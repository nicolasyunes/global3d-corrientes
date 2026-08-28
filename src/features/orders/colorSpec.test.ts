import { describe, expect, it } from 'vitest'
import { colorSpecEntries, swatchFor } from './colorSpec'

describe('colorSpecEntries', () => {
  it('maps a spec object to ordered part/color entries', () => {
    expect(colorSpecEntries({ tapa: 'negro', base: 'blanco' })).toEqual([
      { part: 'tapa', color: 'negro' },
      { part: 'base', color: 'blanco' },
    ])
  })

  it('drops blank and non-string values', () => {
    expect(colorSpecEntries({ tapa: '  ', base: 'rojo', n: 3 })).toEqual([
      { part: 'base', color: 'rojo' },
    ])
  })

  it('returns [] for null, arrays, or non-objects', () => {
    expect(colorSpecEntries(null)).toEqual([])
    expect(colorSpecEntries(['negro'])).toEqual([])
    expect(colorSpecEntries('negro')).toEqual([])
  })
})

describe('swatchFor', () => {
  it('resolves a known name, accent- and case-insensitive', () => {
    expect(swatchFor('Negro')).toBe('#1a1a1a')
    expect(swatchFor('violéta')).toBe('#7b1fa2')
  })

  it('returns null for an unknown name', () => {
    expect(swatchFor('fucsia neón')).toBeNull()
  })
})
