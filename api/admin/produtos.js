import { createClient } from "@supabase/supabase-js";
import { requireAdmin, setCors, json, readBody } from "../_lib/auth.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json(res, 500, { error: "Missing SUPABASE_URL or SERVICE_ROLE env" });
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) return json(res, auth.status, { error: auth.error });

  try {
    // LISTAR
    if (req.method === "GET") {
      const { data, error } = await sbAdmin
        .from("produtos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) return json(res, 400, { error: error.message });
      return json(res, 200, { data });
    }

    const body = await readBody(req);

    // CRIAR
    if (req.method === "POST") {
      const payload = {
        cliente_slug: body.cliente_slug,
        categoria_id: body.categoria_id,
        nome: body.nome,
        descricao: body.descricao || null,
        preco: Number(body.preco || 0),
        imagem_url: body.imagem_url || null,
        ativo: body.ativo !== false,
      };

      const { data, error } = await sbAdmin
        .from("produtos")
        .insert(payload)
        .select("*")
        .single();

      if (error) return json(res, 400, { error: error.message });
      return json(res, 200, { data });
    }

    // ATUALIZAR
    if (req.method === "PATCH" || req.method === "PUT") {
      const id = body.id;
      if (!id) return json(res, 400, { error: "id obrigatório" });

      const patch = {};
      if (body.nome != null) patch.nome = body.nome;
      if (body.descricao != null) patch.descricao = body.descricao || null;
      if (body.preco != null) patch.preco = Number(body.preco || 0);
      if (body.imagem_url != null) patch.imagem_url = body.imagem_url || null;
      if (body.categoria_id != null) patch.categoria_id = body.categoria_id;
      if (body.ativo != null) patch.ativo = !!body.ativo;

      const { data, error } = await sbAdmin
        .from("produtos")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();

      if (error) return json(res, 400, { error: error.message });
      return json(res, 200, { data });
    }

    // EXCLUIR
    if (req.method === "DELETE") {
      const id = req.query?.id;
      if (!id) return json(res, 400, { error: "id obrigatório" });

      const { error } = await sbAdmin.from("produtos").delete().eq("id", id);
      if (error) return json(res, 400, { error: error.message });

      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: "Method not allowed" });
  } catch (e) {
    return json(res, 500, { error: String(e?.message || e) });
  }
}
