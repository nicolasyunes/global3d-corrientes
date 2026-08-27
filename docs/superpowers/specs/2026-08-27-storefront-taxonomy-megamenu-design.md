# Storefront taxonomy, mega-menu & faceted filters — design

Date: 2026-08-27
Branch: feature/auth-access
Status: approved design, pending spec review

## Problem

The public storefront (`src/features/storefront/`) has:

- A flat `CATEGORIES` array (8 entries) in `data/products.ts`; every product
  carries a single `cat` string. All 24 vasos share `cat: 'vasos'`.
- A `subcategories.ts` module that derives sidebar sub-filters from fragile
  runtime name matching (`p.name.includes('Fernetero') && p.price > 20000`).
- A plain horizontal button bar in `StorefrontLayout.tsx` (`sf-cat-nav`) with
  **no dropdowns**.
- `CategoryPage.tsx` with sidebar facets (subcategory, price, brand, a
  "Personalizable" checkbox, sort) that do not deep-link and do not adapt per
  category beyond the filament brand special-case.

The business needs a real category → subcategory taxonomy, an Apple-iPad-style
dropdown menu (desktop hover + mobile drawer), per-category faceted filters, and
a visible "personalizable" signal on every product (the catalog is
overwhelmingly made-to-order).

## Goals

1. One config module as the single source of truth for the category tree.
2. Explicit taxonomy fields on every product (no more name matching).
3. Apple-style mega-menu: desktop full-width hover/focus panels (text links
   only), mobile hamburger → slide-in drawer with per-category accordions.
4. Config-driven faceted filters on `CategoryPage`, deep-linkable via query
   string.
5. Two-tier personalization messaging with a reusable custom-order CTA.

## Non-goals (YAGNI)

- No CMS / backend / API. Catalog stays a static TS file.
- No new products in this change — restructure and tag the existing ~55 only.
  (New Stories-list items — Toy Story vasos, Mates, portalatas, réplicas — are a
  later, separate change.)
- No product images / thumbnails in the menu or elsewhere.
- No URL state for price bucket or sort (only `sub` and `tema` are deep-linked).
- No mega-menu "featured products" block.
- No i18n (site is Spanish-only).

## Taxonomy

11 top-level categories, rendered flat in the nav bar in this order. `⭐` =
`featured: true`.

| slug | name | icon | facets | sub-links (slug → label) |
|---|---|---|---|---|
| `vasos-ferneteros` ⭐ | Vasos Ferneteros | 🍺 | subcat, capacidad, tema, precio, personalizable | `futbol-clubes`→Fútbol y Clubes · `mundial`→Mundial / Selección · `silk-clasicos`→Silk y Clásicos · `otros-disenos`→Otros Deportes y Diseños |
| `vasos-milkshake` ⭐ | Vasos Milkshake | 🥤 | subcat, tema, precio, personalizable | `toy-story`→Toy Story · `sonic`→Sonic · `stranger-things`→Stranger Things · `anime-pop`→Anime & Pop · `mundial`→Mundial |
| `figuras` | Figuras y Coleccionables | 🧸 | subcat, tema, precio, personalizable | `funko-personalizados`→Funko Pop Personalizados · `figuras-grandes`→Figuras Grandes Pintadas a Mano · `personalizadas`→Personalizadas · `articulados`→Muñecos Articulados |
| `mates` | Mates | 🧉 | subcat, tema, precio, personalizable | `seleccion-afa`→Selección / AFA · `clubes`→Clubes · `personalizados`→Personalizados |
| `golosineros` | Alcancías y Golosineros | 💰 | subcat, tema, precio, personalizable | `tematicos`→Modelos Temáticos · `huevos`→Huevos Golosineros |
| `llaveros` | Llaveros y Merch | 🔑 | subcat, tema, precio, personalizable | `flexi`→Flexi Articulados · `gaming-infantil`→Gaming e Infantil · `futbol-mundial`→Fútbol y Mundial · `personalizados-utiles`→Personalizados y Útiles · `portalatas`→Portalatas |
| `trofeos` | Trofeos y Premios | 🏆 | subcat, precio, personalizable | `deportivos`→Deportivos · `placas`→Placas y Reconocimientos |
| `hogar` | Hogar y Decoración | 🏠 | subcat, precio, personalizable | `escritorio`→Escritorio y Organización · `decoracion`→Decoración · `religiosos`→Religiosos |
| `juegos` | Juegos y Juguetes | 🎲 | subcat, precio, personalizable | `mesa`→De Mesa · `habilidad`→Habilidad y Antiestrés · `sensoriales`→Sensoriales e Infantiles |
| `combos` | Combos | 🎁 | precio, personalizable | — |
| `impresion-3d` | Impresión 3D | 🖨️ | subcat, marca, precio | `filamentos`→Filamentos (memberCats `['filamentos']`) · `resina`→Resina (memberCats `['filamentos']`, unit `L`) · `impresoras`→Impresoras (memberCats `['impresoras']`) |

