// Builds Shopify-like Liquid objects from data/store.json (fetched from the public storefront).
const fs = require('fs');
const path = require('path');
const THEME = path.join(__dirname, '..', 'shopify-theme');
const store = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'store.json'), 'utf8'));

// Real collection sizes from /collections.json (the preview only holds the first 24 of each).
const REAL_COUNTS = { 'lancamentos-1': 28, espiritualidade: 283, 'exclusivo-do-site': 46, biblia: 256, 'biblias-de-estudos': 20, ficcao: 111, devocional: 54, infantil: 74 };
const DESCRIPTIONS = {
  biblia: 'NVI, ACF, NTLH e A21 em letra tradicional, grande e gigante. Bíblias de estudo, devocionais, para journaling e para presentear.',
  'lancamentos-1': 'Os livros e Bíblias que acabaram de chegar à nossa estante.',
  ficcao: 'Romances, fantasia e ficção histórica com a fé no centro da história.',
  infantil: 'Livros ilustrados para ensinar fé, perdão e amizade às crianças.',
  devocional: 'Leituras curtas para começar o dia com a Palavra.',
  espiritualidade: 'Vida cristã, oração, emoções e relacionamentos.',
  'exclusivo-do-site': 'Edições e kits que você só encontra aqui.',
  'biblias-de-estudos': 'Notas, mapas, introduções e referências para ir mais fundo.'
};

// ---------- products ----------
const products = {};
for (const raw of Object.values(store.products)) {
  const images = raw.images.map(src => ({ src: '../data/' + src }));
  const variants = raw.variants.map(v => ({
    id: v.id, title: v.title, price: v.price, compare_at_price: v.compare_at_price, available: v.available !== false,
    sku: v.sku, options: [v.title], url: `/products/${raw.handle}?variant=${v.id}`
  }));
  const hasOnlyDefault = variants.length === 1 && variants[0].title === 'Default Title';
  const first = variants.find(v => v.available) || variants[0];
  const prices = variants.map(v => v.price);
  const cmp = variants.map(v => v.compare_at_price || 0);
  products[raw.handle] = {
    id: raw.variants[0].id, handle: raw.handle, title: raw.title, vendor: raw.vendor, type: raw.type,
    url: `/products/${raw.handle}`, tags: raw.tags, images, featured_image: images[0] || null,
    description: '<p>' + (raw.description || '').replace(/\s{2,}/g, '</p><p>') + '</p>',
    price: Math.min(...prices), compare_at_price: Math.max(...cmp) || null, available: variants.some(v => v.available),
    variants, selected_or_first_available_variant: first, has_only_default_variant: hasOnlyDefault,
    options_with_values: hasOnlyDefault ? [] : [{ name: 'Acabamento', values: variants.map(v => v.title), selected_value: first.title }],
    metafields: { book: { pages: 160 + (raw.handle.length * 7) % 400, release_date: '2026-10-15' } },
    collections: []
  };
}
// tag a few products so the badges show
for (const h of store.collections['lancamentos-1'].products.slice(0, 8)) products[h] && products[h].tags.push('lancamento');
for (const h of store.collections['exclusivo-do-site'].products.slice(0, 12)) products[h] && products[h].tags.push('exclusivo');

// ---------- filters ----------
function buildFilters(list, baseUrl) {
  const count = fn => { const m = new Map(); list.forEach(p => [].concat(fn(p)).forEach(v => m.set(v, (m.get(v) || 0) + 1))); return [...m].sort((a, b) => b[1] - a[1]); };
  const mk = (label, param, entries, activeFirst) => {
    const values = entries.slice(0, 8).map(([v, c], i) => ({ label: v, value: v, count: c, param_name: param, active: activeFirst && i === 0, url_to_remove: baseUrl }));
    return { label, type: 'list', values, active_values: values.filter(v => v.active) };
  };
  const max = Math.max(...list.map(p => p.price), 0);
  return [
    mk('Disponibilidade', 'filter.v.availability', [['Em estoque', list.filter(p => p.available).length], ['Esgotado', list.filter(p => !p.available).length]]),
    { label: 'Preço', type: 'price_range', range_max: max, min_value: { param_name: 'filter.v.price.gte', value: null }, max_value: { param_name: 'filter.v.price.lte', value: null }, active_values: [] },
    mk('Acabamento', 'filter.v.option.acabamento', count(p => p.variants.map(v => v.title).filter(t => t !== 'Default Title'))),
    mk('Autor', 'filter.p.vendor', count(p => p.vendor)),
    mk('Tipo', 'filter.p.product_type', count(p => p.type || 'Livro'))
  ].filter(f => f.type === 'price_range' || f.values.length);
}
const SORT_OPTIONS = [
  { value: 'manual', name: 'Em destaque' }, { value: 'best-selling', name: 'Mais vendidos' },
  { value: 'created-descending', name: 'Mais recentes' }, { value: 'price-ascending', name: 'Menor preço' },
  { value: 'price-descending', name: 'Maior preço' }, { value: 'title-ascending', name: 'A-Z' }
];

