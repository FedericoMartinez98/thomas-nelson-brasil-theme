"""Compose banner art from book covers (text is overlaid in HTML, so it stays editable).
Run: python3 -I preview/scripts/make_banners.py"""
import json, os, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
OUT = os.path.join(HERE, '..', '..', 'shopify-theme', 'assets')
d = json.load(open(os.path.join(DATA, 'store.json')))
P = d['products']
def flat_cover(path):
    """True when the image is a flat cover (no white photo backdrop in the corners)."""
    out = subprocess.run(['convert', path, '-crop', '6x6+2+2', '-format', '%[fx:mean]', 'info:'], capture_output=True, text=True).stdout
    return float(out or 1) < 0.93
def pick(paths, n):
    return [x for x in paths if flat_cover(x)][:n]
def covers(col, n, skip=()):
    return pick([os.path.join(DATA, P[h]['images'][0]) for h in d['collections'][col]['products'] if h not in skip and 'brindes' not in h], n)
def by_vendor(v, n):
    return pick([os.path.join(DATA, p['images'][0]) for p in P.values() if p['vendor'] == v], n)

def banner(name, w, h, c1, c2, imgs, cover_h, right=True):
    tmp = os.path.join(DATA, '_tmp'); os.makedirs(tmp, exist_ok=True)
    cmd = ['convert', '-size', f'{w}x{h}', f'gradient:{c1}-{c2}', '-rotate', '0',
           '(', '-size', f'{w}x{h}', 'xc:none', '-fill', 'rgba(255,255,255,0.06)', '-draw', f'circle {int(w*0.78)},{int(h*0.5)} {int(w*0.78)},{int(h*0.5 - h*0.62)}', ')', '-composite']
    n = len(imgs)
    span = w * (0.40 if right else 0.8)
    x0 = w * 0.54 if right else (w - span) / 2
    step = span / n
    order = list(range(n))
    mid = n // 2
    order.sort(key=lambda i: -abs(i - mid))  # outer first, centre on top
    for i in order:
        f = os.path.join(tmp, f'{name}-{i}.png')
        ch = int(cover_h * (1.0 if i == mid else 0.86))
        rot = (i - mid) * 5
        subprocess.run(['convert', imgs[i], '-resize', f'x{ch}', '-bordercolor', 'none', '-border', '0',
                        '(', '+clone', '-background', 'black', '-shadow', '55x18+0+16', ')', '+swap', '-background', 'none', '-layers', 'merge', '+repage',
                        '-background', 'none', '-rotate', str(rot), f], check=True)
        cx = int(x0 + step * i + step / 2)
        cy = int(h / 2)
        cmd += ['(', f, ')', '-gravity', 'NorthWest', '-geometry', f'+{cx}+{cy}', '-compose', 'over']
        # place by centre: compute offset from image size
        sz = subprocess.run(['identify', '-format', '%w %h', f], capture_output=True, text=True).stdout.split()
        cmd[-3] = f'+{cx - int(sz[0]) // 2}+{cy - int(sz[1]) // 2}'
        cmd += ['-composite']
    out = os.path.join(OUT, f'tn-banner-{name}.jpg')
    subprocess.run(cmd + ['-quality', '82', out], check=True)
    print(out)

banner('hero-biblias', 1900, 620, '#0b2e5c', '#164d8f', covers('lancamentos-1', 3) if False else covers('biblia', 3), 470)
banner('hero-ficcao', 1900, 620, '#1d3a2f', '#3f6b4e', covers('ficcao', 4, skip={'ventos-do-leste-brindes-rebeca-sousa'}), 430)
banner('hero-infantil', 1900, 620, '#f2b33d', '#f7d27a', covers('infantil', 4, skip={'tiao-e-o-perdao-brindes-fernanda-witwytzky'}), 420)
banner('promo-cs-lewis', 900, 540, '#2a2238', '#4b3d63', by_vendor('C. S. Lewis', 3), 380)
banner('promo-devocionais', 900, 540, '#7a3b2e', '#b0634c', covers('devocional', 3), 380)
banner('promo-estudo', 900, 540, '#12324f', '#2a5d86', covers('biblias-de-estudos', 3), 380)
banner('newsletter', 1200, 500, '#0b2e5c', '#123f78', covers('espiritualidade', 5), 330, right=False)
