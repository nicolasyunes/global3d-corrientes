import { describe, expect, it } from 'vitest'
import {
  COUNT_WARN_DAYS,
  countDiff,
  countGroups,
  countKey,
  countReminder,
  draftToItems,
  parseCounted,
  reminderText,
  summarizeCount,
} from './count'
import { designLines } from './fixtures'

describe('countGroups', () => {
  it('una fila por color, y recarga solo en líneas con ambas presentaciones', () => {
    const lines = designLines()
    const groups = countGroups(lines)
    expect(groups).toHaveLength(lines.length)
    const totalColors = lines.reduce((n, l) => n + l.colors.length, 0)
    const bothExtra = lines
      .filter((l) => l.presentation === 'both')
      .reduce((n, l) => n + l.colors.length, 0)
    expect(groups.reduce((n, g) => n + g.rows.length, 0)).toBe(
      totalColors + bothExtra,
    )
    const bothLine = lines.find((l) => l.presentation === 'both')!
    const g = groups.find((x) => x.lineId === bothLine.id)!
    expect(g.rows[0].suffix).toBe('Spool')
    expect(g.rows.some((r) => r.refill && r.suffix === 'Recarga')).toBe(true)
    const plain = groups.find(
      (x) => lines.find((l) => l.id === x.lineId)!.presentation !== 'both',
    )!
    expect(plain.rows.every((r) => !r.refill && r.suffix === '')).toBe(true)
  })

  it('una línea con ambas presentaciones sin stock de recarga en un color no pide Recarga', () => {
    const lines = designLines()
    const bothLine = lines.find((l) => l.presentation === 'both')!
    bothLine.colors[0] = { ...bothLine.colors[0], stock_refill: null }
    const g = countGroups(lines).find((x) => x.lineId === bothLine.id)!
    const first = bothLine.colors[0].id
    expect(g.rows.filter((r) => r.colorId === first)).toEqual([
      expect.objectContaining({ refill: false, suffix: '' }),
    ])
    expect(
      g.rows.filter((r) => r.colorId === bothLine.colors[1].id),
    ).toHaveLength(2)
  })

  it('la clave distingue spool de recarga y no expone el stock', () => {
    expect(countKey('c1', false)).toBe('c1:s')
    expect(countKey('c1', true)).toBe('c1:r')
    const row = countGroups(designLines())[0].rows[0]
    expect(Object.keys(row).sort()).toEqual(
      ['colorId', 'colorLabel', 'key', 'refill', 'suffix', 'swatch'].sort(),
    )
  })
})

describe('parseCounted', () => {
  it('vacío es sin contar, número entero es válido, el resto es inválido', () => {
    expect(parseCounted('')).toBeNull()
    expect(parseCounted('  ')).toBeNull()
    expect(parseCounted('0')).toBe(0)
    expect(parseCounted(' 12 ')).toBe(12)
    expect(parseCounted('-1')).toBe('invalid')
    expect(parseCounted('2,5')).toBe('invalid')
    expect(parseCounted('abc')).toBe('invalid')
  })
})

describe('draftToItems', () => {
  it('manda solo lo contado y avisa de lo inválido', () => {
    const r = draftToItems({ 'a:s': '3', 'b:r': '0', 'c:s': '', 'd:s': 'x' })
    expect(r.items).toEqual([
      { color_id: 'a', refill: false, counted: 3 },
      { color_id: 'b', refill: true, counted: 0 },
    ])
    expect(r.invalid).toEqual(['d:s'])
  })
})

describe('diferencias', () => {
  const item = (counted: number, expected: number) =>
    ({ counted, expected }) as never
  it('countDiff es contado menos esperado', () => {
    expect(countDiff({ counted: 3, expected: 5 })).toBe(-2)
    expect(countDiff({ counted: 5, expected: 5 })).toBe(0)
  })
  it('summarizeCount cuenta iguales, sobrantes y faltantes', () => {
    const s = summarizeCount([item(3, 5), item(5, 5), item(6, 4), item(0, 1)])
    expect(s).toEqual({ total: 4, same: 1, over: 1, short: 2, net: -1 })
  })
})

describe('countReminder', () => {
  const now = new Date('2026-10-20T12:00:00Z')
  it('sin conteos: vencido, sin días', () => {
    expect(countReminder([], now)).toEqual({
      days: null,
      overdue: true,
      pending: 0,
    })
  })
  it('usa el último no descartado y cuenta los pendientes', () => {
    const r = countReminder(
      [
        { created_at: '2026-10-19T12:00:00Z', status: 'discarded' },
        { created_at: '2026-10-15T12:00:00Z', status: 'pending' },
        { created_at: '2026-10-01T12:00:00Z', status: 'approved' },
      ],
      now,
    )
    expect(r).toEqual({ days: 5, overdue: false, pending: 1 })
  })
  it('más de 7 días es vencido; justo 7 no', () => {
    const at = (d: number) =>
      countReminder(
        [
          {
            created_at: new Date(now.getTime() - d * 86_400_000).toISOString(),
            status: 'approved',
          },
        ],
        now,
      )
    expect(COUNT_WARN_DAYS).toBe(7)
    expect(at(7).overdue).toBe(false)
    expect(at(8).overdue).toBe(true)
  })
})

describe('reminderText', () => {
  it('textos para cada caso', () => {
    expect(reminderText({ days: null, overdue: true, pending: 0 }, false)).toBe(
      'Todavía no se hizo ningún conteo del estante.',
    )
    expect(reminderText({ days: 9, overdue: true, pending: 0 }, false)).toBe(
      'Hace 9 días que no se cuenta el estante.',
    )
    expect(
      reminderText({ days: 2, overdue: false, pending: 0 }, false),
    ).toBeNull()
    expect(reminderText({ days: 2, overdue: false, pending: 2 }, true)).toBe(
      '2 conteos esperan tu revisión.',
    )
    expect(reminderText({ days: 2, overdue: false, pending: 1 }, true)).toBe(
      '1 conteo espera tu revisión.',
    )
    expect(
      reminderText({ days: 2, overdue: false, pending: 1 }, false),
    ).toBeNull()
    expect(reminderText({ days: 9, overdue: true, pending: 1 }, true)).toBe(
      'Hace 9 días que no se cuenta el estante. 1 conteo espera tu revisión.',
    )
  })
})
