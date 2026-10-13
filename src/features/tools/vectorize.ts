import initVtracer, { initSync, to_svg } from 'vtracer-wasm'

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

// VTracer (visioncortex, MIT) via vtracer-wasm. filterSpeckle: patches smaller
// than this side in px are dropped (dust from anti-aliasing). cornerThreshold:
// turns sharper than this angle stay corners instead of curves.
// lengthThreshold: shortest segment before curves are fitted. pathPrecision:
// decimals in the path data.
const DETAIL_PRESETS: Record<
  Detail,
  {
    filterSpeckle: number
    cornerThreshold: number
    lengthThreshold: number
    pathPrecision: number
    // smoothPath passes over the curve vertices
    smooth: number
  }
> = {
  low: {
    filterSpeckle: 8,
    cornerThreshold: 70,
    lengthThreshold: 6,
    pathPrecision: 1,
    smooth: 3,
  },
  medium: {
    filterSpeckle: 4,
    cornerThreshold: 60,
    lengthThreshold: 4,
    pathPrecision: 2,
    smooth: 2,
  },
  high: {
    filterSpeckle: 2,
    cornerThreshold: 55,
    lengthThreshold: 3.5,
    pathPrecision: 2,
    smooth: 1,
  },
}

// The tracer is a WASM module: load it once before calling vectorize().
let tracerReady: Promise<void> | null = null
export function loadTracer(): Promise<void> {
  tracerReady ??= import('vtracer-wasm/vtracer.wasm?url').then(
    async ({ default: url }) => {
      await initVtracer({ module_or_path: url })
    },
  )
  return tracerReady
}

// Tests (Node) hand over the .wasm bytes directly.
export function loadTracerSync(bytes: BufferSource) {
  initSync({ module: bytes })
  tracerReady = Promise.resolve()
}

export const MAX_SIDE = 1000

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
const toHex = (c: Rgba) => `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`

export interface TracedPath {
  d: string
  fill: string
  transform: string | null
}

// VTracer writes one <path d fill transform> per shape, plus a generator
// comment and a fixed pixel size. Read the shapes back so the SVG can be
// rebuilt with a viewBox (scalable, and sized in mm on request).
export function parsePaths(svg: string): TracedPath[] {
  return [...svg.matchAll(/<path\b([^>]*?)\/?>/g)].map(([, attrs]) => {
    const attr = (name: string) =>
      new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1] ?? null
    return {
      d: attr('d') ?? '',
      fill: (attr('fill') ?? '#000000').toLowerCase(),
      transform: attr('transform'),
    }
  })
}

// The spline output of this VTracer build comes out garbled, so it traces
// polygons (clean, staircase-free outlines) and the curves are fitted here:
// every vertex where the outline turns more than `cornerDeg` stays a sharp
// corner; through the rest passes a smooth cubic (Catmull-Rom → Bézier), the
// way Potrace rounds a logo. Works on each closed subpath ("M … L … Z").
export function smoothPath(
  d: string,
  cornerDeg: number,
  decimals: number,
  passes = 2,
) {
  const f = (n: number) => String(Number(n.toFixed(decimals)))
  const corner = Math.cos((cornerDeg * Math.PI) / 180)
  return d
    .split(/(?=M)/)
    .map((sub) => {
      const nums = sub.match(/-?\d*\.?\d+(?:e-?\d+)?/gi)?.map(Number) ?? []
      let pts: [number, number][] = []
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const p: [number, number] = [nums[i], nums[i + 1]]
        // Vertices less than a pixel apart only add wobble
        const last = pts[pts.length - 1]
        if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= 1)
          pts.push(p)
      }
      if (pts.length > 3) {
        const [fx, fy] = pts[0],
          [lx, ly] = pts[pts.length - 1]
        if (Math.hypot(fx - lx, fy - ly) < 1) pts.pop()
      }
      const n = pts.length
      if (n < 3) return sub.trim()
      const at = (i: number) => pts[(i + n) % n]
      // Is the outline turning sharply at vertex i? The direction in and out is
      // taken against the first vertices at least 2.5 px away, so a short
      // jog in a curve isn't read as a corner.
      const lejos = (i: number, paso: number) => {
        const [x0, y0] = at(i)
        for (let k = 1; k < n; k++) {
          const q = at(i + k * paso)
          if (Math.hypot(q[0] - x0, q[1] - y0) >= 2.5) return q
        }
        return at(i + paso)
      }
      const sharp = pts.map((_, i) => {
        const [ax, ay] = lejos(i, -1),
          [bx, by] = at(i),
          [cx, cy] = lejos(i, 1)
        const ux = bx - ax,
          uy = by - ay,
          vx = cx - bx,
          vy = cy - by
        const l = Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1
        return (ux * vx + uy * vy) / l < corner
      })
      // Smoothing passes on the curve vertices (each one moves halfway to
      // the midpoint of its neighbors) even out the polygon's uneven steps.
      // Corners don't move.
      for (let pasada = 0; pasada < passes; pasada++)
        pts = pts.map((p, i) => {
          if (sharp[i]) return p
          const [ax, ay] = at(i - 1),
            [cx, cy] = at(i + 1)
          return [p[0] / 2 + (ax + cx) / 4, p[1] / 2 + (ay + cy) / 4]
        })
      // Tangent at each vertex (zero on corners, so the curve meets it straight)
      const tan = pts.map((_, i) => {
        if (sharp[i]) return [0, 0]
        const [ax, ay] = at(i - 1),
          [cx, cy] = at(i + 1)
        return [(cx - ax) / 6, (cy - ay) / 6]
      })
      let out = `M${f(pts[0][0])} ${f(pts[0][1])}`
      for (let i = 0; i < n; i++) {
        const [bx, by] = at(i),
          [cx, cy] = at(i + 1)
        const t0 = tan[i],
          t1 = tan[(i + 1) % n]
        if (!t0[0] && !t0[1] && !t1[0] && !t1[1]) {
          out += `L${f(cx)} ${f(cy)}`
          continue
        }
        out += `C${f(bx + t0[0])} ${f(by + t0[1])} ${f(cx - t1[0])} ${f(cy - t1[1])} ${f(cx)} ${f(cy)}`
      }
      return out + 'Z'
    })
    .join('')
}

