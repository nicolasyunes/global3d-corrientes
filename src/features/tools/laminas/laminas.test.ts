import { unzipSync, strFromU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { cleanup, removeIslands } from './cleanup'
import { deltaE, toLab } from './color'
import { gridFor } from './grid'
import { esEstanca, pixelMesh, volumen } from './mesh'
import { armarPrompt } from './prompt'
import { PRODUCTOS } from './productos'
import { procesar } from './pipeline'
import { quantize, type Cuantizada } from './quantize'
import { IMPRESORAS } from './printers'
import { build3mf } from './threemf'

function image(
  w: number,
  h: number,
  paint: (x: number, y: number) => number[],
) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y)
      data.set([r, g, b, 255], (y * w + x) * 4)
    }
  }
  return { data, width: w, height: h }
}

function zones(rows: string[]): Cuantizada {
  const alto = rows.length
  const ancho = rows[0].length
  const indices = new Uint8Array(ancho * alto)
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => (indices[y * ancho + x] = Number(c))),
  )
  const n = Math.max(...indices) + 1
  return {
    ancho,
    alto,
    indices,
    paleta: Array.from({ length: n }, (_, i) => ({ r: i * 60, g: 0, b: 0 })),
  }
}

describe('color', () => {
  it('measures ΔE between black and white', () => {
    expect(toLab({ r: 255, g: 255, b: 255 }).l).toBeCloseTo(100, 0)
    expect(
      deltaE({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }),
    ).toBeCloseTo(100, 0)
    expect(deltaE({ r: 9, g: 9, b: 9 }, { r: 9, g: 9, b: 9 })).toBe(0)
  })
})

describe('gridFor', () => {
  it('uses 0.2 mm per pixel for the matera', () => {
    const g = gridFor(215, 84)
    expect(g.pixelMm).toBeCloseTo(0.2)
    expect(g.ancho).toBe(1075)
    expect(g.alto).toBe(420)
  })

  it('lowers the resolution to a small source', () => {
    const g = gridFor(215, 84, 400)
    expect(g.pixelMm).toBeGreaterThan(0.5)
  })
})

describe('quantize', () => {
  it('finds the flat colors and sorts them by frequency', () => {
    const img = image(20, 10, (x) => (x < 14 ? [255, 0, 0] : [0, 0, 255]))
    const q = quantize(img, 2)
    expect(q.paleta).toHaveLength(2)
    expect(q.paleta[0]).toEqual({ r: 255, g: 0, b: 0 })
    expect(q.indices.filter((i) => i === 0)).toHaveLength(140)
  })
})

describe('cleanup', () => {
  it('melts a 1 px speck into its surroundings', () => {
    const rows = Array.from({ length: 20 }, () => '0'.repeat(20).split(''))
    rows[10][10] = '1'
    const q = zones(rows.map((r) => r.join('')))
    const out = cleanup(q, 0.2)
    expect(new Set(out.indices).size).toBe(1)
  })

  it('keeps a big region of a distinct color', () => {
    const q = zones(
      Array.from({ length: 20 }, (_, y) => (y < 10 ? '0' : '1').repeat(20)),
    )
    const labs = q.paleta.map(toLab)
    const out = removeIslands(q.indices, 20, 20, 0.2, labs)
    expect(new Set(out).size).toBe(2)
  })
})