### Cross-cutting theme: `mundial`

Not a bar slot. A `tema` value applied to every AFA / Selección / club-Mundial
product across categories. Surfaced as:

- A promoted collection tile on `HomePage` linking to `/categoria/todas?tema=mundial`.
- A selectable value in the **Temática** facet wherever it appears.

## Data model

### `navigation.ts` (new) — single source of truth

```ts
export type SubLink = {
  slug: string
  label: string
  memberCats?: string[]   // impresion-3d sub-links target other product `cat` values
  unit?: 'kg' | 'L'       // resina sub-link narrows by unit
}

export type Facet = 'subcat' | 'capacidad' | 'tema' | 'precio' | 'marca' | 'personalizable'

export type NavCategory = {
  slug: string
  name: string
  icon: string            // emoji
  featured?: boolean
  facets: Facet[]
  subLinks: SubLink[]
}

export const NAV: NavCategory[] = [ /* 11 entries per table above */ ]

// Stable labels for the Temática facet (keys are `themes` values)
export const THEME_LABELS: Record<string, string> = {
  mundial: 'Mundial / Selección', afa: 'AFA', boca: 'Boca', river: 'River',
  'stranger-things': 'Stranger Things', capibaras: 'Capibaras', /* ... */
}

// Back-compat: keep the old shape alive for HomePage / ProductDetailPage / pricing
export const CATEGORIES: { slug: string; name: string }[] =
  NAV.map(({ slug, name }) => ({ slug, name }))

export function findNav(slug: string): NavCategory | undefined
export function navSubLinks(slug: string): SubLink[]

// slug aliases for old inbound links
export const CATEGORY_ALIASES: Record<string, string> = {
  vasos: 'vasos-ferneteros',
  'vasos-y-fernetero': 'vasos-ferneteros',
}
```

`data/products.ts` re-exports `CATEGORIES` / `findCategory` from `navigation.ts`
so existing imports keep working. `subcategories.ts` is **deleted**; its
`getSubcategories` callers move to `navSubLinks`.

### `Product` type changes (`data/products.ts`)

```ts
export type Product = {
  // ...existing fields...
  cat: string                       // now one of the 11 slugs (or 'filamentos'/'impresoras' kept for pricing.ts)
  subcat?: string                   // sub-link slug within its category
  themes?: string[]                 // e.g. ['futbol','river'], ['stranger-things'], ['mundial','afa']
  capacity?: '650ml' | '1L'         // vasos-ferneteros only
  customOnRequest: boolean          // default true; false for impresoras + filamentos
}
```

- `cat: 'vasos'` split into `'vasos-ferneteros'` / `'vasos-milkshake'` across the
  24 generated vasos + the custom vaso. `VASOS_DATA` tuples extended from
  `[name, price]` to `[name, price, subcat, themes, capacity?]`.
- `cat: 'filamentos'` and `cat: 'impresoras'` **stay as-is** (not renamed to
  `impresion-3d`) so `pricing.ts` (`l.cat === 'filamentos'`) is untouched. The
  `impresion-3d` NAV node reaches them through `memberCats`.
- Every non-filament/printer product gets `customOnRequest: true`. The ~10
  already `personalizable: true` keep it (that badge = "made to order").
- `FEATURED_PRODUCT_IDS`: `vs18` re-pointed to a valid id after the split.
- `BANNERS[].cat` values updated to new slugs.

### `navigation.test.ts` (new)

- Every `NAV` slug is unique; every `subLink.slug` unique within its category.
- Every product's `cat` resolves to a `NAV` node **or** is a `memberCats` target.
- Every product's `subcat` (when set) exists in its category's `subLinks` (or in
  the `memberCats` node for filaments/printers).