export function buildSvg(
  width: number,
  height: number,
  paths: TracedPath[],
): string {
  const body = paths
    .map(
      (p) =>
        `<path d="${p.d}" fill="${p.fill}"${p.transform ? ` transform="${p.transform}"` : ''}/>`,
    )
    .join('')
  return `<svg viewBox="0 0 ${width} ${height}" version="1.1" xmlns="http://www.w3.org/2000/svg">${body}</svg>`
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
  // Posterized first: every pixel is exactly a palette color, without the
  // anti-aliasing slivers, so VTracer only has to follow the edges.
  const input = posterize(flat, pal)
  const preset = DETAIL_PRESETS[options.detail]
  const raw = to_svg(new Uint8Array(input.data.buffer), px.width, px.height, {
    filterSpeckle: preset.filterSpeckle,
    cornerThreshold: preset.cornerThreshold,
    lengthThreshold: preset.lengthThreshold,
    pathPrecision: preset.pathPrecision,
    binary: false,
    // Polygons, and the curves fitted by smoothPath (see there why)
    mode: 'polygon',
    // Cutout: each color is its own shape with holes, nothing overlaps.
    // Removing the background then leaves real holes (the inside of an O), and
    // each shape can be extruded on its own.
    hierarchical: 'cutout',
    spliceThreshold: 45,
    maxIterations: 10,
    // In this build it's the number of color bits dropped: 0 keeps the palette.
    colorPrecision: 0,
    layerDifference: 1,
  })
  // VTracer averages each patch, so a fill can land a step off its palette
  // color: snap it back, so the background is recognized and colors stay clean.
  const traced = parsePaths(raw).map((p) => {
    const n = parseInt(p.fill.slice(1), 16)
    const i = nearestIndex(pal, {
      r: n >> 16,
      g: (n >> 8) & 255,
      b: n & 255,
      a: 255,
    })
    return {
      ...p,
      d: smoothPath(
        p.d,
        preset.cornerThreshold,
        preset.pathPrecision,
        preset.smooth,
      ),
      fill: toHex(pal[i]),
      index: i,
    }
  })
  const bg = mono ? 1 : nearestIndex(pal, cornerColor(input))
  const kept = options.removeBackground
    ? traced.filter((p) => p.index !== bg)
    : traced
  const svg = withPhysicalSize(
    buildSvg(px.width, px.height, kept),
    px.width,
    px.height,
    options.widthMm,
  )
  // Colors left in the SVG, in palette order
  const used = new Set(kept.map((p) => p.index))
  const colors = pal.flatMap((c, i) => (used.has(i) ? [toHex(c)] : []))
  return { svg, paths: kept.length, colors }
}
