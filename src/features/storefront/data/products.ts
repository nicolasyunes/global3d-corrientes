// Storefront catalog — static data ported from the "Global3D Tienda" design
// (Claude Design canvas). No backend/CMS behind this yet: editing the catalog
// means editing this file.

import { CATEGORIES, findCategory, type Category } from '../navigation'
export { CATEGORIES, findCategory }
export type { Category }

export type StockLevel = 'in' | 'low'

export type ProductColor = { name: string; hex: string }

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

const COLOR_BG: Record<string, string> = {
  Blanco: '#f5f5f0', Negro: '#1a1a1a', Gris: '#8a8a8a', Rojo: '#c0392b', Azul: '#2b6cb0', Verde: '#2f8f4e', Amarillo: '#eab308',
  Dorado: '#c9a24b', Natural: '#e8ddb5', Transparente: '#dbe6e8', Plata: '#c0c0c0', Cobre: '#b06a3d',
}
export function colorBg(c: ProductColor | string): string {
  if (typeof c === 'object') return c.hex
  return COLOR_BG[c] || '#cccccc'
}
export function colorName(c: ProductColor | string): string {
  return typeof c === 'object' ? c.name : c
}

type FilamentLine = { slug: string; name: string; price: number; unit: 'kg' | 'L'; colors: ProductColor[] }
type FilamentBrand = { slug: string; name: string; lines: FilamentLine[] }

const FILAMENT_BRANDS: FilamentBrand[] = [
  {
    slug: '3n3', name: '3N3', lines: [
      { slug: 'pla', name: 'PLA', price: 16500, unit: 'kg', colors: [{ name: 'Blanco', hex: '#f5f5f0' }, { name: 'Negro', hex: '#1a1a1a' }, { name: 'Rojo', hex: '#c0392b' }, { name: 'Azul', hex: '#2b6cb0' }, { name: 'Verde', hex: '#2f8f4e' }, { name: 'Amarillo', hex: '#eab308' }, { name: 'Gris', hex: '#8a8a8a' }] },
      { slug: 'petg', name: 'PETG', price: 21000, unit: 'kg', colors: [{ name: 'Negro', hex: '#1a1a1a' }, { name: 'Transparente', hex: '#dbe6e8' }, { name: 'Blanco', hex: '#f5f5f0' }] },
      { slug: 'abs', name: 'ABS', price: 19500, unit: 'kg', colors: [{ name: 'Negro', hex: '#1a1a1a' }, { name: 'Blanco', hex: '#f5f5f0' }, { name: 'Gris', hex: '#8a8a8a' }] },
    ],
  },
  {
    slug: 'grilon3', name: 'Grilon3', lines: [
      { slug: 'pla', name: 'PLA Estándar', price: 17500, unit: 'kg', colors: [{ name: 'Blanco', hex: '#f5f5f0' }, { name: 'Negro', hex: '#1a1a1a' }, { name: 'Rojo', hex: '#c0392b' }, { name: 'Azul', hex: '#2b6cb0' }] },
      { slug: 'silk', name: 'PLA Silk', price: 22500, unit: 'kg', colors: [{ name: 'Dorado', hex: '#c9a24b' }, { name: 'Plata', hex: '#c0c0c0' }, { name: 'Cobre', hex: '#b06a3d' }] },
      { slug: 'petg', name: 'PETG', price: 23000, unit: 'kg', colors: [{ name: 'Negro', hex: '#1a1a1a' }, { name: 'Natural', hex: '#e8ddb5' }] },
    ],
  },
  {
    slug: 'elegoo', name: 'Elegoo', lines: [
      { slug: 'standard', name: 'Resina Standard', price: 24800, unit: 'L', colors: [{ name: 'Gris', hex: '#8a8a8a' }, { name: 'Blanco', hex: '#f5f5f0' }, { name: 'Transparente', hex: '#dbe6e8' }] },
      { slug: 'abslike', name: 'Resina ABS-Like', price: 27900, unit: 'L', colors: [{ name: 'Negro', hex: '#1a1a1a' }, { name: 'Blanco', hex: '#f5f5f0' }] },
      { slug: 'washable', name: 'Resina Water Washable', price: 26500, unit: 'L', colors: [{ name: 'Verde', hex: '#2f8f4e' }, { name: 'Gris', hex: '#8a8a8a' }] },
    ],
  },
]

const FILAMENT_PRODUCTS: Product[] = []
FILAMENT_BRANDS.forEach((b) =>
  b.lines.forEach((l) => {
    FILAMENT_PRODUCTS.push({
      id: 'fil-' + b.slug + '-' + l.slug,
      cat: 'filamentos',
      subcat: l.unit === 'L' ? 'resina' : 'filamentos',
      brand: b.slug,
      brandName: b.name,
      name: b.name + ' — ' + l.name,
      price: l.price,
      unit: l.unit,
      personalizable: false,
      customOnRequest: false,
      colors: l.colors,
      stock: 'in',
      desc: (l.unit === 'L' ? 'Resina ' : 'Filamento ') + l.name + ' de ' + b.name + '. Presentación de 1' + l.unit + '.',
      specs: ['Marca: ' + b.name, 'Línea: ' + l.name, 'Presentación: 1' + l.unit],
    })
  }),
)
export const BRAND_LIST: Category[] = FILAMENT_BRANDS.map((b) => ({ slug: b.slug, name: b.name }))

export const PRODUCTS: Product[] = BASE_PRODUCTS.concat(VASOS_PRODUCTS).concat(FILAMENT_PRODUCTS)

export const FEATURED_PRODUCT_IDS = ['fg4', 'tr5', 'lv6', 'go2', 'vs18', 'fil-grilon3-silk']

export const TRUST_ITEMS = [
  { key: 'truck', label: 'Envío a todo el país' },
  { key: 'pin', label: 'Retiro en Corrientes' },
  { key: 'edit', label: 'Personalización a medida' },
  { key: 'card', label: 'Pago en cuotas' },
]

export const BANNERS = [
  { id: 'b1', cat: 'combos', title: 'Combos con vasos, trofeos y llaveros', cta: 'Ver combos' },
  { id: 'b2', cat: 'figuras', title: 'Figuras y coleccionables de tus series favoritas', cta: 'Ver figuras' },
  { id: 'b3', cat: 'impresion-3d', title: 'Filamentos 3N3, Grilon3 y Elegoo', cta: 'Ver filamentos' },
]

export const TESTIMONIALS = [
  { name: 'Marina G.', quote: 'Encargué un trofeo personalizado para un torneo y quedó igual a lo que pedí.' },
  { name: 'Rodrigo P.', quote: 'Buena atención por WhatsApp, me asesoraron con el filamento para una pieza resistente.' },
  { name: 'Valentina S.', quote: 'Compré llaveros personalizados para un evento y se notó la calidad de impresión.' },
]

export const PAYMENT_BADGES = ['Efectivo', 'Transferencia', 'Ualá', 'Brubank', 'Mercado Pago']

export function findProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id)
}
