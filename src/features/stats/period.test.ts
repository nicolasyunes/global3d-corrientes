import { describe, expect, it } from 'vitest'
import {
  compareLabel,
  comparisonFor,
  containsMigration,
  isCurrentPeriod,
  parsePeriod,
  periodTitle,
  periodToParams,
  rangeOfPeriod,
  shiftPeriod,
} from './period'

// Martes 13 de octubre de 2026, 12:00 local.
const NOW = new Date(2026, 9, 13, 12)
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d)
const q = (s: string) => new URLSearchParams(s)

describe('parsePeriod', () => {
  it('sin parámetros: el mes en curso', () => {
    expect(parsePeriod(q(''), NOW)).toEqual({ kind: 'month', start: day(2026, 10, 1) })
  })

  it('semana sin ancla: el lunes de la semana en curso', () => {
    expect(parsePeriod(q('p=semana'), NOW)).toEqual({ kind: 'week', start: day(2026, 10, 12) })
  })

  it('semana con ancla: la normaliza al lunes', () => {
    expect(parsePeriod(q('p=semana&d=2026-10-07'), NOW)).toEqual({
      kind: 'week',
      start: day(2026, 10, 5),
    })
  })

  it('mes y año con ancla', () => {
    expect(parsePeriod(q('p=mes&d=2026-09'), NOW).start).toEqual(day(2026, 9, 1))
    expect(parsePeriod(q('p=anio&d=2025'), NOW)).toEqual({ kind: 'year', start: day(2025, 1, 1) })
  })

  it('ancla inválida o de otro formato: el período en curso', () => {
    expect(parsePeriod(q('p=mes&d=2026-13'), NOW).start).toEqual(day(2026, 10, 1))
    expect(parsePeriod(q('p=semana&d=2026-02-31'), NOW).start).toEqual(day(2026, 10, 12))
    expect(parsePeriod(q('p=anio&d=hola'), NOW).start).toEqual(day(2026, 1, 1))
  })

  it('ancla futura: el período en curso', () => {
    expect(parsePeriod(q('p=mes&d=2027-01'), NOW).start).toEqual(day(2026, 10, 1))
  })

  it('p desconocido: mes', () => {
    expect(parsePeriod(q('p=hoy'), NOW).kind).toBe('month')
  })
})

describe('periodToParams', () => {
  it('el período en curso no lleva ancla', () => {
    expect(periodToParams({ kind: 'month', start: day(2026, 10, 1) }, NOW)).toEqual({ p: 'mes' })
  })

  it('un período pasado lleva ancla según su tipo', () => {
    expect(periodToParams({ kind: 'month', start: day(2026, 9, 1) }, NOW)).toEqual({
      p: 'mes',
      d: '2026-09',
    })
    expect(periodToParams({ kind: 'week', start: day(2026, 10, 5) }, NOW)).toEqual({
      p: 'semana',
      d: '2026-10-05',
    })
    expect(periodToParams({ kind: 'year', start: day(2025, 1, 1) }, NOW)).toEqual({
      p: 'anio',
      d: '2025',
    })
  })

  it('ida y vuelta con parsePeriod', () => {
    const p = { kind: 'week' as const, start: day(2026, 9, 28) }
    const params = new URLSearchParams(periodToParams(p, NOW))
    expect(parsePeriod(params, NOW)).toEqual(p)
  })
})

