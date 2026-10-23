import type { Cuantizada } from './quantize'

export interface Parte {
  nombre: string
  zona: number | null
  pos: number[]
  tri: number[]
}

// Vertices are shared through a pool. A corner where two cells touch only
// diagonally is a pinch point: each sheet gets its own copy so no edge is
// used by four triangles.
class Pool {
  readonly pos: number[] = []
  private map = new Map<number, number>()
  constructor(
    private sx: number,
    private sy: number,
    private zs: [number, number],
  ) {}
  get(gx: number, gy: number, zi: 0 | 1, sheet: 0 | 1): number {
    const key = ((gy * 8192 + gx) * 2 + zi) * 2 + sheet
    let id = this.map.get(key)
    if (id === undefined) {
      id = this.pos.length / 3
      this.pos.push(gx * this.sx, gy * this.sy, this.zs[zi])
      this.map.set(key, id)
    }
    return id
  }
}

// One part per palette color. The color layer sits on the bed (z from 0 to
// total - base, face down) and the base goes on top of it; y grows with the
// image rows so the face reads correctly from below. Only the outer surface is
// emitted: top and bottom are merged per row run, and the edges between rows
// are split where the neighbor row's runs start or end, so the mesh has no
// T-junctions.
export function pixelMesh(
  q: Cuantizada,
  wMm: number,
  hMm: number,
  base: number,
  total: number,
): Parte[] {
  const { ancho: w, alto: h, indices } = q
  const sx = wMm / w
  const sy = hMm / h
  const ct = Math.max(0.01, total - base)
  const partes: Parte[] = [baseBox(wMm, hMm, ct, total)]

  q.paleta.forEach((_, z) => {
    const inZone = (x: number, y: number) =>
      x >= 0 && x < w && y >= 0 && y < h && indices[y * w + x] === z

    // run intervals per row: [a0, b0, a1, b1, ...]
    const runs: number[][] = []
    let any = false
    for (let y = 0; y < h; y++) {
      const row: number[] = []
      let x = 0
      while (x < w) {
        if (indices[y * w + x] !== z) {
          x++
          continue
        }
        const s = x
        while (x < w && indices[y * w + x] === z) x++
        row.push(s, x)
        any = true
      }
      runs.push(row)
    }
    if (!any) return

    const pool = new Pool(sx, sy, [0, ct])
    const tri: number[] = []
    const sheetOf = (gx: number, gy: number, ownerX: number): 0 | 1 => {
      const tl = inZone(gx - 1, gy - 1)
      const tr = inZone(gx, gy - 1)
      const bl = inZone(gx - 1, gy)
      const br = inZone(gx, gy)
      const pinch = (tl && br && !tr && !bl) || (tr && bl && !tl && !br)
      return pinch && ownerX >= gx ? 1 : 0
    }
    // endpoints of the neighbor row's runs strictly inside (x0, x1)
    const splits = (row: number[] | undefined, x0: number, x1: number) => {
      const pts = [x0]
      if (row) for (const v of row) if (v > x0 && v < x1) pts.push(v)
      pts.push(x1)
      return pts
    }

    for (let r = 0; r < h; r++) {
      const row = runs[r]
      for (let k = 0; k < row.length; k += 2) {
        const x0 = row[k]
        const x1 = row[k + 1]
        const vert = (gx: number, gy: number, zi: 0 | 1) =>
          pool.get(gx, gy, zi, sheetOf(gx, gy, gx === x1 ? gx - 1 : gx))
        const lo = splits(runs[r - 1], x0, x1)
        const up = splits(runs[r + 1], x0, x1)

        // top (+z) and bottom (-z): zip the two chains
        let i = 0
        let j = 0
        while (i < lo.length - 1 || j < up.length - 1) {
          const lowerNext =
            j >= up.length - 1 || (i < lo.length - 1 && lo[i + 1] <= up[j + 1])
          if (lowerNext) {
            const a = lo[i]
            const b = lo[i + 1]
            const c = up[j]
            tri.push(
              vert(a, r, 1),
              vert(b, r, 1),
              vert(c, r + 1, 1),
              vert(a, r, 0),
              vert(c, r + 1, 0),
              vert(b, r, 0),
            )
            i++
          } else {
            const a = lo[i]
            const b = up[j + 1]
            const c = up[j]
            tri.push(
              vert(a, r, 1),
              vert(b, r + 1, 1),
              vert(c, r + 1, 1),
              vert(a, r, 0),
              vert(c, r + 1, 0),
              vert(b, r + 1, 0),
            )
            j++
          }
        }

        // left (-x) and right (+x) walls
        const quadX = (gx: number, outward: 1 | -1) => {
          const A = vert(gx, r, 0)
          const B = vert(gx, r + 1, 0)
          const C = vert(gx, r + 1, 1)
          const D = vert(gx, r, 1)
          if (outward > 0) tri.push(A, B, C, A, C, D)
          else tri.push(A, C, B, A, D, C)
        }
        quadX(x0, -1)
        quadX(x1, 1)

        // north (-y) and south (+y) walls, only where the neighbor row is empty
        const quadY = (
          chain: number[],
          gy: number,
          nbRow: number,
          out: 1 | -1,
        ) => {
          for (let c = 0; c < chain.length - 1; c++) {
            if (inZone(chain[c], nbRow)) continue
            const P = vert(chain[c], gy, 0)
            const Q = vert(chain[c + 1], gy, 0)
            const R = vert(chain[c + 1], gy, 1)
            const S = vert(chain[c], gy, 1)
            if (out < 0) tri.push(P, Q, R, P, R, S)
            else tri.push(P, R, Q, P, S, R)
          }
        }
        quadY(lo, r, r - 1, -1)
        quadY(up, r + 1, r + 1, 1)
      }
    }
    partes.push({
      nombre: `Color ${partes.length}`,
      zona: z,
      pos: pool.pos,
      tri,
    })
  })

  return partes
}

