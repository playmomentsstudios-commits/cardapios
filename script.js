// ===============================
// CONFIGURAÇÃO SUPABASE (CORRIGIDA)
// ===============================
const SUPABASE_URL = 'https://rgsnmxspyywwouhcdwkj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nHPsCV3y79FgexEMAeANWQ_P6jWRDd1';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===============================
// VARIÁVEIS GLOBAIS
// ===============================
let clienteAtual = null;
let carrinho = [];

// ===============================
// INIT
// ===============================
document.addEventListener('DOMContentLoaded', init);

async function init() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('u') || 'cafeteria'; // fallback seguro

  try {
    await carregarCliente(slug);
    await carregarCardapio(slug);
  } catch (e) {
    // já tratado na UI
    console.error(e);
  }
}

// ===============================
// UTIL
// ===============================
function brl(v) {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

// ===============================
// CLIENTE
// ===============================
async function carregarCliente(slug) {
  const { data, error } = await supabaseClient
    .from('clientes')
    .select('*')
    .eq('slug', slug)
    .limit(1);

  if (error || !data || data.length === 0) {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:70vh;padding:20px;">
        <div style="max-width:720px;width:100%;background:#fff;border-radius:10px;padding:24px;border:1px solid #eee;">
          <h2 style="margin:0 0 10px 0;color:#b00020;">Loja não encontrada</h2>
          <p style="margin:0 0 14px 0;color:#444;">
            Não existe nenhuma loja com o slug:
            <b style="font-family:monospace;">${slug}</b>
          </p>
          <p style="margin:0;color:#666;font-size:14px;">
            Dica: abra assim: <b>?u=seu-slug</b><br/>
            Ex: <b>?u=cafeteria</b>
          </p>
        </div>
      </div>
    `;
    throw new Error('Cliente não encontrado');
  }

  clienteAtual = data[0];

  const elNome = document.getElementById('nome-loja');
  if (elNome) elNome.innerText = clienteAtual.nome;
}

// ===============================
// CARDÁPIO
// ===============================
async function carregarCardapio(slug) {
  const { data: categorias, error: errCat } = await supabaseClient
    .from('categorias')
    .select('*')
    .eq('cliente_slug', slug)
    .eq('ativo', true)
    .order('ordem');

  const { data: produtos, error: errProd } = await supabaseClient
    .from('produtos')
    .select('*')
    .eq('cliente_slug', slug)
    .eq('ativo', true);

  if (errCat) console.error('Erro categorias:', errCat);
  if (errProd) console.error('Erro produtos:', errProd);

  const container = document.getElementById('conteudo');
  if (!container) return;

  container.innerHTML = '';

  if (!categorias || categorias.length === 0) {
    container.innerHTML = '<p style="padding:16px;">Nenhuma categoria cadastrada.</p>';
    return;
  }

  categorias.forEach(cat => {
    const itens = (produtos || []).filter(p => p.categoria_id === cat.id);

    // se quiser esconder categoria vazia, descomente:
    // if (itens.length === 0) return;

    const div = document.createElement('div');
    div.className = 'categoria';
    div.innerHTML = `<h2>${cat.nome}</h2>`;

    if (itens.length === 0) {
      div.innerHTML += `<p style="opacity:.7;margin:0 0 10px 0;">Sem itens nesta categoria.</p>`;
    }

    itens.forEach(p => {
      const img = p.imagem || 'https://via.placeholder.com/80';

      div.innerHTML += `
        <div class="produto">
          <img src="${img}" alt="${p.nome}">
          <div>
            <strong>${p.nome}</strong>
            <p>${p.descricao || ''}</p>
            <p><b>${brl(p.preco)}</b></p>
            <button onclick="addCarrinho('${escapeQuotes(p.nome)}', ${Number(p.preco)})">
              Adicionar
            </button>
          </div>
        </div>
      `;
    });

    container.appendChild(div);
  });
}

function escapeQuotes(str) {
  return String(str || '').replace(/'/g, "\\'");
}

// ===============================
// CARRINHO
// ===============================
function addCarrinho(nome, preco) {
  carrinho.push({ nome, preco: Number(preco) || 0 });
  atualizarTotal();
}

function atualizarTotal() {
  const total = carrinho.reduce((s, i) => s + (Number(i.preco) || 0), 0);
  const elTotal = document.getElementById('total');
  if (elTotal) elTotal.innerText = brl(total);
}

// ===============================
// WHATSAPP
// ===============================
function finalizarPedido() {
  if (!clienteAtual || carrinho.length === 0) {
    alert('Carrinho vazio');
    return;
  }

  let msg = `Pedido - ${clienteAtual.nome}%0A%0A`;
  carrinho.forEach(i => {
    msg += `• ${encodeURIComponent(i.nome)} - ${encodeURIComponent(brl(i.preco))}%0A`;
  });

  const total = carrinho.reduce((s, i) => s + (Number(i.preco) || 0), 0);
  msg += `%0ATotal: ${encodeURIComponent(brl(total))}`;

  window.open(`https://wa.me/55${clienteAtual.whatsapp}?text=${msg}`, '_blank');
}
