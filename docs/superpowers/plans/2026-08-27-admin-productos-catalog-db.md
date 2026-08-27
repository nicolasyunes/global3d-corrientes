# Admin de productos: catálogo en DB + rediseño + import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `/admin/productos` en un gestor de catálogo respaldado por la DB — grilla editable con autosave + editor de una página estilo Shopify — y cargar los ~80 productos existentes a Supabase.

**Architecture:** Migración aditiva sobre `products` + dos tablas nuevas (`categories`, `product_images`). Un módulo puro `catalog-taxonomy.ts` mapea el catálogo estático legacy a la taxonomía nueva y es compartido por el editor y el script de import. La UI se reescribe en dos componentes (`ProductsList` grilla, `ProductForm` editor) sobre helpers `.api.ts` typados. El storefront no se toca en esta spec.

**Tech Stack:** React 18 + react-router 6, TypeScript, Vite, Vitest + Testing Library, `@supabase/supabase-js`, `pg` (solo scripts), Postgres/Supabase con RLS.

**Spec:** [docs/superpowers/specs/2026-08-27-admin-productos-catalog-db-design.md](../specs/2026-08-27-admin-productos-catalog-db-design.md)

## Global Constraints

- **Sin dependencias nuevas.** Solo lo ya presente en `package.json` (`pg`, `vite`, `@supabase/supabase-js`, vitest, RTL).
- **RLS del catálogo sigue admin-only.** Ninguna migración de esta spec agrega `select` público sobre `products` / `categories` / `product_images`. Eso es Spec 2.
- **El storefront (`src/features/storefront/**`) no se modifica.** Sigue leyendo `data/products.ts`.
- **`product_variants` no se toca** (tabla preexistente sin uso).
- **Variantes, texto rico, subida masiva de imágenes, mega-menú: fuera de alcance.**
- **Idioma:** todo el texto de UI y de commits en español (rioplatense), como el resto del repo.
- **Money display:** reusar `formatMoney` de `@/features/orders/format` (es-AR, 2 decimales).
- **Convención de commits:** `feat(products): …` / `test(products): …` / `chore(db): …`. Terminar cada mensaje con línea en blanco + `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- **Estilos:** reusar el vocabulario de `orders.css` (`field`, `field__input`, `form-section`, `order-form`, `sticky-cta`, `orders-list`, `chip`, `empty-state`, `form-banner`). Clases nuevas van en `products.css` con prefijo `product-` / `products-`.
- **Bucket de storage:** `product-images` (ya existe, público, escritura admin). No crear buckets.
- **Migración:** archivo en `supabase/migrations/` con nombre `YYYYMMDDHHMMSS_...`. Aplicar vía Supabase MCP (`apply_migration`) contra una development branch; no aplicar a producción (eso es rollout del usuario).
- **Tipos:** tras la migración, `src/lib/database.types.ts` debe reflejar el esquema nuevo. Regenerar con `npm run gen:types -- --db-url "<DATABASE_URL de la branch>"`; si no hay acceso a la DB, aplicar a mano el bloque exacto del Task 1 y dejar anotado que falta correr el drift gate.

---

## File Structure

**Crear:**
- `supabase/migrations/20260827140000_product_catalog_taxonomy_images.sql` — tablas `categories`, `product_images`, columnas nuevas en `products`, RLS, trigger, seed de 11 categorías.
- `src/features/products/catalog-taxonomy.ts` — puro: `slugify`, `CATEGORY_SEED`, `mapLegacyCategory`, `SUBCATEGORY_OPTIONS`, `deriveSubcategory`.
- `src/features/products/catalog-taxonomy.test.ts`
- `src/features/products/ProductForm.test.tsx`
- `src/features/products/ProductsList.test.tsx`
- `scripts/import-catalog.mjs` — carga los ~80 productos desde `data/products.ts`; `--dry-run` + reporte de diferencias de precio contra los PDF.

**Modificar:**
- `src/lib/database.types.ts` — regenerado (tablas/columnas nuevas).
- `src/features/products/validation.ts` — `ProductDraft` con campos nuevos + parsers/validaciones.
- `src/features/products/validation.test.ts` — casos nuevos.
- `src/features/products/list.ts` — `ProductFilter.category` + filtro.
- `src/features/products/list.test.ts` — casos de categoría; `product()` helper con campos nuevos.
- `src/features/products/products.api.ts` — `listCategories`, galería CRUD, `bulkUpdateProducts`, `uploadProductImage(productId, file, position)`.
- `src/features/products/ProductForm.tsx` — reescritura (editor de una página, dos columnas).
- `src/features/products/ProductsList.tsx` — reescritura (grilla editable + alta rápida + acciones masivas).
- `src/features/products/products.css` — clases nuevas para grilla y editor.
- `package.json` — script `"import:catalog": "node scripts/import-catalog.mjs"`.

**Orden de tasks:** 1 (schema) → 2 (`catalog-taxonomy`) → 3 (`validation`) → 4 (`list`) → 5 (`products.api`) → 6 (`ProductForm`) → 7 (`ProductsList`) → 8 (`import-catalog`).

---

## Task 1: Migración de esquema + seed de taxonomía + tipos

**Files:**
- Create: `supabase/migrations/20260827140000_product_catalog_taxonomy_images.sql`
- Modify: `src/lib/database.types.ts`

**Interfaces:**
- Produces (tablas/columnas que las tasks siguientes consumen vía `Database['public']['Tables']`):
  - `categories`: `{ id, slug, name, icon | null, position, featured, created_at, updated_at }`
  - `product_images`: `{ id, product_id, path, url, position, alt | null, created_at }`
  - `products` + `slug|null, sku|null, compare_at_price|null, custom_on_request, personalizable, weight_grams|null, category_id|null, subcategory|null`

- [ ] **Step 1: Escribir la migración SQL**

Crear `supabase/migrations/20260827140000_product_catalog_taxonomy_images.sql`:

```sql
-- Catálogo respaldado por la DB: taxonomía de categorías, galería de imágenes
-- por producto, y campos de e-commerce sobre `products`. Aditivo. RLS sigue
-- admin-only (el select público del storefront es una spec posterior).

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon text,
  position integer not null default 0,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

insert into public.categories (slug, name, icon, position, featured) values
  ('vasos-ferneteros', 'Vasos Ferneteros',          '🍺', 0, true),
  ('vasos-milkshake',  'Vasos Milkshake',           '🥤', 1, true),
  ('figuras',          'Figuras y Coleccionables',  '🧸', 2, false),
  ('mates',            'Mates',                     '🧉', 3, false),
  ('golosineros',      'Alcancías y Golosineros',   '💰', 4, false),
  ('llaveros',         'Llaveros y Merch',          '🔑', 5, false),
  ('trofeos',          'Trofeos y Premios',         '🏆', 6, false),
  ('hogar',            'Hogar y Decoración',        '🏠', 7, false),
  ('juegos',           'Juegos y Juguetes',         '🎲', 8, false),
  ('combos',           'Combos',                    '🎁', 9, false),
  ('impresion-3d',     'Impresión 3D',              '🖨️', 10, false);

-- ---------------------------------------------------------------------------
-- product_images (galería; la portada se espeja en products.image_url)
-- ---------------------------------------------------------------------------
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null,
  url text not null,
  position integer not null default 0,
  alt text,
  created_at timestamptz not null default now(),
  unique (product_id, path)
);

create index product_images_product_id_position_idx
  on public.product_images (product_id, position);

-- ---------------------------------------------------------------------------
-- products: campos de e-commerce
-- ---------------------------------------------------------------------------
alter table public.products
  add column slug text unique,
  add column sku text,
  add column compare_at_price numeric(12, 2),
  add column custom_on_request boolean not null default false,
  add column personalizable boolean not null default false,
  add column weight_grams integer check (weight_grams is null or weight_grams >= 0),
  add column category_id uuid references public.categories (id) on delete set null,
  add column subcategory text;

create unique index products_sku_key on public.products (sku) where sku is not null;
create index products_category_id_idx on public.products (category_id);

-- ---------------------------------------------------------------------------
-- RLS: admin-only, igual patrón que products_all. Sin select público (Spec 2).
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.product_images enable row level security;

create policy categories_all on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy product_images_all on public.product_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 2: Aplicar la migración a una development branch**

Cargar las tools del MCP de Supabase:
`ToolSearch` query `select:mcp__18229097-73d0-4606-aec9-9984bb8e863c__list_projects,mcp__18229097-73d0-4606-aec9-9984bb8e863c__create_branch,mcp__18229097-73d0-4606-aec9-9984bb8e863c__apply_migration,mcp__18229097-73d0-4606-aec9-9984bb8e863c__execute_sql,mcp__18229097-73d0-4606-aec9-9984bb8e863c__generate_typescript_types`

