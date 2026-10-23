import { labDistance, toLab, type Lab, type RGB } from './color'
import type { Cuantizada } from './quantize'

// Two colors closer than this are "the same ink" for the mode filter and islands.
const DISTINCT_DE = 15
const MERGE_DE = 6
const MIN_FEATURE_MM = 0.8
const KEEP_AREA_MM2 = 0.5
const HALO_THICKNESS_MM = 0.5

const D4: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

// 3×3 mode: removes 1 px noise. A pixel is kept when its color has at least
// two of the nine and it is perceptually different from the winner.
export function modeFilter(
  idx: Uint8Array,
  w: number,
  h: number,
  labs: Lab[],
): Uint8Array {
  const out = new Uint8Array(idx.length)
  const cnt = new Uint16Array(labs.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      cnt.fill(0)
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= w) continue
          cnt[idx[yy * w + xx]]++
        }
      }
      const cur = idx[y * w + x]
      let best = cur
      let bc = cnt[cur]
      for (let i = 0; i < labs.length; i++) {
        if (cnt[i] > bc) {
          best = i
          bc = cnt[i]
        }
      }
      out[y * w + x] =
        best === cur ||
        (cnt[cur] >= 2 && labDistance(labs[cur], labs[best]) >= DISTINCT_DE)
          ? cur
          : best
    }
  }
  return out
}

interface Region {
  color: number
  pixels: number[]
  perimeter: number
  // shared border length per neighboring color
  neigh: Map<number, number>
}

// 4-connected regions of the same index.
function regionsOf(idx: Uint8Array, w: number, h: number): Region[] {
  const N = w * h
  const seen = new Uint8Array(N)
  const stack = new Int32Array(N)
  const regions: Region[] = []
  for (let s = 0; s < N; s++) {
    if (seen[s]) continue
    const color = idx[s]
    const region: Region = { color, pixels: [], perimeter: 0, neigh: new Map() }
    let sp = 0
    stack[sp++] = s
    seen[s] = 1
    while (sp) {
      const p = stack[--sp]
      region.pixels.push(p)
      const x = p % w
      const y = (p - x) / w
      for (const [dx, dy] of D4) {
        const xx = x + dx
        const yy = y + dy
        if (xx < 0 || xx >= w || yy < 0 || yy >= h) {
          region.perimeter++
          continue
        }
        const q = yy * w + xx
        if (idx[q] === color) {
          if (!seen[q]) {
            seen[q] = 1
            stack[sp++] = q
          }
        } else {
          region.perimeter++
          region.neigh.set(idx[q], (region.neigh.get(idx[q]) ?? 0) + 1)
        }
      }
    }
    regions.push(region)
  }
  return regions
}

function mostShared(neigh: Map<number, number>): number {
  let to = -1
  let bc = -1
  neigh.forEach((c, k) => {
    if (c > bc) {
      bc = c
      to = k
    }
  })
  return to
}

// Regions smaller than ~0.8 mm melt into their most frequent neighbor, unless
// they are a visibly different color and big enough to be a real detail.
export function removeIslands(
  idx: Uint8Array,
  w: number,
  h: number,
  pixelMm: number,
  labs: Lab[],
): Uint8Array {
  const out = new Uint8Array(idx)
  const minPx = Math.max(1, Math.ceil((MIN_FEATURE_MM / pixelMm) ** 2))
  for (let pass = 0; pass < 4; pass++) {
    let changed = false
    for (const r of regionsOf(out, w, h)) {
      if (r.pixels.length >= minPx || !r.neigh.size) continue
      const to = mostShared(r.neigh)
      const areaMm2 = r.pixels.length * pixelMm * pixelMm
      if (
        labDistance(labs[r.color], labs[to]) >= DISTINCT_DE &&
        areaMm2 >= KEEP_AREA_MM2
      )
        continue
      for (const p of r.pixels) out[p] = to
      changed = true
    }
    if (!changed) break
  }
  return out
}

// Antialiasing halos: thin regions whose color lies "between" two neighbors
// take the closer neighbor.
export function removeHalos(
  idx: Uint8Array,
  w: number,
  h: number,
  pixelMm: number,
  labs: Lab[],
): Uint8Array {
  const out = new Uint8Array(idx)
  for (const r of regionsOf(idx, w, h)) {
    if (r.neigh.size < 2 || !r.perimeter) continue
    const thickness = ((2 * r.pixels.length) / r.perimeter) * pixelMm
    if (thickness >= HALO_THICKNESS_MM) continue
    const c = labs[r.color]
    const near = [...r.neigh.keys()]
    let target = -1
    for (let i = 0; i < near.length && target < 0; i++) {
      for (let j = i + 1; j < near.length; j++) {
        const a = labs[near[i]]
        const b = labs[near[j]]
        const ab = labDistance(a, b)
        const da = labDistance(c, a)
        const db = labDistance(c, b)
        if (ab >= MERGE_DE && da + db <= ab * 1.15) {
          target = da <= db ? near[i] : near[j]
          break
        }
      }
    }
    if (target < 0) continue
    for (const p of r.pixels) out[p] = target
  }
  return out
}

// Fuses colors closer than ΔE 6 and reorders the palette by frequency.
export function mergeColors(q: Cuantizada): Cuantizada {
  const { paleta, indices } = q
  const labs = paleta.map(toLab)
  const parent = paleta.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]]
    return i
  }
  for (let i = 0; i < paleta.length; i++) {
    for (let j = i + 1; j < paleta.length; j++) {
      if (labDistance(labs[i], labs[j]) < MERGE_DE) {
        parent[find(j)] = find(i)
      }
    }
  }
  const counts = new Array<number>(paleta.length).fill(0)
  for (let p = 0; p < indices.length; p++) counts[find(indices[p])]++
  const roots = paleta
    .map((_, i) => i)
    .filter((i) => find(i) === i && counts[i] > 0)
    .sort((a, b) => counts[b] - counts[a])
  const slot = new Map(roots.map((r, k) => [r, k]))

  const sums = roots.map(() => ({ w: 0, r: 0, g: 0, b: 0 }))
  const own = new Array<number>(paleta.length).fill(0)
  for (let p = 0; p < indices.length; p++) own[indices[p]]++
  paleta.forEach((c, i) => {
    const s = sums[slot.get(find(i)) ?? 0]
    s.w += own[i]
    s.r += c.r * own[i]
    s.g += c.g * own[i]
    s.b += c.b * own[i]
  })

  const out = new Uint8Array(indices.length)
  for (let p = 0; p < indices.length; p++) {
    out[p] = slot.get(find(indices[p])) ?? 0
  }
  const nueva: RGB[] = sums.map((s) => ({
    r: Math.round(s.r / s.w),
    g: Math.round(s.g / s.w),
    b: Math.round(s.b / s.w),
  }))
  return { ancho: q.ancho, alto: q.alto, indices: out, paleta: nueva }
}

export function cleanup(q: Cuantizada, pixelMm: number): Cuantizada {
  const { ancho: w, alto: h } = q
  const labs = q.paleta.map(toLab)
  let idx = modeFilter(q.indices, w, h, labs)
  idx = removeIslands(idx, w, h, pixelMm, labs)
  idx = removeHalos(idx, w, h, pixelMm, labs)
  idx = removeIslands(idx, w, h, pixelMm, labs)
  return mergeColors({ ...q, indices: idx })
}
