import QRCode from 'qrcode'

export type ErrorLevel = 'L' | 'M' | 'Q' | 'H'

export const ERROR_LEVELS: { value: ErrorLevel; label: string }[] = [
  { value: 'L', label: 'Baja (7%)' },
  { value: 'M', label: 'Media (15%)' },
  { value: 'Q', label: 'Alta (25%)' },
  { value: 'H', label: 'Máxima (30%)' },
]

export interface QrMatrix {
  size: number
  isDark: (x: number, y: number) => boolean
}

// "global3d.com.ar/x" → "https://global3d.com.ar/x". Schemes the user typed
// (mailto:, tel:, WIFI:, http://) are kept as they are.
export function normalizeLink(input: string): string {
  const text = input.trim()
  if (!text) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return text
  if (/^[^\s/]+\.[^\s/]{2,}(\/\S*)?$/.test(text)) return `https://${text}`
  return text
}

export function qrMatrix(text: string, level: ErrorLevel): QrMatrix {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: level })
  return {
    size: modules.size,
    isDark: (x, y) => modules.get(y, x) === 1,
  }
}

// One filled path, merging consecutive dark modules of each row into a single
// rectangle. Filled shapes (not strokes) import cleanly into OpenSCAD and
// Bambu Studio, and the merge keeps the file small.
export function qrPath(matrix: QrMatrix, margin: number): string {
  const parts: string[] = []
  for (let y = 0; y < matrix.size; y++) {
    let x = 0
    while (x < matrix.size) {
      if (!matrix.isDark(x, y)) {
        x++
        continue
      }
      const start = x
      while (x < matrix.size && matrix.isDark(x, y)) x++
      parts.push(
        `M${start + margin} ${y + margin}h${x - start}v1h${start - x}z`,
      )
    }
  }
  return parts.join('')
}

export interface QrSvgOptions {
  margin: number
  fg: string
  // null = transparent background (only the dark modules are drawn).
  bg: string | null
  // Final printed side in mm; null keeps the SVG unitless.
  sizeMm: number | null
}

export function qrSvg(matrix: QrMatrix, options: QrSvgOptions): string {
  const side = matrix.size + options.margin * 2
  const dims =
    options.sizeMm != null
      ? ` width="${options.sizeMm}mm" height="${options.sizeMm}mm"`
      : ''
  const bg = options.bg
    ? `<rect width="${side}" height="${side}" fill="${options.bg}"/>`
    : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}"${dims} shape-rendering="crispEdges">` +
    bg +
    `<path fill="${options.fg}" d="${qrPath(matrix, options.margin)}"/>` +
    `</svg>`
  )
}

// Light vs dark contrast; scanners struggle below ~3 and with inverted codes.
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export function isInverted(fg: string, bg: string): boolean {
  const lum = (hex: string) =>
    [1, 3, 5].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0)
  return lum(fg) > lum(bg)
}
