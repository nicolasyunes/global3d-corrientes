# Admin de productos: catálogo en DB + rediseño de carga + import — design

Date: 2026-08-27
Branch: feature/auth-access
Status: approved design, pending spec review

## Problema

`/admin/productos` hoy es una sola pantalla plana:

- [`ProductForm.tsx`](../../../src/features/products/ProductForm.tsx) — un
  `<form>` con imagen única, nombre, descripción, precio, stock y `activo`.
  Sin categoría, sin galería, sin SKU, sin precio comparativo, sin alta rápida.
- [`ProductsList.tsx`](../../../src/features/products/ProductsList.tsx) — lista
  de solo lectura (búsqueda + chip "solo activos" + resumen de stock); cada fila
  linkea al form. No se puede editar nada desde la lista.
- La tabla `products` (migración `20260825120000_product_stock_images.sql`) tiene
  solo `id, name, description, base_price, stock_quantity, image_url, active,
  created_at, updated_at`. RLS admin-only para todas las operaciones.

Paralelamente, el catálogo del storefront vive **estático** en
[`data/products.ts`](../../../src/features/storefront/data/products.ts) (~80
productos ya estructurados: nombre, precio, categoría, descripción, specs,
colores, `personalizable`). El spec
[storefront-taxonomy-megamenu](2026-08-27-storefront-taxonomy-megamenu-design.md)
(diseñado, no implementado) asume ese archivo estático con tagging por producto.

El negocio quiere:

1. Cargar/editar productos rápido, al nivel de una planilla
   (ver memoria "admin-carga-rapida-prioridad").
2. Un editor por producto tipo Shopify/Tiendanube (galería de medios,
   organización, precios).
3. Que la tabla `products` de la DB sea **la fuente de verdad** del catálogo
   (el storefront se conecta después, en la Spec 2).
4. Tener todos los productos ya cargados en la DB.

## Decisiones tomadas (brainstorming)

- **Fuente de verdad:** la DB. El storefront se reconectará en una Spec 2 aparte,
  fusionada con el spec de taxonomía, para no reescribir el storefront dos veces.
- **Estilo de carga:** ambos — grilla editable para volumen + editor de una
  página para el detalle.
- **Modelo de datos a agregar ahora:** categoría + subcategoría, galería de
  imágenes, y campos sueltos (`sku`, `compare_at_price`, `custom_on_request`,
  `weight_grams`). **Variantes quedan fuera de alcance.**
- **Imágenes:** se siembra sin imágenes; el usuario las sube luego (a un Drive) y
  se cargan a mano desde el nuevo editor. El diseño igual incluye la galería.
- **Import:** desde `data/products.ts` (confiable), usando los PDF solo como
  reporte de diferencias de precio.

## Alcance de esta Spec (Spec 1)

Modelo de datos + import + rediseño de `/admin/productos`. **El storefront sigue
leyendo `data/products.ts` sin cambios.** RLS del catálogo sigue admin-only.

### No-goals (YAGNI / Spec 2)

- Storefront leyendo de la DB; políticas RLS de `select` público.
- Mega-menú, facetas, `navigation.ts` (spec de taxonomía).
- Variantes / opciones (color, capacidad, talle) con precio/stock por variante.
- Editor de texto rico para la descripción (queda `<textarea>` plano).
- Subida masiva de imágenes desde Drive (se hace a mano en el editor).
- Tabla `subcategories` normalizada (Spec 2 decide; acá es texto).
- i18n (el sitio es solo español).

## Modelo de datos

### Migración `20260827140000_product_catalog_taxonomy_images.sql`

**1. Tabla `categories` (nueva)**

```sql
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon text,                         -- emoji
  position integer not null default 0,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Seed con las 11 categorías del spec de taxonomía (mismo orden, `icon`, `featured`
para `vasos-ferneteros` y `vasos-milkshake`):

| position | slug | name | icon | featured |
|---|---|---|---|---|
| 0 | `vasos-ferneteros` | Vasos Ferneteros | 🍺 | true |
| 1 | `vasos-milkshake` | Vasos Milkshake | 🥤 | true |
| 2 | `figuras` | Figuras y Coleccionables | 🧸 | false |
| 3 | `mates` | Mates | 🧉 | false |
| 4 | `golosineros` | Alcancías y Golosineros | 💰 | false |
| 5 | `llaveros` | Llaveros y Merch | 🔑 | false |
| 6 | `trofeos` | Trofeos y Premios | 🏆 | false |
| 7 | `hogar` | Hogar y Decoración | 🏠 | false |
| 8 | `juegos` | Juegos y Juguetes | 🎲 | false |
| 9 | `combos` | Combos | 🎁 | false |
| 10 | `impresion-3d` | Impresión 3D | 🖨️ | false |

**2. Tabla `product_images` (nueva)**

```sql
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  path text not null,                -- object path dentro del bucket product-images
  url text not null,                 -- URL pública (bucket público, denormalizado)
  position integer not null default 0,
  alt text,
  created_at timestamptz not null default now(),
  unique (product_id, path)
);
create index product_images_product_id_position_idx
  on public.product_images (product_id, position);
