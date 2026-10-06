import { describe, expect, it } from 'vitest'
import {
  cleanSvg,
  cornerColor,
  DEFAULT_OPTIONS,
  fitSize,
  flattenAlpha,
  nearestIndex,
  posterize,
  quantize,
  thresholdPixels,
  vectorize,
  withPhysicalSize,
  type Pixels,
} from './vectorize'

// w×h image filled with `bg`, with a `fg` square from (x0,y0) to (x1,y1).
function image(
  w: number,
  h: number,
  bg: number[],
  fg: number[],
  [x0, y0, x1, y1]: number[],
): Pixels {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = x >= x0 && x < x1 && y >= y0 && y < y1 ? fg : bg
      data.set(c, (y * w + x) * 4)
    }
  return { width: w, height: h, data }
}

const WHITE = [255, 255, 255, 255]
const BLACK = [0, 0, 0, 255]

describe('fitSize', () => {
  it('scales the long side down to the limit, keeping proportions', () => {
    expect(fitSize(4000, 2000, 1000)).toEqual({ width: 1000, height: 500 })
  })

  it('never upscales', () => {
    expect(fitSize(300, 200, 1000)).toEqual({ width: 300, height: 200 })
  })
})

describe('pixel prep', () => {
  it('turns transparent pixels white', () => {
    const px = image(1, 1, [0, 0, 0, 0], BLACK, [0, 0, 0, 0])
    expect([...flattenAlpha(px).data]).toEqual(WHITE)
  })

  it('thresholds by brightness, and inverts on request', () => {
    const px = image(
      2,
      1,
      [40, 40, 40, 255],
      [220, 220, 220, 255],
      [1, 0, 2, 1],
    )
    expect([...thresholdPixels(px, 128, false).data]).toEqual([
      ...BLACK,
      ...WHITE,
    ])
    expect([...thresholdPixels(px, 128, true).data]).toEqual([
      ...WHITE,
      ...BLACK,
    ])
  })

  it('reads the background from the corners', () => {
    const px = image(10, 10, [10, 200, 30, 255], BLACK, [3, 3, 7, 7])
    expect(cornerColor(px)).toEqual({ r: 10, g: 200, b: 30, a: 255 })
  })

  it('finds the closest palette color', () => {
    const pal = [
      { r: 0, g: 0, b: 0, a: 255 },
      { r: 250, g: 250, b: 250, a: 255 },
    ]
    expect(nearestIndex(pal, { r: 240, g: 255, b: 230, a: 255 })).toBe(1)
  })
})

describe('quantize', () => {
  it('keeps a small distinct color instead of averaging it away', () => {
    // White background, a big orange area and a thin black bar.
    const px = image(60, 60, WHITE, [243, 112, 33, 255], [5, 5, 40, 55])
    for (let y = 5; y < 55; y++)
      for (let x = 50; x < 53; x++) px.data.set(BLACK, (y * 60 + x) * 4)
    const pal = quantize(px, 3)
    expect(pal[0]).toEqual({ r: 255, g: 255, b: 255, a: 255 })
    expect(pal).toContainEqual({ r: 243, g: 112, b: 33, a: 255 })
    expect(pal).toContainEqual({ r: 0, g: 0, b: 0, a: 255 })
  })

  it('returns fewer colors when the image has fewer', () => {
    expect(quantize(image(10, 10, WHITE, BLACK, [2, 2, 5, 5]), 6)).toHaveLength(
      2,
    )
  })
})

describe('posterize', () => {
  const pal = [
    { r: 255, g: 255, b: 255, a: 255 },
    { r: 0, g: 0, b: 0, a: 255 },
  ]

  it('snaps colors to the palette', () => {
    const px = image(
      4,
      4,
      [240, 240, 240, 255],
      [30, 30, 30, 255],
      [0, 0, 4, 2],
    )
    const out = posterize(px, pal).data
    expect([...out.slice(0, 4)]).toEqual(BLACK)
    expect([...out.slice(-4)]).toEqual(WHITE)
  })

  it('removes one-pixel-wide lines, even between two other colors', () => {
    const pal3 = [...pal, { r: 243, g: 112, b: 33, a: 255 }]
    // Left half black, right half white, an orange 1 px column on the seam.
    const px = image(12, 12, WHITE, BLACK, [0, 0, 6, 12])
    for (let y = 0; y < 12; y++)
      px.data.set([243, 112, 33, 255], (y * 12 + 6) * 4)
    const out = posterize(px, pal3).data
    const orange = [...out].filter((_v, i) => i % 4 === 0 && out[i] === 243)
    expect(orange).toHaveLength(0)
  })

  it('removes one-pixel slivers but keeps solid shapes', () => {
    const px = image(12, 12, WHITE, BLACK, [2, 2, 8, 8])
    px.data.set(BLACK, (10 * 12 + 10) * 4) // stray pixel
    const out = posterize(px, pal).data
    expect([...out.slice((10 * 12 + 10) * 4, (10 * 12 + 10) * 4 + 4)]).toEqual(
      WHITE,
    )
    expect([...out.slice((5 * 12 + 5) * 4, (5 * 12 + 5) * 4 + 4)]).toEqual(
      BLACK,
    )
  })
})

describe('svg cleanup', () => {
  it('keeps a hex fill and drops the stroke', () => {
    const raw =
      '<svg viewBox="0 0 2 2" version="1.1" xmlns="http://www.w3.org/2000/svg" desc="Created with imagetracer.js version 1.2.6" >' +
      '<path fill="rgb(255,0,16)" stroke="rgb(255,0,16)" stroke-width="0" opacity="1" d="M 0 0 Z" /></svg>'
    const svg = cleanSvg(raw)
    expect(svg).toContain('<path fill="#ff0010" d="M 0 0 Z" />')
    expect(svg).not.toContain('stroke')
    expect(svg).not.toContain('desc=')
  })

  it('adds a real size in mm, keeping the aspect ratio', () => {
    const svg = withPhysicalSize('<svg viewBox="0 0 200 100">', 200, 100, 50)
    expect(svg).toBe('<svg width="50mm" height="25mm" viewBox="0 0 200 100">')
    expect(withPhysicalSize('<svg >', 1, 1, null)).toBe('<svg >')
  })
})

describe('vectorize', () => {
  const logo = image(40, 40, WHITE, BLACK, [10, 10, 30, 30])

  it('traces a one-color logo into a single shape without the background', () => {
    const r = vectorize(logo, DEFAULT_OPTIONS)
    expect(r.paths).toBe(1)
    expect(r.svg).toContain('fill="#000000"')
    expect(r.svg).not.toContain('fill="#ffffff"')
    expect(r.svg).toContain('viewBox="0 0 40 40"')
  })

  it('keeps the background when asked', () => {
    const r = vectorize(logo, { ...DEFAULT_OPTIONS, removeBackground: false })
    expect(r.svg).toContain('fill="#ffffff"')
  })

  it('separates colors and drops the one in the corners', () => {
    const px = image(
      40,
      40,
      [20, 60, 200, 255],
      [250, 210, 40, 255],
      [8, 8, 32, 32],
    )
    const r = vectorize(px, { ...DEFAULT_OPTIONS, mode: 'color', colors: 2 })
    // Only the colors left in the SVG are listed: the blue background is gone.
    expect(r.colors).toEqual(['#fad228'])
    expect(r.paths).toBe(1)
    expect(r.svg).toContain('fill="#fad228"')
  })
})
