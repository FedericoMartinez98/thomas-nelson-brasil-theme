# Preview local do tema

Renderiza `../shopify-theme` com [LiquidJS](https://liquidjs.com) e o **catálogo real** da loja (174 produtos, 8 coleções, capas e preços), sem precisar de uma loja Shopify.

**Abra `dist/pages.html`** para a lista de todas as páginas, ou `dist/index.html` para a home.

## Recriar
```bash
cd preview
npm install
python3 -I scripts/fetch_store.py    # opcional: atualiza data/ a partir da loja pública
python3 -I scripts/make_banners.py   # opcional: regera os banners em ../shopify-theme/assets
npm run build                        # gera dist/
node scripts/shoot.js index product-sample:m   # prints em shots/ (":m" = mobile)
```

- `mock.js` monta os objetos Liquid (produtos, coleções, filtros, menus, carrinho, cliente, blog).
- `build.js` simula as partes do Shopify que o tema usa (`form`, `paginate`, `t`, `money` em R$, `image_url`...).
- Carrinho, formulários e filtros não funcionam de verdade no preview: mostram um aviso.
