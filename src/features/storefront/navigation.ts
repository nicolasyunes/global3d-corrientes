// Single source of truth for the storefront category tree. The nav bar, the
// mega-menu panels, the mobile drawer and the CategoryPage facet sidebar are
// all generated from NAV. Replaces the old flat CATEGORIES array and the
// name-matching sub-link helper module.

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
