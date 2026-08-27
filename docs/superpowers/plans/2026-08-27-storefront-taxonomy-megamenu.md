# Storefront Taxonomy, Mega-Menu & Faceted Filters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the public storefront a real category→subcategory taxonomy driven by one config module, an Apple-iPad-style dropdown menu (desktop hover panels + mobile drawer), per-category faceted filters, and a visible "personalizable" signal on every product.

**Architecture:** A new `navigation.ts` module is the single source of truth for the category tree; `data/products.ts` re-exports the old `CATEGORIES`/`findCategory` shape from it for back-compat. Every product gains explicit `subcat` / `themes` / `capacity` / `customOnRequest` fields (no more runtime name-matching). A new `StorefrontNav.tsx` renders the bar + mega-menu (desktop) or hamburger + drawer (mobile), chosen by a `useMediaQuery` hook. `CategoryPage.tsx` builds its filter sidebar from `NAV[cat].facets` and reads `?sub=` / `?tema=` from the URL. `filter.ts` stays a pure function, extended with the new facets.

**Tech Stack:** React 18 + TypeScript, react-router-dom v6, Vitest + @testing-library/react (jsdom), plain CSS with existing design tokens in `src/styles/tokens.css`. No backend — the catalog is a static TS file.

**Spec:** `docs/superpowers/specs/2026-08-27-storefront-taxonomy-megamenu-design.md`

## Global Constraints

- Site is **Spanish-only**. All user-facing strings in Spanish, no i18n layer.
- Catalog stays a **static TS module** (`src/features/storefront/data/products.ts`). No CMS, no API, no async.
- **No new products** in this change — restructure and tag the existing catalog only.
- Filament/printer products keep `cat: 'filamentos'` / `cat: 'impresoras'` verbatim — `pricing.ts` keys off `l.cat === 'filamentos'` for the bulk discount and must not break.
- Product ids are **stable** — do not renumber `vs1`…`vs24`. `FEATURED_PRODUCT_IDS` must keep resolving.
- Deep-link query params are exactly **`sub`** and **`tema`**; price bucket / sort / brand are **not** URL-encoded.
- Desktop/mobile breakpoint is **900px** (`min-width: 900px` = desktop).
- Respect `prefers-reduced-motion` for every menu/drawer transition.
- Existing test commands: `npm test` (vitest run), `npm run typecheck`, `npm run lint`, `npm run build`. All four must pass at the end of every task.
- Test runner has `globals: true` — `describe/it/expect/vi` are ambient, but existing files still import them from `vitest`; match that.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/features/storefront/navigation.ts` *(new)* | Category tree config (`NAV`), `THEME_LABELS`, slug aliasing, back-compat `CATEGORIES`/`findCategory`. |
| `src/features/storefront/navigation.test.ts` *(new)* | Config integrity + catalog↔config integrity. |
| `src/features/storefront/useMediaQuery.ts` *(new)* | `useMediaQuery(query)` hook for the desktop/mobile switch. |
| `src/features/storefront/StorefrontNav.tsx` *(new)* | Nav bar + desktop mega-menu + mobile drawer. |
| `src/features/storefront/StorefrontNav.test.tsx` *(new)* | Desktop hover panel + mobile drawer behaviour. |
| `src/features/storefront/CustomOrderCTA.tsx` *(new)* | Reusable custom-order call-to-action (`strip` / `card`). |
| `src/features/storefront/data/products.ts` *(modify)* | New `Product` fields; re-tag every product; re-export `CATEGORIES`/`findCategory` from `navigation.ts`; update `BANNERS`. |
| `src/features/storefront/data/products.test.ts` *(modify)* | Adjust category-name assertion + known-category check. |
| `src/features/storefront/filter.ts` *(modify)* | Add `subcat` / `capacity` / `themes` to `ProductFilters` + logic. |
| `src/features/storefront/filter.test.ts` *(modify)* | Extend `baseFilters`; add facet cases. |
| `src/features/storefront/CategoryPage.tsx` *(modify)* | Alias redirect; `?sub=`/`?tema=` seeding; config-driven facet sidebar; mobile filter sheet; CTA strip. |
| `src/features/storefront/CategoryPage.test.tsx` *(new)* | Alias redirect + query-param seeding. |
| `src/features/storefront/StorefrontLayout.tsx` *(modify)* | Swap the `sf-cat-nav` block for `<StorefrontNav />`. |
| `src/features/storefront/ProductCard.tsx` *(modify)* | "Personalizable a pedido" soft tag. |
| `src/features/storefront/ProductDetailPage.tsx` *(modify)* | Soft tag + `<CustomOrderCTA variant="card" />`. |
| `src/features/storefront/HomePage.tsx` *(modify)* | Category grid from `NAV`; Mundial collection tile. |
| `src/features/storefront/storefront.css` *(modify)* | Remove dead `.sf-cat-nav*`; add nav / mega-menu / drawer / filter-sheet / CTA / soft-tag styles. |
| `src/features/storefront/subcategories.ts` *(delete)* | Replaced by `navigation.ts`. Only consumer is `CategoryPage.tsx`. |
| `src/test/setup.ts` *(modify)* | Add a `window.matchMedia` polyfill for jsdom. |

---

## Task 1: Taxonomy config module (`navigation.ts`)

**Files:**
- Create: `src/features/storefront/navigation.ts`
- Test: `src/features/storefront/navigation.test.ts`

**Interfaces:**
- Produces:
  - `type SubLink = { slug: string; label: string; memberCats?: string[]; unit?: 'kg' | 'L' }`
  - `type Facet = 'subcat' | 'capacidad' | 'tema' | 'precio' | 'marca' | 'personalizable'`
  - `type NavCategory = { slug: string; name: string; icon: string; featured?: boolean; facets: Facet[]; subLinks: SubLink[] }`
  - `const NAV: NavCategory[]`
  - `const THEME_LABELS: Record<string, string>`
  - `const CATEGORY_ALIASES: Record<string, string>`
  - `function resolveCategorySlug(slug: string): string`
  - `function findNav(slug: string): NavCategory | undefined`
  - `function navSubLinks(slug: string): SubLink[]`
  - `function allProductCats(): Set<string>`
  - `type Category = { slug: string; name: string }`
  - `const CATEGORIES: Category[]`
  - `function findCategory(slug: string): Category | undefined`

- [ ] **Step 1: Write the failing test**

Create `src/features/storefront/navigation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  NAV,
  THEME_LABELS,
  navSubLinks,
  resolveCategorySlug,
  allProductCats,
  findCategory,
} from './navigation'