describe('pixelMesh', () => {
  const sizes = { w: 20, h: 12, base: 0.2, total: 0.6 }

  function build(q: Cuantizada) {
    return pixelMesh(q, sizes.w, sizes.h, sizes.base, sizes.total)
  }

  it('makes every part watertight and outward facing', () => {
    const q = zones([
      '0011110000',
      '0111011100',
      '0110001100',
      '1000000011',
      '1101010101',
      '0010101010',
    ])
    for (const p of build(q)) {
      expect(esEstanca(p), p.nombre).toBe(true)
      expect(volumen(p), p.nombre).toBeGreaterThan(0)
    }
  })

  it('stays watertight on a checkerboard (pinch corners) and random noise', () => {
    const checker = zones(
      Array.from({ length: 8 }, (_, y) =>
        Array.from({ length: 8 }, (_, x) => (x + y) % 2).join(''),
      ),
    )
    for (const p of build(checker)) expect(esEstanca(p), p.nombre).toBe(true)

    let seed = 7
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const noise = zones(
      Array.from({ length: 24 }, () =>
        Array.from({ length: 30 }, () => Math.floor(rnd() * 3)).join(''),
      ),
    )
    for (const p of build(noise)) {
      expect(esEstanca(p), p.nombre).toBe(true)
      expect(volumen(p), p.nombre).toBeGreaterThan(0)
    }
  })

  it('has the right volume: base plus color layers fill the sheet', () => {
    const q = zones(['0011', '0111', '1100'])
    const partes = build(q)
    const total = partes.reduce((s, p) => s + volumen(p), 0)
    expect(total).toBeCloseTo(sizes.w * sizes.h * sizes.total, 4)
    expect(partes[0].nombre).toBe('Base')
  })

  it('puts the color face on the bed and the base on top', () => {
    const [base, color] = build(zones(['01', '01']))
    expect(Math.min(...base.pos.filter((_, i) => i % 3 === 2))).toBeCloseTo(0.4)
    expect(Math.max(...base.pos.filter((_, i) => i % 3 === 2))).toBeCloseTo(0.6)
    expect(Math.min(...color.pos.filter((_, i) => i % 3 === 2))).toBe(0)
  })
})

describe('build3mf', () => {
  it('packs the Bambu project files with one filament per part', () => {
    const q = zones(['0011', '0111'])
    const partes = pixelMesh(q, 20, 12, 0.2, 0.6)
    const zip = build3mf({
      partes,
      colores: ['#ff0000', '#00ff00'],
      extrusorDe: partes.map((p) => (p.zona === null ? 1 : p.zona + 1)),
      titulo: 'Matera <test>',
      ancho: 20,
      alto: 12,
      impresora: IMPRESORAS[1],
    })
    const files = unzipSync(zip)
    expect(Object.keys(files).sort()).toEqual(
      [
        'Metadata/model_settings.config',
        'Metadata/project_settings.config',
        '3D/3dmodel.model',
        '[Content_Types].xml',
        '_rels/.rels',
      ].sort(),
    )
    const model = strFromU8(files['3D/3dmodel.model'])
    expect(model).toContain('Matera &lt;test&gt;')
    expect(model).toContain('transform="1 0 0 0 1 0 0 0 1 80 84 0"')
    const proj = JSON.parse(
      strFromU8(files['Metadata/project_settings.config']),
    )
    expect(proj.filament_colour).toEqual(['#ff0000', '#00ff00'])
    expect(proj.printer_settings_id).toBe('Bambu Lab A1 mini 0.4 nozzle')
    expect(proj.printable_area[2]).toBe('180x180')
  })
})

describe('armarPrompt', () => {
  it('fills the template with the product measures', () => {
    const text = armarPrompt(PRODUCTOS[0], 'un colibrí', 3)
    expect(text).toContain('un colibrí')
    expect(text).toContain('215 mm de ancho por 84 mm de alto')
    expect(text).toContain('máximo 3 colores')
    expect(text).toContain('30 mm a cada lado')
    expect(text).not.toMatch(/\{\w+\}/)
  })
})

describe('performance', () => {
  it('processes a matera-size image (1075×420) in under 3 s', () => {
    const img = image(1075, 420, (x, y) => {
      const d = Math.hypot(x - 540, y - 210)
      if (d < 150) return [220, 40, 40]
      if (d < 190) return [250, 250, 250]
      return y > 300 ? [30, 90, 200] : [240, 220, 120]
    })
    const t0 = performance.now()
    const q = procesar(img, 4, 0.2)
    const partes = pixelMesh(q, 215, 84, 0.2, 0.6)
    build3mf({
      partes,
      colores: q.paleta.map(() => '#ffffff'),
      extrusorDe: partes.map((p) => (p.zona ?? 0) + 1),
      titulo: 'perf',
      ancho: 215,
      alto: 84,
    })
    expect(performance.now() - t0).toBeLessThan(3000)
    expect(partes.every(esEstanca)).toBe(true)
  })
})
