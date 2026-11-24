# Tema TN Brasil Redesign (Shopify Online Store 2.0)

Proposta de redesign completo para a loja **thomasnelson.com.br** (Shopify). Tudo em português, preços em R$, editável pelo editor de temas.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `layout/theme.liquid` | Layout base (fontes, CSS, JS, grupos de cabeçalho e rodapé) |
| `config/` | `settings_schema.json` (cores, logo, parcelamento, Pix, frete grátis, cards, redes) e `settings_data.json` |
| `locales/pt-BR.default.json` | Todos os textos da interface |
| `sections/` | 26 seções + `header-group.json` e `footer-group.json` |
| `snippets/` | 26 snippets reutilizáveis (ícones, card, preço, parcelamento, filtros, paginação...) |
| `templates/` | Um JSON por página (lista abaixo) |
| `assets/` | `theme.css`, `theme.js` e 7 banners gerados a partir das capas |

### Páginas (templates)
`index` (home), `collection` (categoria/PLP), `product` (PDP), `list-collections`, `search`, `cart`, `404`, `page`, `page.contact`, `page.bible-finder`, `blog`, `article`, `customers/login`, `customers/register`, `customers/account`.

### Seções
- **Globais:** `announcement-bar` (rotativa), `header` (busca, conta, carrinho, mega menu com destaque, menu mobile), `footer` (newsletter, menus, contato, pagamentos)
- **Home / marketing:** `hero-slider`, `trust-badges`, `product-tabs`, `collection-slider`, `category-grid`, `promo-banners`, `image-with-text`, `bible-finder`, `newsletter`
- **Páginas:** `main-product`, `related-products`, `main-collection`, `main-list-collections`, `main-search`, `main-cart`, `main-404`, `main-page`, `main-contact`, `main-blog`, `main-article`, `main-login`, `main-register`, `main-account`

### Ícones
`snippets/icon.liquid` traz 38 ícones SVG desenhados para o tema (traço 1.8px, 24×24):
search, cart, user, menu, close, chevrons, arrow-right, heart, truck, shield, card, pix, refresh, gift, book, bible, star, plus, minus, trash, filter, check, mail, phone, map-pin, whatsapp, instagram, facebook, youtube, spotify, headphones, tablet, lock, clock, sparkle, grid. Uso: `{% render 'icon', name: 'pix', size: 18 %}`.

## Recursos de e-commerce BR
- Parcelamento "ou 6x de R$ X sem juros", com parcela mínima configurável
- Preço no Pix com desconto (%), selos de frete grátis, troca e compra segura
- Barra de progresso para frete grátis no carrinho
- Calculadora de CEP na PDP, botão Comprar agora, sticky add-to-cart no mobile
- Filtros nativos (Search & Discovery), ordenação, chips de filtros ativos, paginação
- Selos "Lançamento" / "Exclusivo do site" por tag (configurável), "% OFF" automático
- Dados estruturados `Book` (schema.org) na PDP

## Como instalar
1. Admin › Loja virtual › Temas › **Adicionar tema** › subir esta pasta zipada (ou `shopify theme push --unpublished`).
2. Criar os menus usados: `main-menu` (com 3 níveis para o mega menu), `footer-institucional`, `footer-ajuda`, `footer-categorias`.
3. Conferir as coleções referenciadas nos templates (são os handles reais da loja: `lancamentos-1`, `espiritualidade`, `exclusivo-do-site`, `biblia`, `biblias-de-estudos`, `ficcao`, `devocional`, `infantil`).
4. Para o **Encontre sua Bíblia**, marcar as Bíblias com tags: `nvi|acf|ntlh|a21`, `estudo|devocional|journaling`, `letra-grande|letra-gigante`, `capa-dura|couro-soft|brochura`.
5. Criar a página `encontre-sua-biblia` com o template `page.bible-finder` e a página de contato com `page.contact`.
6. Opcional: metafields `book.pages` (número) e `book.release_date` (data) aparecem nos detalhes do produto.

## Pré-visualizar sem Shopify
Veja `../preview/README.md`.
