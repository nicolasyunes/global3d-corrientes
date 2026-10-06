import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  isInverted,
  normalizeLink,
  qrMatrix,
  qrPath,
  qrSvg,
  type QrMatrix,
} from './qr'

function fakeMatrix(rows: string[]): QrMatrix {
  return { size: rows.length, isDark: (x, y) => rows[y][x] === '#' }
}

describe('normalizeLink', () => {
  it('adds https to bare domains', () => {
    expect(normalizeLink(' global3d.com.ar/tienda ')).toBe(
      'https://global3d.com.ar/tienda',
    )
  })

  it('keeps links that already have a scheme', () => {
    expect(normalizeLink('http://a.com')).toBe('http://a.com')
    expect(normalizeLink('mailto:hola@a.com')).toBe('mailto:hola@a.com')
    expect(normalizeLink('WIFI:S:Taller;T:WPA;P:x;;')).toBe(
      'WIFI:S:Taller;T:WPA;P:x;;',
    )
  })

  it('leaves plain text alone', () => {
    expect(normalizeLink('hola mundo')).toBe('hola mundo')
    expect(normalizeLink('   ')).toBe('')
  })
})

describe('qrPath', () => {
  it('merges each run of dark modules into one rectangle', () => {
    const m = fakeMatrix(['###', '#.#', '...'])
    expect(qrPath(m, 0)).toBe('M0 0h3v1h-3zM0 1h1v1h-1zM2 1h1v1h-1z')
  })

  it('offsets by the quiet-zone margin', () => {
    expect(qrPath(fakeMatrix(['#']), 4)).toBe('M4 4h1v1h-1z')
  })
})

describe('qrSvg', () => {
  const m = fakeMatrix(['#.', '.#'])

  it('sizes the viewBox with the margin on both sides', () => {
    const svg = qrSvg(m, {
      margin: 2,
      fg: '#000000',
      bg: '#ffffff',
      sizeMm: null,
    })
    expect(svg).toContain('viewBox="0 0 6 6"')
    expect(svg).toContain('<rect width="6" height="6" fill="#ffffff"/>')
    expect(svg).not.toContain('mm"')
  })

  it('draws filled shapes only, so 3D tools can import it', () => {
    const svg = qrSvg(m, { margin: 0, fg: '#111111', bg: null, sizeMm: 40 })
    expect(svg).not.toContain('stroke')
    expect(svg).not.toContain('<rect')
    expect(svg).toContain('width="40mm" height="40mm"')
    expect(svg).toContain('fill="#111111"')
  })
})

describe('qrMatrix', () => {
  it('encodes a real link with finder patterns in the corners', () => {
    const m = qrMatrix('https://global3d.com.ar', 'M')
    expect(m.size).toBeGreaterThanOrEqual(21)
    // Top-left finder: dark outer ring, light ring, dark core.
    expect(m.isDark(0, 0)).toBe(true)
    expect(m.isDark(1, 1)).toBe(false)
    expect(m.isDark(3, 3)).toBe(true)
  })

  it('grows with the error-correction level', () => {
    const text = 'https://global3d.com.ar/pedido/12345'
    expect(qrMatrix(text, 'H').size).toBeGreaterThan(qrMatrix(text, 'L').size)
  })
})

describe('contrast', () => {
  it('rates black on white as maximum contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrastRatio('#777777', '#888888')).toBeLessThan(1.5)
  })

  it('detects light-on-dark codes', () => {
    expect(isInverted('#ffffff', '#000000')).toBe(true)
    expect(isInverted('#000000', '#ffffff')).toBe(false)
  })
})