- Every `capacity` is set only on `vasos-ferneteros` products.
- No product has an empty `themes: []` (omit instead).

## Components

### `StorefrontNav.tsx` (new) — replaces the `sf-cat-nav` block in `StorefrontLayout.tsx`

State: `openSlug: string | null`, `drawerOpen: boolean`, `expandedSlug` (mobile
accordion). A `useMediaQuery('(min-width: 900px)')` hook (or a CSS-driven
approach) picks desktop vs mobile rendering.

**Desktop (≥ 900px):**

- `<nav aria-label="Categorías">` with a `<button>` per `NAV` entry (`icon` +
  `name`), plus a leading "Todas" link.
- Hover **or** focus on a button opens `openSlug`; ~120 ms open delay, ~200 ms
  close delay (timeout refs) to allow diagonal travel into the panel.
- Panel: full-width absolutely-positioned `<div class="sf-megamenu">` under the
  header, `role="region"`, listing `subLinks` as text (`<Link>`), grouped in up
  to 3 CSS columns. A dim scrim (`sf-megamenu__scrim`) sits behind it.
- Closes on: mouse-leave of button+panel, `Escape`, focus leaving the
  nav+panel, route change (`useLocation` effect).
- `1100px`–`900px`: the bar itself is `overflow-x: auto` with hidden scrollbar.

**Mobile (< 900px):**

- Hamburger button in the header row toggles `drawerOpen`.
- `<div class="sf-drawer">` slides in from the left (`transform`), with a scrim.
  `document.body` gets `overflow: hidden` while open.
- Each category is a row: `<button aria-expanded>` with a chevron; tap toggles
  `expandedSlug` to reveal an accordion `<ul>` of `subLink` `<Link>`s. Only one
  open at a time.
- Close on: scrim tap, close button, `Escape`, route change.

**Accessibility:** all destinations are real `<Link>`s
(`/categoria/<catSlug>?sub=<subLinkSlug>`, or `?tema=` where a sub-link maps to a
theme). `aria-expanded` / `aria-controls` on every toggle. Focus is not trapped
on desktop (hover menu) but `Escape` always closes and returns focus to the
trigger; the mobile drawer traps focus while open. `prefers-reduced-motion`
disables slide/fade transitions.

### `CustomOrderCTA.tsx` (new)

Props: `variant: 'strip' | 'card'`. Copy: "¿Lo querés con otro nombre, color o
escudo? Escribinos y lo hacemos a tu medida." Button → `waHref(...)` (existing
`@/lib/whatsapp`). `strip` renders on `CategoryPage` above the grid; `card`
renders on `ProductDetailPage` in the info column.

### `CategoryPage.tsx` changes

- Resolve slug through `CATEGORY_ALIASES`; if aliased, `<Navigate replace>` to
  the canonical slug preserving query string. Unknown slug → treat as `todas`.
- Read `sub` and `tema` from `useSearchParams` as the initial facet state; local
  state still lets the user change them without a navigation. Reset on slug
  change (existing `useEffect`).
- Sidebar sections rendered from `findNav(slug).facets`:
  - **subcat** — buttons from `navSubLinks(slug)`; "Todas" + one per sub-link;
    filters `product.subcat === slug` (for `impresion-3d`, filter by the
    sub-link's `memberCats` / `unit`).
  - **capacidad** — `Todas` / `650 ml` / `1 L` from `product.capacity`.
  - **tema** — checkbox list built from the union of `product.themes` across the
    category's products (stable label map in `navigation.ts`, e.g.
    `mundial`→"Mundial / Selección", `stranger-things`→"Stranger Things").
    Multi-select (OR within the facet).
  - **precio** — existing `PRICE_BUCKETS`.
  - **marca** — existing, only for `impresion-3d`.
  - **personalizable** — existing checkbox, relabeled "Sólo personalizables (a
    medida)".
- **Mobile (< 900px):** the `<aside>` collapses behind a "Filtros" button that
  opens a bottom sheet (`sf-filter-sheet`) containing the same controls plus an
  "Aplicar" / "Limpiar" footer. Reuses the drawer scrim + body-lock pattern.
- `<CustomOrderCTA variant="strip" />` above the results grid.