```

**3. Columnas nuevas en `products`**

```sql
alter table public.products
  add column slug text unique,
  add column sku text,
  add column compare_at_price numeric(12, 2),
  add column custom_on_request boolean not null default false,
  add column personalizable boolean not null default false,
  add column weight_grams integer check (weight_grams is null or weight_grams >= 0),
  add column category_id uuid references public.categories(id) on delete set null,
  add column subcategory text;

create unique index products_sku_key on public.products (sku) where sku is not null;
create index products_category_id_idx on public.products (category_id);
```

- `slug` queda `null` en filas viejas hasta que corra el import; el editor lo
  exige a partir de ahora. (No se pone `not null` para no romper el `alter`.)
- `image_url` **se mantiene**, redefinido semánticamente como *portada*: espejo
  de `product_images` con `position = 0`. La app lo mantiene sincronizado al
  subir/reordenar/borrar imágenes. Evita un join en la lista y en el storefront.

**4. RLS**

```sql
alter table public.categories enable row level security;
alter table public.product_images enable row level security;

-- Spec 1: admin-only, igual que products. El select público llega en Spec 2.
create policy categories_all on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy product_images_all on public.product_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
```

El bucket `product-images` y sus políticas de storage (lectura pública, escritura
admin) ya existen — se reutilizan.

**5. Trigger `updated_at`** en `categories`:
`create trigger trg_categories_updated_at before update on public.categories for
each row execute function public.set_updated_at();` (la función ya existe, migr.
`20260819195906`). `product_images` no tiene `updated_at`, no necesita trigger.

**Nota — tabla `product_variants` preexistente.** La migración greenfield
`20260819195906` ya creó `public.product_variants` (`color, size,
personalization, price_delta, active`), hoy sin UI ni uso. Queda **fuera de
alcance** de esta Spec (no la tocamos, no la exponemos). Se menciona para que el
plan no la "descubra": el modelo de variantes eventual se apoyará en ella.

### Regeneración de tipos

`npm run gen:types` → `src/lib/database.types.ts` con `categories`,
`product_images` y las columnas nuevas.

## Import

### `scripts/import-catalog.mjs` (nuevo)

Sigue el patrón de `scripts/gen-types.mjs`. Node, sin deps nuevas. Lee la
service-role key de env (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`), aborta si
faltan. Flag `--dry-run` (default recomendado la primera vez): imprime el plan y
el reporte de diferencias de precio, sin escribir.

**Fuente:** `src/features/storefront/data/products.ts` — se importa el módulo y se
usa `PRODUCTS` (~80). Los PDF (`~/Downloads/global3d - Catalogo de productos*.pdf`)
**no** se parsean en runtime; su texto (extraído aparte con `pdftotext -layout`)
se incluye como una constante `PDF_PRICES: Record<string, number>` curada a mano
en el script, usada **solo** para el reporte de diferencias.

**Mapeo** (delegado a `src/features/products/catalog-taxonomy.ts`, módulo puro
compartido con el editor):

- `slug` = `slugify(name)`, dedup con sufijo `-2`, `-3`.
- `category` (old `cat` → slug nuevo):
  - `combos` → `combos`
  - `figuras` → `figuras`
  - `trofeos` → `trofeos`
  - `llaveros` → `llaveros`
  - `golosineros` → `golosineros`
  - `vasos` → `vasos-milkshake` si el nombre contiene "milkshake" (case-insensitive),
    si no `vasos-ferneteros`
  - `filamentos` → `impresion-3d`
  - `impresoras` → `impresion-3d`
- `subcategory`: primera pasada portando los `test(p)` de
  [`subcategories.ts`](../../../src/features/storefront/subcategories.ts) al mapa
  de `catalog-taxonomy.ts`. Lo que no matchea queda `null` para que el admin lo
  asigne.
