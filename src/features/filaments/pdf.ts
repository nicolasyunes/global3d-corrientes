import {
  colorPrice,
  isBoth,
  money,
  selectForExport,
  type ExportOptions,
  type FilamentLine,
} from './filaments'

type RGB = [number, number, number]

const TODAY = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function exportSummary({ brands, stock }: ExportOptions): string {
  const who = brands ? `Marcas: ${brands.join(', ')}` : 'Todas las marcas'
  const what =
    stock === 'with'
      ? 'Solo con stock'
      : stock === 'without'
        ? 'Solo sin stock'
        : 'Con y sin stock'
  return `${who} · ${what}`
}

export function pdfFileName(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `paleta-filamentos-${y}-${m}-${d}.pdf`
}

// Colors a swatch is made of, blended on white when translucent. A gradient
// (silk, multicolor) gives all of its stops, a plain color just one.
export function swatchColors(swatch: string): RGB[] {
  const out: RGB[] = []
  const blend = (c: number, a: number) => Math.round(c * a + 255 * (1 - a))
  for (const m of swatch.matchAll(
    /#([0-9a-f]{8}|[0-9a-f]{6})\b|rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/gi,
  )) {
    if (m[1]) {
      const n = parseInt(m[1].slice(0, 6), 16)
      const a = m[1].length === 8 ? parseInt(m[1].slice(6), 16) / 255 : 1
      out.push([blend(n >> 16, a), blend((n >> 8) & 255, a), blend(n & 255, a)])
    } else {
      const a = m[5] === undefined ? 1 : Number(m[5])
      out.push([blend(+m[2], a), blend(+m[3], a), blend(+m[4], a)])
    }
  }
  return out.length ? out : [[184, 176, 166]]
}

const PAGE = { w: 210, h: 297, margin: 14 }
const COLS = 3
const ROW = 9.5

