// Archivos que adjunta el cliente en "Pedido a medida". Los límites tienen que
// coincidir con el bucket shop-quote-files (migración 20261104154342).

export const QUOTE_MAX_FILES = 3
export const QUOTE_MAX_BYTES = 10 * 1024 * 1024

const TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
}

/** Para el atributo accept del input */
export const QUOTE_ACCEPT =
  '.png,.jpg,.jpeg,.svg,.pdf,' + Object.keys(TYPES).join(',')

/** Algunos sistemas no informan el tipo del SVG o del PDF: se deduce del nombre. */
export function quoteFileType(file: {
  name: string
  type: string
}): string | null {
  if (TYPES[file.type]) return file.type
  const ext = file.name.toLowerCase().split('.').pop()
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'pdf') return 'application/pdf'
  return null
}

/** Mensaje para mostrar si el archivo no se puede subir; null si está bien. */
export function quoteFileError(file: {
  name: string
  type: string
  size: number
}): string | null {
  if (!quoteFileType(file)) return 'Solo se pueden subir PNG, JPG, SVG o PDF.'
  if (file.size > QUOTE_MAX_BYTES) return 'Pesa más de 10 MB.'
  if (file.size === 0) return 'El archivo está vacío.'
  return null
}

/** Ruta dentro del bucket: a-medida/AAAA-MM/<aleatorio>.<ext> */
export function quoteFilePath(
  type: string,
  now = new Date(),
  id: string = crypto.randomUUID(),
): string {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return `a-medida/${month}/${id}.${TYPES[type]}`
}

export function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}
