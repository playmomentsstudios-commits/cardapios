// ===============================
// CONFIGURAÇÃO SUPABASE
// ===============================
const SUPABASE_URL = 'https://rgsnmxspyywwouhcdwkj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nHPsCV3y79FgexEMAeANWQ_P6jWRDd1';

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

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

  await carregarCliente(slug);
  await carregarCardapio(slug);
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
      <h2 style="text-align:center;margin-top:50px">
        Cliente não encontrado ❌<br>
        <small>Slug: ${slug}</small>
      </h2>
    `;
    throw new Error('Cliente não encontrado');
  }

  clienteAtual = data[0];
  document.getElementById('nome-loja').innerText = clienteAtual.nome;
}

// ===============================
// CARDÁPIO
// ===============================
async function carregarCardapio(slug) {
  const { data: categorias } = await supabaseClient
    .from('categorias')
    .select('*')
    .eq('cliente_slug', slug)
    .order('ordem');

  const { data: produtos } = await supabaseClient
    .from('produtos')
    .select('*')
    .eq('cliente_slug', slug)
    .eq('ativo', true);

  const container = document.getElementById('conteudo');
  container.innerHTML = '';

  if (!categorias || categorias.length === 0) {
    container.innerHTML = '<p>Nenhuma categoria cadastrada.</p>';
    return;
  }

  categorias.forEach(cat => {
    const div = document.createElement('div');
    div.className = 'categoria';
    div.innerHTML = `<h2>${cat.nome}</h2>`;

    produtos
      .filter(p => p.categoria_id === cat.id)
      .forEach(p => {
        div.innerHTML += `
          <div class="produto">
            <img src="${p.imagem || 'https://via.placeholder.com/80'}">
            <div>
              <strong>${p.nome}</strong>
              <p>${p.descricao || ''}</p>
              <p><b>R$ ${Number(p.preco).toFixed(2)}</b></p>
              <button onclick="addCarrinho('${p.nome}', ${p.preco})">
                Adicionar
              </button>
            </div>
          </div>
        `;
      });

    container.appendChild(div);
  });
}

// ===============================
// CARRINHO
// ===============================
function addCarrinho(nome, preco) {
  carrinho.push({ nome, preco });
  atualizarTotal();
}

function atualizarTotal() {
  const total = carrinho.reduce((s, i) => s + i.preco, 0);
  document.getElementById('total').innerText =
    'R$ ' + total.toFixed(2);
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
    msg += `• ${i.nome} - R$ ${i.preco.toFixed(2)}%0A`;
  });

  const total = carrinho.reduce((s, i) => s + i.preco, 0);
  msg += `%0ATotal: R$ ${total.toFixed(2)}`;

  window.open(
    `https://wa.me/55${clienteAtual.whatsapp}?text=${msg}`,
    '_blank'
  );
}
