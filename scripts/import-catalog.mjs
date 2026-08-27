// Carga el catálogo del storefront estático (src/features/storefront/data/products.ts)
// a la tabla `products` de Supabase, mapeando a la taxonomía nueva. Re-ejecutable:
// upsert por `slug`, no duplica. NO pisa stock_quantity ni active al reimportar.
//
// Uso:
//   node scripts/import-catalog.mjs --dry-run           # plan + diffs de precio, no escribe
//   node scripts/import-catalog.mjs --print-sql         # emite el SQL idempotente a stdout
//   node scripts/import-catalog.mjs --db-url "<url>"    # escribe directo vía pg
//
// Conexión directa: --db-url, luego $DATABASE_URL, luego $SUPABASE_DB_URL (igual
// que gen-types.mjs). Si no hay conexión y no se pidió --print-sql, corre en
// modo --dry-run.
//
// Precios de los PDF (solo para el reporte de diferencias): se extraen en runtime
// con `pdftotext -layout` si está en el PATH. Rutas por --pdf <ruta> (repetible).

import { execFileSync } from 'node:child_process'
import { createServer } from 'vite'

const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const PRINT_SQL = args.includes('--print-sql')
function argValues(flag) {
  const out = []
  for (let i = 0; i < args.length; i++)
    if (args[i] === flag) out.push(args[i + 1])
  return out
}
const dbUrl =
  argValues('--db-url')[0] ||
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  null
const pdfPaths = argValues('--pdf')

// --- 1. Cargar los módulos TS vía Vite SSR (sin deps nuevas) -----------------
const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})
let PRODUCTS
let tax
try {
  ;({ PRODUCTS } = await vite.ssrLoadModule(
    '/src/features/storefront/data/products.ts',
  ))
  tax = await vite.ssrLoadModule('/src/features/products/catalog-taxonomy.ts')
} finally {
  await vite.close()
}

// --- 2. Precios desde los PDF (best-effort) ---------------------------------
function pdfPrices(paths) {
  const map = new Map()
  for (const p of paths) {
    let text
    try {
      text = execFileSync('pdftotext', ['-layout', p, '-'], {
        encoding: 'latin1',
      })
    } catch {
      console.warn(`No se pudo leer ${p} con pdftotext; se omite del reporte.`)
      continue
    }
    let lastName = null
    for (const line of text.split(/\r?\n/)) {
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
  const root = base || 'producto'
  let s = root
  let i = 2
  while (seenSlugs.has(s)) s = `${root}-${i++}`
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

// Extras que aparecen en los PDF y NO están en data/products.ts (curado a mano).
// "Vaso copa del mundo 1L" ya está en el catálogo estático, así que no va acá.
rows.push(
  {
    slug: uniqueSlug('capibara-carpincho-figura'),
    name: 'Capibara / Carpincho figura coleccionable',
    description: 'Figura coleccionable impresa en 3D.',
    base_price: null,
    stock_quantity: 0,
    personalizable: false,
    custom_on_request: true,
    active: false,
    category_slug: 'figuras',
    subcategory: null,
    _pdfPrice: null,
  },
  {
    slug: uniqueSlug('trofeo-paleta'),
    name: 'Trofeo paleta',
    description: 'Trofeo con forma de paleta.',
    base_price: null,
    stock_quantity: 0,
    personalizable: true,
    custom_on_request: true,
    active: false,
    category_slug: 'trofeos',
    subcategory: 'deportivos',
    _pdfPrice: null,
  },
)

// --- 4. Reporte -----------------------------------------------------------
console.error(`${rows.length} productos a importar.`)
const diffs = rows.filter(
  (r) =>
    r._pdfPrice != null &&
    r.base_price != null &&
    Math.abs(r._pdfPrice - r.base_price) >= 1,
)
if (diffs.length) {
  console.error(
    '\nDiferencias de precio (data/products.ts vs PDF) — revisar a mano:',
  )
  for (const d of diffs)
    console.error(`  ${d.name}: $${d.base_price} vs PDF $${d._pdfPrice}`)
}
const noCat = rows.filter((r) => !r.category_slug)
if (noCat.length) console.error(`\n${noCat.length} sin categoría resuelta.`)

// --- 5. SQL idempotente --------------------------------------------------
function lit(v) {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return `'${String(v).replace(/'/g, "''")}'`
}

function buildSql() {
  const cats = tax.CATEGORY_SEED.map(
    (c) =>
      `  (${lit(c.slug)}, ${lit(c.name)}, ${lit(c.icon)}, ${lit(c.position)}, ${lit(c.featured)})`,
  ).join(',\n')
  const catUpsert =
    `insert into public.categories (slug, name, icon, position, featured) values\n${cats}\n` +
    `on conflict (slug) do update set name = excluded.name, icon = excluded.icon, ` +
    `position = excluded.position, featured = excluded.featured;`

  const values = rows
    .map(
      (r) =>
        `  (${lit(r.slug)}, ${lit(r.name)}, ${lit(r.description)}, ${lit(r.base_price)}, ` +
        `${lit(r.stock_quantity)}, ${lit(r.personalizable)}, ${lit(r.custom_on_request)}, ` +
        `${lit(r.active)}, (select id from public.categories where slug = ${lit(r.category_slug)}), ` +
        `${lit(r.subcategory)})`,
    )
    .join(',\n')
  const prodUpsert =
    `insert into public.products\n` +
    `  (slug, name, description, base_price, stock_quantity, personalizable,\n` +
    `   custom_on_request, active, category_id, subcategory) values\n${values}\n` +
    `on conflict (slug) do update set\n` +
    `  name = excluded.name, description = excluded.description,\n` +
    `  base_price = excluded.base_price, personalizable = excluded.personalizable,\n` +
    `  custom_on_request = excluded.custom_on_request,\n` +
    `  category_id = excluded.category_id, subcategory = excluded.subcategory;`

  return `${catUpsert}\n\n${prodUpsert}\n`
}

if (PRINT_SQL) {
  process.stdout.write(buildSql())
  process.exit(0)
}

if (DRY || !dbUrl) {
  if (!dbUrl && !DRY)
    console.error('\nSin --db-url ni $DATABASE_URL: corriendo como --dry-run.')
  console.error(
    '\n--dry-run: no se escribió nada. Usá --print-sql o --db-url para aplicar.',
  )
  process.exit(0)
}

// --- 6. Escritura directa vía pg --------------------------------------
const pg = (await import('pg')).default
const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
})
await client.connect()
try {
  await client.query(buildSql())
  const { rows: count } = await client.query(
    'select count(*)::int as n from public.products',
  )
  console.error(`\nListo. products ahora tiene ${count[0].n} filas.`)
} finally {
  await client.end()
}
