// Per-category subfilters shown in the CategoryPage sidebar, derived from
// product naming/attributes so the sidebar doesn't just repeat the top nav's
// category list. Capped at ~4-5 options per category to avoid clutter.
import type { Product } from './data/products'

export type Subcategory = { slug: string; label: string; test: (p: Product) => boolean }

const SUBCATEGORIES: Record<string, Subcategory[]> = {
  vasos: [
    { slug: 'fernetero-1l', label: 'Fernetero 1L', test: (p) => p.name.includes('Fernetero') && p.price > 20000 },
    { slug: 'fernetero-500', label: 'Fernetero 500ml', test: (p) => p.name.includes('Fernetero') && p.price <= 20000 },
    { slug: 'deportivos', label: 'Deportivos', test: (p) => !p.name.includes('Fernetero') && !p.name.toLowerCase().includes('milkshake') && !p.personalizable },
    { slug: 'milkshake', label: 'Milkshake', test: (p) => p.name.toLowerCase().includes('milkshake') },
    { slug: 'personalizados', label: 'Personalizados', test: (p) => p.personalizable },
  ],
  figuras: [
    { slug: 'funkos', label: 'Funkos', test: (p) => p.name.includes('Funko') },
    { slug: 'articulados', label: 'Muñecos articulados', test: (p) => p.name.toLowerCase().includes('articulado') },
    { slug: 'portalapices', label: 'Portalápices', test: (p) => p.name.includes('Portalápices') },
    {
      slug: 'otros',
      label: 'Otros coleccionables',
      test: (p) => !p.name.includes('Funko') && !p.name.toLowerCase().includes('articulado') && !p.name.includes('Portalápices'),
    },
  ],
  trofeos: [
    { slug: 'padel', label: 'Pádel', test: (p) => p.name.includes('pádel') },
    { slug: 'amedida', label: 'A medida', test: (p) => p.name.includes('a medida') },
    { slug: 'personalizados', label: 'Personalizados', test: (p) => !p.name.includes('pádel') && !p.name.includes('a medida') },
  ],
  llaveros: [
    { slug: 'personajes', label: 'Personajes', test: (p) => !p.personalizable && !p.name.toLowerCase().includes('comunión') },
    { slug: 'personalizados', label: 'Personalizados', test: (p) => p.personalizable },
    { slug: 'eventos', label: 'Eventos', test: (p) => p.name.toLowerCase().includes('comunión') },
  ],
  golosineros: [
    { slug: 'alcancias', label: 'Alcancías', test: (p) => p.name.includes('alcancía') },
    { slug: 'huevos', label: 'Huevos', test: (p) => p.name.includes('Huevo') },
  ],
  filamentos: [
    { slug: 'pla', label: 'PLA', test: (p) => p.unit !== 'L' && p.name.includes('PLA') },
    { slug: 'petg', label: 'PETG', test: (p) => p.unit !== 'L' && p.name.includes('PETG') },
    { slug: 'abs', label: 'ABS', test: (p) => p.unit !== 'L' && p.name.includes('ABS') },
    { slug: 'resina', label: 'Resina', test: (p) => p.unit === 'L' },
  ],
}

export function getSubcategories(catSlug: string): Subcategory[] {
  return SUBCATEGORIES[catSlug] || []
}