- `list_projects` → identificar el proyecto (ref).
- `create_branch` (nombre `catalog-db`) si no existe una branch de trabajo.
- `apply_migration` con `name = "product_catalog_taxonomy_images"` y el SQL del Step 1, contra la branch.

Si no hay acceso al MCP: entregar el `.sql` al usuario para que lo corra en el SQL editor de una branch y pedir el `DATABASE_URL` resultante.

- [ ] **Step 3: Verificar el esquema en la branch**

Con `execute_sql` contra la branch, correr y confirmar:

```sql
select count(*) from public.categories;                -- espera 11
select slug from public.categories order by position;  -- 11 slugs en orden del seed
select column_name from information_schema.columns
  where table_name = 'products'
    and column_name in ('slug','sku','compare_at_price','custom_on_request',
                        'personalizable','weight_grams','category_id','subcategory');
                                                       -- espera 8 filas
select relrowsecurity from pg_class where relname = 'product_images';  -- espera t
```

Expected: los tres counts/listas coinciden con lo comentado.

- [ ] **Step 4: Regenerar tipos**

Run: `npm run gen:types -- --db-url "<DATABASE_URL de la branch>"`
Expected: `src/lib/database.types.ts` cambia y agrega `categories`, `product_images`, y las 8 columnas en `products`.

Si no se puede correr `gen:types`, editar `src/lib/database.types.ts` a mano insertando, dentro de `Database.public.Tables`, en orden alfabético (`categories` antes de `customers`; `product_images` antes de `products`):

```ts
      categories: {
        Row: {
          id: string
          slug: string
          name: string
          icon: string | null
          position: number
          featured: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          icon?: string | null
          position?: number
          featured?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          icon?: string | null
          position?: number
          featured?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
```

```ts
      product_images: {
        Row: {
          id: string
          product_id: string
          path: string
          url: string
          position: number
          alt: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          path: string
          url: string
          position?: number
          alt?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          path?: string
          url?: string
          position?: number
          alt?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
```

Y en `products`: agregar a `Row` `slug: string | null`, `sku: string | null`, `compare_at_price: number | null`, `custom_on_request: boolean`, `personalizable: boolean`, `weight_grams: number | null`, `category_id: string | null`, `subcategory: string | null`; a `Insert` y `Update` los mismos con `?` (y `?` en `custom_on_request` / `personalizable` por tener default). Cambiar `products` `Relationships: []` por:

```ts
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
```

- [ ] **Step 5: Chequear que el proyecto compila**

Run: `npm run typecheck`
Expected: PASS (nada consume los campos nuevos todavía).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260827140000_product_catalog_taxonomy_images.sql src/lib/database.types.ts
git commit
```
Mensaje: `chore(db): categorías, galería de imágenes y campos de e-commerce en products`

---

## Task 2: Módulo puro `catalog-taxonomy.ts`

**Files:**
- Create: `src/features/products/catalog-taxonomy.ts`
- Create: `src/features/products/catalog-taxonomy.test.ts`

**Interfaces:**
- Consumes: `PRODUCTS` de `@/features/storefront/data/products` (solo en el test).
- Produces:
  - `slugify(input: string): string`
  - `CATEGORY_SEED: { slug: string; name: string; icon: string; position: number; featured: boolean }[]` (11 entradas, idénticas al seed de la migración)
  - `CATEGORY_SLUGS: string[]` (los 11 slugs)
  - `mapLegacyCategory(legacyCat: string, name: string): string` (devuelve un slug de `CATEGORY_SLUGS`; `throw` si `legacyCat` es desconocido)
  - `SUBCATEGORY_OPTIONS: Record<string, { slug: string; label: string }[]>` (clave = slug de categoría nueva)
  - `deriveSubcategory(legacyCat: string, product: { name: string; personalizable: boolean; unit?: 'kg' | 'L' }): string | null`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/features/products/catalog-taxonomy.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '@/features/storefront/data/products'
import {
  CATEGORY_SEED,
  CATEGORY_SLUGS,
  deriveSubcategory,
  mapLegacyCategory,
  SUBCATEGORY_OPTIONS,
  slugify,
} from './catalog-taxonomy'

describe('slugify', () => {
  it('normaliza acentos, mayúsculas y espacios', () => {
    expect(slugify('Vaso Fernetero Mandiyú 1 lt')).toBe('vaso-fernetero-mandiyu-1-lt')
  })
  it('colapsa separadores y recorta guiones', () => {
    expect(slugify('  Trofeo / placa  ')).toBe('trofeo-placa')
  })
})

describe('mapLegacyCategory', () => {
  it('mapea vasos milkshake por nombre', () => {
    expect(mapLegacyCategory('vasos', 'Vaso milkshake Sonic')).toBe('vasos-milkshake')
  })
  it('mapea vasos no-milkshake a ferneteros', () => {
    expect(mapLegacyCategory('vasos', 'Vaso Fernetero Boca 1 lt')).toBe('vasos-ferneteros')
  })
  it('colapsa filamentos e impresoras en impresion-3d', () => {
    expect(mapLegacyCategory('filamentos', 'x')).toBe('impresion-3d')
    expect(mapLegacyCategory('impresoras', 'x')).toBe('impresion-3d')
  })
  it('tira error ante una categoría legacy desconocida', () => {
    expect(() => mapLegacyCategory('zarasa', 'x')).toThrow()
  })
})

describe('CATEGORY_SEED', () => {
  it('tiene 11 entradas con slugs únicos y positions 0..10', () => {
    expect(CATEGORY_SEED).toHaveLength(11)
    expect(new Set(CATEGORY_SLUGS).size).toBe(11)
    expect(CATEGORY_SEED.map((c) => c.position)).toEqual([...Array(11).keys()])
  })
})

describe('taxonomía sobre el catálogo real', () => {
  it('cada producto mapea a una categoría válida', () => {
    for (const p of PRODUCTS) {
      expect(CATEGORY_SLUGS).toContain(mapLegacyCategory(p.cat, p.name))
    }
  })
  it('deriveSubcategory devuelve null u opción válida de esa categoría', () => {
    for (const p of PRODUCTS) {
      const catSlug = mapLegacyCategory(p.cat, p.name)
      const sub = deriveSubcategory(p.cat, p)
      if (sub === null) continue
      const allowed = (SUBCATEGORY_OPTIONS[catSlug] ?? []).map((o) => o.slug)
      expect(allowed).toContain(sub)
    }
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/features/products/catalog-taxonomy.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar el módulo**

Crear `src/features/products/catalog-taxonomy.ts`:

```ts
// Puente entre el catálogo estático legacy (src/features/storefront/data/products.ts)
// y la taxonomía nueva respaldada por la DB. Puro: sin DB, sin DOM. Compartido
// por el editor de productos y scripts/import-catalog.mjs. Es el germen de lo
// que la Spec 2 promoverá a un navigation.ts del storefront.

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const CATEGORY_SEED = [
  { slug: 'vasos-ferneteros', name: 'Vasos Ferneteros', icon: '🍺', position: 0, featured: true },
  { slug: 'vasos-milkshake', name: 'Vasos Milkshake', icon: '🥤', position: 1, featured: true },
  { slug: 'figuras', name: 'Figuras y Coleccionables', icon: '🧸', position: 2, featured: false },
  { slug: 'mates', name: 'Mates', icon: '🧉', position: 3, featured: false },
  { slug: 'golosineros', name: 'Alcancías y Golosineros', icon: '💰', position: 4, featured: false },
  { slug: 'llaveros', name: 'Llaveros y Merch', icon: '🔑', position: 5, featured: false },
  { slug: 'trofeos', name: 'Trofeos y Premios', icon: '🏆', position: 6, featured: false },
  { slug: 'hogar', name: 'Hogar y Decoración', icon: '🏠', position: 7, featured: false },
  { slug: 'juegos', name: 'Juegos y Juguetes', icon: '🎲', position: 8, featured: false },
  { slug: 'combos', name: 'Combos', icon: '🎁', position: 9, featured: false },
  { slug: 'impresion-3d', name: 'Impresión 3D', icon: '🖨️', position: 10, featured: false },
] as const

export const CATEGORY_SLUGS: string[] = CATEGORY_SEED.map((c) => c.slug)

export function mapLegacyCategory(legacyCat: string, name: string): string {
  const n = name.toLowerCase()
  switch (legacyCat) {
    case 'combos':
      return 'combos'
    case 'figuras':
      return 'figuras'
    case 'trofeos':
      return 'trofeos'
    case 'llaveros':
      return 'llaveros'
    case 'golosineros':
      return 'golosineros'
    case 'vasos':
      return n.includes('milkshake') ? 'vasos-milkshake' : 'vasos-ferneteros'
    case 'filamentos':
    case 'impresoras':
      return 'impresion-3d'
    default:
      throw new Error(`Categoría legacy desconocida: ${legacyCat}`)
  }
}

