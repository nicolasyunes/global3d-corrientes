export interface Producto {
  id: string
  nombre: string
  descripcion: string
  ancho_mm: number
  alto_mm: number
  // useful size = ancho - tolerancia
  tolerancia_mm: number
  espesor_mm: number
  // back layer, thinner than espesor_mm
  espesor_base_mm: number
  max_colores: number
}

export const PRODUCTOS: Producto[] = [
  {
    id: 'matera',
    nombre: 'Matera',
    descripcion: 'Lámina para matera, 215 × 84 mm útiles.',
    ancho_mm: 215,
    alto_mm: 84,
    tolerancia_mm: 0,
    espesor_mm: 0.6,
    espesor_base_mm: 0.2,
    max_colores: 4,
  },
  {
    id: 'lampara',
    nombre: 'Lámpara',
    descripcion: 'Lámina para lámpara, 110 × 160 mm.',
    ancho_mm: 110,
    alto_mm: 160,
    tolerancia_mm: 0,
    espesor_mm: 0.6,
    espesor_base_mm: 0.2,
    max_colores: 4,
  },
  {
    id: 'chop',
    nombre: 'Chop',
    descripcion: 'Lámina para chop, 130 × 120 mm.',
    ancho_mm: 130,
    alto_mm: 120,
    tolerancia_mm: 0,
    espesor_mm: 0.6,
    espesor_base_mm: 0.2,
    max_colores: 4,
  },
]

export const medidaUtil = (p: Producto) => ({
  ancho: p.ancho_mm - p.tolerancia_mm,
  alto: p.alto_mm - p.tolerancia_mm,
})