- `base_price` = `price`.
- `description` = `desc`; si el producto tenía `colors[]` (filamentos) o specs de
  capacidad, se listan al final de la descripción (texto).
- `personalizable` = `p.personalizable`.
- `custom_on_request` = `true` salvo `cat ∈ {filamentos, impresoras}`.
- `stock_quantity` = `0` para todos (el `stock` estático es un placeholder de UI,
  ver comentario en `pricing.ts`). El admin carga el stock real después.
- `compare_at_price` = `null`. `sku` = `null`. `weight_grams` = `null`.
- `active` = `true`.

**Extras solo en PDF** (no están en `data/products.ts`) — lista corta y curada a
mano en el script, `stock_quantity: 0`, precio del PDF, categoría asignada:

- "Capibara / Carpincho figura coleccionable" → `figuras`
- "Vaso copa del mundo 1L" ($28.500) → `vasos-ferneteros`
- "Trofeo paleta" → `trofeos` (sin precio en el PDF → queda `base_price` null,
  `active: false` para que no se publique sin precio)

**Escritura:**

1. `upsert` de las 11 `categories` por `slug` (idempotente; la migración ya las
   sembró, esto cubre correr el script contra una branch sin el seed).
2. `upsert` de cada producto con `onConflict: 'slug'`. Re-ejecutar actualiza, no
   duplica. No se tocan `product_images` (no hay imágenes).

**Reporte de diferencias de precio:** por cada producto cuyo `slug`/nombre matchea
una entrada de `PDF_PRICES`, si `|precio_estatico - precio_pdf| > 0`, imprime una
línea `nombre | data/products.ts: $X | PDF: $Y`. El usuario decide a mano; el
script nunca pisa con el precio del PDF.

**Documentación de rollout:** el README del script (comentario de cabecera)
explica cómo correrlo post-merge contra cloud: `--dry-run` primero, revisar el
reporte, luego sin flag.

## UI del admin

Rutas sin cambios en
[`admin.route.tsx`](../../../src/features/admin/admin.route.tsx):
`/admin/productos` (grilla), `/admin/productos/nuevo` y `/:id` (editor). Ambas
siguen bajo `AdminOnlyRoute`.

### A. Grilla editable — "carga rápida" (`ProductsList.tsx` reescrito)

Tabla editable (desktop-first). Columnas: miniatura · **nombre** (link al editor)
· categoría (`<select>`) · precio · precio comparativo · stock (`−` / n / `+`) ·
SKU · activo (toggle).

- **Autosave inline** al cambiar/blur vía `updateProduct` — optimista, estado
  `busyId` por fila, error revierte + toast. Mismo patrón que
  [`InsumosList.handleAdjust`](../../../src/features/insumos/InsumosList.tsx).
- **Fila de alta rápida:** botón "+ Producto" antepone una fila en blanco
  (nombre + precio + categoría). Enter guarda (crea con `slug` autogenerado,
  `stock 0`, `active true`) y abre otra fila en blanco para seguir cargando.
- **Toolbar:** búsqueda existente + `<select>` de categoría (nuevo
  `ProductFilter.category`) + chip "solo activos" + resumen de stock ya presente.
- **Acciones masivas:** columna de checkboxes → barra de acciones (activar /
  desactivar / asignar categoría / eliminar). `bulkUpdateProducts` en la API.
  *(Puede recortarse en la fase de plan si agranda demasiado el PR — es la parte
  más prescindible.)*
- **Sticky CTA:** "Nuevo producto (detalle)" → editor completo.
- **Mobile (< ~760px):** la tabla colapsa a las filas-card actuales con `−`/`+`
  de stock y tap al editor. La edición inline completa es desktop-only (supuesto:
  el trabajo de catálogo se hace en compu).

### B. Editor de una página — estilo Shopify (`ProductForm.tsx` reescrito)

Una página scrolleable; dos columnas en desktop (`main` + `aside`), apiladas en
mobile. Reutiliza `order-form`, `form-section`, `field`, `sticky-cta` de
`orders.css`.

**Columna principal:**

- Título grande sin borde + slug editable autogenerado (con affordance de
  "editar").
- **Descripción:** `<textarea>` que crece. Sin librería de texto rico.
- **Medios:** drop-zone + grilla de galería. Multi-upload → una fila
  `product_images` por archivo (`uploadProductImage(productId, file, position)`).
  Drag para reordenar → reescribe `position`. La primera (`position 0`) es la
  portada y se refleja en `products.image_url`. Borrar elimina la fila y el
  objeto de storage. Requiere que el producto ya exista (id en el path).