// ---------- collections ----------
const collectionList = Object.values(store.collections).map(c => {
  const list = c.products.map(h => products[h]).filter(Boolean);
  list.forEach(p => p.collections.push(c.handle));
  return {
    handle: c.handle, title: c.title, url: `/collections/${c.handle}`, products: list,
    products_count: REAL_COUNTS[c.handle] || list.length, all_products_count: REAL_COUNTS[c.handle] || list.length,
    description: DESCRIPTIONS[c.handle] ? `<p>${DESCRIPTIONS[c.handle]}</p>` : '', image: null,
    filters: buildFilters(list, `/collections/${c.handle}`), sort_options: SORT_OPTIONS, sort_by: 'manual', default_sort_by: 'manual', all_tags: []
  };
});
const collections = Object.assign([...collectionList], Object.fromEntries(collectionList.map(c => [c.handle, c])));
collections['colecao-c-s-lewis'] = { ...collections.espiritualidade, handle: 'colecao-c-s-lewis', title: 'Coleção C. S. Lewis', products: Object.values(products).filter(p => p.vendor === 'C. S. Lewis') };

// ---------- menus ----------
const L = (title, url, links = []) => ({ title, url, links, active: false });
const linklists = {
  'main-menu': { title: 'Menu principal', links: [
    L('Livros', '/collections/espiritualidade', [
      L('Categorias', '/collections/espiritualidade', [L('Devocionais', '/collections/devocional'), L('Ficção cristã', '/collections/ficcao'), L('Infantil', '/collections/infantil'), L('Infantojuvenil', '/collections/infantojuvenil'), L('Espiritualidade', '/collections/espiritualidade'), L('Família', '/collections/familia')]),
      L('Coleções', '/collections', [L('C. S. Lewis', '/collections/colecao-c-s-lewis'), L('Reforma Protestante', '/collections/colecao-reforma-protestante'), L('Teologia para todos', '/collections/colecao-teologia-para-todos'), L('Bible Journaling', '/collections/bible-journaling')]),
      L('Formatos', '/collections', [L('E-books', '/collections/e-books'), L('Audiolivros', '/collections/audio-livros'), L('Capa dura', '/collections/capa-dura')])
    ]),
    L('Bíblias', '/collections/biblia', [
      L('Traduções', '/collections/biblia', [L('NVI', '/collections/biblia/nvi'), L('ACF', '/collections/almeida-corrigida-fiel-acf'), L('NTLH', '/collections/biblia-ntlh-1'), L('A21', '/collections/biblia-a21-1')]),
      L('Tipos', '/collections/biblia', [L('Bíblias de estudo', '/collections/biblias-de-estudos'), L('Temáticas', '/collections/biblias-tematicas'), L('Infantojuvenis', '/collections/biblias-infantojuvenis'), L('Bilíngue', '/collections/biblia-bilingue'), L('Slim', '/collections/biblia-slim')]),
      L('Tamanho da letra', '/collections/biblia', [L('Tradicional', '/collections/biblia-letra-tradicional'), L('Grande', '/collections/letra-grande'), L('Gigante', '/collections/letra-gigante'), L('Sênior', '/collections/biblia-letra-senior-1')])
    ]),
    L('Lançamentos', '/collections/lancamentos-1'),
    L('Exclusivos', '/collections/exclusivo-do-site'),
    L('Encontre sua Bíblia', '/pages/encontre-sua-biblia'),
    L('Sobre', '/pages/sobre', [L('Institucional', '/pages/sobre', [L('Sobre nós', '/pages/sobre'), L('Blog', '/blogs/news'), L('Contato', '/pages/contato')])]),
    L('HarperCollins Brasil', 'https://harpercollins.com.br')
  ] },
  'footer-institucional': { title: 'Institucional', links: [L('Sobre nós', '/pages/sobre'), L('HarperCollins Brasil', 'https://harpercollins.com.br'), L('Grupo de leitura', '/pages/sobre'), L('Vendas e direitos', '/pages/contato'), L('Blog', '/blogs/news')] },
  'footer-ajuda': { title: 'Ajuda', links: [L('Contato', '/pages/contato'), L('Dúvidas frequentes', '/pages/sobre'), L('Trocas e devoluções', '/pages/sobre'), L('Política de privacidade', '/pages/sobre'), L('Termos de uso', '/pages/sobre')] },
  'footer-categorias': { title: 'Categorias', links: [L('Bíblias', '/collections/biblia'), L('Devocionais', '/collections/devocional'), L('Ficção cristã', '/collections/ficcao'), L('Infantil', '/collections/infantil'), L('Lançamentos', '/collections/lancamentos-1')] }
};

