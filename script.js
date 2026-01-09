// ===== CONFIGURAÇÃO SUPABASE =====
const SUPABASE_URL = 'https://rgsnmxspyywwouhcdwkj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nHPsCV3y79FgexEMAeANWQ_P6jWRDd1I';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== FUNÇÃO PRINCIPAL =====
async function carregarCardapio() {
    const params = new URLSearchParams(window.location.search);
    const clienteSlug = params.get('u');

    if (!clienteSlug) {
        document.body.innerHTML = `
            <h2 style="text-align:center;margin-top:50px;">
                Cliente não identificado ❌
            </h2>
        `;
        return;
    }

    // Nome da loja
    const nomeFormatado = clienteSlug.replace(/_/g, ' ');
    document.getElementById('nome-loja').innerText = nomeFormatado.toUpperCase();

    // Busca no Supabase
    const { data: produtos, error } = await supabaseClient
        .from('Cardapio')
        .select('*')
        .eq('slug', clienteSlug)
        .order('nome', { ascending: true });

    const container = document.getElementById('cardapio');
    container.innerHTML = '';

    if (error) {
        console.error(error);
        container.innerHTML = `
            <div class="loader">
                Erro ao carregar o cardápio 😕
            </div>
        `;
        return;
    }

    if (!produtos || produtos.length === 0) {
        container.innerHTML = `
            <div class="loader">
                Nenhum produto disponível no momento.
            </div>
        `;
        return;
    }

    // Renderização
    produtos.forEach(item => {
        const card = document.createElement('div');
        card.className = 'produto-card';

        card.innerHTML = `
            <div class="produto-info">
                <h3>${item.nome}</h3>
                <p>${item.descricao || ''}</p>
            </div>
            <div class="preco">
                R$ ${Number(item.preco).toFixed(2)}
            </div>
        `;

        container.appendChild(card);
    });
}

carregarCardapio();