export const SUBCATEGORY_OPTIONS: Record<string, { slug: string; label: string }[]> = {
  'vasos-ferneteros': [
    { slug: 'futbol-clubes', label: 'Fútbol y Clubes' },
    { slug: 'mundial', label: 'Mundial / Selección' },
    { slug: 'silk-clasicos', label: 'Silk y Clásicos' },
    { slug: 'otros-disenos', label: 'Otros Deportes y Diseños' },
  ],
  'vasos-milkshake': [
    { slug: 'toy-story', label: 'Toy Story' },
    { slug: 'sonic', label: 'Sonic' },
    { slug: 'stranger-things', label: 'Stranger Things' },
    { slug: 'anime-pop', label: 'Anime & Pop' },
    { slug: 'mundial', label: 'Mundial' },
  ],
  figuras: [
    { slug: 'funko-personalizados', label: 'Funko Pop Personalizados' },
    { slug: 'figuras-grandes', label: 'Figuras Grandes' },
    { slug: 'personalizadas', label: 'Personalizadas' },
    { slug: 'articulados', label: 'Muñecos Articulados' },
  ],
  mates: [
    { slug: 'seleccion-afa', label: 'Selección / AFA' },
    { slug: 'clubes', label: 'Clubes' },
    { slug: 'personalizados', label: 'Personalizados' },
  ],
  golosineros: [
    { slug: 'tematicos', label: 'Modelos Temáticos' },
    { slug: 'huevos', label: 'Huevos Golosineros' },
  ],
  llaveros: [
    { slug: 'flexi', label: 'Flexi Articulados' },
    { slug: 'gaming-infantil', label: 'Gaming e Infantil' },
    { slug: 'futbol-mundial', label: 'Fútbol y Mundial' },
    { slug: 'personalizados-utiles', label: 'Personalizados y Útiles' },
    { slug: 'portalatas', label: 'Portalatas' },
  ],
  trofeos: [
    { slug: 'deportivos', label: 'Deportivos' },
    { slug: 'placas', label: 'Placas y Reconocimientos' },
  ],
  hogar: [
    { slug: 'escritorio', label: 'Escritorio y Organización' },
    { slug: 'decoracion', label: 'Decoración' },
    { slug: 'religiosos', label: 'Religiosos' },
  ],
  juegos: [
    { slug: 'mesa', label: 'De Mesa' },
    { slug: 'habilidad', label: 'Habilidad y Antiestrés' },
    { slug: 'sensoriales', label: 'Sensoriales e Infantiles' },
  ],
  combos: [],
  'impresion-3d': [
    { slug: 'filamentos', label: 'Filamentos' },
    { slug: 'resina', label: 'Resina' },
    { slug: 'impresoras', label: 'Impresoras' },
  ],
}