- **Precios:** `base_price`, `compare_at_price` con % de descuento calculado y
  aviso si `compare_at_price <= base_price`; preview read-only del precio de
  contado reusando `CASH_DISCOUNT` de `storefront/pricing.ts` (import de una
  constante, sin acoplar lógica).
- **Inventario:** `sku`, `stock_quantity`, `weight_grams`.

**Columna lateral (`aside`):**

- **Estado:** Activo / Inactivo.
- **Organización:** `<select>` de categoría (de `categories`), `<select>` de
  subcategoría (opciones de `catalog-taxonomy.ts` según la categoría elegida;
  "— sin asignar —" permitido), checkbox `personalizable`, checkbox
  `custom_on_request`.

**Guardado:** barra sticky "Guardar" + guard de cambios sin guardar
(`beforeunload` + confirm al navegar). Alta: `/admin/productos/nuevo` guarda y
redirige a `/:id` para poder cargar medios.

### Módulos compartidos / puros

- `src/features/products/catalog-taxonomy.ts` (nuevo, puro): `slugify`,
  `mapLegacyCategory(cat, name)`, `SUBCATEGORY_OPTIONS: Record<catSlug,
  {slug,label}[]>`, `deriveSubcategory(cat, product)`. Usado por el importer y el
  editor. Es el germen de lo que la Spec 2 promoverá a `navigation.ts`.
- `products.api.ts`: agregar `listCategories()`, `createProductImage()`,
  `deleteProductImage()`, `reorderProductImages()`, `bulkUpdateProducts()`;
  extender `uploadProductImage()` para aceptar `position` y devolver
  `{path, url}`.
- `list.ts`: `ProductFilter` gana `category: string` (`''` = todas);
  `filterProducts` la aplica.
- `validation.ts`: agregar validación de `slug` (no vacío, `[a-z0-9-]+`),
  `sku` (opcional, sin espacios), aviso `compare_at_price`, `weight_grams`
  entero ≥ 0. `ProductDraft` gana los campos nuevos.

## Flujo de datos

```
data/products.ts (estático, ~80)
      │  import-catalog.mjs  (+ catalog-taxonomy.ts para el mapeo,
      │                        + PDF_PRICES para el reporte de diffs)
      ▼
Supabase: categories ─◄─ products ─►─ product_images
      ▲                    │                 ▲
      │  listCategories     │ updateProduct    │ create/delete/reorderProductImage
      │                    │ bulkUpdateProducts│ (bucket product-images)
      └──────── /admin/productos: grilla editable + editor Shopify ───────┘

Storefront: SIN CAMBIOS en Spec 1 (sigue leyendo data/products.ts).
```

## Testing

- **Unit:**
  - `catalog-taxonomy.test.ts` — todo `cat` legacy mapea a un slug de las 11;
    `slugify` dedup; `deriveSubcategory` devuelve `null` u opción válida de la
    categoría.
  - `validation.test.ts` — slug / sku / compare-at / weight.
  - `list.test.ts` — filtro por categoría, combinado con búsqueda y "solo
    activos".
- **RTL:**
  - `ProductsList` — editar precio inline hace autosave (mock `updateProduct`);
    fila de alta rápida crea y reabre; desactivar masivo.
  - `ProductForm` — agregar/reordenar/borrar imagen (storage mockeado), guardar
    organización desde el `aside`, guard de cambios sin guardar.
- **Importer:** `--dry-run` imprime plan + reporte sin escribir; smoke manual
  contra una branch de Supabase antes de cloud.
- `npm test` completo + `npm run typecheck` verdes.

## Rollout

Un solo PR en `feature/auth-access`.

1. Migración `20260827140000_product_catalog_taxonomy_images.sql` + `gen:types`.
2. `catalog-taxonomy.ts` + test.
3. `products.api.ts` + `list.ts` + `validation.ts` + tests.
4. `ProductsList.tsx` (grilla) + CSS + RTL.
5. `ProductForm.tsx` (editor) + CSS + RTL.
6. `scripts/import-catalog.mjs` + doc de cabecera.
7. `npm test` + `typecheck` + revisión manual en `npm run dev`.

Post-merge (manual, documentado en el script): correr `import-catalog.mjs
--dry-run` contra cloud, revisar el reporte de precios, correr sin flag.

Sin cambios en el storefront → nada visible para el cliente se mueve. La Spec 2
(storefront sobre DB + taxonomía) parte de este esquema.