### `filter.ts` changes

`ProductFilters` gains:

```ts
subcat: string          // 'all' or a sub-link slug
capacity: 'all' | '650ml' | '1L'
themes: string[]         // empty = no theme filter; OR semantics
```

`filterProducts` applies, in order: search → category → subcat → capacity →
themes (product matches if it has ≥1 of the selected) → price → brand →
personalizable → sort. Stays pure. `filter.test.ts` extended with cases for
subcat, capacity, multi-theme OR, and combined facets.

### `ProductCard.tsx` / `ProductDetailPage.tsx` changes

- Keep the solid `Personalizable` tag when `product.personalizable`.
- When `product.customOnRequest` (and not already `personalizable`), render a
  lighter line: "Personalizable a pedido — nombre, color o escudo".
- `ProductDetailPage`: add `<CustomOrderCTA variant="card" />`; breadcrumb category
  name comes from `findNav`.

### `HomePage.tsx` changes

- Category grid maps `NAV` (icon + name) instead of the old `CATEGORIES`.
- Add one promoted "Mundial / Selección" collection tile →
  `/categoria/todas?tema=mundial`.
- `BANNERS` links resolve against new slugs.

### `storefront.css` additions

`.sf-megamenu`, `.sf-megamenu__scrim`, `.sf-megamenu__col`, `.sf-nav-bar`
(scroll behavior), `.sf-drawer` + `.sf-drawer__scrim` + accordion rows,
`.sf-filter-sheet`, `.sf-cta-strip` / `.sf-cta-card`, `.sf-tag--soft` for the
"a pedido" line. All theme-aware via existing tokens; motion behind
`@media (prefers-reduced-motion: no-preference)`.

## Data flow

```
navigation.ts (NAV)
   │
   ├─► StorefrontNav ──renders bar + panels──► <Link> /categoria/:slug?sub=&tema=
   │
   └─► CategoryPage ──reads slug + query + NAV.facets──► filter.ts (pure) ──► ProductCard grid
                                                              ▲
                                              data/products.ts (static PRODUCTS
                                              with cat/subcat/themes/capacity)
```

No async, no backend. Everything derives from two static modules.

## Migration / breakage checklist

- `/categoria/vasos` inbound links → alias redirect to `vasos-ferneteros`.
- `FEATURED_PRODUCT_IDS` `vs18` → repoint.
- `BANNERS[].cat` → new slugs.
- `CartContext.tsx` stores `cat` on line items — values change but nothing keys
  off specific strings; verify.
- `pricing.ts` `l.cat === 'filamentos'` — unaffected (slug kept).
- `subcategories.ts` deleted — update `CategoryPage` import and remove
  `subcategories.test.ts` (fold coverage into `navigation.test.ts`).
- Grep for hardcoded old slugs (`figuras`, `golosineros`, `llaveros`, `trofeos`)
  — these slugs are retained, so only `vasos`/`filamentos`/`impresoras` grouping
  needs care.

## Testing

- `navigation.test.ts` — taxonomy integrity (see above).
- `filter.test.ts` — new facet logic + combinations.
- `pricing.test.ts` — unchanged, must still pass.
- RTL test for `StorefrontNav`: desktop hover opens/closes a panel; `Escape`
  closes; mobile drawer opens, one accordion at a time, link click closes.
- RTL test for `CategoryPage`: `?sub=` and `?tema=` pre-select facets;
  alias slug redirects.
- Manual: `npm run dev`, verify menu on desktop + at 375 px, keyboard-only nav,
  reduced-motion.

## Rollout

Single PR on `feature/auth-access`. No feature flag (storefront is not yet
public-facing per `data/products.ts` header comment). Order of work handed to
the writing-plans skill:

1. `navigation.ts` + `navigation.test.ts` (taxonomy only, no UI).
2. `data/products.ts` re-tag + type changes; make `navigation.test.ts` green.
3. `filter.ts` + tests.
4. `StorefrontNav.tsx` + CSS + `StorefrontLayout` wiring + RTL test.
5. `CategoryPage.tsx` facets + mobile sheet + alias redirect + RTL test.
6. `CustomOrderCTA.tsx` + `ProductCard` / `ProductDetailPage` / `HomePage` wiring.
7. Full `npm test` + manual pass.