// The palette as a real PDF file: each color a swatch circle with its name,
// grouped by line. Built in the browser; the library loads only when asked.
export async function createPalettePdf(
  lines: readonly FilamentLine[],
  options: ExportOptions,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const chosen = selectForExport(lines, options)
  const total = chosen.reduce((n, l) => n + l.colors.length, 0)
  const inner = PAGE.w - PAGE.margin * 2
  const colW = inner / COLS
  let y = PAGE.margin

  const text = (
    s: string,
    x: number,
    at: number,
    size: number,
    bold = false,
    color: RGB = [29, 27, 25],
    align: 'left' | 'right' = 'left',
  ) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...color)
    doc.text(s, x, at, { align })
  }
  const fit = (s: string, width: number, size: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    if (doc.getTextWidth(s) <= width) return s
    let cut = s
    while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > width)
      cut = cut.slice(0, -1)
    return `${cut.trimEnd()}…`
  }

  // Swatch: a disc, or equal wedges when the color is a gradient.
  const dot = (cx: number, cy: number, r: number, swatch: string) => {
    const colors = swatchColors(swatch)
    doc.setDrawColor(190, 184, 176)
    doc.setLineWidth(0.25)
    if (colors.length === 1) {
      doc.setFillColor(...colors[0])
      doc.circle(cx, cy, r, 'FD')
      return
    }
    const step = (Math.PI * 2) / colors.length
    colors.forEach((c, i) => {
      const a0 = -Math.PI / 2 + i * step
      const pts: [number, number][] = [[cx, cy]]
      for (let k = 0; k <= 8; k++) {
        const a = a0 + (step * k) / 8
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
      }
      doc.setFillColor(...c)
      doc.lines(
        pts.slice(1).map((p, k) => [p[0] - pts[k][0], p[1] - pts[k][1]]),
        pts[0][0],
        pts[0][1],
        [1, 1],
        'F',
        true,
      )
    })
    doc.setFillColor(0, 0, 0)
    doc.setDrawColor(190, 184, 176)
    doc.circle(cx, cy, r, 'S')
  }

  // Title block.
  text('Paleta de filamentos', PAGE.margin, y + 6, 22, true)
  y += 12
  text(
    `Global 3D Corrientes · ${TODAY.format(new Date())} · ${total} colores`,
    PAGE.margin,
    y,
    9.5,
    false,
    [77, 70, 64],
  )
  y += 5
  text(exportSummary(options), PAGE.margin, y, 9.5, false, [77, 70, 64])
  y += 3
  doc.setDrawColor(243, 112, 33)
  doc.setLineWidth(0.7)
  doc.line(PAGE.margin, y, PAGE.w - PAGE.margin, y)
  y += 8

  const heading = (line: FilamentLine, again: boolean) => {
    text(line.brand, PAGE.margin, y, 13, true)
    const bw = doc.getTextWidth(line.brand)
    text(line.name, PAGE.margin + bw + 2, y, 13, false, [77, 70, 64])
    const meta = `${line.material}${isBoth(line) ? ' · spool y recarga' : ''}${again ? ' · continúa' : ''}`
    text(meta, PAGE.w - PAGE.margin, y, 8.5, true, [95, 88, 81], 'right')
    doc.setDrawColor(216, 209, 200)
    doc.setLineWidth(0.25)
    doc.line(PAGE.margin, y + 1.8, PAGE.w - PAGE.margin, y + 1.8)
    y += 8
  }

  for (const line of chosen) {
    // A heading needs room for at least one row under it.
    if (y + 8 + ROW > PAGE.h - PAGE.margin) {
      doc.addPage()
      y = PAGE.margin
    }
    heading(line, false)
    line.colors.forEach((c, i) => {
      const col = i % COLS
      if (col === 0 && i > 0) {
        y += ROW
        if (y + ROW > PAGE.h - PAGE.margin) {
          doc.addPage()
          y = PAGE.margin
          heading(line, true)
        }
      }
      const x = PAGE.margin + col * colW
      dot(x + 3.2, y - 1, 3.2, c.swatch)

      const right: string[] = []
      if (options.showStock) {
        const out = c.stock + (c.stock_refill ?? 0) === 0
        right.push(
          out
            ? 'sin stock'
            : isBoth(line)
              ? `${c.stock}+${c.stock_refill ?? 0}`
              : `${c.stock} bob.`,
        )
      }
      const price = colorPrice(line, c)
      if (options.showPrice && price != null) right.push(money(price))
      const meta = right.join('  ')
      const metaW = meta ? doc.getTextWidth(meta) + 2 : 0

      const label = c.finish !== 'Estándar' ? `${c.name} · ${c.finish}` : c.name
      const room = colW - 10 - metaW - 2
      text(fit(label, room, 9.5, true), x + 8, y, 9.5, true)
      if (meta) text(meta, x + colW - 3, y, 8, false, [77, 70, 64], 'right')
    })
    y += ROW + 5
  }

  return doc.output('blob')
}

// A plain list to paste in a chat: lines with their colors, and the quantities
// when they are asked for. For quick answers to "¿qué tenés?".
export function palettePlainText(
  lines: readonly FilamentLine[],
  options: ExportOptions,
): string {
  const chosen = selectForExport(lines, options)
  const out: string[] = ['*Filamentos Global 3D*', exportSummary(options), '']
  for (const line of chosen) {
    out.push(`*${line.brand} ${line.name}* (${line.material})`)
    for (const c of line.colors) {
      const total = c.stock + (c.stock_refill ?? 0)
      const bits: string[] = []
      if (c.finish !== 'Estándar') bits.push(c.finish)
      if (options.showStock)
        bits.push(
          total === 0
            ? 'sin stock'
            : isBoth(line)
              ? `spool ${c.stock}, recarga ${c.stock_refill ?? 0}`
              : `${c.stock} bob.`,
        )
      const price = colorPrice(line, c)
      if (options.showPrice && price != null) bits.push(money(price))
      out.push(`• ${c.name}${bits.length ? ` (${bits.join(' · ')})` : ''}`)
    }
    out.push('')
  }
  return out.join('\n').trimEnd()
}
