import { createClient } from "@supabase/supabase-js";

const allowOrigins = [
  "https://playmomentsstudios-commits.github.io",
  "https://playmomentsstudios-commits.github.io/cafeteria",
  "http://localhost:3000",
  "http://localhost:5173",
];

function getOrigin(req) {
  return req.headers.origin || "";
}

function setCors(req, res) {
  const origin = getOrigin(req);
  const allowed = allowOrigins.includes(origin) ? origin : allowOrigins[0];
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function requireBearer(req) {
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Protege seu endpoint (você já usou isso antes)
  const token = requireBearer(req);
  if (!token) return res.status(401).json({ error: "Missing Bearer token" });
  if (token !== process.env.ADMIN_BEARER_TOKEN) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env" });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const {
      // cliente
      nome,
      slug,
      whatsapp,
      logo_url,
      ativo = true,

      // acesso
      email,
      senha,
      role = "owner",
    } = body || {};

    if (!nome || !slug) {
      return res.status(400).json({ error: "nome e slug são obrigatórios" });
    }

    if (!email || !senha) {
      return res.status(400).json({ error: "email e senha são obrigatórios para criar o acesso" });
    }

    // 1) Cria usuário no Auth (ou detecta se já existe)
    // tenta criar:
    let userId = null;
    const { data: created, error: eCreate } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });

    if (eCreate) {
      // Se já existe, vamos buscar por email (listUsers)
      // Observação: listUsers pode vir paginado; aqui resolve 99% dos casos.
      const { data: list, error: eList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (eList) return res.status(400).json({ error: `Erro criando usuário: ${eCreate.message}; e erro listando usuários: ${eList.message}` });

      const found = (list?.users || []).find(u => (u.email || "").toLowerCase() === String(email).toLowerCase());
      if (!found?.id) return res.status(400).json({ error: `Erro criando usuário: ${eCreate.message}` });

      userId = found.id;
    } else {
      userId = created?.user?.id;
    }

    if (!userId) return res.status(500).json({ error: "Não foi possível obter user_id do Auth" });

    // 2) Cria/atualiza cliente
    const { data: clienteRow, error: eCli } = await admin
      .from("clientes")
      .upsert(
        [{
          nome,
          slug,
          whatsapp: whatsapp || null,
          logo_url: logo_url || null,
          ativo: !!ativo,
        }],
        { onConflict: "slug" }
      )
      .select("*")
      .single();

    if (eCli) return res.status(400).json({ error: eCli.message });

    // 3) Vínculo user ↔ loja
    const { error: eLink } = await admin
      .from("cliente_usuarios")
      .upsert(
        [{
          cliente_slug: slug,
          user_id: userId,
          role,
          ativo: true,
        }],
        { onConflict: "cliente_slug,user_id" }
      );

    if (eLink) return res.status(400).json({ error: eLink.message });

    return res.status(200).json({
      ok: true,
      cliente: clienteRow,
      user_id: userId,
      login_email: email,
      painel_cliente_url: `https://playmomentsstudios-commits.github.io/cafeteria/cliente/`,
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
