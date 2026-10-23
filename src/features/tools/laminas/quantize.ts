import type { RGB } from './color'

export interface Cuantizada {
  ancho: number
  alto: number
  indices: Uint8Array
  paleta: RGB[]
}

export type PixelData = Pick<ImageData, 'data' | 'width' | 'height'>

interface Sample extends RGB {
  w: number
}

const LUMA = { r: 0.299, g: 0.587, b: 0.114 }

function histogram(d: Uint8ClampedArray): Sample[] {
  const m = new Map<number, number>()
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue
    const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m].map(([k, w]) => ({
    r: k >> 16,
    g: (k >> 8) & 255,
    b: k & 255,
    w,
  }))
}

function box(s: Sample[]) {
  let W = 0
  let mr = 0
  let mg = 0
  let mb = 0
  for (const p of s) {
    W += p.w
    mr += p.r * p.w
    mg += p.g * p.w
    mb += p.b * p.w
  }
  mr /= W
  mg /= W
  mb /= W
  let vr = 0
  let vg = 0
  let vb = 0
  for (const p of s) {
    vr += p.w * (p.r - mr) ** 2
    vg += p.w * (p.g - mg) ** 2
    vb += p.w * (p.b - mb) ** 2
  }
  vr *= LUMA.r ** 2
  vg *= LUMA.g ** 2
  vb *= LUMA.b ** 2
  const ch: 'r' | 'g' | 'b' = vr >= vg && vr >= vb ? 'r' : vg >= vb ? 'g' : 'b'
  return { s, W, ch, err: vr + vg + vb }
}

function mean(s: Sample[]): RGB {
  let W = 0
  let r = 0
  let g = 0
  let b = 0
  for (const p of s) {
    W += p.w
    r += p.r * p.w
    g += p.g * p.w
    b += p.b * p.w
  }
  return W
    ? { r: Math.round(r / W), g: Math.round(g / W), b: Math.round(b / W) }
    : { r: 0, g: 0, b: 0 }
}

// Weighted median cut: split the box with the most error, on its widest
// channel, at the point that maximizes the between-class variance.
function split(samples: Sample[], n: number): RGB[] {
  if (!samples.length) return [{ r: 255, g: 255, b: 255 }]
  const boxes = [box(samples)]
  while (boxes.length < n) {
    let bi = -1
    let be = 0
    boxes.forEach((b, i) => {
      if (b.s.length > 1 && b.err > be) {
        be = b.err
        bi = i
      }
    })
    if (bi < 0) break
    const b = boxes[bi]
    const c = b.ch
    const sorted = [...b.s].sort((p, q) => p[c] - q[c])
    let tot = 0
    for (const p of sorted) tot += p[c] * p.w
    let cw = 0
    let cs = 0
    let best = -1
    let cut = 0
    for (let i = 0; i < sorted.length - 1; i++) {
      cw += sorted[i].w
      cs += sorted[i][c] * sorted[i].w
      if (sorted[i][c] === sorted[i + 1][c]) continue
      const rw = b.W - cw
      const d = cs / cw - (tot - cs) / rw
      const score = cw * rw * d * d
      if (score > best) {
        best = score
        cut = i
      }
    }
    if (best < 0) {
      b.err = 0
      continue
    }
    boxes.splice(
      bi,
      1,
      box(sorted.slice(0, cut + 1)),
      box(sorted.slice(cut + 1)),
    )
  }
  return boxes.map((b) => mean(b.s))
}

const dist = (a: RGB, b: RGB) =>
  ((a.r - b.r) * LUMA.r) ** 2 +
  ((a.g - b.g) * LUMA.g) ** 2 +
  ((a.b - b.b) * LUMA.b) ** 2

const nearest = (pal: RGB[], c: RGB) => {
  let bi = 0
  let bd = Infinity
  pal.forEach((p, i) => {
    const d = dist(p, c)
    if (d < bd) {
      bd = d
      bi = i
    }
  })
  return bi
}

function kmeans(samples: Sample[], init: RGB[], iters = 8): RGB[] {
  let pal = [...init]
  for (let it = 0; it < iters; it++) {
    const groups: Sample[][] = pal.map(() => [])
    for (const s of samples) groups[nearest(pal, s)].push(s)
    let changed = false
    pal = pal.map((c, i) => {
      if (!groups[i].length) return c
      const m = mean(groups[i])
      if (m.r !== c.r || m.g !== c.g || m.b !== c.b) changed = true
      return m
    })
    if (!changed) break
  }
  return pal
}

// Reduces the image to `n` flat colors; the palette comes sorted by frequency.
export function quantize(img: PixelData, n: number): Cuantizada {
  const samples = histogram(img.data)
  const pal = kmeans(samples, split(samples, Math.max(1, Math.min(16, n))))
  const N = img.width * img.height
  const idx = new Uint8Array(N)
  const counts: number[] = new Array(pal.length).fill(0)
  const cache = new Map<number, number>()
  for (let p = 0, o = 0; p < N; p++, o += 4) {
    const k = (img.data[o] << 16) | (img.data[o + 1] << 8) | img.data[o + 2]
    let z = cache.get(k)
    if (z === undefined) {
      z = nearest(pal, {
        r: img.data[o],
        g: img.data[o + 1],
        b: img.data[o + 2],
      })
      cache.set(k, z)
    }
    idx[p] = z
    counts[z]++
  }
  const order = pal
    .map((c, i) => ({ c, n: counts[i], i }))
    .filter((o) => o.n)
    .sort((a, b) => b.n - a.n)
  const remap = new Uint8Array(pal.length)
  order.forEach((o, j) => (remap[o.i] = j))
  for (let p = 0; p < N; p++) idx[p] = remap[idx[p]]
  return {
    ancho: img.width,
    alto: img.height,
    indices: idx,
    paleta: order.map((o) => o.c),
  }
}
