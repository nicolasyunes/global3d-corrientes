import { describe, expect, it } from 'vitest'
import type { PendingSheetOrder } from './pendingSheet.api'
import {
  availableMonths,
  emptySheetFilters,
  filterSheetOrders,
  formatMonthLabel,
  normalizeEstado,
  sheetOrderMonth,
} from './sheetFilters'

function sheetOrder(
  overrides: Partial<PendingSheetOrder> = {},
): PendingSheetOrder {
  return {
    id: '',
    nombre: 'Ada',
    producto: 'Taza',
    detalles: '',
    fechaEntrega: '05/08/2026',
    fechaEntregaSortKey: '2026-08-05',
    total: 1000,
    saldo: 500,
    canal: 'WhatsApp',
    estado: '',
    ...overrides,
  }
}

describe('normalizeEstado', () => {
  it('treats a blank/whitespace ESTADO as pendiente', () => {
    expect(normalizeEstado('')).toBe('pendiente')
    expect(normalizeEstado('   ')).toBe('pendiente')
  })

  it('lowercases and trims a known estado', () => {
    expect(normalizeEstado(' Listo ')).toBe('listo')
    expect(normalizeEstado('ENTREGADO')).toBe('entregado')
    expect(normalizeEstado('Cancelado')).toBe('cancelado')
  })

  it('falls back to pendiente for anything unrecognised', () => {
    expect(normalizeEstado('en proceso')).toBe('pendiente')
  })
})

describe('sheetOrderMonth', () => {
  it('returns YYYY-MM from the delivery sort key', () => {
    expect(sheetOrderMonth(sheetOrder({ fechaEntregaSortKey: '2026-08-05' }))).toBe(
      '2026-08',
    )
  })

  it('returns "" when the row has no parseable date', () => {
    expect(
      sheetOrderMonth(sheetOrder({ fechaEntregaSortKey: '9999-99-99' })),
    ).toBe('')
  })
})

describe('filterSheetOrders', () => {
  const rows = [
    sheetOrder({ nombre: 'A', fechaEntregaSortKey: '2026-08-05', estado: '' }),
    sheetOrder({ nombre: 'B', fechaEntregaSortKey: '2026-08-20', estado: 'Listo' }),
    sheetOrder({ nombre: 'C', fechaEntregaSortKey: '2026-09-01', estado: 'Entregado' }),
    sheetOrder({ nombre: 'D', fechaEntregaSortKey: '9999-99-99', estado: 'Cancelado' }),
  ]

  it('returns everything with the empty filter', () => {
    expect(filterSheetOrders(rows, emptySheetFilters())).toHaveLength(4)
  })

  it('filters by month on the delivery date', () => {
    const result = filterSheetOrders(rows, { month: '2026-08', estado: '' })
    expect(result.map((r) => r.nombre)).toEqual(['A', 'B'])
  })

  it('never matches a dateless row against a specific month', () => {
    const result = filterSheetOrders(rows, { month: '2026-09', estado: '' })
    expect(result.map((r) => r.nombre)).toEqual(['C'])
  })

  it('filters by estado, counting a blank cell as pendiente', () => {
    expect(
      filterSheetOrders(rows, { month: '', estado: 'pendiente' }).map((r) => r.nombre),
    ).toEqual(['A'])
    expect(
      filterSheetOrders(rows, { month: '', estado: 'cancelado' }).map((r) => r.nombre),
    ).toEqual(['D'])
  })

  it('combines month and estado', () => {
    expect(
      filterSheetOrders(rows, { month: '2026-08', estado: 'listo' }).map(
        (r) => r.nombre,
      ),
    ).toEqual(['B'])
  })
})

describe('availableMonths', () => {
  it('lists the distinct delivery months, newest first, skipping dateless rows', () => {
    const rows = [
      sheetOrder({ fechaEntregaSortKey: '2026-08-05' }),
      sheetOrder({ fechaEntregaSortKey: '2026-08-20' }),
      sheetOrder({ fechaEntregaSortKey: '2026-09-01' }),
      sheetOrder({ fechaEntregaSortKey: '9999-99-99' }),
      sheetOrder({ fechaEntregaSortKey: '2026-07-10' }),
    ]
    expect(availableMonths(rows)).toEqual(['2026-09', '2026-08', '2026-07'])
  })
})

describe('formatMonthLabel', () => {
  it('renders a Spanish "Mes AAAA" label', () => {
    expect(formatMonthLabel('2026-08')).toBe('Agosto 2026')
    expect(formatMonthLabel('2026-01')).toBe('Enero 2026')
  })

  it('passes through an unexpected value untouched', () => {
    expect(formatMonthLabel('nope')).toBe('nope')
  })
})
