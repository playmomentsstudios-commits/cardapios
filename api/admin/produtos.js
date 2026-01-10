// api/admin/produtos.js
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "../_lib/auth.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ALLOWED_ORIGINS = [
  "https://playmomentsstudios-commits.github.io",
  "https://playmomentsstudios-commits.github.io/cafeteria",
  "https://playmomentsstudios-commits.github.io/cafeteria/",
];

function setCors(req, res) {
  const origin = req.headers.origin || "";
  const isVercelPreview = origin.endsWith(".vercel.app");
  const isAllowed =
    ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o)) ||
    isVercelPreview;

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, content-type, x-requested-with"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");

  if (isAllowed) res.setHeader("Access-Control-Allow-Origin", origin);
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.method === "GET") return {};
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

// ===== CRUD: produtos =====
// Table expected: produtos {
//  id, cliente_slug, categoria_id, nome, descricao, preco, imagem_url, ativo, created_at
// }

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json(res, 500, { error: "Missing SUPABASE_URL or SERVICE_ROLE env" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  let body = {};
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: "Invalid JSON body" });
  }

  try {
    if (req.method === "GET") {
      const cliente_slug = (req.query?.cliente_slug || "").toString();
      let q = sbAdmin.from("produtos").select("*").order("id", { ascending: false });

      if (cliente_slug) q = q.eq("cliente_slug", cliente_slug);

      const { data, error } = await q;
      if (error) return json(res, 400, { error: error.message });
      return json(res, 200, { data });
    }

    if (req.method === "POST") {
      const {
        cliente_slug,
        categoria_id,
        nome,
        descricao = null,
        preco,
        imagem_url = null,
        ativo = true,
      } = body;

      if (!cliente_slug || !categoria_id || !nome || preco === undefined) {
        return json(res, 400, {
          error: "cliente_slug, categoria_id, nome e preco são obrigatórios",
        });
      }

      const { data, error } = await sbAdmin
        .from("produtos")
        .insert([
          {
            cliente_slug,
            categoria_id,
            nome,
            descricao,
            preco: Number(preco),
            imagem_url,
            ativo: !!ativo,
          },
        ])
        .select("*")
        .single();

      if (error) return json(res, 400, { error: error.message });
      return json(res, 201, { data });
    }

    if (req.method === "PUT") {
      const {
        id,
        cliente_slug,
        categoria_id,
        nome,
        descricao,
        preco,
        imagem_url,
        ativo,
      } = body;

      if (!id) return json(res, 400, { error: "id é obrigatório" });

      const patch = {};
      if (cliente_slug !== undefined) patch.cliente_slug = cliente_slug;
      if (categoria_id !== undefined) patch.categoria_id = categoria_id;
      if (nome !== undefined) patch.nome = nome;
      if (descricao !== undefined) patch.descricao = descricao || null;
      if (preco !== undefined) patch.preco = Number(preco);
      if (imagem_url !== undefined) patch.imagem_url = imagem_url || null;
      if (ativo !== undefined) patch.ativo = !!ativo;

      const { data, error } = await sbAdmin
        .from("produtos")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();

      if (error) return json(res, 400, { error: error.message });
      return json(res, 200, { data });
    }

    if (req.method === "PATCH") {
      const { action, id } = body;
      if (!action || !id) return json(res, 400, { error: "action e id são obrigatórios" });

      if (action === "toggle") {
        const { data: row, error: e1 } = await sbAdmin
          .from("produtos")
          .select("*")
          .eq("id", id)
          .single();
        if (e1) return json(res, 400, { error: e1.message });

        const { data, error } = await sbAdmin
          .from("produtos")
          .update({ ativo: !row.ativo })
          .eq("id", id)
          .select("*")
          .single();

        if (error) return json(res, 400, { error: error.message });
        return json(res, 200, { data });
      }

      if (action === "duplicate") {
        const { data: row, error: e1 } = await sbAdmin
          .from("produtos")
          .select("*")
          .eq("id", id)
          .single();
        if (e1) return json(res, 400, { error: e1.message });

        const { data, error } = await sbAdmin
          .from("produtos")
          .insert([
            {
              cliente_slug: row.cliente_slug,
              categoria_id: row.categoria_id,
              nome: `${row.nome} (cópia)`,
              descricao: row.descricao,
              preco: row.preco,
              imagem_url: row.imagem_url,
              ativo: row.ativo,
            },
          ])
          .select("*")
          .single();

        if (error) return json(res, 400, { error: error.message });
        return json(res, 201, { data });
      }

      return json(res, 400, { error: "action inválida" });
    }

    if (req.method === "DELETE") {
      const { id } = body;
      if (!id) return json(res, 400, { error: "id é obrigatório" });

      const { error } = await sbAdmin.from("produtos").delete().eq("id", id);
      if (error) return json(res, 400, { error: error.message });
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (e) {
    return json(res, 500, { error: "Server error", details: String(e.message || e) });
  }
}