// ---------- settings ----------
const schema = JSON.parse(fs.readFileSync(path.join(THEME, 'config', 'settings_schema.json'), 'utf8'));
const settings = {};
schema.forEach(g => (g.settings || []).forEach(s => { if (s.id) settings[s.id] = s.default ?? null; }));
Object.assign(settings, JSON.parse(fs.readFileSync(path.join(THEME, 'config', 'settings_data.json'), 'utf8')).current);

// ---------- cart / customer / search / blog ----------
const pick = hs => hs.map(h => products[h]).filter(Boolean);
const cartItems = pick([store.collections.biblia.products[0], store.collections.ficcao.products[2], store.collections.infantil.products[0]]).map((p, i) => {
  const v = p.selected_or_first_available_variant, q = i === 1 ? 2 : 1;
  return { key: 'k' + i, product: p, variant: v, title: p.title, vendor: p.vendor, image: p.featured_image, url: p.url, quantity: q, final_price: v.price, final_line_price: v.price * q, url_to_remove: '/cart/change?line=' + (i + 1) + '&quantity=0' };
});
const cart = { items: cartItems, item_count: cartItems.reduce((a, b) => a + b.quantity, 0), total_price: cartItems.reduce((a, b) => a + b.final_line_price, 0), note: '', currency: { iso_code: 'BRL' } };
const emptyCart = { items: [], item_count: 0, total_price: 0, note: '', currency: { iso_code: 'BRL' } };

function search(terms) {
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const res = Object.values(products).filter(p => norm(p.title).includes(norm(terms))).map(p => ({ ...p, object_type: 'product' }));
  return { performed: true, terms, results: res.slice(0, 24), results_count: res.length, filters: res.length ? buildFilters(res, '/search') : [], url: '/search' };
}

const banners = ['assets/tn-banner-hero-biblias.jpg', 'assets/tn-banner-promo-devocionais.jpg', 'assets/tn-banner-hero-ficcao.jpg', 'assets/tn-banner-promo-cs-lewis.jpg', 'assets/tn-banner-hero-infantil.jpg', 'assets/tn-banner-promo-estudo.jpg'];
const posts = [
  ['Como escolher a Bíblia certa para você', 'Guias', 'NVI ou ACF? Letra grande ou tradicional? Um guia simples para acertar na escolha da sua próxima Bíblia.'],
  ['5 devocionais para começar o ano com a Palavra', 'Devocionais', 'Separamos devocionais curtos e profundos para criar o hábito de ler a Bíblia todos os dias.'],
  ['Bible journaling: por onde começar', 'Bible journaling', 'Materiais, ideias e Bíblias com espaço para anotações para quem quer registrar o que aprende.'],
  ['C. S. Lewis para quem nunca leu C. S. Lewis', 'Autores', 'De Cristianismo puro e simples a As Crônicas de Nárnia: uma ordem de leitura para começar.'],
  ['Livros infantis que ensinam perdão', 'Infantil', 'Histórias ilustradas para conversar com as crianças sobre amizade, perdão e reconciliação.'],
  ['Ficção cristã: 6 lançamentos que valem a leitura', 'Ficção', 'Romances, fantasia e ficção histórica que chegaram à estante nos últimos meses.']
];
const articles = posts.map(([title, tag, excerpt], i) => ({
  title, url: '/blogs/news/' + i, author: 'Equipe Thomas Nelson Brasil', tags: [tag], published_at: `2026-11-${String(20 - i * 3).padStart(2, '0')}`,
  image: { src: banners[i] }, excerpt_or_content: excerpt,
  content: `<p>${excerpt}</p><p>Este é um texto de exemplo para o preview do tema. No Shopify, o conteúdo vem do artigo cadastrado em Loja virtual › Posts do blog.</p><h2>Comece pelo básico</h2><p>Escolha um horário fixo, um lugar tranquilo e um plano de leitura realista. Pequenos passos todos os dias fazem mais diferença do que grandes metas que não se sustentam.</p><blockquote>“Lâmpada para os meus pés é a tua palavra, e luz para o meu caminho.” Salmos 119:105</blockquote><p>Depois, vá ajustando: anote o que aprendeu, compartilhe com alguém e volte aos textos que marcaram você.</p>`
}));
const blog = { title: 'Blog Thomas Nelson Brasil', url: '/blogs/news', articles, all_tags: [...new Set(posts.map(p => p[1]))] };

