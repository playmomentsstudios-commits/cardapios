const supabaseUrl = 'https://rgsnmxspyywwouhcdwkj.supabase.co';
const supabaseKey = 'SUA_KEY_PUBLICA';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let carrinho = [];
let clienteAtual = null;

// ===== INIT =====
(async function init() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('u') || 'cafeteria';

  const { data: cliente } = await supabaseClient
    .from('clientes')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!cliente) {
    document.body.innerHTML = 'Cliente não encontrado';
    return;
  }

  clienteAtual = cliente;
  document.getElementById('nome-loja').innerText = cliente.nome;

  carregarCardapio(slug);
})();

// ===== CARDÁPIO =====
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

  categorias.forEach(cat => {
    const div = document.createElement('div');
    div.className = 'categoria';
    div.innerHTML = `<h2>${cat.nome}</h2>`;

    produtos
      .filter(p => p.categoria_id === cat.id)
      .forEach(p => {
        div.innerHTML += `
          <div class="produto">
            <img src="${p.imagem}">
            <div>
              <strong>${p.nome}</strong>
              <p>${p.descricao || ''}</p>
              <p>R$ ${p.preco.toFixed(2)}</p>
              <button onclick='addCarrinho("${p.nome}", ${p.preco})'>Adicionar</button>
            </div>
          </div>
        `;
      });

    container.appendChild(div);
  });
}

// ===== CARRINHO =====
function addCarrinho(nome, preco) {
  carrinho.push({ nome, preco });
  atualizarTotal();
}

function atualizarTotal() {
  const total = carrinho.reduce((s, i) => s + i.preco, 0);
  document.getElementById('total').innerText =
    'R$ ' + total.toFixed(2);
}

// ===== WHATSAPP =====
function finalizarPedido() {
  let msg = `Pedido - ${clienteAtual.nome}%0A%0A`;
  carrinho.forEach(i => msg += `• ${i.nome} - R$ ${i.preco}%0A`);

  const total = carrinho.reduce((s, i) => s + i.preco, 0);
  msg += `%0ATotal: R$ ${total.toFixed(2)}`;

  window.open(
    `https://wa.me/55${clienteAtual.whatsapp}?text=${msg}`,
    '_blank'
  );
}
