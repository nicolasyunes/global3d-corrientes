import ImageTracer from 'imagetracerjs'

export type VectorMode = 'mono' | 'color'
export type Detail = 'low' | 'medium' | 'high'

export interface VectorOptions {
  mode: VectorMode
  // mono: pixels darker than this become the shape (0–255).
  threshold: number
  invert: boolean
  // color: palette size.
  colors: number
  detail: Detail
  removeBackground: boolean
  // Final width in mm; null keeps the SVG unitless (pixel sized).
  widthMm: number | null
}

export const DEFAULT_OPTIONS: VectorOptions = {
  mode: 'mono',
  threshold: 128,
  invert: false,
  colors: 4,
  detail: 'medium',
  removeBackground: true,
  widthMm: null,
}

export const DETAILS: { value: Detail; label: string }[] = [
  { value: 'low', label: 'Suave' },
  { value: 'medium', label: 'Normal' },
  { value: 'high', label: 'Máximo' },
]

// ltres/qtres: error allowed when fitting lines and curves (lower = closer to
// the pixels). pathomit: outlines shorter than this many pixels are dropped;
// 16 clears the 2–4 px blobs left in tight curves, keeping an i-dot at 1000 px.
const DETAIL_PRESETS: Record<Detail, Record<string, number>> = {
  low: {
    ltres: 2,
    qtres: 2,
    pathomit: 32,
    roundcoords: 1,
  },
  medium: {
    ltres: 1,
    qtres: 1,
    pathomit: 16,
    roundcoords: 1,
  },
  high: {
    ltres: 0.5,
    qtres: 0.5,
    pathomit: 6,
    roundcoords: 2,
  },
}

export const MAX_SIDE = 1000

// px² of bounding box; smaller shapes are dropped as specks.
const MIN_SHAPE_AREA = 20

export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

export interface Pixels {
  width: number
  height: number
  data: Uint8ClampedArray
}

// Big photos trace slowly and add noise, not detail.
export function fitSize(width: number, height: number, max = MAX_SIDE) {
  const k = Math.min(1, max / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * k)),
    height: Math.max(1, Math.round(height * k)),
  }
}

// Transparent pixels become white so a PNG logo's empty area reads as background.
export function flattenAlpha(px: Pixels): Pixels {
  const data = new Uint8ClampedArray(px.data)
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255
    data[i] = data[i] * a + 255 * (1 - a)
    data[i + 1] = data[i + 1] * a + 255 * (1 - a)
    data[i + 2] = data[i + 2] * a + 255 * (1 - a)
    data[i + 3] = 255
  }
  return { ...px, data }
}

// Pure black shape on white, by perceived brightness.
export function thresholdPixels(
  px: Pixels,
  threshold: number,
  invert: boolean,
): Pixels {
  const flat = flattenAlpha(px).data
  for (let i = 0; i < flat.length; i += 4) {
    const lum = 0.299 * flat[i] + 0.587 * flat[i + 1] + 0.114 * flat[i + 2]
    const dark = invert ? lum >= threshold : lum < threshold
    const v = dark ? 0 : 255
    flat[i] = flat[i + 1] = flat[i + 2] = v
  }
  return { ...px, data: flat }
}

// Average of the four corners: the usual background of a logo or a photo.
export function cornerColor(px: Pixels): Rgba {
  const { width: w, height: h, data } = px
  const idx = [0, w - 1, (h - 1) * w, h * w - 1].map((p) => p * 4)
  const avg = (o: number) =>
    Math.round(idx.reduce((s, i) => s + data[i + o], 0) / idx.length)
  return { r: avg(0), g: avg(1), b: avg(2), a: 255 }
}

export function nearestIndex(palette: Rgba[], c: Rgba): number {
  let best = 0
  let bestD = Infinity
  palette.forEach((p, i) => {
    const d = (p.r - c.r) ** 2 + (p.g - c.g) ** 2 + (p.b - c.b) ** 2
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}

const hex = (n: number) => n.toString(16).padStart(2, '0')

// imagetracer writes fill + matching stroke + opacity on every path; 3D tools
// ignore strokes and the stroke fattens shapes in browsers. Keep a hex fill only.
export function cleanSvg(svg: string): string {
  return svg
    .replace(
      /fill="rgb\((\d+),(\d+),(\d+)\)" stroke="[^"]*" stroke-width="[^"]*" opacity="([^"]*)" /g,
      (_m, r, g, b, op) =>
        `fill="#${hex(+r)}${hex(+g)}${hex(+b)}"${Number(op) < 1 ? ` opacity="${op}"` : ''} `,
    )
    .replace(/ desc="[^"]*"/, '')
}

export function withPhysicalSize(
  svg: string,
  width: number,
  height: number,
  widthMm: number | null,
): string {
  if (widthMm == null) return svg
  const heightMm = Math.round((widthMm * height * 100) / width) / 100
  return svg.replace(
    '<svg ',
    `<svg width="${widthMm}mm" height="${heightMm}mm" `,
  )
}