function baseBox(wMm: number, hMm: number, z0: number, z1: number): Parte {
  const pos = [
    0,
    0,
    z0,
    wMm,
    0,
    z0,
    wMm,
    hMm,
    z0,
    0,
    hMm,
    z0,
    0,
    0,
    z1,
    wMm,
    0,
    z1,
    wMm,
    hMm,
    z1,
    0,
    hMm,
    z1,
  ]
  // 0..3 bottom ring, 4..7 top ring, same x/y order
  const tri = [
    0,
    3,
    2,
    0,
    2,
    1, // -z
    4,
    5,
    6,
    4,
    6,
    7, // +z
    0,
    1,
    5,
    0,
    5,
    4, // -y
    3,
    7,
    6,
    3,
    6,
    2, // +y
    0,
    4,
    7,
    0,
    7,
    3, // -x
    1,
    2,
    6,
    1,
    6,
    5, // +x
  ]
  return { nombre: 'Base', zona: null, pos, tri }
}

// Watertight check: every directed edge appears once and so does its reverse.
export function esEstanca(p: Parte): boolean {
  const seen = new Map<number, number>()
  const n = p.pos.length / 3
  for (let t = 0; t < p.tri.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = p.tri[t + e]
      const b = p.tri[t + ((e + 1) % 3)]
      const key = a * n + b
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
  }
  for (const [key, count] of seen) {
    if (count !== 1) return false
    const a = Math.floor(key / n)
    const b = key % n
    if (seen.get(b * n + a) !== 1) return false
  }
  return true
}

// Signed volume (positive when the triangles face outward).
export function volumen(p: Parte): number {
  let v = 0
  for (let t = 0; t < p.tri.length; t += 3) {
    const a = p.tri[t] * 3
    const b = p.tri[t + 1] * 3
    const c = p.tri[t + 2] * 3
    const P = p.pos
    v +=
      (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) -
        P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) +
        P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) /
      6
  }
  return v
}
