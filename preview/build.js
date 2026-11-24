// Local preview for ../shopify-theme using LiquidJS + real catalog data (data/store.json).
// Usage: npm run build   -> static pages in ./dist (open dist/index.html or dist/pages.html)
const fs = require('fs');
const path = require('path');
const { Liquid } = require('liquidjs');
const mock = require('./mock.js');

const THEME = path.join(__dirname, '..', 'shopify-theme');
const DIST = path.join(__dirname, 'dist');
const DATA = path.join(__dirname, 'data');

// ---------- output folder ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
// product images are referenced from ../data/img (not copied, keeps the repo small)
for (const f of fs.readdirSync(path.join(THEME, 'assets'))) fs.copyFileSync(path.join(THEME, 'assets', f), path.join(DIST, 'assets', f));

// ---------- engine ----------
const engine = new Liquid({ root: [path.join(THEME, 'snippets')], extname: '.liquid', jsTruthy: false, strictFilters: true });
const locale = JSON.parse(fs.readFileSync(path.join(THEME, 'locales', 'pt-BR.default.json'), 'utf8'));
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const money = c => 'R$ ' + (Number(c || 0) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
engine.registerFilter('money', money);
engine.registerFilter('t', (key, ...args) => {
  const s = key.split('.').reduce((o, k) => (o ? o[k] : undefined), locale);
  if (typeof s !== 'string') return key;
  const vars = Object.fromEntries(args.filter(Array.isArray));
  return s.replace(/{{\s*(\w+)\s*}}/g, (_, k) => vars[k] ?? '');
});
engine.registerFilter('asset_url', f => 'assets/' + f);
engine.registerFilter('stylesheet_tag', u => `<link rel="stylesheet" href="${u}">`);
engine.registerFilter('image_url', img => (img && (img.src || img)) || '');
engine.registerFilter('image_tag', (src, ...args) => {
  const o = Object.fromEntries(args.filter(Array.isArray));
  const attrs = ['class', 'style', 'loading', 'fetchpriority'].filter(k => o[k]).map(k => `${k}="${esc(o[k])}"`).join(' ');
  return `<img src="${src}" alt="${esc(o.alt)}" ${attrs}>`;
});
engine.registerFilter('placeholder_svg_tag', (_, cls) => `<svg class="${cls || ''}" viewBox="0 0 4 5"><rect width="4" height="5"/></svg>`);
engine.registerFilter('url_for_vendor', v => '/collections/vendors?q=' + encodeURIComponent(v));
engine.registerFilter('default_errors', e => e);
engine.registerFilter('payment_button', () => '<button type="button" class="btn btn--ghost btn--block shopify-payment-button__button">Comprar agora</button>');
engine.registerFilter('handleize', s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
engine.registerFilter('format_address', a => a ? `<p>${a.name}<br>${a.address1}<br>${a.city} - ${a.province_code}<br>${a.zip}</p>` : '');
engine.registerFilter('json', v => JSON.stringify(v));

function blockTag(name, render) {
  engine.registerTag(name, {
    parse(tok, rem) {
      this.args = tok.args;
      this.tpl = [];
      const s = this.liquid.parser.parseStream(rem);
      s.on('tag:end' + name, () => s.stop()).on('template', t => this.tpl.push(t)).on('end', () => { throw new Error(name + ' not closed'); });
      s.start();
    },
    render
  });
}
blockTag('schema', function* () { return ''; });
blockTag('form', function* (ctx, emitter) {
  const type = this.args.split(',')[0].trim().replace(/['"]/g, '');
  const cls = (this.args.match(/class:\s*'([^']+)'/) || [])[1] || '';
  const id = (this.args.match(/id:\s*'([^']+)'/) || [])[1] || '';
  const action = { product: '/cart/add', customer: '/contact#newsletter', contact: '/contact', customer_login: '/account/login', create_customer: '/account' }[type] || '#';
  ctx.push({ form: { 'posted_successfully?': false, errors: null } });
  emitter.write(`<form method="post" action="${action}" class="${cls}" ${id ? `id="${id}"` : ''} data-type="${type}" onsubmit="return window.TN_PREVIEW_SUBMIT(event)">`);
  yield this.liquid.renderer.renderTemplates(this.tpl, ctx, emitter);
  emitter.write('</form>');
  ctx.pop();
});
blockTag('paginate', function* (ctx, emitter) {
  const expr = this.args.split(/\s+by\s+/)[0].trim();
  const target = expr.split('.').reduce((o, k) => (o ? o[k] : undefined), ctx.getAll());
  const count = (target && (target.products_count || target.results_count || target.length)) || 0;
  const pages = Math.max(1, Math.ceil(count / 24));
  const parts = [];
  for (let i = 1; i <= Math.min(pages, 3); i++) parts.push({ title: i, is_link: i !== 1, url: '#' });
  if (pages > 4) parts.push({ title: '…', is_link: false });
  if (pages > 3) parts.push({ title: pages, is_link: true, url: '#' });
  ctx.push({ paginate: { pages, current_page: 1, parts, next: pages > 1 ? { url: '#' } : null, previous: null } });
  yield this.liquid.renderer.renderTemplates(this.tpl, ctx, emitter);
  ctx.pop();
});

// ---------- section rendering ----------
const schemaOf = src => JSON.parse(src.split('{% schema %}')[1].split('{% endschema %}')[0]);
function resolveSetting(def, val) {
  if (def.type === 'collection') return mock.collections[val] || null;
  if (def.type === 'product') return mock.products[val] || null;
  if (def.type === 'image_picker') return val || null;
  if (def.type === 'link_list') return val;
  return val;
}
const settingsFrom = (defs, given = {}) => Object.fromEntries((defs || []).filter(d => d.id).map(d => [d.id, resolveSetting(d, d.id in given ? given[d.id] : d.default)]));

async function renderSection(key, s, globals) {
  const src = fs.readFileSync(path.join(THEME, 'sections', s.type + '.liquid'), 'utf8');
  const schema = schemaOf(src);
  const blocks = (s.block_order || []).map(id => {
    const b = s.blocks[id];
    const def = (schema.blocks || []).find(x => x.type === b.type) || {};
    return { id: `${key}-${id}`, type: b.type, shopify_attributes: '', settings: settingsFrom(def.settings, b.settings) };
  });
  const section = { id: key, settings: settingsFrom(schema.settings, s.settings), blocks };
  const html = await engine.parseAndRender(src, { ...globals, section }, { globals });
  return `<div id="shopify-section-${key}" class="shopify-section ${schema.class || ''}">${html}</div>`;
}
async function renderGroup(file, globals) {
  const g = JSON.parse(fs.readFileSync(path.join(THEME, 'sections', file), 'utf8'));
  let out = '';
  for (const k of g.order) out += await renderSection(k, g.sections[k], globals);
  return out;
}

// Rewrite store-relative links so the static files link to each other.
function rewriteLinks(html) {
  return html.replace(/(href|action)="(\/[^"#]*)(#[^"]*)?"/g, (m, attr, url) => {
    if (attr === 'action') return `${attr}="#"`;
    const [p, q] = url.split('?');
    const c = p.match(/^\/collections\/([^/]+)/);
    let to = mock.routeMap[p];
    if (!to && c) to = mock.collections[c[1]] ? `collection-${c[1]}.html` : 'collection-biblia.html';
    if (!to && p.startsWith('/products/')) to = `product-${p.split('/')[2]}.html`;
    if (!to && p.startsWith('/search')) to = q && /q=xyz/.test(q) ? 'search-empty.html' : 'search.html';
    return `${attr}="${to || '404.html'}"`;
  }).replace(/<form([^>]*) action="#"([^>]*role="search")/g, '<form$1 action="search.html"$2');
}

const PREVIEW_JS = `<script>window.TN_PREVIEW=true;window.TN_PREVIEW_SUBMIT=function(e){var t=e.target,ty=t.dataset.type;if(ty==='product'){e.preventDefault();window.TN&&TN.toast('Adicionado ao carrinho (preview)','cart.html');return false}if(ty){e.preventDefault();window.TN&&TN.toast('Enviado (preview)','#');return false}return true}</script>`;

async function renderPage(out, templateName, ctx) {
  const tpl = JSON.parse(fs.readFileSync(path.join(THEME, 'templates', templateName + '.json'), 'utf8'));
  const [name, suffix] = path.basename(templateName).split('.');
  const globals = { ...mock.globals, ...ctx, template: { name, suffix: suffix || null } };
  let body = '';
  for (const k of tpl.order) body += await renderSection(k, tpl.sections[k], globals);
  const layout = fs.readFileSync(path.join(THEME, 'layout', 'theme.liquid'), 'utf8')
    .replace("{% sections 'header-group' %}", '%%HEADER%%').replace("{% sections 'footer-group' %}", '%%FOOTER%%');
  let html = await engine.parseAndRender(layout, { ...globals, content_for_layout: '%%BODY%%', content_for_header: '' }, { globals });
  html = html.replace('%%HEADER%%', await renderGroup('header-group.json', globals))
    .replace('%%FOOTER%%', await renderGroup('footer-group.json', globals))
    .replace('%%BODY%%', body)
    .replace('<script src="assets/theme.js" defer></script>', PREVIEW_JS + '<script src="assets/theme.js" defer></script>')
    .replace('</body>', '<a class="pv-badge" href="pages.html">Preview local · ver todas as páginas</a><style>.pv-badge{position:fixed;right:12px;bottom:12px;z-index:90;background:#111;color:#fff;font:700 12px Mulish,sans-serif;padding:8px 12px;border-radius:999px;opacity:.85}</style></body>');
  fs.writeFileSync(path.join(DIST, out), rewriteLinks(html));
}

(async () => {
  const built = [];
  const add = async (out, t, ctx, label) => { await renderPage(out, t, ctx); built.push([label, out]); };

  await add('index.html', 'index', { page_title: 'Thomas Nelson Brasil' }, 'Home');
  for (const c of mock.collectionList) await add(`collection-${c.handle}.html`, 'collection', { collection: c, page_title: c.title, current_tags: [] }, `Categoria: ${c.title}`);
  await add('collections.html', 'list-collections', { page_title: 'Todas as coleções' }, 'Lista de coleções');
  for (const p of Object.values(mock.products)) {
    await renderPage(`product-${p.handle}.html`, 'product', { product: p, page_title: p.title, collection: mock.collections[p.collections[0]], recommendations: mock.recommendationsFor(p) });
  }
  built.push([`Produto (${Object.keys(mock.products).length} páginas, exemplo)`, `product-${mock.sampleProduct.handle}.html`]);
  await add('search.html', 'search', { search: mock.search('bíblia'), page_title: 'Busca' }, 'Busca com resultados');
  await add('search-empty.html', 'search', { search: mock.search('xyz'), page_title: 'Busca' }, 'Busca sem resultados');
  await add('cart.html', 'cart', { cart: mock.cart, page_title: 'Carrinho' }, 'Carrinho');
  await add('cart-empty.html', 'cart', { cart: mock.emptyCart, page_title: 'Carrinho' }, 'Carrinho vazio');
  await add('404.html', '404', { page_title: 'Página não encontrada' }, 'Página 404');
  await add('page.html', 'page', { page: mock.pages.sobre, page_title: mock.pages.sobre.title }, 'Página institucional (Sobre)');
  await add('contact.html', 'page.contact', { page: mock.pages.contato, page_title: 'Contato' }, 'Contato');
  await add('bible-finder.html', 'page.bible-finder', { page: mock.pages.finder, page_title: 'Encontre sua Bíblia' }, 'Encontre sua Bíblia');
  await add('blog.html', 'blog', { blog: mock.blog, page_title: mock.blog.title, current_tags: [] }, 'Blog');
  await add('article.html', 'article', { blog: mock.blog, article: mock.blog.articles[0], page_title: mock.blog.articles[0].title }, 'Artigo do blog');
  await add('login.html', 'customers/login', { page_title: 'Entrar' }, 'Login');
  await add('register.html', 'customers/register', { page_title: 'Criar conta' }, 'Cadastro');
  await add('account.html', 'customers/account', { customer: mock.customer, page_title: 'Minha conta' }, 'Minha conta');

  const list = built.map(([l, f]) => `<li><a href="${f}">${l}</a><code>${f}</code></li>`).join('');
  fs.writeFileSync(path.join(DIST, 'pages.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Páginas do preview</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;color:#1b1f2a;background:#fbf8f3}h1{font-family:Georgia,serif;color:#0b3a75}ul{list-style:none;padding:0}li{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #e6e0d6}a{color:#0b3a75;font-weight:700}code{color:#5f6673;font-size:13px}</style>
<h1>Thomas Nelson Brasil · preview do tema</h1><p>Cada página é renderizada a partir dos arquivos Liquid em <code>shopify-theme/</code>, com o catálogo real da loja.</p><ul>${list}</ul>`);
  console.log(`built ${built.length} entries + ${Object.keys(mock.products).length} product pages`);
})().catch(e => { console.error(e); process.exit(1); });
