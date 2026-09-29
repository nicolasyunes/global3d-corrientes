import { describe, expect, it } from 'vitest'
import { formatAmount, multiplierLabel, num, quote } from './calculator'

const sheet = {
  filamentPrice: 21000,
  kwhPrice: 140,
  watts: 100,
  lifeHours: 3000,
  spareParts: 150000,
  errorPct: 5,
  mlSurcharge: 0.8,
}

describe('quote', () => {
  it('matches the sheet row "Portallaves grande"', () => {
    const q = quote(
      sheet,
      { hours: 10, minutes: 0, grams: 400, extras: 4000 },
      4,
    )
    expect(q.material).toBeCloseTo(8400)
    expect(q.power).toBeCloseTo(140)
    expect(q.wear).toBeCloseTo(500)
    expect(q.error).toBeCloseTo(452)
    expect(q.cost).toBeCloseTo(9492)
    expect(q.extras).toBeCloseTo(5200)
    expect(q.total).toBeCloseTo(43168)
    expect(q.mercadoLibre).toBeCloseTo(50761.6)
  })

  it('counts extra minutes (sheet row "bases x 4 trofeo")', () => {
    const q = quote(sheet, { hours: 6, minutes: 16, grams: 254, extras: 0 }, 4)
    expect(q.power).toBeCloseTo(87.73, 2)
    expect(q.total).toBeCloseTo(24087.28, 1)
    expect(q.mercadoLibre).toBeCloseTo(28904.74, 1)
  })

  it('matches the reference screenshot', () => {
    const q = quote(
      { ...sheet, filamentPrice: 16000, spareParts: 50000 },
      { hours: 10, minutes: 0, grams: 400, extras: 0 },
      3.5,
    )
    expect(q.cost).toBeCloseTo(7042)
    expect(q.total).toBeCloseTo(24647)
  })

  it('does not divide by a zero machine life', () => {
    const q = quote(
      { ...sheet, lifeHours: 0 },
      { hours: 1, minutes: 0, grams: 0, extras: 0 },
      2,
    )
    expect(q.wear).toBe(0)
  })
})

describe('num', () => {
  it('reads AR formats and treats blanks as 0', () => {
    expect(num('3,5')).toBe(3.5)
    expect(num('16.000')).toBe(16000)
    expect(num('')).toBe(0)
    expect(num('abc')).toBe(0)
  })
})

describe('labels', () => {
  it('formats money and multipliers the Argentine way', () => {
    expect(formatAmount(24647, 'ARS')).toMatch(/24\.647,00/)
    expect(multiplierLabel(2.5)).toBe('×2,5')
  })
})
