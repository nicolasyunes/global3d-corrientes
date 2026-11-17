// Variante de prueba "blíster" del inicio (ruta /nueva). Cada categoría tiene
// su color de fondo, definido en styles/blister.css para modo claro y oscuro.

const TINTED = new Set([
  'vasos',
  'milkshake',
  'regalos',
  'trofeos',
  'llaveros',
  'figuras',
  'juegos',
  'hogar',
  'didactico',
  'insumos',
])

/** Valor CSS del color del blíster para una categoría */
export function categoryTint(slug: string): string {
  return TINTED.has(slug) ? `var(--bl-${slug})` : 'var(--bl-default)'
}