const customer = {
  first_name: 'Ana', email: 'ana@exemplo.com',
  orders: [
    { name: '#10482', customer_url: '#', created_at: '2026-11-18', financial_status_label: 'Pago', fulfillment_status_label: 'Enviado', total_price: 32970 },
    { name: '#10217', customer_url: '#', created_at: '2026-10-02', financial_status_label: 'Pago', fulfillment_status_label: 'Entregue', total_price: 8990 },
    { name: '#09876', customer_url: '#', created_at: '2026-08-21', financial_status_label: 'Pago', fulfillment_status_label: 'Entregue', total_price: 15480 }
  ],
  default_address: { name: 'Ana Souza', address1: 'Rua das Flores, 123', city: 'São Paulo', province_code: 'SP', zip: '01000-000' }
};

const pages = {
  sobre: { title: 'Sobre a Thomas Nelson Brasil', content: '<p>A Thomas Nelson é uma das editoras cristãs mais tradicionais do mundo, com mais de 200 anos de história publicando Bíblias e livros que inspiram gerações.</p><p>No Brasil, faz parte da HarperCollins Brasil e publica Bíblias em diversas traduções, devocionais, ficção cristã, teologia e livros infantis.</p><h2>Nossa missão</h2><p>Inspirar o mundo com conteúdo que aproxima as pessoas de Deus, com edições cuidadosas e acessíveis.</p>' },
  contato: { title: 'Fale com a gente', content: '<p>Dúvidas sobre pedidos, trocas, vendas corporativas ou direitos? Envie uma mensagem e respondemos em até 1 dia útil.</p>' },
  finder: { title: 'Como funciona o Encontre sua Bíblia', content: '<p>Cada Bíblia do catálogo é marcada com tradução, tipo de uso, tamanho da letra e tipo de capa. Ao responder as perguntas, mostramos só as edições que combinam com você.</p>' }
};

const routeMap = {
  '/': 'index.html', '/cart': 'cart.html', '/account': 'account.html', '/account/login': 'login.html', '/account/register': 'register.html',
  '/account/logout': 'index.html', '/account/addresses': 'account.html', '/collections': 'collections.html', '/collections/all': 'collection-lancamentos-1.html',
  '/pages/encontre-sua-biblia': 'bible-finder.html', '/pages/sobre': 'page.html', '/pages/contato': 'contact.html', '/blogs/news': 'blog.html', '/search': 'search.html'
};
for (let i = 0; i < 6; i++) routeMap['/blogs/news/' + i] = 'article.html';

module.exports = {
  products, collections, collectionList, linklists, cart, emptyCart, customer, blog, pages, search, routeMap,
  sampleProduct: products[store.collections.biblia.products[0]],
  recommendationsFor: p => {
    const pool = (p.collections[0] && collections[p.collections[0]].products) || [];
    const list = pool.filter(x => x !== p).concat(Object.values(products).filter(x => x !== p)).slice(0, 10);
    return { 'performed?': true, performed: true, products: list, products_count: list.length };
  },
  globals: {
    settings, linklists, collections, shop: { name: 'Thomas Nelson Brasil', url: 'https://thomasnelson.com.br' },
    routes: { root_url: '/', cart_url: '/cart', account_url: '/account', account_login_url: '/account/login', account_register_url: '/account/register', account_logout_url: '/account/logout', account_addresses_url: '/account/addresses', search_url: '/search', collections_url: '/collections', all_products_collection_url: '/collections/all', product_recommendations_url: '#' },
    cart: emptyCart, customer: null, request: { locale: { iso_code: 'pt-BR' } }, canonical_url: 'https://thomasnelson.com.br', current_page: 1, search: { terms: '' }
  }
};
