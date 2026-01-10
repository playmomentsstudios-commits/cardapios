// api/admin/clientes.js
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "../_lib/auth.js";

/**
 * ENV obrigatórias na Vercel:
 * - SUPABASE_URL=https://rgsnmxspyywwouhcdwkj.supabase.co
 * - SUPABASE_SERVICE_ROLE_KEY=xxxxx (NUNCA no front)
 *
 * ENV opcional (RECOMENDADO):
 * - ADMIN_EMAILS=playmomentsstudios@gmail.com,outro@email.com
 */

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

// ===== CRUD: clientes =====
// Table expected: clientes { id, nome, slug, whatsapp, ativo, created_at }

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
      // list
      const { data, error } = await sbAdmin
        .from("clientes")
        .select("*")
        .order("id", { ascending: false });

      if (error) return json(res, 400, { error: error.message });
      return json(res, 200, { data });
    }

    if (req.method === "POST") {
      // create
      const { nome, slug, whatsapp, ativo = true } = body;
      if (!nome || !slug) return json(res, 400, { error: "nome e slug são obrigatórios" });

      const { data, error } = await sbAdmin
        .from("clientes")
        .insert([{ nome, slug, whatsapp: whatsapp || null, ativo }])
        .select("*")
        .single();

      if (error) return json(res, 400, { error: error.message });
      return json(res, 201, { data });
    }

    if (req.method === "PUT") {
      // update
      const { id, nome, slug, whatsapp, ativo } = body;
      if (!id) return json(res, 400, { error: "id é obrigatório" });

      const patch = {};
      if (nome !== undefined) patch.nome = nome;
      if (slug !== undefined) patch.slug = slug;
      if (whatsapp !== undefined) patch.whatsapp = whatsapp || null;
      if (ativo !== undefined) patch.ativo = !!ativo;

      const { data, error } = await sbAdmin
        .from("clientes")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();

      if (error) return json(res, 400, { error: error.message });
      return json(res, 200, { data });
    }

    if (req.method === "PATCH") {
      // actions: toggle | duplicate
      const { action, id } = body;
      if (!action || !id) return json(res, 400, { error: "action e id são obrigatórios" });

      if (action === "toggle") {
        const { data: row, error: e1 } = await sbAdmin
          .from("clientes")
          .select("*")
          .eq("id", id)
          .single();
        if (e1) return json(res, 400, { error: e1.message });

        const { data, error } = await sbAdmin
          .from("clientes")
          .update({ ativo: !row.ativo })
          .eq("id", id)
          .select("*")
          .single();

        if (error) return json(res, 400, { error: error.message });
        return json(res, 200, { data });
      }

      if (action === "duplicate") {
        const { data: row, error: e1 } = await sbAdmin
          .from("clientes")
          .select("*")
          .eq("id", id)
          .single();
        if (e1) return json(res, 400, { error: e1.message });

        // slug novo pra não bater unique (se existir)
        const newSlug = `${row.slug}-copia-${Date.now()}`;

        const { data, error } = await sbAdmin
          .from("clientes")
          .insert([
            {
              nome: `${row.nome} (cópia)`,
              slug: newSlug,
              whatsapp: row.whatsapp,
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

      // opcional: deletar dependências manualmente se não tiver FK cascade
      // await sbAdmin.from("produtos").delete().eq("cliente_slug", slugDoCliente)
      // await sbAdmin.from("categorias").delete().eq("cliente_slug", slugDoCliente)

      const { error } = await sbAdmin.from("clientes").delete().eq("id", id);
      if (error) return json(res, 400, { error: error.message });
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (e) {
    return json(res, 500, { error: "Server error", details: String(e.message || e) });
  }
}
