// api/admin/clientes.js
import { requireAdmin } from "../_lib/auth.js";
import { supabaseAdmin } from "../_lib/supabaseAdmin.js";

const ALLOWED_ORIGINS = [
  "https://playmomentsstudios-commits.github.io",
  "http://localhost:3000",
  "http://localhost:5173",
];

function setCors(req, res) {
  const origin = req.headers.origin || "";
  const isVercel = origin.endsWith(".vercel.app");
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || isVercel;

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, content-type, x-requested-with"
  );

  if (isAllowed) res.setHeader("Access-Control-Allow-Origin", origin);
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.method === "GET" || req.method === "DELETE") return {};
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({ __invalidJson: true });
      }
    });
  });
}

function getQuery(req) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  return Object.fromEntries(url.searchParams.entries());
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  // 🔐 Auth (Bearer token do Supabase + allowlist ADMIN_EMAILS)
  const auth = await requireAdmin(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  const sb = supabaseAdmin();
  const q = getQuery(req);
  const body = await readBody(req);

  if (body.__invalidJson) return json(res, 400, { error: "Invalid JSON body" });

  try {
    // ===== LISTAR =====
    if (req.method === "GET") {
      const search = (q.search || "").trim();

      let query = sb.from("clientes").select("*").order("created_at", { ascending: false });

      if (search) {
        // busca por nome ou slug
        query = query.or(`nome.ilike.%${search}%,slug.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) return json(res, 400, { error: error.message });

      return json(res, 200, { data });
    }

    // ===== CRIAR =====
    if (req.method === "POST") {
      const { nome, slug, whatsapp = "", ativo = true } = body;

      if (!nome || !slug) {
        return json(res, 400, { error: "Campos obrigatórios: nome, slug" });
      }

      const payload = {
        nome: String(nome).trim(),
        slug: String(slug).trim(),
        whatsapp: String(whatsapp).trim(),
        ativo: Boolean(ativo),
      };

      const { data, error } = await sb.from("clientes").insert(payload).select("*").single();
      if (error) return json(res, 400, { error: error.message });

      return json(res, 201, { data });
    }

    // ===== ATUALIZAR =====
    if (req.method === "PATCH") {
      const { id, nome, slug, whatsapp, ativo } = body;
      if (!id) return json(res, 400, { error: "id é obrigatório para atualizar" });

      const patch = {};
      if (nome !== undefined) patch.nome = String(nome).trim();
      if (slug !== undefined) patch.slug = String(slug).trim();
      if (whatsapp !== undefined) patch.whatsapp = String(whatsapp).trim();
      if (ativo !== undefined) patch.ativo = Boolean(ativo);

      const { data, error } = await sb
        .from("clientes")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();

      if (error) return json(res, 400, { error: error.message });
      return json(res, 200, { data });
    }

    // ===== EXCLUIR =====
    if (req.method === "DELETE") {
      const { id } = q;
      if (!id) return json(res, 400, { error: "Passe ?id= no querystring" });

      const { error } = await sb.from("clientes").delete().eq("id", id);
      if (error) return json(res, 400, { error: error.message });

      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (e) {
    return json(res, 500, { error: e?.message || "Server error" });
  }
}
