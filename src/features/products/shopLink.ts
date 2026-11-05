// "Mostrar en la tienda" desde la ficha del producto. La tienda agrupa los
// productos en familias (shop_families): cada familia es una ficha y sus
// productos son las variantes, elegidas por ejes como Tamaño o Equipo
// (option_axes). Un producto está en una sola familia (shop_family_products).

export interface ShopAxis {
  key: string
  label: string
}

export interface ShopFamilyOption {
  id: string
  slug: string
  name: string
  category: string
  published: boolean
  axes: ShopAxis[]
  /** Productos de la familia con sus valores, para sugerir y evitar duplicados */
  members: {
    productId: string
    values: Record<string, string>
    position: number
  }[]
}

export type ShopLinkMode = 'none' | 'existing' | 'new'

export interface ShopLinkDraft {
  mode: ShopLinkMode
  familyId: string
  options: Record<string, string>
  newName: string
  newCategory: string
}

export function emptyShopLink(): ShopLinkDraft {
  return {
    mode: 'none',
    familyId: '',
    options: {},
    newName: '',
    newCategory: '',
  }
}

const CATEGORY_LABELS: Record<string, string> = { didactico: 'Didáctico' }

export function categoryLabel(slug: string): string {
  return CATEGORY_LABELS[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1)
}

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
}

/** Slug libre: agrega -2, -3… si ya existe. */
export function uniqueSlug(name: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const base = slugify(name) || 'producto'
  if (!used.has(base)) return base
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`
}

/** Valores ya usados en un eje de la familia, sin repetir, para sugerir. */
export function usedValues(family: ShopFamilyOption, axis: string): string[] {
  const set = new Set<string>()
  for (const m of family.members) {
    const v = m.values[axis]?.trim()
    if (v) set.add(v)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'es'))
}

export function cleanOptions(
  family: ShopFamilyOption,
  options: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const a of family.axes) out[a.key] = (options[a.key] ?? '').trim()
  return out
}

/** Mensaje para mostrar si no se puede guardar; null si está bien. */
export function validateShopLink(
  d: ShopLinkDraft,
  families: ShopFamilyOption[],
  productId: string | null,
): string | null {
  if (d.mode === 'none') return null
  if (d.mode === 'new') {
    if (d.newName.trim().length < 3)
      return 'Escribí el nombre que va a ver el cliente en la tienda.'
    if (!d.newCategory) return 'Elegí en qué categoría de la tienda va.'
    return null
  }
  const family = families.find((f) => f.id === d.familyId)
  if (!family) return 'Elegí la ficha de la tienda.'
  const values = cleanOptions(family, d.options)
  const missing = family.axes.find((a) => !values[a.key])
  if (missing) return `Completá ${missing.label.toLowerCase()}.`
  const twin = family.members.find(
    (m) =>
      m.productId !== productId &&
      family.axes.every(
        (a) =>
          (m.values[a.key] ?? '').trim().toLowerCase() ===
          values[a.key].toLowerCase(),
      ),
  )
  if (twin && family.axes.length > 0)
    return `Ya hay otro producto con ${family.axes
      .map((a) => `${a.label} ${values[a.key]}`)
      .join(' y ')} en esta ficha.`
  return null
}
