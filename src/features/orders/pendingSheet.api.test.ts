import { describe, expect, it } from 'vitest'
import type { OrderWithCustomer } from './orders.api'
import type { PendingSheetOrder } from './pendingSheet.api'
import { appOrderToSheetRow, mergeSheetOrders } from './pendingSheet.api'

function appOrder(overrides: Partial<OrderWithCustomer> = {}): OrderWithCustomer {
  return {
    id: 'order-1',
    customer_id: 'cust-1',
    product_type: 'cup',
    color_spec: {},
    personalization: null,
    measurements: null,
    observations: null,
    order_date: '2026-08-01',
    due_date: '2026-08-10',
    total_amount: 1000,
    deposit: 200,
    pending_balance: 800,
    payment_method: null,
    status: 'new',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    origin_channel: 'whatsapp',
    reference_link: null,
    customers: { name: 'Ada', phone: null },
    ...overrides,
  } as OrderWithCustomer
}

function sheetRow(overrides: Partial<PendingSheetOrder> = {}): PendingSheetOrder {
  return {
    id: '',
    nombre: 'Manual',
    producto: 'Otro',
    detalles: '',
    fechaEntrega: '15/08/2026',
    fechaEntregaSortKey: '2026-08-15',
    total: null,
    saldo: 0,
    canal: '',
    estado: '',
    ...overrides,
  }
}

describe('appOrderToSheetRow', () => {
  it('maps the order into the Planilla row shape', () => {
    const row = appOrderToSheetRow(appOrder())
    expect(row).toMatchObject({
      id: 'order-1',
      nombre: 'Ada',
      producto: 'Taza',
      fechaEntrega: '10/08/2026',
      fechaEntregaSortKey: '2026-08-10',
      total: 1000,
      saldo: 800,
      canal: 'WhatsApp',
      estado: '',
    })
  })

  it('derives estado text only for the sheet-expressed statuses', () => {
    expect(appOrderToSheetRow(appOrder({ status: 'finished' })).estado).toBe('listo')
    expect(appOrderToSheetRow(appOrder({ status: 'delivered' })).estado).toBe(
      'entregado',
    )
    expect(appOrderToSheetRow(appOrder({ status: 'cancelled' })).estado).toBe(
      'cancelado',
    )
    expect(appOrderToSheetRow(appOrder({ status: 'printing' })).estado).toBe('')
  })

  it('joins personalization / measurements / observations into detalles', () => {
    const row = appOrderToSheetRow(
      appOrder({ personalization: 'logo', measurements: null, observations: 'urgente' }),
    )
    expect(row.detalles).toBe('logo — urgente')
  })
})

describe('mergeSheetOrders', () => {
  it('drops the sheet row that mirrors an app order (matched on id)', () => {
    const merged = mergeSheetOrders(
      [sheetRow({ id: 'order-1', nombre: 'Ada (mirror)' })],
      [appOrder({ id: 'order-1' })],
    )
    expect(merged).toHaveLength(1)
    expect(merged[0].nombre).toBe('Ada')
  })

  it('keeps sheet-only rows (no id, or id with no matching order)', () => {
    const merged = mergeSheetOrders(
      [
        sheetRow({ id: '', nombre: 'Manual' }),
        sheetRow({ id: 'order-999', nombre: 'Huérfana' }),
      ],
      [appOrder({ id: 'order-1' })],
    )
    expect(merged.map((r) => r.nombre).sort()).toEqual([
      'Ada',
      'Huérfana',
      'Manual',
    ])
  })

  it('sorts the merged rows by delivery date ascending', () => {
    const merged = mergeSheetOrders(
      [sheetRow({ id: '', nombre: 'Later', fechaEntregaSortKey: '2026-12-01' })],
      [appOrder({ id: 'order-1', due_date: '2026-01-05' })],
    )
    expect(merged.map((r) => r.nombre)).toEqual(['Ada', 'Later'])
  })
})