describe('shiftPeriod', () => {
  it('mes hacia atrás y adelante', () => {
    const oct = { kind: 'month' as const, start: day(2026, 10, 1) }
    const sep = shiftPeriod(oct, -1, NOW)
    expect(sep.start).toEqual(day(2026, 9, 1))
    expect(shiftPeriod(sep, 1, NOW).start).toEqual(day(2026, 10, 1))
  })

  it('no pasa del período en curso', () => {
    const oct = { kind: 'month' as const, start: day(2026, 10, 1) }
    expect(shiftPeriod(oct, 1, NOW)).toEqual(oct)
  })

  it('semana y año', () => {
    expect(shiftPeriod({ kind: 'week', start: day(2026, 10, 12) }, -1, NOW).start).toEqual(
      day(2026, 10, 5),
    )
    expect(shiftPeriod({ kind: 'year', start: day(2026, 1, 1) }, -1, NOW).start).toEqual(
      day(2025, 1, 1),
    )
  })

  it('cruza el fin de año', () => {
    expect(shiftPeriod({ kind: 'month', start: day(2026, 1, 1) }, -1, NOW).start).toEqual(
      day(2025, 12, 1),
    )
  })
})

describe('isCurrentPeriod / rangeOfPeriod', () => {
  it('reconoce el período en curso', () => {
    expect(isCurrentPeriod({ kind: 'month', start: day(2026, 10, 1) }, NOW)).toBe(true)
    expect(isCurrentPeriod({ kind: 'month', start: day(2026, 9, 1) }, NOW)).toBe(false)
  })

  it('rango semiabierto del período', () => {
    expect(rangeOfPeriod({ kind: 'week', start: day(2026, 10, 5) })).toEqual({
      from: day(2026, 10, 5),
      to: day(2026, 10, 12),
    })
  })
})

describe('comparisonFor', () => {
  it('antes del corte de migración no se compara', () => {
    expect(comparisonFor({ kind: 'month', start: day(2026, 10, 1) }, NOW)).toBeNull()
    expect(comparisonFor({ kind: 'month', start: day(2026, 9, 1) }, NOW)).toBeNull()
  })

  it('período en curso: mismo tramo del anterior', () => {
    const nov = new Date(2026, 10, 10, 12)
    const cmp = comparisonFor({ kind: 'month', start: day(2026, 11, 1) }, nov)
    expect(cmp?.from).toEqual(day(2026, 10, 1))
    // 9 días transcurridos (1 a 10 de noviembre a las 12:00) sobre el 1 de octubre.
    expect(cmp?.to.getTime()).toBeLessThan(day(2026, 11, 1).getTime())
  })

  it('período cerrado: el anterior completo', () => {
    const dec = new Date(2026, 11, 20)
    const cmp = comparisonFor({ kind: 'month', start: day(2026, 11, 1) }, dec)
    expect(cmp).toEqual({ from: day(2026, 10, 1), to: day(2026, 11, 1) })
  })
})

describe('containsMigration', () => {
  it('septiembre sí, octubre no', () => {
    expect(containsMigration({ from: day(2026, 9, 1), to: day(2026, 10, 1) })).toBe(true)
    expect(containsMigration({ from: day(2026, 10, 1), to: day(2026, 11, 1) })).toBe(false)
  })
})

describe('títulos', () => {
  it('periodTitle', () => {
    expect(periodTitle({ kind: 'month', start: day(2026, 9, 1) })).toBe('Septiembre 2026')
    expect(periodTitle({ kind: 'week', start: day(2026, 10, 5) })).toBe('Semana del 5 al 11 de octubre')
    expect(periodTitle({ kind: 'week', start: day(2026, 9, 28) })).toBe(
      'Semana del 28 de septiembre al 4 de octubre',
    )
    expect(periodTitle({ kind: 'year', start: day(2026, 1, 1) })).toBe('2026')
  })

  it('compareLabel', () => {
    expect(compareLabel({ kind: 'month', start: day(2026, 9, 1) })).toBe('comparado con agosto')
    expect(compareLabel({ kind: 'month', start: day(2026, 1, 1) })).toBe('comparado con diciembre')
    expect(compareLabel({ kind: 'week', start: day(2026, 10, 5) })).toBe(
      'comparado con la semana anterior',
    )
    expect(compareLabel({ kind: 'year', start: day(2026, 1, 1) })).toBe('comparado con 2025')
  })
})
