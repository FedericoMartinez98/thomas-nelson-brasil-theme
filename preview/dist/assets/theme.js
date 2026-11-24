/* TN Brasil Redesign — theme behaviour (no dependencies). */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const moneyFormat = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Header shadow on scroll
  const header = $('[data-header]');
  if (header) addEventListener('scroll', () => header.classList.toggle('is-scrolled', scrollY > 10), { passive: true });

  // Announcement rotator
  $$('[data-rotator]').forEach(r => {
    const items = $$('.announce__item', r);
    if (items.length < 2) return;
    let i = 0;
    setInterval(() => { items[i].classList.remove('is-on'); i = (i + 1) % items.length; items[i].classList.add('is-on'); }, 4500);
  });

  // Mobile drawer close button
  $$('[data-drawer-close]').forEach(b => b.addEventListener('click', () => b.closest('details').removeAttribute('open')));
  document.addEventListener('click', e => {
    const d = $('[data-drawer][open]');
    if (d && !e.target.closest('.drawer__panel') && !e.target.closest('summary')) d.removeAttribute('open');
  });

  // Hero slider
  $$('[data-hero]').forEach(hero => {
    const slides = $$('.hero__slide', hero), dots = $$('[data-hero-dot]', hero);
    if (slides.length < 2) return;
    let i = 0, timer;
    const go = n => {
      slides[i].classList.remove('is-on'); dots[i] && dots[i].classList.remove('is-on');
      i = (n + slides.length) % slides.length;
      slides[i].classList.add('is-on'); dots[i] && dots[i].classList.add('is-on');
    };
    const play = () => { clearInterval(timer); timer = setInterval(() => go(i + 1), 6000); };
    dots.forEach(d => d.addEventListener('click', () => { go(+d.dataset.heroDot); play(); }));
    hero.addEventListener('mouseenter', () => clearInterval(timer));
    hero.addEventListener('mouseleave', play);
    play();
  });

  // Product sliders
  $$('[data-slider]').forEach(s => {
    const track = $('[data-slider-track]', s), prev = $('[data-slider-prev]', s), next = $('[data-slider-next]', s);
    if (!track) return;
    const step = () => track.clientWidth * 0.9;
    const update = () => {
      prev.disabled = track.scrollLeft < 4;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    };
    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    track.addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
  });

  // Tabs
  $$('[data-tabs]').forEach(root => {
    $$('[role=tab]', root).forEach(tab => tab.addEventListener('click', () => {
      $$('[role=tab]', root).forEach(t => t.setAttribute('aria-selected', 'false'));
      $$('[role=tabpanel]', root).forEach(p => (p.hidden = true));
      tab.setAttribute('aria-selected', 'true');
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      panel.hidden = false;
      $$('[data-slider-track]', panel).forEach(t => t.dispatchEvent(new Event('scroll')));
    }));
  });

  // Quantity inputs
  $$('[data-qty]').forEach(q => {
    const input = $('input', q);
    $('[data-qty-minus]', q).addEventListener('click', () => { input.value = Math.max(+input.min || 0, (+input.value || 1) - 1); input.dispatchEvent(new Event('change', { bubbles: true })); });
    $('[data-qty-plus]', q).addEventListener('click', () => { input.value = (+input.value || 0) + 1; input.dispatchEvent(new Event('change', { bubbles: true })); });
  });

  // Bible finder -> /collections/<handle>/<tag>+<tag>
  $$('[data-finder]').forEach(f => f.addEventListener('submit', e => {
    e.preventDefault();
    const tags = $$('select', f).map(s => s.value).filter(Boolean);
    location.href = f.dataset.base + (tags.length ? '/' + tags.join('+') : '');
  }));

  // Facets: auto-submit, mobile drawer, sort
  const facets = $('[data-facets]');
  if (facets) {
    const submit = () => {
      const params = new URLSearchParams(new FormData(facets));
      const sort = $('[data-sort]'); if (sort) params.set('sort_by', sort.value);
      [...params.keys()].forEach(k => { if (params.get(k) === '') params.delete(k); });
      location.search = params.toString();
    };
    facets.addEventListener('change', submit);
    $$('[data-sort]').forEach(s => s.addEventListener('change', submit));
  }
  const filters = $('[data-filters]');
  $$('[data-filters-open]').forEach(b => b.addEventListener('click', () => filters && filters.classList.add('is-open')));
  $$('[data-filters-close]').forEach(b => b.addEventListener('click', () => filters && filters.classList.remove('is-open')));

  // Product page: gallery, variants, sticky buy
  const product = $('[data-product]');
  if (product) {
    const slides = $$('[data-gallery-slide]', product), thumbs = $$('[data-gallery-thumb]', product);
    thumbs.forEach(t => t.addEventListener('click', () => {
      slides.forEach(s => s.classList.toggle('is-on', s.dataset.gallerySlide === t.dataset.galleryThumb));
      thumbs.forEach(x => x.classList.toggle('is-on', x === t));
    }));

    const json = $('[data-variants]', product);
    const variants = json ? JSON.parse(json.textContent) : [];
    const idInput = $('[data-variant-id]', product);
    const addBtn = $('[data-add]', product), addLabel = $('[data-add-label]', product);
    $$('[data-option-index]', product).forEach(r => r.addEventListener('change', () => {
      const chosen = $$('fieldset.variant-pills', product).map(fs => ($('input:checked', fs) || {}).value);
      const v = variants.find(v => v.options.every((o, i) => o === chosen[i]));
      $$('[data-option-label]', product).forEach((l, i) => (l.textContent = chosen[i]));
      if (!v) return;
      idInput.value = v.id;
      addBtn.disabled = !v.available;
      addLabel.textContent = v.available ? 'Adicionar ao carrinho' : 'Esgotado';
      const cur = $('.price__current', product), cmp = $('.price__compare', product);
      if (cur) cur.textContent = moneyFormat(v.price);
      if (cmp) cmp.textContent = v.compare_at_price ? moneyFormat(v.compare_at_price) : '';
      const sku = $('[data-sku]', product); if (sku && v.sku) sku.textContent = v.sku;
      const sp = $('.sticky-buy__price'); if (sp) sp.textContent = moneyFormat(v.price);
      const url = new URL(location.href); url.searchParams.set('variant', v.id); history.replaceState(null, '', url);
    }));

    const sticky = $('[data-sticky-buy]');
    if (sticky && addBtn && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => sticky.classList.toggle('is-on', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(addBtn);
    }
  }

  // Product recommendations (Shopify Section Rendering API)
  $$('[data-recommendations]').forEach(el => {
    const body = $('[data-recommendations-body]', el);
    if (!body || body.children.length || !el.dataset.url || el.dataset.url.startsWith('#')) return;
    fetch(el.dataset.url).then(r => r.text()).then(html => {
      const d = document.createElement('div'); d.innerHTML = html;
      const fresh = $('[data-recommendations-body]', d);
      if (fresh && fresh.children.length) body.innerHTML = fresh.innerHTML; else el.hidden = true;
    }).catch(() => { el.hidden = true; });
  });

  // Ajax add to cart (falls back to normal submit)
  document.addEventListener('submit', e => {
    const form = e.target;
    if (!form.matches('form[action$="/cart/add"]') || !window.fetch || window.TN_PREVIEW) return;
    e.preventDefault();
    const btn = form.querySelector('[type=submit]'); btn && (btn.disabled = true);
    fetch(form.action + '.js', { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
      .then(r => { if (!r.ok) throw r; return fetch('/cart.js'); })
      .then(r => r.json())
      .then(cart => {
        $$('[data-cart-count]').forEach(c => { c.textContent = cart.item_count; c.classList.toggle('is-empty', !cart.item_count); });
        toast('Adicionado ao carrinho', '/cart');
      })
      .catch(() => form.submit())
      .finally(() => btn && (btn.disabled = false));
  });

  function toast(msg, href) {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.innerHTML = `<span>${msg}</span><a href="${href}">Ver carrinho</a>`;
    t.classList.add('is-on');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('is-on'), 3200);
  }
  window.TN = { toast };
})();
