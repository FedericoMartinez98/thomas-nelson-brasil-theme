"""Fetch public catalog data from the live store into preview/data (store.json + images).
Run: python3 -I preview/scripts/fetch_store.py"""
import json, os, re, subprocess, sys, urllib.request, html

BASE = 'https://thomasnelson.com.br'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
IMG = os.path.join(ROOT, 'img')
os.makedirs(IMG, exist_ok=True)
COLS = {
    'lancamentos-1': 'Lançamentos', 'espiritualidade': 'Mais procurados', 'exclusivo-do-site': 'Exclusivos',
    'biblia': 'Bíblias', 'biblias-de-estudos': 'Bíblias de estudo', 'ficcao': 'Ficção cristã',
    'devocional': 'Devocionais', 'infantil': 'Infantil'}

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (preview builder)'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

authors = set()
for page in range(1, 15):
    cs = json.loads(get(f'{BASE}/collections.json?limit=250&page={page}'))['collections']
    if not cs: break
    for c in cs:
        m = re.match(r'livros-de-(.+?)(-br|-\d+)?$', c['handle'])
        if m: authors.add(m.group(1))

def author_of(handle):
    best = ''
    for a in authors:
        if handle.endswith('-' + a) and len(a) > len(best): best = a
    fixes = {'cs-lewis': 'C. S. Lewis'}
    if best in fixes: return fixes[best]
    if best.isdigit(): best = ''
    small = ('de', 'da', 'do', 'dos', 'das', 'e')
    return ' '.join(w.upper() + '.' if len(w) == 1 else w if w in small else w.capitalize() for w in best.split('-')) if best else 'Thomas Nelson Brasil'

def strip(h):
    t = html.unescape(re.sub(r'<[^>]+>', ' ', h or ''))
    return re.sub(r'\s+', ' ', t).strip()

def save_img(src, name, width):
    path = os.path.join(IMG, name)
    if not os.path.exists(path):
        raw = path + '.dl'
        open(raw, 'wb').write(get(src.split('?')[0] + f'?width={width * 2}'))
        subprocess.run(['convert', raw, '-resize', f'{width}x', '-quality', '80', '-background', 'white', '-flatten', path], check=True)
        os.remove(raw)
    return 'img/' + name

products, collections = {}, {}
for h, title in COLS.items():
    ps = json.loads(get(f'{BASE}/collections/{h}/products.json?limit=24'))['products']
    collections[h] = {'handle': h, 'title': title, 'products': []}
    for p in ps:
        if not p['images']: continue
        collections[h]['products'].append(p['handle'])
        if p['handle'] in products: continue
        imgs = [save_img(im['src'], f"{p['handle'][:60]}-{i}.jpg", 480 if i == 0 else 720)
                for i, im in enumerate(p['images'][:3 if len(products) < 30 else 1])]
        v = p['variants']
        products[p['handle']] = {
            'handle': p['handle'], 'title': p['title'], 'vendor': author_of(p['handle']), 'type': p['product_type'],
            'tags': [t for t in p['tags'] if not t.startswith(('action:', 'BIB.', 'CAT.'))][:10],
            'description': strip(p['body_html'])[:1200], 'images': imgs,
            'variants': [{'id': x['id'], 'title': x['title'], 'price': round(float(x['price']) * 100),
                          'compare_at_price': round(float(x['compare_at_price']) * 100) if x.get('compare_at_price') else None,
                          'available': x.get('available', True), 'sku': x.get('sku') or ''} for x in v]}
    print(h, len(collections[h]['products']), file=sys.stderr)

json.dump({'products': products, 'collections': collections}, open(os.path.join(ROOT, 'store.json'), 'w'), ensure_ascii=False, indent=1)
print(len(products), 'products', file=sys.stderr)