const dist2 = (a: Rgba, b: Rgba) =>
  (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2

// Palette of k colors for logos and drawings. Seeds with the background (the
// corners), then keeps adding the sampled color farthest from those already
// picked, so small but distinct areas (a black outline, an accent) get their
// own color instead of being averaged into a muddy one. A few k-means rounds
// then settle each color on the mean of its pixels. Deterministic: the same
// image always gives the same palette.
export function quantize(px: Pixels, k: number, maxSamples = 20000): Rgba[] {
  const total = px.width * px.height
  const step = Math.max(1, Math.floor(total / maxSamples))
  const samples: Rgba[] = []
  for (let p = 0; p < total; p += step) {
    const i = p * 4
    samples.push({
      r: px.data[i],
      g: px.data[i + 1],
      b: px.data[i + 2],
      a: 255,
    })
  }
  const centers: Rgba[] = [cornerColor(px)]
  const nearest = samples.map((s) => dist2(s, centers[0]))
  while (centers.length < k) {
    let far = 0
    for (let i = 1; i < samples.length; i++)
      if (nearest[i] > nearest[far]) far = i
    if (nearest[far] === 0) break // fewer distinct colors than asked
    centers.push({ ...samples[far] })
    samples.forEach(
      (s, i) => (nearest[i] = Math.min(nearest[i], dist2(s, samples[far]))),
    )
  }
  for (let round = 0; round < 8; round++) {
    const acc = centers.map(() => ({ r: 0, g: 0, b: 0, n: 0 }))
    for (const s of samples) {
      const a = acc[nearestIndex(centers, s)]
      a.r += s.r
      a.g += s.g
      a.b += s.b
      a.n++
    }
    acc.forEach((a, i) => {
      if (a.n)
        centers[i] = {
          r: Math.round(a.r / a.n),
          g: Math.round(a.g / a.n),
          b: Math.round(a.b / a.n),
          a: 255,
        }
    })
  }
  return centers
}

// Snaps every pixel to its palette color, then a 3×3 majority pass removes the
// 1–2 px slivers anti-aliasing leaves along edges (gray text edges sit closer
// to an orange than to black or white, and would print as orange specks).
export function posterize(px: Pixels, palette: Rgba[]): Pixels {
  const { width: w, height: h, data } = px
  const idx = new Uint8Array(w * h)
  const memo = new Map<number, number>()
  for (let p = 0; p < idx.length; p++) {
    const key = (data[p * 4] << 16) | (data[p * 4 + 1] << 8) | data[p * 4 + 2]
    let i = memo.get(key)
    if (i === undefined) {
      i = nearestIndex(palette, {
        r: data[p * 4],
        g: data[p * 4 + 1],
        b: data[p * 4 + 2],
        a: 255,
      })
      memo.set(key, i)
    }
    idx[p] = i
  }
  const counts = new Uint16Array(palette.length)
  const out = new Uint8ClampedArray(data.length)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      counts.fill(0)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy
          const xx = x + dx
          if (yy >= 0 && yy < h && xx >= 0 && xx < w) counts[idx[yy * w + xx]]++
        }
      // A pixel with 3 or fewer same-color neighbors (itself included) is part
      // of a 1 px line or speck: it takes the strongest other color. Otherwise
      // ties keep its own color, so straight edges and corners don't move.
      const own = idx[y * w + x]
      let best = own
      if (counts[own] <= 3) {
        counts[own] = 0
        for (let c = 0; c < counts.length; c++)
          if (counts[c] > counts[best]) best = c
      } else {
        for (let c = 0; c < counts.length; c++)
          if (counts[c] > counts[best]) best = c
      }
      const col = palette[best]
      out.set([col.r, col.g, col.b, 255], (y * w + x) * 4)
    }
  return { width: w, height: h, data: out }
}

export interface VectorResult {
  svg: string
  paths: number
  colors: string[]
}

export function vectorize(px: Pixels, options: VectorOptions): VectorResult {
  const mono = options.mode === 'mono'
  const flat = mono
    ? thresholdPixels(px, options.threshold, options.invert)
    : flattenAlpha(px)
  const pal = mono
    ? [
        { r: 0, g: 0, b: 0, a: 255 },
        { r: 255, g: 255, b: 255, a: 255 },
      ]
    : quantize(flat, Math.min(Math.max(options.colors, 2), 16))
  const input = posterize(flat, pal)
  const traceOptions = {
    ...DETAIL_PRESETS[options.detail],
    viewbox: true,
    strokewidth: 0,
    rightangleenhance: true,
    // A fixed palette and one cycle: imagetracer only assigns pixels to it.
    colorquantcycles: 1,
    colorsampling: 0,
    pal,
    // The input is already posterized: blurring would bring back the in-between
    // colors that turn into specks.
    blurradius: 0,
  }
  const data = ImageTracer.imagedataToTracedata(input, traceOptions)
  const palette = data.palette as Rgba[]
  // Blobs of a few pixels survive in tight curves; they'd print as dust.
  // Marking them as holes makes getsvgstring skip them without reindexing.
  for (const layer of data.layers)
    for (const path of layer) {
      const [x0, y0, x1, y1] = path.boundingbox
      if (!path.isholepath && (x1 - x0) * (y1 - y0) < MIN_SHAPE_AREA)
        path.isholepath = true
    }

  // Colors left in the SVG: not the removed background, nor colors whose areas
  // were all smaller than the speck filters.
  const used = (i: number) => data.layers[i].some((p) => !p.isholepath)

  if (options.removeBackground) {
    const bg = mono ? 1 : nearestIndex(palette, cornerColor(input))
    data.layers[bg] = []
  }
  const svg = withPhysicalSize(
    cleanSvg(ImageTracer.getsvgstring(data, traceOptions)),
    px.width,
    px.height,
    options.widthMm,
  )
  const colors = palette.flatMap((c, i) =>
    used(i) ? [`#${hex(c.r)}${hex(c.g)}${hex(c.b)}`] : [],
  )
  return { svg, paths: (svg.match(/<path /g) ?? []).length, colors }
}