// Primera pasada best-effort — portada de src/features/storefront/subcategories.ts.
// Lo que no matchea queda null para que el admin lo asigne a mano.
export function deriveSubcategory(
  legacyCat: string,
  product: { name: string; personalizable: boolean; unit?: 'kg' | 'L' },
): string | null {
  const n = product.name.toLowerCase()
  switch (legacyCat) {
    case 'vasos': {
      if (n.includes('milkshake')) {
        if (n.includes('stranger') || n.includes('vecna') || n.includes('demogorgon'))
          return 'stranger-things'
        if (n.includes('sonic')) return 'sonic'
        if (
          n.includes('simpson') || n.includes('intensamente') || n.includes('k-pop') ||
          n.includes('brainrot') || n.includes('labubu') || n.includes('chimuelo')
        )
          return 'anime-pop'
        return null
      }
      if (n.includes('silk')) return 'silk-clasicos'
      if (n.includes('afa') || n.includes('mundial') || n.includes('copa del mundo'))
        return 'mundial'
      if (
        n.includes('boca') || n.includes('river') || n.includes('racing') ||
        n.includes('san lorenzo') || n.includes('mandiy') || n.includes('sapucay') ||
        n.includes('chicago') || n.includes('bulls')
      )
        return 'futbol-clubes'
      return 'otros-disenos'
    }
    case 'figuras': {
      if (n.includes('articulado')) return 'articulados'
      if (n.includes('funko') && product.personalizable) return 'funko-personalizados'
      return null
    }
    case 'trofeos': {
      if (n.includes('placa')) return 'placas'
      return 'deportivos'
    }
    case 'llaveros':
      return product.personalizable ? 'personalizados-utiles' : null
    case 'golosineros':
      return n.includes('huevo') ? 'huevos' : 'tematicos'
    case 'filamentos':
      return product.unit === 'L' ? 'resina' : 'filamentos'
    case 'impresoras':
      return 'impresoras'
    default:
      return null
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/features/products/catalog-taxonomy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/products/catalog-taxonomy.ts src/features/products/catalog-taxonomy.test.ts
git commit
```
Mensaje: `feat(products): módulo puro de mapeo a la taxonomía nueva`

---

## Task 3: Extender `validation.ts`

**Files:**
- Modify: `src/features/products/validation.ts`
- Modify: `src/features/products/validation.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces:
  - `ProductDraft` con: `name, description, basePrice, compareAtPrice (string), stockQuantity, sku (string), weightGrams (string), slug (string), categoryId (string), subcategory (string), personalizable (bool), customOnRequest (bool), active (bool)`
  - `emptyProductDraft(): ProductDraft`
  - `parseNonNegativeDecimal`, `parseNonNegativeInt` (sin cambios)
  - `validateProduct(draft): FieldErrors` — reglas nuevas abajo
  - `FieldErrors = Partial<Record<keyof ProductDraft, string>>`

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/features/products/validation.test.ts` dentro de `describe('validateProduct', …)`:

```ts
it('rechaza un slug con caracteres inválidos', () => {
  const errors = validateProduct({ ...emptyProductDraft(), name: 'X', slug: 'Con Espacios' })
  expect(errors.slug).toBeDefined()
})

it('acepta un slug kebab-case válido', () => {
  const errors = validateProduct({ ...emptyProductDraft(), name: 'X', slug: 'vaso-fernetero-boca' })
  expect(errors.slug).toBeUndefined()
})

it('rechaza un precio comparativo menor o igual al precio base', () => {
  const errors = validateProduct({
    ...emptyProductDraft(), name: 'X', basePrice: '100', compareAtPrice: '100',
  })
  expect(errors.compareAtPrice).toBeDefined()
})

it('acepta un precio comparativo mayor al base', () => {
  const errors = validateProduct({
    ...emptyProductDraft(), name: 'X', basePrice: '100', compareAtPrice: '150',
  })
  expect(errors.compareAtPrice).toBeUndefined()
})

it('rechaza un peso no entero', () => {
  const errors = validateProduct({ ...emptyProductDraft(), name: 'X', weightGrams: '10.5' })
  expect(errors.weightGrams).toBeDefined()
})

it('rechaza un SKU con espacios', () => {
  const errors = validateProduct({ ...emptyProductDraft(), name: 'X', sku: 'A B' })
  expect(errors.sku).toBeDefined()
})
```

- [ ] **Step 2: Correr para verificar que fallan**

Run: `npx vitest run src/features/products/validation.test.ts`
Expected: FAIL (campos `slug`/`compareAtPrice`/`weightGrams`/`sku` no existen en `ProductDraft`).

- [ ] **Step 3: Implementar**

Reescribir `src/features/products/validation.ts`:

```ts
// Validación pura del form de producto. Sin DB, sin DOM: compartida entre el
// componente y sus tests unitarios.

export interface ProductDraft {
  name: string
  description: string
  basePrice: string // decimal o ''
  compareAtPrice: string // decimal o ''
  stockQuantity: string // entero o ''
  sku: string
  weightGrams: string // entero o ''
  slug: string
  categoryId: string // uuid o ''
  subcategory: string // slug o ''
  personalizable: boolean
  customOnRequest: boolean
  active: boolean
}

export type FieldErrors = Partial<Record<keyof ProductDraft, string>>

export function emptyProductDraft(): ProductDraft {
  return {
    name: '', description: '', basePrice: '', compareAtPrice: '', stockQuantity: '0',
    sku: '', weightGrams: '', slug: '', categoryId: '', subcategory: '',
    personalizable: false, customOnRequest: false, active: true,
  }
}

export function parseNonNegativeDecimal(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

export function parseNonNegativeInt(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  if (!/^\d+$/.test(trimmed)) return null
  return Number(trimmed)
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function validateProduct(draft: ProductDraft): FieldErrors {
  const errors: FieldErrors = {}

  if (draft.name.trim() === '') errors.name = 'Ingresá un nombre.'

  if (draft.basePrice.trim() !== '' && parseNonNegativeDecimal(draft.basePrice) === null) {
    errors.basePrice = 'Ingresá un precio válido (0 o más).'
  }

  if (draft.compareAtPrice.trim() !== '') {
    const cmp = parseNonNegativeDecimal(draft.compareAtPrice)
    const base = parseNonNegativeDecimal(draft.basePrice)
    if (cmp === null) errors.compareAtPrice = 'Ingresá un precio comparativo válido.'
    else if (base !== null && cmp <= base)
      errors.compareAtPrice = 'El precio comparativo debe ser mayor al precio base.'
  }

  if (parseNonNegativeInt(draft.stockQuantity) === null) {
    errors.stockQuantity = 'Ingresá un stock válido (entero, 0 o más).'
  }

  if (draft.weightGrams.trim() !== '' && parseNonNegativeInt(draft.weightGrams) === null) {
    errors.weightGrams = 'Ingresá un peso válido en gramos (entero).'
  }

  if (draft.sku.trim() !== '' && /\s/.test(draft.sku.trim())) {
    errors.sku = 'El SKU no puede tener espacios.'
  }

  if (draft.slug.trim() !== '' && !SLUG_RE.test(draft.slug.trim())) {
    errors.slug = 'El slug solo admite minúsculas, números y guiones.'
  }

  return errors
}
```

- [ ] **Step 4: Correr todos los tests de validación**

Run: `npx vitest run src/features/products/validation.test.ts`
Expected: PASS (los viejos siguen verdes; `emptyProductDraft()` cubre los campos nuevos).

- [ ] **Step 5: Commit**

```bash
git add src/features/products/validation.ts src/features/products/validation.test.ts
git commit
```
Mensaje: `feat(products): campos de e-commerce en la validación del draft`

---

## Task 4: Filtro por categoría en `list.ts`

**Files:**
- Modify: `src/features/products/list.ts`
- Modify: `src/features/products/list.test.ts`

**Interfaces:**
- Consumes: `ProductRow` de `./products.api` (ya trae `category_id` tras Task 1).
- Produces:
  - `ProductFilter = { query: string; activeOnly: boolean; categoryId: string }` (`''` = todas)
  - `emptyProductFilter()` con `categoryId: ''`
  - `filterProducts(products, filter)` — aplica `categoryId` además de lo existente
  - `stockLevel`, `LOW_STOCK_THRESHOLD` sin cambios

- [ ] **Step 1: Escribir los tests que fallan**

En `src/features/products/list.test.ts`: extender el helper `product()` con `category_id: null` (y el resto de campos nuevos como `slug: null, sku: null, compare_at_price: null, custom_on_request: false, personalizable: false, weight_grams: null, subcategory: null`). Añadir dentro de `describe('filterProducts', …)`:

```ts
it('filtra por categoría cuando categoryId está seteado', () => {
  const products = [
    product({ id: 'a', category_id: 'cat-1' }),
    product({ id: 'b', category_id: 'cat-2' }),
    product({ id: 'c', category_id: null }),
  ]
  const result = filterProducts(products, { query: '', activeOnly: false, categoryId: 'cat-1' })
  expect(result.map((p) => p.id)).toEqual(['a'])
})

it('devuelve todo cuando categoryId es ""', () => {
  const products = [product({ id: 'a', category_id: 'cat-1' }), product({ id: 'b', category_id: null })]
  expect(
    filterProducts(products, { query: '', activeOnly: false, categoryId: '' }),
  ).toHaveLength(2)
})
```

Actualizar las 4 llamadas existentes a `filterProducts` en el archivo para incluir `categoryId: ''`.

- [ ] **Step 2: Correr para verificar que fallan**

Run: `npx vitest run src/features/products/list.test.ts`
Expected: FAIL (type error: `categoryId` no existe en `ProductFilter`).

- [ ] **Step 3: Implementar**

En `src/features/products/list.ts`:

```ts
export interface ProductFilter {
  query: string
  activeOnly: boolean
  categoryId: string // '' = todas
}

export function emptyProductFilter(): ProductFilter {
  return { query: '', activeOnly: false, categoryId: '' }
}
```

En `filterProducts`, dentro del `.filter(...)`, antes del match de query:

```ts
    if (filter.activeOnly && !product.active) return false
    if (filter.categoryId !== '' && product.category_id !== filter.categoryId) return false
    if (query === '') return true
```

- [ ] **Step 4: Correr los tests**

Run: `npx vitest run src/features/products/list.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/products/list.ts src/features/products/list.test.ts
git commit
```
Mensaje: `feat(products): filtro por categoría en la lista`

---

## Task 5: Helpers de API en `products.api.ts`

**Files:**
- Modify: `src/features/products/products.api.ts`

**Interfaces:**
- Consumes: `supabase` de `@/lib/supabase`; `Database` de `@/lib/database.types`.
- Produces:
  - `CategoryRow = Database['public']['Tables']['categories']['Row']`
  - `ProductImageRow = Database['public']['Tables']['product_images']['Row']`
  - `listCategories(): Promise<CategoryRow[]>` — ordenadas por `position`
  - `listProductImages(productId: string): Promise<ProductImageRow[]>` — ordenadas por `position`
  - `uploadProductImage(productId: string, file: File, position: number): Promise<ProductImageRow>` — sube al bucket, inserta fila, y si `position === 0` espeja `image_url`
  - `deleteProductImage(image: ProductImageRow): Promise<void>` — borra objeto + fila, luego `syncCoverImage`
  - `reorderProductImages(productId: string, orderedIds: string[]): Promise<void>` — reescribe `position` por índice, luego `syncCoverImage`
  - `bulkUpdateProducts(ids: string[], patch: ProductUpdate): Promise<void>`
  - Existentes intactos: `listProducts`, `getProduct`, `createProduct`, `updateProduct`, `ProductRow/Insert/Update`

- [ ] **Step 1: Implementar los helpers nuevos**

Añadir a `src/features/products/products.api.ts` (mantener lo existente; `PRODUCT_IMAGES_BUCKET` ya está declarado):

```ts
export type CategoryRow = Database['public']['Tables']['categories']['Row']
export type ProductImageRow = Database['public']['Tables']['product_images']['Row']

export async function listCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('position', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function listProductImages(productId: string): Promise<ProductImageRow[]> {
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .order('position', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Espeja products.image_url con la imagen de menor position (o null si no hay).
async function syncCoverImage(productId: string): Promise<void> {
  const images = await listProductImages(productId)
  const cover = images[0]?.url ?? null
  await updateProduct(productId, { image_url: cover })
}

export async function uploadProductImage(
  productId: string,
  file: File,
  position: number,
): Promise<ProductImageRow> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${productId}/${position}-${Date.now()}.${ext}`
  const up = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file, { upsert: false })
  if (up.error) throw up.error
  const { data: pub } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path)
  const { data, error } = await supabase
    .from('product_images')
    .insert({ product_id: productId, path, url: pub.publicUrl, position })
    .select('*')
    .single()
  if (error) throw error
  if (position === 0) await updateProduct(productId, { image_url: pub.publicUrl })
  return data
}

export async function deleteProductImage(image: ProductImageRow): Promise<void> {
  const rm = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([image.path])
  if (rm.error) throw rm.error
  const { error } = await supabase.from('product_images').delete().eq('id', image.id)
  if (error) throw error
  await syncCoverImage(image.product_id)
}

export async function reorderProductImages(
  productId: string,
  orderedIds: string[],
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('product_images')
      .update({ position: i })
      .eq('id', orderedIds[i])
    if (error) throw error
  }
  await syncCoverImage(productId)
}

export async function bulkUpdateProducts(
  ids: string[],
  patch: ProductUpdate,
): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('products').update(patch).in('id', ids)
  if (error) throw error
}
```

Nota: la firma de `uploadProductImage` cambia (agrega `position`). El único llamador actual es `ProductForm.tsx`, que se reescribe en el Task 6.

- [ ] **Step 2: Verificar compilación**

Run: `npm run typecheck`
Expected: FALLA solo en `src/features/products/ProductForm.tsx` (usa la firma vieja de `uploadProductImage` y `ProductDraft` viejo) y `ProductsList.tsx`. Esos se reescriben en Tasks 6–7. Ningún otro archivo debe fallar.

- [ ] **Step 3: Commit**

```bash
git add src/features/products/products.api.ts
git commit
```
Mensaje: `feat(products): helpers de categorías, galería de imágenes y update masivo`

---

## Task 6: Reescribir `ProductForm.tsx` — editor de una página

**Files:**
- Modify: `src/features/products/ProductForm.tsx`
- Modify: `src/features/products/products.css`
- Create: `src/features/products/ProductForm.test.tsx`

**Interfaces:**
- Consumes: `createProduct, getProduct, updateProduct, listCategories, listProductImages, uploadProductImage, deleteProductImage, reorderProductImages, ProductRow, CategoryRow, ProductImageRow` de `./products.api`; `emptyProductDraft, validateProduct, parseNonNegativeDecimal, parseNonNegativeInt, ProductDraft, FieldErrors` de `./validation`; `SUBCATEGORY_OPTIONS, slugify` de `./catalog-taxonomy`; `formatMoney` de `@/features/orders/format`; `CASH_DISCOUNT` de `@/features/storefront/pricing`.
- Produces: componente default `ProductForm` (rutas `/admin/productos/nuevo` y `/:id`).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/features/products/ProductForm.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getProductMock, createProductMock, updateProductMock, listCategoriesMock, listProductImagesMock } =
  vi.hoisted(() => ({
    getProductMock: vi.fn(),
    createProductMock: vi.fn(),
    updateProductMock: vi.fn(),
    listCategoriesMock: vi.fn(),
    listProductImagesMock: vi.fn(),
  }))

vi.mock('./products.api', () => ({
  getProduct: getProductMock,
  createProduct: createProductMock,
  updateProduct: updateProductMock,
  listCategories: listCategoriesMock,
  listProductImages: listProductImagesMock,
  uploadProductImage: vi.fn(),
  deleteProductImage: vi.fn(),
  reorderProductImages: vi.fn(),
}))

import ProductForm from './ProductForm'

const CATS = [
  { id: 'c1', slug: 'llaveros', name: 'Llaveros y Merch', icon: '🔑', position: 5, featured: false, created_at: '', updated_at: '' },
  { id: 'c2', slug: 'trofeos', name: 'Trofeos y Premios', icon: '🏆', position: 6, featured: false, created_at: '', updated_at: '' },
]

beforeEach(() => {
  vi.clearAllMocks()
  listCategoriesMock.mockResolvedValue(CATS)
  listProductImagesMock.mockResolvedValue([])
  createProductMock.mockResolvedValue({ id: 'new-1' })
  updateProductMock.mockResolvedValue({ id: 'new-1' })
})

function renderNew() {
  return render(
    <MemoryRouter initialEntries={['/admin/productos/nuevo']}>
      <Routes>
        <Route path="/admin/productos/nuevo" element={<ProductForm />} />
        <Route path="/admin/productos" element={<div>lista</div>} />
        <Route path="/admin/productos/:id" element={<div>editor {':id'}</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProductForm (alta)', () => {
  it('autogenera el slug desde el nombre', async () => {
    renderNew()
    await screen.findByLabelText('Nombre')
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Vaso Fernetero Boca' } })
    expect(screen.getByLabelText('Slug')).toHaveValue('vaso-fernetero-boca')
  })

  it('bloquea el guardado si falta el nombre', async () => {
    renderNew()
    await screen.findByLabelText('Nombre')
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(await screen.findByText('Ingresá un nombre.')).toBeInTheDocument()
    expect(createProductMock).not.toHaveBeenCalled()
  })

  it('guarda y crea el producto con la organización elegida', async () => {
    renderNew()
    await screen.findByLabelText('Nombre')
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Trofeo pádel' } })
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'c2' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await waitFor(() => expect(createProductMock).toHaveBeenCalledTimes(1))
    expect(createProductMock.mock.calls[0][0]).toMatchObject({
      name: 'Trofeo pádel', category_id: 'c2', slug: 'trofeo-padel',
    })
  })

  it('las opciones de subcategoría dependen de la categoría', async () => {
    renderNew()
    await screen.findByLabelText('Nombre')
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'c2' } })
    const sub = screen.getByLabelText('Subcategoría') as HTMLSelectElement
    const opts = Array.from(sub.options).map((o) => o.value)
    expect(opts).toEqual(['', 'deportivos', 'placas'])
  })
})
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run src/features/products/ProductForm.test.tsx`
Expected: FAIL (el componente viejo no tiene labels "Slug"/"Categoría"/"Subcategoría").

- [ ] **Step 3: Reescribir el componente**

Reescribir `src/features/products/ProductForm.tsx`. Estructura:

- Estado: `draft: ProductDraft`, `errors: FieldErrors`, `categories: CategoryRow[]`, `images: ProductImageRow[]`, `slugTouched: boolean` (si el usuario editó el slug a mano, dejar de autogenerarlo), `loading`, `loadError`, `submitting`, `submitError`.
- `useEffect` inicial: `listCategories()` siempre; si `id`, `getProduct(id)` + `listProductImages(id)`; `draftFromProduct` mapea la fila (incluye `slug`, `sku`, `compare_at_price`→`compareAtPrice`, `weight_grams`→`weightGrams`, `category_id`→`categoryId`, `subcategory`, `personalizable`, `custom_on_request`→`customOnRequest`).
- `setField`: como el actual; además si `field === 'name'` y `!slugTouched` y `!isEdit`, setear `slug: slugify(value)`. Si `field === 'slug'`, `setSlugTouched(true)`. Si `field === 'categoryId'`, resetear `subcategory: ''`.
- `handleSubmit`: `validateProduct`; si OK, construir patch:

```ts
const patch = {
  name: draft.name.trim(),
  slug: (draft.slug.trim() || slugify(draft.name)) || null,
  description: draft.description.trim() || null,
  base_price: parseNonNegativeDecimal(draft.basePrice),
  compare_at_price: parseNonNegativeDecimal(draft.compareAtPrice),
  stock_quantity: parseNonNegativeInt(draft.stockQuantity) ?? 0,
  sku: draft.sku.trim() || null,
  weight_grams: parseNonNegativeInt(draft.weightGrams),
  category_id: draft.categoryId || null,
  subcategory: draft.subcategory || null,
  personalizable: draft.personalizable,
  custom_on_request: draft.customOnRequest,
  active: draft.active,
}
const saved = isEdit && id ? await updateProduct(id, patch) : await createProduct(patch)
navigate(isEdit ? '/admin/productos' : `/admin/productos/${saved.id}`)
```

  (Alta redirige a `/:id` para poder cargar medios; edición vuelve a la lista.)
- Layout: `<main className="order-form">` → `<form>` → `<div className="product-editor">` con `<div className="product-editor__main">` y `<aside className="product-editor__aside">`.

  **main:**
  - Header con back-link a `/admin/productos` + `<h1>` "Nuevo producto" / "Editar producto".
  - `field` "Nombre" (input, `aria-invalid`, error).
  - `field` "Slug" (input; hint "URL del producto").
  - `field` "Descripción" (`textarea`, `field__input--textarea`).
  - `section.form-section` "Medios": si `!isEdit`, mostrar nota "Guardá el producto para poder cargar imágenes."; si `isEdit`, `<ProductImageGallery productId={id} images={images} onChange={setImages} />` (ver Step 4).
  - `section.form-section` "Precios": `field` "Precio base" (input decimal), `field` "Precio comparativo" (input decimal, error); si ambos válidos y `compare > base`, mostrar `<p className="product-editor__hint">-{pct}% · contado {formatMoney(cashPrice)}</p>` donde `pct = Math.round((1 - base/compare) * 100)` y `cashPrice = base * (1 - CASH_DISCOUNT)`.
  - `section.form-section` "Inventario": `field` "SKU" (input), `field` "Stock" (input numérico), `field` "Peso (g)" (input numérico).

  **aside:**
  - `section.form-section` "Estado": dos radios `Activo` / `Inactivo` enlazados a `draft.active`.
  - `section.form-section` "Organización":
    - `field` "Categoría": `<select id="product-category" aria-label="Categoría">` con `<option value="">— sin categoría —</option>` + `categories.map(c => <option value={c.id}>{c.icon} {c.name}</option>)`.
    - `field` "Subcategoría": `<select aria-label="Subcategoría">` con `<option value="">— sin asignar —</option>` + opciones de `SUBCATEGORY_OPTIONS[selectedCatSlug] ?? []` (resolver `selectedCatSlug` desde `categories.find(c => c.id === draft.categoryId)?.slug`).
    - checkbox "Personalizable (hecho a medida)" → `personalizable`.
    - checkbox "Personalizable a pedido" → `customOnRequest`.
  - `sticky-cta` con botón submit "Guardar producto" / "Guardando…".

- [ ] **Step 4: Sub-componente de galería (mismo archivo o `ProductImageGallery.tsx`)**

Crear `src/features/products/ProductImageGallery.tsx`:

- Props: `{ productId: string; images: ProductImageRow[]; onChange: (next: ProductImageRow[]) => void }`.
- `<input type="file" accept="image/*" multiple>`: por cada archivo, `uploadProductImage(productId, file, images.length + i)`, acumular y `onChange`.
- Grid de miniaturas (`product-gallery__grid`); cada una: `<img src={img.url}>`, botón "Quitar" → `deleteProductImage(img)` + `onChange(images.filter(...))`, y flechas ◀ ▶ que reordenan el array localmente y llaman `reorderProductImages(productId, nextIds)` + `onChange`.
- Estado `busy` para deshabilitar durante operaciones; errores en un `<p className="field__error">`.
- La primera del grid lleva el badge "Portada".

(No requiere test propio en esta task más allá de que `ProductForm.test.tsx` renderice el caso `isEdit` sin romper — el mock de `products.api` cubre las fns.)

- [ ] **Step 5: CSS**

Añadir a `src/features/products/products.css`:

```css
/* Editor de producto: dos columnas en desktop, apilado en mobile. */
.product-editor {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: 1fr;
}
@media (min-width: 900px) {
  .product-editor {
    grid-template-columns: minmax(0, 1fr) 20rem;
    align-items: start;
  }
}
.product-editor__aside {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.product-editor__hint {
  font-size: 0.8125rem;
  color: var(--color-carbon-muted);
  margin-top: 0.5rem;
}
.product-gallery__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6rem, 1fr));
  gap: 0.75rem;
}
.product-gallery__item {
  position: relative;
  border-radius: 0.5rem;
  overflow: hidden;
  background: var(--color-carbon-soft);
  aspect-ratio: 1 / 1;
}
.product-gallery__item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.product-gallery__badge {
  position: absolute;
  inset-block-start: 0.25rem;
  inset-inline-start: 0.25rem;
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  background: var(--color-carbon);
  color: var(--color-white);
}
```

(Si `--color-carbon` / `--color-white` no existen, usar los tokens presentes en `tokens.css` — verificar con `grep -n "color-carbon\|color-white" src/styles/tokens.css`.)

- [ ] **Step 6: Correr el test + typecheck**

Run: `npx vitest run src/features/products/ProductForm.test.tsx`
Expected: PASS.
Run: `npm run typecheck`
Expected: FALLA solo en `ProductsList.tsx` (Task 7).

- [ ] **Step 7: Commit**

```bash
git add src/features/products/ProductForm.tsx src/features/products/ProductImageGallery.tsx src/features/products/ProductForm.test.tsx src/features/products/products.css
git commit
```
Mensaje: `feat(products): editor de producto de una página estilo Shopify`

---

## Task 7: Reescribir `ProductsList.tsx` — grilla editable

**Files:**
- Modify: `src/features/products/ProductsList.tsx`
- Modify: `src/features/products/products.css`
- Create: `src/features/products/ProductsList.test.tsx`

**Interfaces:**
- Consumes: `listProducts, listCategories, createProduct, updateProduct, bulkUpdateProducts, ProductRow, CategoryRow` de `./products.api`; `emptyProductFilter, filterProducts, stockLevel, ProductFilter` de `./list`; `slugify` de `./catalog-taxonomy`; `formatMoney` de `@/features/orders/format`.
- Produces: componente default `ProductsList` (ruta `/admin/productos`).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/features/products/ProductsList.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listProductsMock, listCategoriesMock, updateProductMock, createProductMock, bulkUpdateProductsMock } =
  vi.hoisted(() => ({
    listProductsMock: vi.fn(),
    listCategoriesMock: vi.fn(),
    updateProductMock: vi.fn(),
    createProductMock: vi.fn(),
    bulkUpdateProductsMock: vi.fn(),
  }))

vi.mock('./products.api', () => ({
  listProducts: listProductsMock,
  listCategories: listCategoriesMock,
  updateProduct: updateProductMock,
  createProduct: createProductMock,
  bulkUpdateProducts: bulkUpdateProductsMock,
}))

import ProductsList from './ProductsList'

function row(over = {}) {
  return {
    id: 'p1', name: 'Llavero Zelda', description: null, base_price: 1500,
    compare_at_price: null, stock_quantity: 10, image_url: null, active: true,
    slug: 'llavero-zelda', sku: null, custom_on_request: false, personalizable: false,
    weight_grams: null, category_id: 'c1', subcategory: null,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...over,
  }
}
const CATS = [
  { id: 'c1', slug: 'llaveros', name: 'Llaveros', icon: '🔑', position: 5, featured: false, created_at: '', updated_at: '' },
]

beforeEach(() => {
  vi.clearAllMocks()
  listProductsMock.mockResolvedValue([row()])
  listCategoriesMock.mockResolvedValue(CATS)
  updateProductMock.mockImplementation((id, patch) => Promise.resolve({ ...row(), ...patch }))
  createProductMock.mockResolvedValue(row({ id: 'p2', name: 'Nuevo', slug: 'nuevo' }))
})

function renderList() {
  return render(<MemoryRouter><ProductsList /></MemoryRouter>)
}

describe('ProductsList (grilla)', () => {
  it('edita el precio inline y autoguarda al blur', async () => {
    renderList()
    const priceInput = await screen.findByLabelText('Precio de Llavero Zelda')
    fireEvent.change(priceInput, { target: { value: '1800' } })
    fireEvent.blur(priceInput)
    await waitFor(() => expect(updateProductMock).toHaveBeenCalledWith('p1', { base_price: 1800 }))
  })

  it('la fila de alta rápida crea un producto', async () => {
    renderList()
    fireEvent.click(await screen.findByRole('button', { name: /producto/i }))
    fireEvent.change(screen.getByLabelText('Nombre del nuevo producto'), { target: { value: 'Nuevo' } })
    fireEvent.change(screen.getByLabelText('Precio del nuevo producto'), { target: { value: '999' } })
    fireEvent.submit(screen.getByTestId('quick-add-form'))
    await waitFor(() => expect(createProductMock).toHaveBeenCalledTimes(1))
    expect(createProductMock.mock.calls[0][0]).toMatchObject({ name: 'Nuevo', slug: 'nuevo', base_price: 999, stock_quantity: 0, active: true })
  })

  it('desactiva en masa las filas tildadas', async () => {
    listProductsMock.mockResolvedValue([row(), row({ id: 'p2', name: 'Otro' })])
    renderList()
    const checks = await screen.findAllByLabelText(/seleccionar/i)
    fireEvent.click(checks[0])
    fireEvent.click(screen.getByRole('button', { name: /desactivar/i }))
    await waitFor(() => expect(bulkUpdateProductsMock).toHaveBeenCalledWith(['p1'], { active: false }))
  })
})
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run src/features/products/ProductsList.test.tsx`
Expected: FAIL (la lista actual es de solo lectura).

- [ ] **Step 3: Reescribir el componente**

Reescribir `src/features/products/ProductsList.tsx`. Estructura:

- Estado: `products: ProductRow[]`, `categories: CategoryRow[]`, `filter: ProductFilter`, `loading`, `error`, `busyId: string | null`, `selected: Set<string>`, `quickAddOpen: boolean`, `quickAdd: { name: string; price: string; categoryId: string }`, `savingQuick: boolean`.
- `load()`: `Promise.all([listProducts(), listCategories()])`.
- `catName(id)`: lookup en `categories`.
- **Autosave inline** — `patchRow(id, patch)`:

```ts
async function patchRow(id: string, patch: Partial<ProductRow>) {
  setBusyId(id)
  const prev = products
  setProducts((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  try {
    await updateProduct(id, patch)
  } catch {
    setProducts(prev)
    setError('No se pudo guardar el cambio.')
  } finally {
    setBusyId(null)
  }
}
```

  - Precio: `<input>` controlado por estado local de la fila; en `onBlur`, si cambió y parsea a decimal ≥ 0, `patchRow(id, { base_price: n })`. `aria-label={`Precio de ${p.name}`}`.
  - Stock: botones `−` / número / `+` como `InsumosList`; `onClick` → `patchRow(id, { stock_quantity: Math.max(0, p.stock_quantity + delta) })`. También `<input>` editable con `aria-label={`Stock de ${p.name}`}`.
  - Categoría: `<select>` con `aria-label={`Categoría de ${p.name}`}` → `patchRow(id, { category_id: value || null })`.
  - Activo: checkbox `aria-label={`Activo: ${p.name}`}` → `patchRow(id, { active: checked })`.
  - Nombre: `<Link to={`/admin/productos/${p.id}`}>` (no editable inline; el detalle es el editor).
- **Fila de alta rápida**: botón "+ Producto" (toolbar) togglea `quickAddOpen`. Cuando abierto, un `<form data-testid="quick-add-form" onSubmit={handleQuickAdd}>` como primera fila con inputs "Nombre del nuevo producto" / "Precio del nuevo producto" + `<select>` categoría + botón "Agregar". `handleQuickAdd`:

```ts
async function handleQuickAdd(e: FormEvent) {
  e.preventDefault()
  const name = quickAdd.name.trim()
  if (name === '') return
  setSavingQuick(true)
  try {
    const created = await createProduct({
      name,
      slug: slugify(name),
      base_price: parseFloat(quickAdd.price) || null,
      stock_quantity: 0,
      category_id: quickAdd.categoryId || null,
      active: true,
    })
    setProducts((rows) => [created, ...rows])
    setQuickAdd({ name: '', price: '', categoryId: quickAdd.categoryId })
    // se queda abierta para seguir cargando
  } catch {
    setError('No se pudo crear el producto.')
  } finally {
    setSavingQuick(false)
  }
}
```

- **Acciones masivas**: columna de checkboxes `aria-label={`Seleccionar ${p.name}`}` → toggle en `selected`. Cuando `selected.size > 0`, barra `product-bulkbar` con: "{n} seleccionados", botones "Activar" / "Desactivar" / `<select>` "Asignar categoría" / "Eliminar". "Desactivar" → `bulkUpdateProducts([...selected], { active: false })` luego `load()` + limpiar `selected`. "Eliminar" pide `confirm()` y usa `bulkUpdateProducts` **no** (no hay delete masivo en la api) → llamar `updateProduct`/`deleteProduct` por id; si no hay `deleteProduct`, dejar "Eliminar" fuera y solo activar/desactivar/categoría. **Decisión: incluir solo Activar / Desactivar / Asignar categoría** (todas cubiertas por `bulkUpdateProducts`).
- **Toolbar**: search (existente) + `<select>` categoría (`aria-label="Filtrar por categoría"`, opción "Todas las categorías") + chip "Solo activos" + resumen de stock (existente: `products.length`, low, out) + botón "+ Producto".
- **Render de filas**: en desktop, tabla/grid CSS (`product-grid`); en mobile (`@media max-width: 760px`), cada fila se apila como card con nombre (link), precio editable, stock `−/+`, toggle activo. Mantener `empty-state` para 0 productos y para 0 coincidencias.
- Quitar el `sticky-cta` con "Nuevo producto" y reemplazar por un link discreto "Nuevo producto (detalle)" → `/admin/productos/nuevo` en la toolbar o al pie.

- [ ] **Step 4: CSS**

Añadir a `src/features/products/products.css`:

```css
.product-grid {
  display: grid;
  gap: 0.25rem;
}
.product-grid__row {
  display: grid;
  grid-template-columns: 2rem 2.75rem minmax(0, 1fr) 8rem 7rem 6rem 3rem;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
}
.product-grid__row:hover {
  background: var(--color-carbon-soft);
}
.product-grid__cell-input {
  width: 100%;
  min-width: 0;
}
.product-bulkbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  background: var(--color-carbon-soft);
  font-size: 0.8125rem;
}
@media (max-width: 760px) {
  .product-grid__row {
    grid-template-columns: 1fr auto;
    grid-auto-rows: min-content;
    row-gap: 0.375rem;
    border: 1px solid var(--color-carbon-soft);
  }
}
```

(Ajustar nombres de tokens a los reales de `src/styles/tokens.css`.)

- [ ] **Step 5: Correr tests + typecheck + suite completa**

Run: `npx vitest run src/features/products/ProductsList.test.tsx`
Expected: PASS.
Run: `npm run typecheck`
Expected: PASS (todo el árbol compila).
Run: `npm test`
Expected: PASS (toda la suite).

- [ ] **Step 6: Verificación en el navegador**

- `npm run dev` (o `preview_start` con la config del proyecto).
- Ir a `/admin/productos` (requiere sesión admin). Confirmar: la grilla lista, editar un precio y ver el autosave (network `PATCH products`), alta rápida agrega una fila, seleccionar y "Desactivar" en masa.
- Abrir un producto → el editor de dos columnas; cambiar categoría y ver que las subcategorías cambian; guardar.
- `resize_window` a 375px: la grilla se apila; el editor pasa a una columna.
- `read_console_messages`: sin errores.
- Screenshot de la grilla y del editor para el usuario.

- [ ] **Step 7: Commit**

```bash
git add src/features/products/ProductsList.tsx src/features/products/ProductsList.test.tsx src/features/products/products.css
git commit
```
Mensaje: `feat(products): grilla de carga rápida con edición inline y acciones masivas`

---

## Task 8: Script de import `scripts/import-catalog.mjs`

**Files:**
- Create: `scripts/import-catalog.mjs`
- Modify: `package.json` (script `import:catalog`)

**Interfaces:**
- Consumes (en runtime, vía Vite SSR): `PRODUCTS` de `src/features/storefront/data/products.ts`; `mapLegacyCategory, deriveSubcategory, slugify` de `src/features/products/catalog-taxonomy.ts`.
- Consumes (env): `DATABASE_URL` o `--db-url` (igual que `gen-types.mjs`).
- Produces: filas en `categories` (upsert por slug) y `products` (upsert por slug). `--dry-run` no escribe.

- [ ] **Step 1: Escribir el script**

Crear `scripts/import-catalog.mjs`:

```js
// Carga el catálogo del storefront estático (src/features/storefront/data/products.ts)
// a la tabla `products` de Supabase, mapeando a la taxonomía nueva. Re-ejecutable:
// upsert por `slug`, no duplica.
//
// Uso:
//   node scripts/import-catalog.mjs --dry-run     # imprime el plan + diffs de precio
//   node scripts/import-catalog.mjs               # escribe
//
// Conexión: --db-url, luego $DATABASE_URL, luego $SUPABASE_DB_URL (igual que
// gen-types.mjs). Los precios de los PDF (para el reporte de diferencias) se
// extraen en runtime con `pdftotext -layout` si está en el PATH; si no, se omite
// el reporte. Rutas de PDF por --pdf <ruta> (repetible).

import { execFileSync } from 'node:child_process'
import { createServer } from 'vite'
import pg from 'pg'

const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
function argValues(flag) {
  const out = []
  for (let i = 0; i < args.length; i++) if (args[i] === flag) out.push(args[i + 1])
  return out
}
const dbUrl =
  argValues('--db-url')[0] || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
if (!dbUrl) {
  console.error('Falta la connection string: --db-url o $DATABASE_URL / $SUPABASE_DB_URL.')
  process.exit(1)
}
const pdfPaths = argValues('--pdf')

// --- 1. Cargar los módulos TS vía Vite SSR (sin deps nuevas) -----------------
const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})
let PRODUCTS, tax
try {
  ;({ PRODUCTS } = await vite.ssrLoadModule('/src/features/storefront/data/products.ts'))
  tax = await vite.ssrLoadModule('/src/features/products/catalog-taxonomy.ts')
} finally {
  await vite.close()
}

// --- 2. Reporte de precios desde los PDF (best-effort) ----------------------
function pdfPrices(paths) {
  const map = new Map()
  for (const p of paths) {
    let text
    try {
      text = execFileSync('pdftotext', ['-layout', p, '-'], { encoding: 'latin1' })
    } catch {
      console.warn(`No se pudo leer ${p} con pdftotext; se omite del reporte.`)
      continue
    }
    const lines = text.split(/\r?\n/)
    let lastName = null
    for (const line of lines) {
      const priceMatch = line.match(/\$\s*[\d.\s]+,\d{2}/)
      const stripped = line.replace(/\$\s*[\d.\s]+,\d{2}/g, '').trim()
      if (stripped.length > 3 && !/^\$/.test(line.trim())) lastName = stripped
      if (priceMatch && lastName) {
        const n = Number(priceMatch[0].replace(/[^\d,]/g, '').replace(',', '.'))
        if (Number.isFinite(n) && n > 0) map.set(tax.slugify(lastName), n)
      }
    }
  }
  return map
}
const priceMap = pdfPaths.length ? pdfPrices(pdfPaths) : new Map()

// --- 3. Construir las filas -----------------------------------------------
const seenSlugs = new Set()
function uniqueSlug(base) {
  let s = base || 'producto'
  let i = 2
  while (seenSlugs.has(s)) s = `${base}-${i++}`
  seenSlugs.add(s)
  return s
}

const rows = PRODUCTS.map((p) => {
  const slug = uniqueSlug(tax.slugify(p.name))
  const categorySlug = tax.mapLegacyCategory(p.cat, p.name)
  const subcategory = tax.deriveSubcategory(p.cat, p)
  const customOnRequest = !(p.cat === 'filamentos' || p.cat === 'impresoras')
  const descParts = [p.desc]
  if (Array.isArray(p.colors) && p.colors.length)
    descParts.push('Colores: ' + p.colors.map((c) => c.name).join(', '))
  return {
    slug,
    name: p.name,
    description: descParts.join('\n'),
    base_price: p.price ?? null,
    stock_quantity: 0,
    personalizable: Boolean(p.personalizable),
    custom_on_request: customOnRequest,
    active: true,
    category_slug: categorySlug,
    subcategory,
    _pdfPrice: priceMap.get(slug) ?? null,
  }
})

// Extras solo en los PDF (curado a mano).
rows.push(
  { slug: uniqueSlug('capibara-carpincho-figura'), name: 'Capibara / Carpincho figura coleccionable', description: 'Figura coleccionable impresa en 3D.', base_price: null, stock_quantity: 0, personalizable: false, custom_on_request: true, active: false, category_slug: 'figuras', subcategory: null, _pdfPrice: null },
  { slug: uniqueSlug('vaso-copa-del-mundo-1l'), name: 'Vaso copa del mundo 1L', description: 'Vaso fernetero 1L, edición copa del mundo.', base_price: 28500, stock_quantity: 0, personalizable: false, custom_on_request: true, active: true, category_slug: 'vasos-ferneteros', subcategory: 'mundial', _pdfPrice: 28500 },
  { slug: uniqueSlug('trofeo-paleta'), name: 'Trofeo paleta', description: 'Trofeo con forma de paleta.', base_price: null, stock_quantity: 0, personalizable: true, custom_on_request: true, active: false, category_slug: 'trofeos', subcategory: 'deportivos', _pdfPrice: null },
)

// --- 4. Reporte -----------------------------------------------------------
console.log(`${rows.length} productos a importar.`)
const diffs = rows.filter((r) => r._pdfPrice != null && r.base_price != null && Math.abs(r._pdfPrice - r.base_price) >= 1)
if (diffs.length) {
  console.log('\nDiferencias de precio (data/products.ts vs PDF) — revisar a mano:')
  for (const d of diffs) console.log(`  ${d.name}: $${d.base_price} vs PDF $${d._pdfPrice}`)
}
const noCat = rows.filter((r) => !r.category_slug)
if (noCat.length) console.log(`\n${noCat.length} sin categoría resuelta.`)

if (DRY) {
  console.log('\n--dry-run: no se escribió nada.')
  process.exit(0)
}

// --- 5. Escribir --------------------------------------------------------
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  // categorías (idempotente)
  for (const c of tax.CATEGORY_SEED) {
    await client.query(
      `insert into public.categories (slug, name, icon, position, featured)
       values ($1,$2,$3,$4,$5)
       on conflict (slug) do update set
         name = excluded.name, icon = excluded.icon,
         position = excluded.position, featured = excluded.featured`,
      [c.slug, c.name, c.icon, c.position, c.featured],
    )
  }
  const catIds = new Map(
    (await client.query('select id, slug from public.categories')).rows.map((r) => [r.slug, r.id]),
  )
  let created = 0
  for (const r of rows) {
    const res = await client.query(
      `insert into public.products
         (slug, name, description, base_price, stock_quantity, personalizable,
          custom_on_request, active, category_id, subcategory)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (slug) do update set
         name = excluded.name, description = excluded.description,
         base_price = excluded.base_price, personalizable = excluded.personalizable,
         custom_on_request = excluded.custom_on_request,
         category_id = excluded.category_id, subcategory = excluded.subcategory
       returning (xmax = 0) as inserted`,
      [
        r.slug, r.name, r.description, r.base_price, r.stock_quantity, r.personalizable,
        r.custom_on_request, r.active, catIds.get(r.category_slug) ?? null, r.subcategory,
      ],
    )
    if (res.rows[0]?.inserted) created++
  }
  console.log(`\nListo: ${created} nuevos, ${rows.length - created} actualizados.`)
} finally {
  await client.end()
}
```

Nota: el `on conflict do update` de productos **no** pisa `stock_quantity` ni `active` (para no borrar stock cargado a mano al re-ejecutar).

- [ ] **Step 2: Agregar el npm script**

En `package.json`, dentro de `"scripts"`:

```json
"import:catalog": "node scripts/import-catalog.mjs",
```

- [ ] **Step 3: Dry-run**

Run: `node scripts/import-catalog.mjs --dry-run --pdf "C:/Users/nyunes/Downloads/global3d - Catalogo de productos (1).pdf" --pdf "C:/Users/nyunes/Downloads/global3d - Catalogo de productos.pdf"`
Expected: imprime "~83 productos a importar", el reporte de diferencias de precio, y "no se escribió nada". Sin excepción.

- [ ] **Step 4: Import real contra la branch**

Run: `node scripts/import-catalog.mjs --db-url "<DATABASE_URL de la branch>"`
Expected: "Listo: N nuevos, M actualizados." Verificar con Supabase MCP `execute_sql`:

```sql
select count(*) from public.products;                         -- ~83
select c.name, count(*) from public.products p
  left join public.categories c on c.id = p.category_id
  group by c.name order by 2 desc;
select count(*) from public.products where category_id is null; -- idealmente 0
```

- [ ] **Step 5: Commit**

```bash
git add scripts/import-catalog.mjs package.json
git commit
```
Mensaje: `feat(products): script de import del catálogo con reporte de diferencias de precio`

---

## Self-Review

**1. Spec coverage:**

| Sección del spec | Task |
|---|---|
| `categories` (tabla + seed 11) | 1 |
| `product_images` (tabla + índice) | 1 |
| Columnas `products` (slug, sku, compare_at_price, custom_on_request, personalizable, weight_grams, category_id, subcategory) | 1 |
| `image_url` como espejo de portada | 5 (`syncCoverImage`, `uploadProductImage`) |
| RLS admin-only para tablas nuevas | 1 |
| Trigger `updated_at` en `categories` | 1 |
| `product_variants` intacta | (no se toca en ninguna task) |
| Regeneración de `database.types.ts` | 1 |
| `catalog-taxonomy.ts` (slugify, mapLegacyCategory, SUBCATEGORY_OPTIONS, deriveSubcategory) | 2 |
| Import re-ejecutable desde `data/products.ts`, upsert por slug | 8 |
| Reporte de diferencias de precio con PDF (sin pisar) | 8 |
| Extras solo-PDF (Capibara, Vaso copa del mundo, Trofeo paleta) | 8 |
| `stock_quantity = 0` en import | 8 |
| `custom_on_request` = true salvo filamentos/impresoras | 2 (`deriveSubcategory` no; regla en 8) + 8 |
| Grilla editable con autosave + `−/+` stock | 7 |
| Fila de alta rápida | 7 |
| Acciones masivas (activar/desactivar/asignar categoría) | 7 |
| Filtro por categoría en toolbar | 4 + 7 |
| Editor de una página, dos columnas | 6 |
| Media: galería, reordenar, portada, borrar | 6 (`ProductImageGallery`) + 5 |
| Precios: compare-at %, preview contado con `CASH_DISCOUNT` | 6 |
| Sidebar: estado, categoría, subcategoría, personalizable, custom_on_request | 6 |
| `validation.ts` extendido (slug, sku, compare-at, weight) | 3 |
| `ProductFilter.category` | 4 |
| `products.api.ts`: listCategories, galería CRUD, bulkUpdateProducts | 5 |
| Tests unit (catalog-taxonomy, validation, list) | 2, 3, 4 |
| Tests RTL (ProductsList, ProductForm) | 6, 7 |
| Rollout: 1 PR, import manual post-merge documentado | header del script (Task 8 Step 1) |

Sin huecos. El storefront no se toca (Global Constraints). Mega-menú/variantes/texto rico: fuera de alcance, no aparecen en ninguna task.

**2. Placeholder scan:** Sin "TBD"/"TODO". Cada step de código tiene el contenido real. Los ajustes de nombres de tokens CSS (`--color-carbon*`) están acotados con un `grep` concreto a correr.

**3. Type consistency:** `ProductDraft` (Task 3) → consumido con los mismos nombres de campo en Task 6. `ProductFilter` con `categoryId` (Task 4) → usado como `categoryId` en Task 7 y en el test de Task 4. `uploadProductImage(productId, file, position)` (Task 5) → llamado con 3 args en Task 6. `bulkUpdateProducts(ids, patch)` (Task 5) → `bulkUpdateProducts(['p1'], { active: false })` en Task 7. `CATEGORY_SEED` (Task 2) → reusado por el import (Task 8) y espejo del seed SQL (Task 1). `mapLegacyCategory` / `deriveSubcategory` / `slugify` firmas idénticas entre Task 2, sus tests, y Task 8.

**Nota de ejecución:** Tasks 1 y 8-Step-4 tocan una development branch de Supabase vía MCP. Si el ejecutor no tiene acceso, debe entregar el `.sql` y el comando de import al usuario y marcar esos steps como bloqueados —el resto del plan (2–7) se completa y testea sin la DB viva salvo el typecheck del Task 1-Step-5, que igual pasa porque `database.types.ts` se actualiza a mano con el bloque provisto.
