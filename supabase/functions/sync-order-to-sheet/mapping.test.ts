import { describe, expect, it } from 'vitest'
import { toSheetRow, type OrderRecord } from './mapping'

const base: OrderRecord = {
  id: 'o-1',
  customer_id: 'c-1',
  product_type: 'other',
  title: 'Vasos 500 ml + Vasos 1 lt',
  description: '10× 500 ml tercer tiempo; 3× 1 lt',
  personalization: null,
  measurements: null,
  observations: 'retira el viernes',
  due_date: '2026-10-02',
  total_amount: 245500,
  deposit: 100000,
  pending_balance: 145500,
  origin_channel: 'whatsapp_personal',
  status: 'new',
}

describe('toSheetRow', () => {
  it('uses the free-text product and description like the sheet', () => {
    const row = toSheetRow(base, 'Juanjo')
    expect(row[1]).toBe('Juanjo')
    expect(row[2]).toBe('Vasos 500 ml + Vasos 1 lt')
    expect(row[3]).toBe('10× 500 ml tercer tiempo; 3× 1 lt')
    expect(row[4]).toBe('02/10/2026')
    expect(row[8]).toBe('WhatsApp personal')
    expect(row[9]).toBe('No comenzado')
    expect(row[10]).toBe('o-1')
  })

  it('falls back to the legacy type and fields for old orders', () => {
    const row = toSheetRow(
      {
        ...base,
        title: null,
        description: null,
        product_type: 'cup',
        personalization: 'Juan',
      },
      'X',
    )
    expect(row[2]).toBe('Vaso')
    expect(row[3]).toBe('Juan — retira el viernes')
  })

  it('writes Imprimiendo while printing', () => {
    expect(toSheetRow({ ...base, status: 'printing' }, 'X')[9]).toBe(
      'Imprimiendo',
    )
  })
})
