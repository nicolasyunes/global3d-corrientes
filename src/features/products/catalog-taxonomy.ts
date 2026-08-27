// Puente entre el catálogo estático legacy (src/features/storefront/data/products.ts)
// y la taxonomía nueva respaldada por la DB. Puro: sin DB, sin DOM. Compartido
// por el editor de productos y scripts/import-catalog.mjs. Es el germen de lo
// que la Spec 2 promoverá a un navigation.ts del storefront.

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const CATEGORY_SEED = [
  {
    slug: 'vasos-ferneteros',
    name: 'Vasos Ferneteros',
    icon: '🍺',
    position: 0,
    featured: true,
  },
  {
    slug: 'vasos-milkshake',
    name: 'Vasos Milkshake',
    icon: '🥤',
    position: 1,
    featured: true,
  },
  {
    slug: 'figuras',
    name: 'Figuras y Coleccionables',
    icon: '🧸',
    position: 2,
    featured: false,
  },
  { slug: 'mates', name: 'Mates', icon: '🧉', position: 3, featured: false },
  {
    slug: 'golosineros',
    name: 'Alcancías y Golosineros',
    icon: '💰',
    position: 4,
    featured: false,
  },
  {
    slug: 'llaveros',
    name: 'Llaveros y Merch',
    icon: '🔑',
    position: 5,
    featured: false,
  },
  {
    slug: 'trofeos',
    name: 'Trofeos y Premios',
    icon: '🏆',
    position: 6,
    featured: false,
  },
  {
    slug: 'hogar',
    name: 'Hogar y Decoración',
    icon: '🏠',
    position: 7,
    featured: false,
  },
  {
    slug: 'juegos',
    name: 'Juegos y Juguetes',
    icon: '🎲',
    position: 8,
    featured: false,
  },
  { slug: 'combos', name: 'Combos', icon: '🎁', position: 9, featured: false },
  {
    slug: 'impresion-3d',
    name: 'Impresión 3D',
    icon: '🖨️',
    position: 10,
    featured: false,
  },
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

export const SUBCATEGORY_OPTIONS: Record<
  string,
  { slug: string; label: string }[]
> = {
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
        if (
          n.includes('stranger') ||
          n.includes('vecna') ||
          n.includes('demogorgon')
        )
          return 'stranger-things'
        if (n.includes('sonic')) return 'sonic'
        if (
          n.includes('simpson') ||
          n.includes('intensamente') ||
          n.includes('k-pop') ||
          n.includes('brainrot') ||
          n.includes('labubu') ||
          n.includes('chimuelo')
        )
          return 'anime-pop'
        return null
      }
      if (n.includes('silk')) return 'silk-clasicos'
      if (
        n.includes('afa') ||
        n.includes('mundial') ||
        n.includes('copa del mundo')
      )
        return 'mundial'
      if (
        n.includes('boca') ||
        n.includes('river') ||
        n.includes('racing') ||
        n.includes('san lorenzo') ||
        n.includes('mandiy') ||
        n.includes('sapucay') ||
        n.includes('chicago') ||
        n.includes('bulls')
      )
        return 'futbol-clubes'
      return 'otros-disenos'
    }
    case 'figuras': {
      if (n.includes('articulado')) return 'articulados'
      if (n.includes('funko') && product.personalizable)
        return 'funko-personalizados'
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