describe('NAV config', () => {
  it('has 11 categories with unique slugs', () => {
    expect(NAV).toHaveLength(11)
    const slugs = NAV.map((c) => c.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('has unique sub-link slugs within each category', () => {
    for (const c of NAV) {
      const slugs = c.subLinks.map((s) => s.slug)
      expect(new Set(slugs).size).toBe(slugs.length)
    }
  })

  it('every category has a name and a single-glyph icon', () => {
    for (const c of NAV) {
      expect(c.name.length).toBeGreaterThan(0)
      expect([...c.icon].length).toBeGreaterThanOrEqual(1)
    }
  })

  it('only impresion-3d uses memberCats', () => {
    for (const c of NAV) {
      for (const s of c.subLinks) {
        if (s.memberCats) expect(c.slug).toBe('impresion-3d')
      }
    }
  })

  it('marks exactly the two vasos categories as featured', () => {
    expect(NAV.filter((c) => c.featured).map((c) => c.slug)).toEqual([
      'vasos-ferneteros',
      'vasos-milkshake',
    ])
  })

  it('resolves alias slugs to canonical', () => {
    expect(resolveCategorySlug('vasos')).toBe('vasos-ferneteros')
    expect(resolveCategorySlug('filamentos')).toBe('impresion-3d')
    expect(resolveCategorySlug('impresoras')).toBe('impresion-3d')
    expect(resolveCategorySlug('trofeos')).toBe('trofeos')
    expect(resolveCategorySlug('nope')).toBe('nope')
  })

  it('navSubLinks works through an alias', () => {
    expect(navSubLinks('vasos').map((s) => s.slug)).toContain('futbol-clubes')
  })

  it('allProductCats includes NAV slugs and memberCats targets', () => {
    const cats = allProductCats()
    expect(cats.has('vasos-ferneteros')).toBe(true)
    expect(cats.has('filamentos')).toBe(true)
    expect(cats.has('impresoras')).toBe(true)
  })

  it('THEME_LABELS has a label for every theme referenced by a sub-link slug', () => {
    // sub-link slugs that double as theme slugs must be labelled
    for (const slug of ['stranger-things', 'sonic', 'toy-story', 'mundial']) {
      expect(THEME_LABELS[slug]).toBeTruthy()
    }
  })

  it('findCategory returns the back-compat shape', () => {
    expect(findCategory('trofeos')).toEqual({ slug: 'trofeos', name: 'Trofeos y Premios' })
    expect(findCategory('nope')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/storefront/navigation.test.ts`
Expected: FAIL — cannot resolve `./navigation`.

- [ ] **Step 3: Write the implementation**

Create `src/features/storefront/navigation.ts`:

```ts
// Single source of truth for the storefront category tree. The nav bar, the
// mega-menu panels, the mobile drawer and the CategoryPage facet sidebar are
// all generated from NAV. Replaces the old flat CATEGORIES array and the
// name-matching subcategories.ts module.

export type SubLink = {
  slug: string
  label: string
  /** `impresion-3d` sub-links target these product `cat` values instead of a
   *  `subcat` on the product. */
  memberCats?: string[]
  /** Narrows a memberCats sub-link further by product unit (kg = filament, L = resin). */
  unit?: 'kg' | 'L'
}

export type Facet = 'subcat' | 'capacidad' | 'tema' | 'precio' | 'marca' | 'personalizable'

export type NavCategory = {
  slug: string
  name: string
  icon: string
  featured?: boolean
  facets: Facet[]
  subLinks: SubLink[]
}

export const NAV: NavCategory[] = [
  {
    slug: 'vasos-ferneteros',
    name: 'Vasos Ferneteros',
    icon: '🍺',
    featured: true,
    facets: ['subcat', 'capacidad', 'tema', 'precio', 'personalizable'],
    subLinks: [
      { slug: 'futbol-clubes', label: 'Fútbol y Clubes' },
      { slug: 'mundial', label: 'Mundial / Selección' },
      { slug: 'silk-clasicos', label: 'Silk y Clásicos' },
      { slug: 'otros-disenos', label: 'Otros Deportes y Diseños' },
    ],
  },
  {
    slug: 'vasos-milkshake',
    name: 'Vasos Milkshake',
    icon: '🥤',
    featured: true,
    facets: ['subcat', 'tema', 'precio', 'personalizable'],
    subLinks: [
      { slug: 'toy-story', label: 'Toy Story' },
      { slug: 'sonic', label: 'Sonic' },
      { slug: 'stranger-things', label: 'Stranger Things' },
      { slug: 'anime-pop', label: 'Anime, Series y Pop' },
      { slug: 'mundial', label: 'Mundial' },
    ],
  },
  {
    slug: 'figuras',
    name: 'Figuras y Coleccionables',
    icon: '🧸',
    facets: ['subcat', 'tema', 'precio', 'personalizable'],
    subLinks: [
      { slug: 'funko-personalizados', label: 'Funko Pop Personalizados' },
      { slug: 'figuras-grandes', label: 'Figuras Grandes Pintadas a Mano' },
      { slug: 'personalizadas', label: 'Personalizadas' },
      { slug: 'articulados', label: 'Muñecos Articulados' },
    ],
  },
  {
    slug: 'mates',
    name: 'Mates',
    icon: '🧉',
    facets: ['subcat', 'tema', 'precio', 'personalizable'],
    subLinks: [
      { slug: 'seleccion-afa', label: 'Selección / AFA' },
      { slug: 'clubes', label: 'Clubes' },
      { slug: 'personalizados', label: 'Personalizados' },
    ],
  },
  {
    slug: 'golosineros',
    name: 'Alcancías y Golosineros',
    icon: '💰',
    facets: ['subcat', 'tema', 'precio', 'personalizable'],
    subLinks: [
      { slug: 'tematicos', label: 'Modelos Temáticos' },
      { slug: 'huevos', label: 'Huevos Golosineros' },
    ],
  },
  {
    slug: 'llaveros',
    name: 'Llaveros y Merch',
    icon: '🔑',
    facets: ['subcat', 'tema', 'precio', 'personalizable'],
    subLinks: [
      { slug: 'flexi', label: 'Flexi Articulados' },
      { slug: 'gaming-infantil', label: 'Gaming e Infantil' },
      { slug: 'futbol-mundial', label: 'Fútbol y Mundial' },
      { slug: 'personalizados-utiles', label: 'Personalizados y Útiles' },
      { slug: 'portalatas', label: 'Portalatas' },
    ],
  },
  {
    slug: 'trofeos',
    name: 'Trofeos y Premios',
    icon: '🏆',
    facets: ['subcat', 'precio', 'personalizable'],
    subLinks: [
      { slug: 'deportivos', label: 'Deportivos' },
      { slug: 'placas', label: 'Placas y Reconocimientos' },
    ],
  },
  {
    slug: 'hogar',
    name: 'Hogar y Decoración',
    icon: '🏠',
    facets: ['subcat', 'precio', 'personalizable'],
    subLinks: [
      { slug: 'escritorio', label: 'Escritorio y Organización' },
      { slug: 'decoracion', label: 'Decoración' },
      { slug: 'religiosos', label: 'Religiosos' },
    ],
  },
  {
    slug: 'juegos',
    name: 'Juegos y Juguetes',
    icon: '🎲',
    facets: ['subcat', 'precio', 'personalizable'],
    subLinks: [
      { slug: 'mesa', label: 'De Mesa' },
      { slug: 'habilidad', label: 'Habilidad y Antiestrés' },
      { slug: 'sensoriales', label: 'Sensoriales e Infantiles' },
    ],
  },
  {
    slug: 'combos',
    name: 'Combos',
    icon: '🎁',
    facets: ['precio', 'personalizable'],
    subLinks: [],
  },
  {
    slug: 'impresion-3d',
    name: 'Impresión 3D',
    icon: '🖨️',
    facets: ['subcat', 'marca', 'precio'],
    subLinks: [
      { slug: 'filamentos', label: 'Filamentos', memberCats: ['filamentos'], unit: 'kg' },
      { slug: 'resina', label: 'Resina', memberCats: ['filamentos'], unit: 'L' },
      { slug: 'impresoras', label: 'Impresoras', memberCats: ['impresoras'] },
    ],
  },
]

/** Human labels for `product.themes` values, keyed by theme slug. */
export const THEME_LABELS: Record<string, string> = {
  mundial: 'Mundial / Selección',
  seleccion: 'Selección Argentina',
  afa: 'AFA',
  futbol: 'Fútbol',
  boca: 'Boca',
  river: 'River',
  racing: 'Racing',
  'san-lorenzo': 'San Lorenzo',
  mandiyu: 'Mandiyú',
  messi: 'Messi',
  corrientes: 'Corrientes / Carnaval',
  silk: 'Efecto Silk',
  bulls: 'Chicago Bulls',
  simpsons: 'Los Simpsons',
  intensamente: 'Intensamente',
  'stranger-things': 'Stranger Things',
  sonic: 'Sonic',
  'toy-story': 'Toy Story',
  anime: 'Anime',
  labubu: 'Labubu',
  httyd: 'Cómo Entrenar a tu Dragón',
  brainrot: 'Italian Brainrot',
  kpop: 'K-pop Demon Hunters',
  capibaras: 'Capibaras',
  stitch: 'Stitch',
  'hello-kitty': 'Hello Kitty',
  roblox: 'Roblox',
  gaming: 'Gaming',
  f1: 'Fórmula 1',
  padel: 'Pádel',
  fitness: 'Fitness',
  moto: 'Motociclismo',
  eventos: 'Comuniones y Eventos',
}

const CANONICAL = new Set(NAV.map((c) => c.slug))

/** Old inbound slugs → canonical NAV slug. */
export const CATEGORY_ALIASES: Record<string, string> = {
  vasos: 'vasos-ferneteros',
  'vasos-y-fernetero': 'vasos-ferneteros',
  filamentos: 'impresion-3d',
  impresoras: 'impresion-3d',
}

export function resolveCategorySlug(slug: string): string {
  if (CANONICAL.has(slug)) return slug
  return CATEGORY_ALIASES[slug] ?? slug
}

export function findNav(slug: string): NavCategory | undefined {
  return NAV.find((c) => c.slug === resolveCategorySlug(slug))
}

export function navSubLinks(slug: string): SubLink[] {
  return findNav(slug)?.subLinks ?? []
}

/** All valid product `cat` values: NAV slugs plus every memberCats target. */
export function allProductCats(): Set<string> {
  const set = new Set<string>(NAV.map((c) => c.slug))
  for (const c of NAV) for (const s of c.subLinks) for (const m of s.memberCats ?? []) set.add(m)
  return set
}

/** Back-compat shape for HomePage / ProductDetailPage / older tests. */
export type Category = { slug: string; name: string }
export const CATEGORIES: Category[] = NAV.map(({ slug, name }) => ({ slug, name }))
export function findCategory(slug: string): Category | undefined {
  const n = findNav(slug)
  return n ? { slug: n.slug, name: n.name } : undefined
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/storefront/navigation.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no other file imports `navigation.ts` yet).

- [ ] **Step 6: Commit**

```bash
git add src/features/storefront/navigation.ts src/features/storefront/navigation.test.ts
git commit -m "feat(storefront): add navigation.ts taxonomy config"
```

---

## Task 2: Product data model + re-tag (`data/products.ts`)

**Files:**
- Modify: `src/features/storefront/data/products.ts`
- Modify: `src/features/storefront/data/products.test.ts`
- Modify: `src/features/storefront/navigation.test.ts` (add catalog-integrity block)

**Interfaces:**
- Consumes: `NAV`, `allProductCats`, `findNav`, `CATEGORIES`, `findCategory`, `type Category` from `./navigation` (Task 1).
- Produces:
  - `type Capacity = '500ml' | '650ml' | '1L'`
  - `Product` type gains: `subcat?: string`, `themes?: string[]`, `capacity?: Capacity`, `customOnRequest: boolean`
  - `PRODUCTS` array where every entry is tagged; `CATEGORIES` / `findCategory` / `Category` re-exported from `./navigation`.

- [ ] **Step 1: Write the failing test — catalog↔config integrity**

Append to `src/features/storefront/navigation.test.ts`:

```ts
import { PRODUCTS } from './data/products'
import { findNav } from './navigation'

describe('NAV <-> catalog integrity', () => {
  it('every product cat is a valid NAV slug or memberCats target', () => {
    const valid = allProductCats()
    for (const p of PRODUCTS) {
      expect(valid.has(p.cat), `${p.id} has cat "${p.cat}"`).toBe(true)
    }
  })

  it('every product subcat exists in its resolved category', () => {
    for (const p of PRODUCTS) {
      if (!p.subcat) continue
      const nav = findNav(p.cat)
      expect(nav, `${p.id} cat "${p.cat}" resolves`).toBeDefined()
      const subSlugs = nav!.subLinks.map((s) => s.slug)
      expect(subSlugs, `${p.id} subcat "${p.subcat}"`).toContain(p.subcat)
    }
  })

  it('capacity is only set on vasos-ferneteros products', () => {
    for (const p of PRODUCTS) {
      if (p.capacity) expect(p.cat).toBe('vasos-ferneteros')
    }
  })

  it('no product carries an empty themes array', () => {
    for (const p of PRODUCTS) {
      if (p.themes) expect(p.themes.length, p.id).toBeGreaterThan(0)
    }
  })

  it('filaments and printers are never customOnRequest', () => {
    for (const p of PRODUCTS.filter((p) => p.cat === 'filamentos' || p.cat === 'impresoras')) {
      expect(p.customOnRequest, p.id).toBe(false)
    }
  })

  it('every other product is customOnRequest', () => {
    for (const p of PRODUCTS.filter((p) => p.cat !== 'filamentos' && p.cat !== 'impresoras')) {
      expect(p.customOnRequest, p.id).toBe(true)
    }
  })
})
```

> Note: `allProductCats` is already imported at the top of the file from Task 1. Add `findNav` to that existing import; add the new `PRODUCTS` import.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/storefront/navigation.test.ts`
Expected: FAIL — `Product` has no `customOnRequest`; products have no `subcat`.

- [ ] **Step 3: Update the `Product` type and category re-exports**

In `src/features/storefront/data/products.ts`:

1. Replace the top-of-file `Category` / `CATEGORIES` / `findCategory` definitions (the `export type Category = ...`, the `export const CATEGORIES: Category[] = [ ... ]` block, and the `export function findCategory` at the bottom) with a re-export near the top of the file:

```ts
import { CATEGORIES, findCategory, type Category } from '../navigation'
export { CATEGORIES, findCategory }
export type { Category }
```

2. Add the `Capacity` type and extend `Product`:

```ts
export type Capacity = '500ml' | '650ml' | '1L'

export type Product = {
  id: string
  cat: string
  subcat?: string
  themes?: string[]
  capacity?: Capacity
  name: string
  price: number
  unit?: 'kg' | 'L'
  brand?: string
  brandName?: string
  personalizable: boolean
  customOnRequest: boolean
  colors: ProductColor[] | null
  stock: StockLevel
  desc: string
  specs: string[]
}
```

- [ ] **Step 4: Re-tag `BASE_PRODUCTS`**

Replace the entire `BASE_PRODUCTS` array with the version below (adds `customOnRequest`, `subcat`, and `themes` where relevant — all other fields unchanged):

```ts
const BASE_PRODUCTS: Product[] = [
  { id: 'combo1', cat: 'combos', name: 'Combo 3 llaveros personalizados', price: 4000, personalizable: true, customOnRequest: true, colors: null, stock: 'in', desc: 'Tres llaveros personalizados a elección, ideal para regalar en grupo.', specs: ['Incluye 3 llaveros', 'Ahorrás $500 vs. comprarlos por separado', 'Tiempo estimado: 2-3 días'] },
  { id: 'combo2', cat: 'combos', name: 'Combo vaso fernetero + llavero de regalo', price: 26900, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Vaso fernetero de 1 litro a elección + llavero de regalo.', specs: ['Incluye vaso fernetero + llavero', 'Ahorrás $1.600 vs. comprarlos por separado'] },
  { id: 'combo3', cat: 'combos', name: 'Combo trofeo + llavero grabado', price: 19000, personalizable: true, customOnRequest: true, colors: null, stock: 'in', desc: 'Trofeo personalizado + llavero a juego con el mismo nombre.', specs: ['Incluye trofeo + llavero grabado', 'Tiempo estimado: 3-4 días'] },

  { id: 'fg1', cat: 'figuras', subcat: 'figuras-grandes', themes: ['moto'], name: 'Figura Valentino Rossi', price: 28000, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Figura coleccionable de Valentino Rossi.', specs: ['Material: Resina'] },
  { id: 'fg2', cat: 'figuras', subcat: 'funko-personalizados', themes: ['stranger-things'], name: 'Funko Demogorgon (Stranger Things)', price: 12000, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Figura estilo Funko de Demogorgon.', specs: ['Material: Resina'] },
  { id: 'fg3', cat: 'figuras', subcat: 'funko-personalizados', themes: ['stranger-things'], name: 'Funko Eddie Munson', price: 28000, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Figura coleccionable de Eddie Munson.', specs: ['Material: Resina'] },
  { id: 'fg4', cat: 'figuras', subcat: 'funko-personalizados', themes: ['stranger-things'], name: 'Funko Eleven (Stranger Things)', price: 28000, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Figura coleccionable de Eleven.', specs: ['Material: Resina'] },
  { id: 'fg5', cat: 'figuras', subcat: 'funko-personalizados', themes: ['futbol', 'seleccion', 'messi'], name: 'Funko Messi coleccionable', price: 28000, personalizable: false, customOnRequest: true, colors: null, stock: 'low', desc: 'Figura coleccionable de Messi.', specs: ['Material: Resina'] },
  { id: 'fg6', cat: 'figuras', subcat: 'articulados', themes: ['brainrot'], name: 'Muñecos Italian Brainrot', price: 9000, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Figura de personajes Italian Brainrot.', specs: ['Material: PLA'] },
  { id: 'fg7', cat: 'figuras', subcat: 'personalizadas', themes: ['fitness'], name: 'Funko Novios Fitness', price: 45000, personalizable: false, customOnRequest: true, colors: null, stock: 'low', desc: 'Set de figuras Novios Fitness.', specs: ['Material: Resina', 'Incluye 2 figuras'] },
  { id: 'fg8', cat: 'figuras', subcat: 'articulados', themes: ['stranger-things'], name: 'Muñeco articulado Demogorgon', price: 10000, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Muñeco articulado de Demogorgon.', specs: ['Material: PLA', 'Articulado'] },
  { id: 'fg9', cat: 'figuras', subcat: 'articulados', name: 'Muñeco articulado Dummy 13 (30cm)', price: 17000, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Muñeco articulado Dummy 13, 30cm de altura.', specs: ['Material: PLA', 'Altura: 30cm'] },
  { id: 'fg10', cat: 'figuras', subcat: 'articulados', themes: ['stranger-things'], name: 'Muñeco articulado Eleven', price: 10000, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Muñeco articulado de Eleven.', specs: ['Material: PLA', 'Articulado'] },
  { id: 'fg11', cat: 'figuras', subcat: 'figuras-grandes', themes: ['anime'], name: 'Sailor Moon', price: 25000, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Figura coleccionable de Sailor Moon.', specs: ['Material: Resina'] },
  { id: 'fg12', cat: 'hogar', subcat: 'escritorio', name: 'Portalápices Volkswagen Van', price: 18500, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Portalápices con forma de combi Volkswagen.', specs: ['Material: PLA'] },
  { id: 'fg13', cat: 'hogar', subcat: 'escritorio', name: 'Portalápices muelita', price: 10000, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Portalápices con forma de muela.', specs: ['Material: PLA'] },
  { id: 'fg14', cat: 'juegos', subcat: 'mesa', name: 'Set Dados Gonggi', price: 12000, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Set de dados Gonggi impresos en 3D.', specs: ['Material: PLA'] },

  { id: 'tr1', cat: 'trofeos', subcat: 'placas', name: 'Trofeo a medida', price: 15500, personalizable: true, customOnRequest: true, colors: null, stock: 'in', desc: 'Trofeo diseñado a medida según lo que necesites.', specs: ['Precio desde $15.500 hasta $18.500 según tamaño', 'Tiempo estimado: a consultar'] },
  { id: 'tr2', cat: 'trofeos', subcat: 'deportivos', themes: ['padel'], name: 'Trofeo de pádel personalizado', price: 12000, personalizable: true, customOnRequest: true, colors: null, stock: 'in', desc: 'Trofeo de pádel con nombre o texto personalizado.', specs: ['Tiempo estimado: 3-4 días'] },
  { id: 'tr3', cat: 'trofeos', subcat: 'deportivos', themes: ['padel'], name: 'Trofeo pádel rayo (18cm)', price: 15000, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Trofeo de pádel modelo rayo, 18cm de altura.', specs: ['Altura: 18cm'] },
  { id: 'tr4', cat: 'trofeos', subcat: 'placas', name: 'Trofeo pelota / placa personalizado', price: 13500, personalizable: true, customOnRequest: true, colors: null, stock: 'in', desc: 'Trofeo con forma de pelota o placa, personalizado con nombre y fecha.', specs: ['Tiempo estimado: 3-4 días'] },
  { id: 'tr5', cat: 'trofeos', subcat: 'placas', name: 'Trofeo personalizado', price: 18500, personalizable: true, customOnRequest: true, colors: null, stock: 'in', desc: 'Trofeo personalizado con nombre, texto o logo.', specs: ['Tiempo estimado: 3-4 días'] },

  { id: 'lv1', cat: 'llaveros', subcat: 'gaming-infantil', name: 'Llavero Merlina dedos', price: 2000, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Llavero de Merlina.', specs: ['Material: PLA'] },
  { id: 'lv2', cat: 'llaveros', subcat: 'flexi', themes: ['capibaras'], name: 'Llaveros capibaras', price: 2200, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Llavero con forma de capibara.', specs: ['Material: PLA'] },
  { id: 'lv3', cat: 'llaveros', subcat: 'personalizados-utiles', themes: ['eventos'], name: 'Llaveros comunión', price: 1000, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Llavero recuerdo de comunión.', specs: ['Material: PLA'] },
  { id: 'lv4', cat: 'llaveros', subcat: 'personalizados-utiles', themes: ['f1'], name: 'Llaveros Fórmula 1', price: 1350, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Llavero con diseño de Fórmula 1.', specs: ['Material: PLA'] },
  { id: 'lv5', cat: 'llaveros', subcat: 'personalizados-utiles', name: 'Llaveros personalizados frutas', price: 1500, personalizable: true, customOnRequest: true, colors: null, stock: 'in', desc: 'Llavero con forma de fruta y nombre personalizado.', specs: ['Material: PLA', 'Tiempo estimado: 1-2 días'] },
  { id: 'lv6', cat: 'llaveros', subcat: 'gaming-infantil', themes: ['gaming', 'roblox'], name: 'Llaveros Roblox', price: 1800, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Llavero con personajes de Roblox.', specs: ['Material: PLA'] },
  { id: 'lv7', cat: 'llaveros', subcat: 'gaming-infantil', name: 'Llaveros personalizados La Casa de Gabi', price: 1800, personalizable: true, customOnRequest: true, colors: null, stock: 'in', desc: 'Llavero personalizado estilo La Casa de Gabi.', specs: ['Material: PLA', 'Tiempo estimado: 1-2 días'] },

  { id: 'go1', cat: 'golosineros', subcat: 'tematicos', themes: ['capibaras'], name: 'Golosinero alcancía Capibaras', price: 11000, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Golosinero alcancía con forma de capibara.', specs: ['Material: PLA'] },
  { id: 'go2', cat: 'golosineros', subcat: 'tematicos', themes: ['stitch'], name: 'Golosinero alcancía Stitch', price: 12500, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Golosinero alcancía de Stitch.', specs: ['Material: PLA'] },
  { id: 'go3', cat: 'golosineros', subcat: 'huevos', themes: ['capibaras'], name: 'Huevo golosinero capibara', price: 11500, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Golosinero con forma de huevo capibara.', specs: ['Material: PLA'] },
  { id: 'go4', cat: 'golosineros', subcat: 'tematicos', themes: ['futbol', 'boca', 'river'], name: 'Golosinero alcancía Boca - River', price: 11000, personalizable: false, customOnRequest: true, colors: null, stock: 'low', desc: 'Golosinero alcancía con los colores de Boca o River.', specs: ['Material: PLA'] },
  { id: 'go5', cat: 'golosineros', subcat: 'tematicos', themes: ['hello-kitty'], name: 'Golosinero alcancía Hello Kitty', price: 12500, personalizable: false, customOnRequest: true, colors: null, stock: 'in', desc: 'Golosinero alcancía de Hello Kitty.', specs: ['Material: PLA'] },

  { id: 'imp1', cat: 'impresoras', subcat: 'impresoras', name: 'Impresora 3D Creality Ender 3 V3', price: 420000, personalizable: false, customOnRequest: false, colors: null, stock: 'low', desc: 'Impresora FDM de alta velocidad, ideal para empezar a imprimir en casa.', specs: ['Volumen de impresión: 220x220x250mm', 'Incluye 1kg de filamento de regalo', 'Garantía: 6 meses'] },
  { id: 'imp2', cat: 'impresoras', subcat: 'impresoras', name: 'Impresora 3D de resina Anycubic Photon', price: 380000, personalizable: false, customOnRequest: false, colors: null, stock: 'low', desc: 'Impresora de resina para piezas de alta definición y detalle fino.', specs: ['Volumen de impresión: 130x80x160mm', 'Incluye 500ml de resina', 'Garantía: 6 meses'] },
]
```

- [ ] **Step 5: Re-tag the vasos**

Replace the `VASOS_DATA` declaration and the `VASOS_PRODUCTS` map + custom push with:

```ts
type VasoRow = [
  name: string,
  price: number,
  cat: 'vasos-ferneteros' | 'vasos-milkshake',
  subcat: string,
  themes: string[],
  capacity?: Capacity,
]

const VASOS_DATA: VasoRow[] = [
  ['Vaso Fernetero Boca Silk 1L', 27000, 'vasos-ferneteros', 'silk-clasicos', ['futbol', 'boca', 'silk'], '1L'],
  ['Vaso copa del mundo 1L', 28500, 'vasos-ferneteros', 'mundial', ['mundial', 'seleccion', 'afa'], '1L'],
  ['Vaso de River 1L Negro', 28000, 'vasos-ferneteros', 'futbol-clubes', ['futbol', 'river'], '1L'],
  ['Vaso Fernetero AFA 1L', 27000, 'vasos-ferneteros', 'futbol-clubes', ['seleccion', 'afa'], '1L'],
  ['Vaso Fernetero AFA Azul 1L', 27000, 'vasos-ferneteros', 'futbol-clubes', ['seleccion', 'afa'], '1L'],
  ['Vaso Fernetero AFA Negro 1L', 27000, 'vasos-ferneteros', 'futbol-clubes', ['seleccion', 'afa'], '1L'],
  ['Vaso Fernetero Ara Bera 500ml', 18000, 'vasos-ferneteros', 'otros-disenos', ['corrientes'], '500ml'],
  ['Vaso Fernetero Boca 1L', 27000, 'vasos-ferneteros', 'futbol-clubes', ['futbol', 'boca'], '1L'],
  ['Vaso Fernetero clásico Chicago Bulls', 18000, 'vasos-ferneteros', 'otros-disenos', ['bulls']],
  ['Vaso Fernetero clásico Sapucay 500ml', 18000, 'vasos-ferneteros', 'otros-disenos', ['corrientes'], '500ml'],
  ['Vaso Fernetero Mandiyú 1L', 27000, 'vasos-ferneteros', 'futbol-clubes', ['futbol', 'mandiyu'], '1L'],
  ['Vaso Fernetero Racing 1L', 27000, 'vasos-ferneteros', 'futbol-clubes', ['futbol', 'racing'], '1L'],
  ['Vaso Fernetero River Negro 1L', 27000, 'vasos-ferneteros', 'futbol-clubes', ['futbol', 'river'], '1L'],
  ['Vaso Fernetero San Lorenzo 1L', 27000, 'vasos-ferneteros', 'futbol-clubes', ['futbol', 'san-lorenzo'], '1L'],
  ['Vaso River Rojo 1L', 27000, 'vasos-ferneteros', 'futbol-clubes', ['futbol', 'river'], '1L'],
  ['Vaso milkshake Chimuelo', 15500, 'vasos-milkshake', 'anime-pop', ['httyd']],
  ['Vaso milkshake Demogorgon (Stranger Things)', 15500, 'vasos-milkshake', 'stranger-things', ['stranger-things']],
  ['Vaso milkshake Labubu', 15500, 'vasos-milkshake', 'anime-pop', ['labubu']],
  ['Vaso milkshake Sonic', 15500, 'vasos-milkshake', 'sonic', ['sonic']],
  ['Vaso milkshake Vecna (Stranger Things)', 15500, 'vasos-milkshake', 'stranger-things', ['stranger-things']],
  ['Vasos Brainrots milkshake', 15500, 'vasos-milkshake', 'anime-pop', ['brainrot']],
  ['Vasos Guerreras K-pop milkshake', 15500, 'vasos-milkshake', 'anime-pop', ['kpop']],
  ['Vasos milkshake Intensamente', 15500, 'vasos-milkshake', 'anime-pop', ['intensamente']],
  ['Vasos milkshake Los Simpsons', 15500, 'vasos-milkshake', 'anime-pop', ['simpsons']],
]

const VASOS_PRODUCTS: Product[] = VASOS_DATA.map(([name, price, cat, subcat, themes, capacity], i) => ({
  id: 'vs' + (i + 1),
  cat,
  subcat,
  themes,
  ...(capacity ? { capacity } : {}),
  name,
  price,
  personalizable: false,
  customOnRequest: true,
  colors: null,
  stock: 'in',
  desc: name.includes('milkshake')
    ? 'Vaso milkshake decorado, impreso en 3D.'
    : 'Vaso fernetero/deportivo impreso en 3D, resistente al uso diario.',
  specs: ['Material: PLA', 'Apto para uso diario'],
}))
VASOS_PRODUCTS.push({
  id: 'vs-custom',
  cat: 'vasos-ferneteros',
  subcat: 'otros-disenos',
  name: 'Vasos personalizados logo/escudo/nombre',
  price: 21000,
  personalizable: true,
  customOnRequest: true,
  colors: null,
  stock: 'in',
  desc: 'Vaso personalizado con el logo, escudo o nombre que elijas.',
  specs: ['Material: PLA', 'Tiempo estimado: 2-3 días'],
})
```

- [ ] **Step 6: Tag filament products + fix `BANNERS`**

In the `FILAMENT_PRODUCTS` builder's `.push({ ... })`, add two fields:

```ts
      cat: 'filamentos',
      subcat: l.unit === 'L' ? 'resina' : 'filamentos',
      brand: b.slug,
      brandName: b.name,
      // ...
      personalizable: false,
      customOnRequest: false,
```

In `BANNERS`, change the third entry's `cat`:

```ts
  { id: 'b3', cat: 'impresion-3d', title: 'Filamentos 3N3, Grilon3 y Elegoo', cta: 'Ver filamentos' },
```

(`b1` `combos` and `b2` `figuras` are unchanged — both are still valid NAV slugs.)

- [ ] **Step 7: Update `products.test.ts`**

Two edits in `src/features/storefront/data/products.test.ts`:

1. Replace the import line's `CATEGORIES` usage test — change the `every product belongs to a known category` test body to:

```ts
  it('every product belongs to a known category', () => {
    const slugs = allProductCats()
    for (const p of PRODUCTS) expect(slugs.has(p.cat)).toBe(true)
  })
```

and add `allProductCats` to the imports:

```ts
import { allProductCats } from '../navigation'
```

2. Change the category-name assertion:

```ts
  it('finds an existing category by slug', () => {
    expect(findCategory('trofeos')?.name).toBe('Trofeos y Premios')
  })
```

- [ ] **Step 8: Run the data tests**

Run: `npx vitest run src/features/storefront/navigation.test.ts src/features/storefront/data/products.test.ts`
Expected: PASS.

- [ ] **Step 9: Typecheck + full test + lint**

Run: `npm run typecheck && npm test && npm run lint`
Expected: PASS. (`filter.ts` still compiles — it reads `p.cat` only. `CartContext`/`pricing` unaffected. If `filter.test.ts` fails here it is a pre-existing shape mismatch — it is not; `ProductFilters` is unchanged in this task.)

- [ ] **Step 10: Commit**

```bash
git add src/features/storefront/data/products.ts src/features/storefront/data/products.test.ts src/features/storefront/navigation.test.ts
git commit -m "feat(storefront): re-tag catalog into new taxonomy (subcat/themes/capacity/customOnRequest)"
```

---

## Task 3: Extend the pure filter (`filter.ts`)

**Files:**
- Modify: `src/features/storefront/filter.ts`
- Modify: `src/features/storefront/filter.test.ts`

**Interfaces:**
- Consumes: `findNav` from `./navigation`; `Product`, `Capacity` from `./data/products`.
- Produces:
  - `type CapacityValue = 'all' | '500ml' | '650ml' | '1L'`
  - `ProductFilters` gains `subcat: string`, `capacity: CapacityValue`, `themes: string[]`
  - `filterProducts` unchanged signature: `(products: Product[], filters: ProductFilters) => Product[]`

- [ ] **Step 1: Write the failing tests**

In `src/features/storefront/filter.test.ts`, extend `baseFilters` and the fixture, and add a describe block. Full new file contents:

```ts
import { describe, expect, it } from 'vitest'
import { filterProducts, type ProductFilters } from './filter'
import type { Product } from './data/products'

const baseFilters: ProductFilters = {
  search: '',
  category: 'all',
  subcat: 'all',
  capacity: 'all',
  themes: [],
  priceBucket: 'all',
  brand: 'all',
  personalizableOnly: false,
  sort: 'relevance',
}

const p = (over: Partial<Product>): Product => ({
  id: 'x', cat: 'llaveros', name: '', price: 1000, personalizable: false,
  customOnRequest: true, colors: null, stock: 'in', desc: '', specs: [], ...over,
})

const products: Product[] = [
  p({ id: 'a', cat: 'llaveros', name: 'Llavero barato', price: 1000 }),
  p({ id: 'b', cat: 'trofeos', subcat: 'placas', name: 'Trofeo personalizado', price: 15000, personalizable: true }),
  p({ id: 'c', cat: 'filamentos', brand: '3n3', unit: 'kg', name: '3N3 — PLA', price: 25000, customOnRequest: false }),
  p({ id: 'd', cat: 'filamentos', brand: 'grilon3', unit: 'L', name: 'Grilon3 — Resina', price: 25000, customOnRequest: false }),
  p({ id: 'e', cat: 'vasos-ferneteros', subcat: 'futbol-clubes', themes: ['futbol', 'river'], capacity: '1L', name: 'Vaso River 1L', price: 27000 }),
  p({ id: 'f', cat: 'vasos-ferneteros', subcat: 'mundial', themes: ['mundial', 'afa'], capacity: '1L', name: 'Vaso Copa del Mundo', price: 28500 }),
  p({ id: 'g', cat: 'vasos-ferneteros', subcat: 'otros-disenos', themes: ['corrientes'], capacity: '500ml', name: 'Vaso Ará Berá', price: 18000 }),
]

describe('filterProducts', () => {
  it('filters by category', () => {
    expect(filterProducts(products, { ...baseFilters, category: 'trofeos' }).map((x) => x.id)).toEqual(['b'])
  })

  it('search overrides category', () => {
    expect(filterProducts(products, { ...baseFilters, category: 'trofeos', search: 'llavero' }).map((x) => x.id)).toEqual(['a'])
  })

  it('is case-insensitive on search', () => {
    expect(filterProducts(products, { ...baseFilters, search: 'TROFEO' }).map((x) => x.id)).toEqual(['b'])
  })

  it('filters by price bucket', () => {
    expect(filterProducts(products, { ...baseFilters, priceBucket: 'low' }).map((x) => x.id)).toEqual(['a'])
  })

  it('filters personalizable-only', () => {
    expect(filterProducts(products, { ...baseFilters, personalizableOnly: true }).map((x) => x.id)).toEqual(['b'])
  })

  it('maps the filamentos alias to the impresion-3d category', () => {
    const r = filterProducts(products, { ...baseFilters, category: 'filamentos' }).map((x) => x.id)
    expect(r.sort()).toEqual(['c', 'd'])
  })

  it('filters by brand only within impresion-3d', () => {
    expect(filterProducts(products, { ...baseFilters, category: 'impresion-3d', brand: '3n3' }).map((x) => x.id)).toEqual(['c'])
    expect(filterProducts(products, { ...baseFilters, category: 'trofeos', brand: '3n3' }).map((x) => x.id)).toEqual(['b'])
  })

  it('filters by memberCats sub-link + unit (resina)', () => {
    expect(filterProducts(products, { ...baseFilters, category: 'impresion-3d', subcat: 'resina' }).map((x) => x.id)).toEqual(['d'])
    expect(filterProducts(products, { ...baseFilters, category: 'impresion-3d', subcat: 'filamentos' }).map((x) => x.id)).toEqual(['c'])
  })

  it('filters by subcat within a normal category', () => {
    expect(filterProducts(products, { ...baseFilters, category: 'vasos-ferneteros', subcat: 'mundial' }).map((x) => x.id)).toEqual(['f'])
  })

  it('filters by capacity', () => {
    expect(
      filterProducts(products, { ...baseFilters, category: 'vasos-ferneteros', capacity: '500ml' }).map((x) => x.id),
    ).toEqual(['g'])
  })

  it('filters by themes with OR semantics, even when category is all', () => {
    expect(filterProducts(products, { ...baseFilters, themes: ['mundial'] }).map((x) => x.id)).toEqual(['f'])
    expect(
      filterProducts(products, { ...baseFilters, themes: ['river', 'corrientes'] }).map((x) => x.id).sort(),
    ).toEqual(['e', 'g'])
  })

  it('sorts by price ascending / descending', () => {
    expect(filterProducts(products, { ...baseFilters, sort: 'price-asc' })[0].id).toBe('a')
    expect(filterProducts(products, { ...baseFilters, sort: 'price-desc' })[0].id).toBe('f')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/storefront/filter.test.ts`
Expected: FAIL — `ProductFilters` has no `subcat` / `capacity` / `themes`.

- [ ] **Step 3: Rewrite `filter.ts`**

Full file contents:

```ts
// Pure product list filtering/sorting. Config-aware: category/subcat matching
// goes through navigation.ts so aliases (e.g. 'filamentos' -> 'impresion-3d')
// and memberCats sub-links resolve correctly.
import type { Product } from './data/products'
import { findNav } from './navigation'

export type PriceBucket = 'all' | 'low' | 'mid' | 'high'
export type SortValue = 'relevance' | 'price-asc' | 'price-desc'
export type CapacityValue = 'all' | '500ml' | '650ml' | '1L'

export type ProductFilters = {
  search: string
  category: string // 'all' or a category slug (canonical or alias)
  subcat: string // 'all' or a sub-link slug
  capacity: CapacityValue
  themes: string[] // empty = no theme filter; OR semantics
  priceBucket: PriceBucket
  brand: string // 'all' or a filament brand slug
  personalizableOnly: boolean
  sort: SortValue
}

export const PRICE_BUCKETS: { key: PriceBucket; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'low', label: 'Hasta $5.000' },
  { key: 'mid', label: '$5.000 - $20.000' },
  { key: 'high', label: 'Más de $20.000' },
]

function canonical(slug: string): string {
  return findNav(slug)?.slug ?? slug
}

function matchesSubcat(prod: Product, category: string, subcat: string): boolean {
  if (subcat === 'all') return true
  const link = findNav(category)?.subLinks.find((s) => s.slug === subcat)
  if (link?.memberCats) {
    if (!link.memberCats.includes(prod.cat)) return false
    if (link.unit && prod.unit !== link.unit) return false
    return true
  }
  return prod.subcat === subcat
}

export function filterProducts(products: Product[], filters: ProductFilters): Product[] {
  let list = products.slice()

  if (filters.search) {
    const q = filters.search.toLowerCase()
    list = list.filter((p) => p.name.toLowerCase().includes(q))
  } else {
    if (filters.category !== 'all') {
      const target = canonical(filters.category)
      list = list.filter((p) => canonical(p.cat) === target)
      list = list.filter((p) => matchesSubcat(p, filters.category, filters.subcat))
      if (filters.capacity !== 'all') list = list.filter((p) => p.capacity === filters.capacity)
    }
    if (filters.themes.length > 0) {
      list = list.filter((p) => (p.themes ?? []).some((t) => filters.themes.includes(t)))
    }
  }

  if (filters.priceBucket === 'low') list = list.filter((p) => p.price <= 5000)
  if (filters.priceBucket === 'mid') list = list.filter((p) => p.price > 5000 && p.price <= 20000)
  if (filters.priceBucket === 'high') list = list.filter((p) => p.price > 20000)

  if (filters.personalizableOnly) list = list.filter((p) => p.personalizable)

  if (canonical(filters.category) === 'impresion-3d' && filters.brand !== 'all') {
    list = list.filter((p) => p.brand === filters.brand)
  }

  if (filters.sort === 'price-asc') list = list.slice().sort((a, b) => a.price - b.price)
  if (filters.sort === 'price-desc') list = list.slice().sort((a, b) => b.price - a.price)

  return list
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/storefront/filter.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: FAIL in `CategoryPage.tsx` — it calls `filterProducts` without the new fields. That is fixed in Task 5. **For this task's commit gate, run the narrower check instead:**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v CategoryPage || true`
Expected: no errors outside `CategoryPage.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/features/storefront/filter.ts src/features/storefront/filter.test.ts
git commit -m "feat(storefront): add subcat/capacity/themes facets to filterProducts"
```

---

## Task 4: Nav bar + mega-menu + mobile drawer (`StorefrontNav.tsx`)

**Files:**
- Create: `src/features/storefront/useMediaQuery.ts`
- Create: `src/features/storefront/StorefrontNav.tsx`
- Create: `src/features/storefront/StorefrontNav.test.tsx`
- Modify: `src/features/storefront/StorefrontLayout.tsx`
- Modify: `src/features/storefront/storefront.css`
- Modify: `src/test/setup.ts`

**Interfaces:**
- Consumes: `NAV` from `./navigation`.
- Produces: `default export StorefrontNav` (no props); `useMediaQuery(query: string): boolean`.

- [ ] **Step 1: Add the `matchMedia` polyfill to the test setup**

Append to `src/test/setup.ts`:

```ts
// jsdom has no matchMedia — provide a minimal, overridable stub.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
```

- [ ] **Step 2: Write `useMediaQuery.ts`**

```ts
import { useEffect, useState } from 'react'

/** Reactive `window.matchMedia` wrapper. SSR-safe (returns false when no window). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}
```

- [ ] **Step 3: Write the failing test**

Create `src/features/storefront/StorefrontNav.test.tsx`:

```tsx
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import StorefrontNav from './StorefrontNav'

function setViewport(width: number) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width: 900px') ? width >= 900 : width <= 899,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

const renderNav = () =>
  render(
    <MemoryRouter>
      <StorefrontNav />
    </MemoryRouter>,
  )

afterEach(() => {
  document.body.style.overflow = ''
})

describe('StorefrontNav — desktop', () => {
  beforeEach(() => setViewport(1200))

  it('shows all 11 category triggers plus "Todas"', () => {
    renderNav()
    expect(screen.getByRole('link', { name: 'Todas' })).toBeInTheDocument()
    expect(screen.getByText('Vasos Ferneteros')).toBeInTheDocument()
    expect(screen.getByText('Impresión 3D')).toBeInTheDocument()
  })

  it('opens a mega-menu panel on hover and lists its sub-links', async () => {
    renderNav()
    const group = screen.getByText('Vasos Ferneteros').closest('.sf-nav__group')!
    fireEvent.mouseEnter(group)
    const panel = await screen.findByRole('region', { name: 'Vasos Ferneteros' })
    expect(within(panel).getByRole('link', { name: 'Fútbol y Clubes' })).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Ver todo' })).toBeInTheDocument()
  })
})

describe('StorefrontNav — mobile', () => {
  beforeEach(() => setViewport(390))

  it('opens the drawer and expands one category at a time', () => {
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: /Categorías/ }))
    expect(screen.getByRole('link', { name: 'Todas las categorías' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /subcategorías de Vasos Milkshake/i }))
    expect(screen.getByRole('link', { name: 'Toy Story' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /subcategorías de Trofeos y Premios/i }))
    expect(screen.queryByRole('link', { name: 'Toy Story' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Deportivos' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/features/storefront/StorefrontNav.test.tsx`
Expected: FAIL — cannot resolve `./StorefrontNav`.

- [ ] **Step 5: Write `StorefrontNav.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { NAV, type NavCategory } from './navigation'
import { useMediaQuery } from './useMediaQuery'

const OPEN_DELAY = 120
const CLOSE_DELAY = 200

function subLinkTo(catSlug: string, subSlug: string): string {
  return `/categoria/${catSlug}?sub=${subSlug}`
}

export default function StorefrontNav() {
  const isDesktop = useMediaQuery('(min-width: 900px)')
  return isDesktop ? <DesktopNav /> : <MobileNav />
}

function DesktopNav() {
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const openTimer = useRef<number | undefined>(undefined)
  const closeTimer = useRef<number | undefined>(undefined)
  const location = useLocation()

  useEffect(() => {
    setOpenSlug(null)
  }, [location.pathname, location.search])

  useEffect(
    () => () => {
      window.clearTimeout(openTimer.current)
      window.clearTimeout(closeTimer.current)
    },
    [],
  )

  const scheduleOpen = (slug: string) => {
    window.clearTimeout(closeTimer.current)
    openTimer.current = window.setTimeout(() => setOpenSlug(slug), OPEN_DELAY)
  }
  const scheduleClose = () => {
    window.clearTimeout(openTimer.current)
    closeTimer.current = window.setTimeout(() => setOpenSlug(null), CLOSE_DELAY)
  }
  const closeNow = () => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
    setOpenSlug(null)
  }

  const openCat: NavCategory | undefined = NAV.find((c) => c.slug === openSlug)

  return (
    <nav
      className="sf-nav"
      aria-label="Categorías"
      onMouseLeave={scheduleClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') closeNow()
      }}
    >
      <div className="sf-nav__bar">
        <Link className="sf-nav__item" to="/categoria/todas" onFocus={closeNow}>
          Todas
        </Link>
        {NAV.map((c) => (
          <div key={c.slug} className="sf-nav__group" onMouseEnter={() => scheduleOpen(c.slug)}>
            <Link
              to={`/categoria/${c.slug}`}
              className={`sf-nav__item ${openSlug === c.slug ? 'sf-nav__item--open' : ''}`}
              aria-expanded={openSlug === c.slug}
              aria-haspopup={c.subLinks.length > 0}
              onFocus={() => (c.subLinks.length ? setOpenSlug(c.slug) : closeNow())}
            >
              <span aria-hidden="true">{c.icon}</span> {c.name}
            </Link>
          </div>
        ))}
      </div>

      {openCat && openCat.subLinks.length > 0 && (
        <>
          <div className="sf-megamenu__scrim" aria-hidden="true" onMouseEnter={scheduleClose} />
          <div
            className="sf-megamenu"
            role="region"
            aria-label={openCat.name}
            onMouseEnter={() => window.clearTimeout(closeTimer.current)}
            onMouseLeave={scheduleClose}
          >
            <div className="sf-megamenu__inner">
              <div className="sf-megamenu__title">
                <span aria-hidden="true">{openCat.icon}</span> {openCat.name}
              </div>
              <ul className="sf-megamenu__cols">
                <li>
                  <Link
                    to={`/categoria/${openCat.slug}`}
                    className="sf-megamenu__link sf-megamenu__link--all"
                  >
                    Ver todo
                  </Link>
                </li>
                {openCat.subLinks.map((s) => (
                  <li key={s.slug}>
                    <Link to={subLinkTo(openCat.slug, s.slug)} className="sf-megamenu__link">
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </nav>
  )
}

function MobileNav() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const location = useLocation()

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!drawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [drawerOpen])

  return (
    <nav className="sf-nav sf-nav--mobile" aria-label="Categorías">
      <button
        type="button"
        className="sf-nav__toggle"
        aria-expanded={drawerOpen}
        aria-controls="sf-drawer"
        onClick={() => setDrawerOpen((v) => !v)}
      >
        <span aria-hidden="true">☰</span> Categorías
      </button>

      {drawerOpen && (
        <div className="sf-drawer__scrim" aria-hidden="true" onClick={() => setDrawerOpen(false)} />
      )}

      <div id="sf-drawer" className={`sf-drawer ${drawerOpen ? 'sf-drawer--open' : ''}`}>
        <div className="sf-drawer__head">
          <span>Categorías</span>
          <button
            type="button"
            className="sf-drawer__close"
            aria-label="Cerrar menú"
            onClick={() => setDrawerOpen(false)}
          >
            ✕
          </button>
        </div>
        <ul className="sf-drawer__list">
          <li>
            <Link to="/categoria/todas" className="sf-drawer__cat">
              Todas las categorías
            </Link>
          </li>
          {NAV.map((c) => (
            <li key={c.slug}>
              <div className="sf-drawer__row">
                <Link to={`/categoria/${c.slug}`} className="sf-drawer__cat">
                  <span aria-hidden="true">{c.icon}</span> {c.name}
                </Link>
                {c.subLinks.length > 0 && (
                  <button
                    type="button"
                    className="sf-drawer__expand"
                    aria-expanded={expanded === c.slug}
                    aria-label={`Ver subcategorías de ${c.name}`}
                    onClick={() => setExpanded((v) => (v === c.slug ? null : c.slug))}
                  >
                    {expanded === c.slug ? '▲' : '▼'}
                  </button>
                )}
              </div>
              {expanded === c.slug && c.subLinks.length > 0 && (
                <ul className="sf-drawer__sub">
                  {c.subLinks.map((s) => (
                    <li key={s.slug}>
                      <Link to={subLinkTo(c.slug, s.slug)} className="sf-drawer__sublink">
                        {s.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/features/storefront/StorefrontNav.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 7: Wire into `StorefrontLayout.tsx`**

- Add import: `import StorefrontNav from './StorefrontNav'`
- Remove `CATEGORIES` from the `'./data/products'` import (line 3) — it is no longer used here.
- Replace the entire `<nav className="sf-cat-nav" ...> ... </nav>` block with:

```tsx
        <StorefrontNav />
```

- [ ] **Step 8: Update the CSS**

In `src/features/storefront/storefront.css`:

1. **Delete** the dead rules: `.sf-cat-nav`, `.sf-cat-nav__item`, `.sf-cat-nav__item:hover`, `.sf-cat-nav__item--active` (the block that starts at `.sf-cat-nav {`).

2. **Append** this block at the end of the file:

```css
/* ---------------------------------------------------------------------------
   Storefront nav — desktop bar + mega-menu, mobile drawer.
--------------------------------------------------------------------------- */

.sf-nav {
  position: relative;
  border-bottom: 1px solid var(--color-carbon-soft);
}

.sf-nav__bar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  max-width: 72rem;
  margin-inline: auto;
  padding: 0.5rem 1rem;
  overflow-x: auto;
  scrollbar-width: none;
}
.sf-nav__bar::-webkit-scrollbar {
  display: none;
}

.sf-nav__group {
  flex-shrink: 0;
}

.sf-nav__item {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  white-space: nowrap;
  padding: 0.4rem 0.6rem;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-carbon-muted);
  text-decoration: none;
  cursor: pointer;
  transition: background-color 150ms ease-out, color 150ms ease-out;
}
.sf-nav__item:hover,
.sf-nav__item--open {
  background: var(--color-carbon-soft);
  color: var(--color-carbon);
}

.sf-megamenu__scrim {
  position: fixed;
  inset: 0;
  top: 0;
  background: rgba(0, 0, 0, 0.15);
  z-index: 39;
}

.sf-megamenu {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  z-index: 41;
  background: var(--color-white);
  border-bottom: 1px solid var(--color-carbon-soft);
  box-shadow: 0 12px 24px -12px rgba(0, 0, 0, 0.25);
  animation: sf-megamenu-in 160ms ease-out;
}

@keyframes sf-megamenu-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}

.sf-megamenu__inner {
  max-width: 72rem;
  margin-inline: auto;
  padding: 1.25rem 1rem 1.75rem;
}

.sf-megamenu__title {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-carbon-muted);
  margin-bottom: 0.75rem;
}

.sf-megamenu__cols {
  list-style: none;
  margin: 0;
  padding: 0;
  columns: 3 12rem;
  column-gap: 2rem;
}

.sf-megamenu__link {
  display: block;
  padding: 0.4rem 0;
  font-size: 0.9375rem;
  color: var(--color-carbon);
  text-decoration: none;
}
.sf-megamenu__link:hover {
  color: var(--color-accent-700);
}
.sf-megamenu__link--all {
  font-weight: 800;
}

.sf-nav--mobile .sf-nav__bar {
  display: none;
}

.sf-nav__toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 72rem;
  margin-inline: auto;
  padding: 0.7rem 1rem;
  border: 0;
  background: none;
  font-size: 0.875rem;
  font-weight: 800;
  color: var(--color-carbon);
  cursor: pointer;
}

.sf-drawer__scrim {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 49;
}

.sf-drawer {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  width: min(86vw, 340px);
  z-index: 50;
  background: var(--color-white);
  transform: translateX(-100%);
  transition: transform 220ms ease-out;
  overflow-y: auto;
}
.sf-drawer--open {
  transform: translateX(0);
}

.sf-drawer__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  font-weight: 800;
  border-bottom: 1px solid var(--color-carbon-soft);
}

.sf-drawer__close {
  border: 0;
  background: none;
  font-size: 1rem;
  cursor: pointer;
  color: var(--color-carbon-muted);
}

.sf-drawer__list {
  list-style: none;
  margin: 0;
  padding: 0.5rem 0;
}

.sf-drawer__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sf-drawer__cat {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-carbon);
  text-decoration: none;
}

.sf-drawer__expand {
  padding: 0.75rem 1rem;
  border: 0;
  background: none;
  font-size: 0.7rem;
  color: var(--color-carbon-muted);
  cursor: pointer;
}

.sf-drawer__sub {
  list-style: none;
  margin: 0;
  padding: 0 0 0.5rem;
  background: var(--color-carbon-soft);
}

.sf-drawer__sublink {
  display: block;
  padding: 0.55rem 1rem 0.55rem 2.25rem;
  font-size: 0.875rem;
  color: var(--color-carbon);
  text-decoration: none;
}
.sf-drawer__sublink:hover {
  color: var(--color-accent-700);
}

/* ---------------------------------------------------------------------------
   Custom-order CTA + "a pedido" soft tag + mobile filter sheet + collection tile.
--------------------------------------------------------------------------- */

.sf-cta-strip,
.sf-cta-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  border: 1px solid var(--color-carbon-soft);
  border-radius: var(--radius-sm);
  background: var(--color-carbon-soft);
}
.sf-cta-strip {
  padding: 0.75rem 1rem;
  margin-bottom: 1.25rem;
}
.sf-cta-card {
  padding: 1rem 1.25rem;
  margin: 1.25rem 0;
}
.sf-cta__text {
  flex: 1;
  min-width: 12rem;
  font-size: 0.875rem;
  color: var(--color-carbon);
}

.sf-tag--soft {
  background: transparent;
  border: 1px dashed var(--color-carbon-muted);
  color: var(--color-carbon-muted);
}

.sf-filter-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: var(--color-white);
  border-top-left-radius: 1rem;
  border-top-right-radius: 1rem;
  animation: sf-sheet-in 220ms ease-out;
}
@keyframes sf-sheet-in {
  from {
    transform: translateY(100%);
  }
}
.sf-filter-sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  font-weight: 800;
  border-bottom: 1px solid var(--color-carbon-soft);
}
.sf-filter-sheet__body {
  padding: 1rem;
  overflow-y: auto;
}
.sf-filter-sheet__foot {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  border-top: 1px solid var(--color-carbon-soft);
}
.sf-filter-sheet__foot .btn {
  flex: 1;
}

.sf-collection-tile {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 1rem 1.25rem;
  border: 1px solid var(--color-carbon-soft);
  border-radius: var(--radius-sm);
  background: var(--color-white);
  font-size: 1rem;
  text-align: left;
  cursor: pointer;
}
.sf-collection-tile:hover {
  border-color: var(--color-orange);
}

@media (prefers-reduced-motion: reduce) {
  .sf-megamenu,
  .sf-drawer,
  .sf-filter-sheet {
    animation: none;
    transition: none;
  }
}
```

- [ ] **Step 9: Full verification**

Run: `npm run typecheck && npx vitest run src/features/storefront && npm run lint`
Expected: `typecheck` FAILS only in `CategoryPage.tsx` (Task 5). Vitest storefront suite PASSES except `CategoryPage`-dependent specs do not exist yet. Lint PASSES.

Then: `npm run dev`, open `http://localhost:5173`, confirm the desktop bar shows 11 categories, hovering opens a panel; resize to < 900px and confirm the hamburger drawer works.

- [ ] **Step 10: Commit**

```bash
git add src/features/storefront/useMediaQuery.ts src/features/storefront/StorefrontNav.tsx src/features/storefront/StorefrontNav.test.tsx src/features/storefront/StorefrontLayout.tsx src/features/storefront/storefront.css src/test/setup.ts
git commit -m "feat(storefront): Apple-style mega-menu nav + mobile drawer"
```

---

## Task 5: Config-driven facet sidebar + mobile filter sheet (`CategoryPage.tsx`)

**Files:**
- Modify: `src/features/storefront/CategoryPage.tsx` (full rewrite)
- Create: `src/features/storefront/CategoryPage.test.tsx`
- Create: `src/features/storefront/CustomOrderCTA.tsx` (minimal stub here; fleshed out in Task 6)
- Delete: `src/features/storefront/subcategories.ts`

**Interfaces:**
- Consumes: `filterProducts`, `PRICE_BUCKETS`, `CapacityValue`, `PriceBucket`, `SortValue` from `./filter`; `findNav`, `THEME_LABELS`, `CATEGORY_ALIASES` from `./navigation`; `PRODUCTS`, `BRAND_LIST` from `./data/products`; `useMediaQuery` from `./useMediaQuery`; `CustomOrderCTA` from `./CustomOrderCTA`.
- Produces: the `/categoria/:slug?` page.

- [ ] **Step 1: Create the `CustomOrderCTA` stub**

Create `src/features/storefront/CustomOrderCTA.tsx`:

```tsx
import { waHref } from '@/lib/whatsapp'

const MSG = 'Hola! Quiero un pedido personalizado (nombre, color o escudo a elección).'

export default function CustomOrderCTA({ variant }: { variant: 'strip' | 'card' }) {
  return (
    <div className={variant === 'card' ? 'sf-cta-card' : 'sf-cta-strip'}>
      <div className="sf-cta__text">
        <strong>¿Lo querés a tu medida?</strong> Personalizamos casi todo con nombres, colores,
        escudos o diseños propios.
      </div>
      <a className="btn btn--primary" href={waHref(MSG)} target="_blank" rel="noopener noreferrer">
        Pedir personalizado
      </a>
    </div>
  )
}
```

- [ ] **Step 2: Write the failing test**

Create `src/features/storefront/CategoryPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import CategoryPage from './CategoryPage'

function setDesktop() {
  window.matchMedia = ((q: string) => ({
    matches: q.includes('min-width: 900px'),
    media: q,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

const renderAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/categoria/:slug?" element={<CategoryPage />} />
      </Routes>
    </MemoryRouter>,
  )

describe('CategoryPage', () => {
  beforeEach(setDesktop)

  it('redirects an alias slug to the canonical category', () => {
    renderAt('/categoria/vasos')
    // "Vasos Ferneteros" appears as the sub-filter heading once the redirect lands
    expect(screen.getAllByText('Vasos Ferneteros').length).toBeGreaterThan(0)
  })

  it('pre-selects the sub-link from ?sub=', () => {
    renderAt('/categoria/vasos-ferneteros?sub=silk-clasicos')
    expect(screen.getByRole('button', { name: 'Silk y Clásicos' }).className).toContain(
      'sf-filters__item--active',
    )
  })

  it('pre-checks a theme from ?tema=', () => {
    renderAt('/categoria/vasos-ferneteros?tema=mundial')
    expect((screen.getByLabelText('Mundial / Selección') as HTMLInputElement).checked).toBe(true)
  })

  it('shows the brand facet only for impresion-3d', () => {
    renderAt('/categoria/impresion-3d')
    expect(screen.getByText('Marca')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/features/storefront/CategoryPage.test.tsx`
Expected: FAIL — current `CategoryPage` imports the deleted `getSubcategories` shape / has no `?sub=` seeding.

- [ ] **Step 4: Rewrite `CategoryPage.tsx`**

Full file contents:

```tsx
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { BRAND_LIST, PRODUCTS } from './data/products'
import { CATEGORY_ALIASES, THEME_LABELS, findNav } from './navigation'
import {
  PRICE_BUCKETS,
  filterProducts,
  type CapacityValue,
  type PriceBucket,
  type SortValue,
} from './filter'
import { useMediaQuery } from './useMediaQuery'
import CustomOrderCTA from './CustomOrderCTA'
import ProductCard from './ProductCard'

const CAPACITY_OPTIONS: { key: CapacityValue; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: '500ml', label: '500 ml' },
  { key: '650ml', label: '650 ml' },
  { key: '1L', label: '1 litro' },
]

export default function CategoryPage() {
  const navigate = useNavigate()
  const { slug = 'todas' } = useParams()
  const [searchParams] = useSearchParams()

  const aliasTarget = slug !== 'todas' && CATEGORY_ALIASES[slug] ? CATEGORY_ALIASES[slug] : null
  const effSlug = aliasTarget ?? slug

  const search = searchParams.get('q') || ''
  const activeCategory = search ? 'all' : effSlug === 'todas' ? 'all' : effSlug
  const nav = findNav(activeCategory)
  const facets = nav?.facets ?? []

  const [priceBucket, setPriceBucket] = useState<PriceBucket>('all')
  const [brand, setBrand] = useState('all')
  const [personalizableOnly, setPersonalizableOnly] = useState(false)
  const [sort, setSort] = useState<SortValue>('relevance')
  const [sub, setSub] = useState(searchParams.get('sub') || 'all')
  const [capacity, setCapacity] = useState<CapacityValue>('all')
  const [themes, setThemes] = useState<string[]>(() => {
    const t = searchParams.get('tema')
    return t ? [t] : []
  })

  const isMobile = useMediaQuery('(max-width: 899px)')
  const [sheetOpen, setSheetOpen] = useState(false)

  const title = search ? `Resultados para "${search}"` : nav ? nav.name : 'Todas las categorías'

  // Re-seed facets from the URL whenever the category (or its query) changes.
  useEffect(() => {
    setSub(searchParams.get('sub') || 'all')
    const t = searchParams.get('tema')
    setThemes(t ? [t] : [])
    setCapacity('all')
    setPriceBucket('all')
    setBrand('all')
    setPersonalizableOnly(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, searchParams.get('sub'), searchParams.get('tema')])

  const list = useMemo(
    () =>
      filterProducts(PRODUCTS, {
        search,
        category: activeCategory,
        subcat: sub,
        capacity,
        themes,
        priceBucket,
        brand,
        personalizableOnly,
        sort,
      }),
    [search, activeCategory, sub, capacity, themes, priceBucket, brand, personalizableOnly, sort],
  )

  const themeOptions = useMemo(() => {
    if (!facets.includes('tema')) return [] as { slug: string; label: string }[]
    const target = nav?.slug
    const set = new Set<string>()
    for (const p of PRODUCTS) {
      if ((findNav(p.cat)?.slug ?? p.cat) !== target) continue
      for (const t of p.themes ?? []) set.add(t)
    }
    return [...set].sort().map((s) => ({ slug: s, label: THEME_LABELS[s] ?? s }))
  }, [facets, nav])

  const toggleTheme = (t: string) =>
    setThemes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

  const clearAll = () => {
    setSub('all')
    setCapacity('all')
    setThemes([])
    setPriceBucket('all')
    setBrand('all')
    setPersonalizableOnly(false)
  }

  if (aliasTarget) {
    const qs = searchParams.toString()
    return <Navigate to={`/categoria/${aliasTarget}${qs ? `?${qs}` : ''}`} replace />
  }

  const filtersBody = (
    <>
      {facets.includes('subcat') && nav && nav.subLinks.length > 0 && (
        <FilterGroup heading={nav.name}>
          <FilterButton active={sub === 'all'} onClick={() => setSub('all')}>
            Todas
          </FilterButton>
          {nav.subLinks.map((s) => (
            <FilterButton key={s.slug} active={sub === s.slug} onClick={() => setSub(s.slug)}>
              {s.label}
            </FilterButton>
          ))}
        </FilterGroup>
      )}

      {facets.includes('capacidad') && (
        <FilterGroup heading="Capacidad">
          {CAPACITY_OPTIONS.map((c) => (
            <FilterButton key={c.key} active={capacity === c.key} onClick={() => setCapacity(c.key)}>
              {c.label}
            </FilterButton>
          ))}
        </FilterGroup>
      )}

      {facets.includes('tema') && themeOptions.length > 0 && (
        <FilterGroup heading="Temática">
          {themeOptions.map((t) => (
            <label key={t.slug} className="sf-filters__checkbox">
              <input
                type="checkbox"
                checked={themes.includes(t.slug)}
                onChange={() => toggleTheme(t.slug)}
              />
              {t.label}
            </label>
          ))}
        </FilterGroup>
      )}

      <FilterGroup heading="Precio">
        {PRICE_BUCKETS.map((b) => (
          <FilterButton
            key={b.key}
            active={priceBucket === b.key}
            onClick={() => setPriceBucket(b.key)}
          >
            {b.label}
          </FilterButton>
        ))}
      </FilterGroup>

      {facets.includes('marca') && (
        <FilterGroup heading="Marca">
          <FilterButton active={brand === 'all'} onClick={() => setBrand('all')}>
            Todas
          </FilterButton>
          {BRAND_LIST.map((b) => (
            <FilterButton key={b.slug} active={brand === b.slug} onClick={() => setBrand(b.slug)}>
              {b.name}
            </FilterButton>
          ))}
        </FilterGroup>
      )}

      {facets.includes('personalizable') && (
        <label className="sf-filters__checkbox">
          <input
            type="checkbox"
            checked={personalizableOnly}
            onChange={(e) => setPersonalizableOnly(e.target.checked)}
          />
          Sólo personalizables (a medida)
        </label>
      )}
    </>
  )

  return (
    <div className="sf-section">
      <div className="sf-breadcrumb">
        <button type="button" className="sf-breadcrumb__link" onClick={() => navigate('/')}>
          Inicio
        </button>
        {' / '}
        <span className="sf-breadcrumb__current">{title}</span>
      </div>

      <div className="sf-category">
        {!isMobile && <aside className="sf-filters">{filtersBody}</aside>}

        <div>
          <CustomOrderCTA variant="strip" />

          <div className="sf-results-bar">
            <span className="sf-muted" style={{ fontSize: '0.9rem' }}>
              {list.length} resultado{list.length === 1 ? '' : 's'}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {isMobile && (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setSheetOpen(true)}
                >
                  Filtros
                </button>
              )}
              <select
                className="sf-input"
                style={{ width: 'auto' }}
                value={sort}
                onChange={(e) => setSort(e.target.value as SortValue)}
              >
                <option value="relevance">Relevancia</option>
                <option value="price-asc">Menor precio</option>
                <option value="price-desc">Mayor precio</option>
              </select>
            </div>
          </div>

          {list.length > 0 ? (
            <div className="sf-product-grid" style={{ marginTop: '1.25rem' }}>
              {list.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="sf-empty sf-muted">No encontramos productos con estos filtros.</div>
          )}
        </div>
      </div>

      {isMobile && sheetOpen && (
        <>
          <div
            className="sf-drawer__scrim"
            aria-hidden="true"
            onClick={() => setSheetOpen(false)}
          />
          <div className="sf-filter-sheet" role="dialog" aria-label="Filtros">
            <div className="sf-filter-sheet__head">
              <span>Filtros</span>
              <button
                type="button"
                className="sf-drawer__close"
                aria-label="Cerrar filtros"
                onClick={() => setSheetOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="sf-filter-sheet__body sf-filters">{filtersBody}</div>
            <div className="sf-filter-sheet__foot">
              <button type="button" className="btn btn--secondary" onClick={clearAll}>
                Limpiar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setSheetOpen(false)}
              >
                Ver {list.length} resultados
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function FilterGroup({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div>
      <div className="sf-filters__heading">{heading}</div>
      <div className="sf-filters__list">{children}</div>
    </div>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`sf-filters__item ${active ? 'sf-filters__item--active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 5: Delete `subcategories.ts`**

```bash
git rm src/features/storefront/subcategories.ts
```

Confirm nothing else imports it: `grep -rn "subcategories" src/` should return only this plan / spec references (none in `src/`).

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/features/storefront/CategoryPage.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 7: Full verification**

Run: `npm run typecheck && npm test && npm run lint`
Expected: PASS across the board.

- [ ] **Step 8: Commit**

```bash
git add src/features/storefront/CategoryPage.tsx src/features/storefront/CategoryPage.test.tsx src/features/storefront/CustomOrderCTA.tsx
git rm src/features/storefront/subcategories.ts
git commit -m "feat(storefront): config-driven facet sidebar + mobile filter sheet + alias redirect"
```

---

## Task 6: Personalization messaging + HomePage wiring

**Files:**
- Modify: `src/features/storefront/ProductCard.tsx`
- Modify: `src/features/storefront/ProductDetailPage.tsx`
- Modify: `src/features/storefront/HomePage.tsx`

**Interfaces:**
- Consumes: `NAV` from `./navigation`; `CustomOrderCTA` from `./CustomOrderCTA` (Task 5); `Product.customOnRequest` (Task 2).

- [ ] **Step 1: `ProductCard.tsx` — soft tag**

In the `product-card__tags` block, after the existing `{product.personalizable && ...}` line, add:

```tsx
          {!product.personalizable && product.customOnRequest && (
            <span className="sf-tag sf-tag--soft">Personalizable a pedido</span>
          )}
```

- [ ] **Step 2: `ProductDetailPage.tsx` — soft tag + CTA card**

1. Add import at the top:

```tsx
import CustomOrderCTA from './CustomOrderCTA'
```

2. In the `sf-product__tags` block, after the `{product.personalizable && ...}` line, add the same soft-tag snippet as Step 1.

3. Immediately after the closing `</div>` of `sf-product__actions` (and before `<hr className="sf-hr" />`), add:

```tsx
          {product.customOnRequest && <CustomOrderCTA variant="card" />}
```

- [ ] **Step 3: `HomePage.tsx` — category grid from `NAV` + Mundial tile**

1. Change the import block: remove `CATEGORIES` from `'./data/products'`, add a new import:

```tsx
import { NAV } from './navigation'
```

2. Delete the `CATEGORY_ICON` constant (the `const CATEGORY_ICON: Record<string, string> = { ... }` block).

3. Replace the "Categorías" section's `.sf-cat-grid` mapping:

```tsx
        <div className="sf-cat-grid">
          {NAV.map((c) => (
            <button
              key={c.slug}
              type="button"
              className="sf-cat-card"
              onClick={() => navigate(`/categoria/${c.slug}`)}
            >
              <span className="sf-cat-card__icon" aria-hidden="true">
                {c.icon}
              </span>
              <span className="sf-cat-card__name">{c.name}</span>
            </button>
          ))}
        </div>
```

4. Directly after the closing `</section>` of the "Categorías" section, add a new section:

```tsx
      <section className="sf-section" style={{ paddingTop: 0 }}>
        <button
          type="button"
          className="sf-collection-tile"
          onClick={() => navigate('/categoria/todas?tema=mundial')}
        >
          <span aria-hidden="true" style={{ fontSize: '1.5rem' }}>
            🇦🇷
          </span>
          <span>
            <strong>Colección Mundial / Selección</strong>
            <span className="sf-muted"> — vasos, mates, réplicas y llaveros de la Scaloneta</span>
          </span>
        </button>
      </section>
```

- [ ] **Step 4: Verification**

Run: `npm run typecheck && npm test && npm run lint`
Expected: PASS.

Then `npm run build`
Expected: PASS (no unused-import or type errors).

- [ ] **Step 5: Commit**

```bash
git add src/features/storefront/ProductCard.tsx src/features/storefront/ProductDetailPage.tsx src/features/storefront/HomePage.tsx
git commit -m "feat(storefront): two-tier personalizable messaging + Mundial collection tile"
```

---

## Task 7: End-to-end verification & manual pass

**Files:** none (verification only).

- [ ] **Step 1: Full automated suite**

Run: `npm run typecheck && npm test && npm run lint && npm run build`
Expected: all PASS. If anything fails, fix in the owning task's file and re-run.

- [ ] **Step 2: Manual — desktop**

Run: `npm run dev`. In the Browser pane at `http://localhost:5173` (desktop width):
- Nav bar shows 11 categories + "Todas"; horizontal scroll appears only if the window is narrow.
- Hovering a category opens its panel after ~120 ms; moving the pointer into the panel keeps it open; leaving closes it after ~200 ms.
- `Esc` closes an open panel.
- Clicking "Fútbol y Clubes" under Vasos Ferneteros lands on `/categoria/vasos-ferneteros?sub=futbol-clubes` with that sub-filter pre-selected and the list narrowed.
- `/categoria/vasos` redirects to `/categoria/vasos-ferneteros`.
- Home "Colección Mundial / Selección" tile → `/categoria/todas?tema=mundial`, list shows only Mundial-themed products.
- A non-personalizable, non-printer product card shows the dashed "Personalizable a pedido" tag; a printer card does not.

- [ ] **Step 3: Manual — mobile**

`resize_window` to 390 px (or DevTools device mode):
- The bar is replaced by a "☰ Categorías" button; tapping opens the left drawer with a scrim; body scroll is locked.
- Tapping a category's chevron expands its sub-links; opening another collapses the first.
- Tapping a link navigates and closes the drawer.
- On a category page, a "Filtros" button appears; tapping opens the bottom sheet; "Limpiar" resets, "Ver N resultados" closes.

- [ ] **Step 4: Manual — reduced motion**

With OS "reduce motion" on (or emulated), confirm the panel/drawer/sheet appear without slide/fade animation.

- [ ] **Step 5: Final commit (if any manual fixes were needed)**

```bash
git add -A
git commit -m "fix(storefront): manual QA follow-ups for taxonomy nav"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task(s) |
|---|---|
| `navigation.ts` single source of truth | Task 1 |
| Back-compat `CATEGORIES`/`findCategory` | Task 1 (defs) + Task 2 (re-export) |
| 11-category taxonomy + sub-links + `mundial` theme | Task 1 (config) + Task 2 (tagging) + Task 6 (home tile) |
| `Product` fields `subcat`/`themes`/`capacity`/`customOnRequest` | Task 2 |
| Split `vasos` → ferneteros/milkshake, ids stable | Task 2 (Step 5) |
| `filamentos`/`impresoras` slugs retained for `pricing.ts` | Task 2 (Step 6), Global Constraints |
| `navigation.test.ts` integrity checks | Task 1 + Task 2 |
| `StorefrontNav` desktop hover panel (text links) | Task 4 |
| `StorefrontNav` mobile drawer + accordion + scroll lock | Task 4 |
| a11y: real links, `aria-expanded`/`aria-controls`, `Esc` | Task 4 |
| `prefers-reduced-motion` | Task 4 (CSS Step 8) |
| `filter.ts` new facets, pure, tested | Task 3 |
| `CategoryPage` `?sub=`/`?tema=` seeding | Task 5 |
| `CategoryPage` config-driven facet sections | Task 5 |
| `CategoryPage` mobile filter sheet | Task 5 |
| Alias redirect `/categoria/vasos` | Task 5 |
| `CustomOrderCTA` strip + card | Task 5 (create) + Task 6 (wire card) |
| Two-tier personalizable (badge + soft tag) | Task 6 |
| `HomePage` grid from `NAV`, `BANNERS` slugs | Task 2 (BANNERS) + Task 6 (grid) |
| `storefront.css` additions, dead `.sf-cat-nav` removed | Task 4 (Step 8) |
| Delete `subcategories.ts` | Task 5 (Step 5) |
| RTL tests for nav + category page | Task 4 + Task 5 |

No spec requirement is left without a task.

**2. Placeholder scan** — no "TBD"/"handle edge cases"/"similar to Task N". Every code step has full contents. The only cross-task dependency notes ("fixed in Task 5") are paired with a concrete narrower verification command so each task still has a green gate.

**3. Type consistency**

- `SubLink`/`NavCategory`/`Facet` defined in Task 1, consumed verbatim in Tasks 3–5.
- `filterProducts(products, filters)` signature identical in Task 3 def and Task 5 call; the `ProductFilters` object built in `CategoryPage` includes exactly the 9 fields defined in Task 3 (`search, category, subcat, capacity, themes, priceBucket, brand, personalizableOnly, sort`).
- `CapacityValue` (`'all' | '500ml' | '650ml' | '1L'`) in `filter.ts` vs `Capacity` (`'500ml' | '650ml' | '1L'`) on the `Product` — deliberately different (the filter has an extra `'all'`); `CategoryPage` `CAPACITY_OPTIONS` keys are typed `CapacityValue`.
- `customOnRequest` is non-optional `boolean` on `Product` (Task 2) and every fixture/product literal in Tasks 2, 3, 6 sets it.
- `CustomOrderCTA` prop `variant: 'strip' | 'card'` defined Task 5, used with `"strip"` (CategoryPage) and `"card"` (ProductDetailPage) only.
- `findNav` returns `NavCategory | undefined`; every call site guards (`?.` or `if (nav)`).

Fixes applied inline: none needed on re-read.
