import { describe, expect, it } from 'vitest'
import {
  balanceOf,
  buildDescription,
  buildTitle,
  emptyDraft,
  parseMoney,
  validateDraft,
  type ItemDraft,
} from './orderDraft'

const item = (product: string, quantity = '1', details = ''): ItemDraft => ({
  product,
  quantity,
  details,
})

describe('parseMoney', () => {
  it('acepta formatos argentinos', () => {
    expect(parseMoney('245.500')).toBe(245500)
    expect(parseMoney('$ 245500')).toBe(245500)
    expect(parseMoney('1.234,50')).toBe(1234.5)
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('abc')).toBeNaN()
  })
})

describe('buildTitle', () => {
  it('arma la columna PRODUCTO como en la planilla', () => {
    expect(
      buildTitle([
        item('Vaso 500 ml', '10'),
        item('Vaso 1 lt', '3'),
        item('  '),
      ]),
    ).toBe('10× Vaso 500 ml + 3× Vaso 1 lt')
    expect(buildTitle([item('Sombrero Harry Potter')])).toBe(
      'Sombrero Harry Potter',
    )
  })
})

describe('buildDescription', () => {
  it('un solo producto: sólo los detalles y las notas', () => {
    expect(
      buildDescription(
        [item('Vaso', '1', 'negro franja azul')],
        'mandó logo por wpp',
      ),
    ).toBe('negro franja azul — mandó logo por wpp')
  })
  it('varios productos: antepone el nombre', () => {
    expect(
      buildDescription(
        [item('Boca 1 L', '1', 'nombre Juan'), item('River 650', '1', '')],
        '',
      ),
    ).toBe('Boca 1 L: nombre Juan')
  })
})

describe('balanceOf', () => {
  it('total menos seña, nunca negativo', () => {
    expect(balanceOf({ total: '245.500', deposit: '100000' })).toBe(145500)
    expect(balanceOf({ total: '1000', deposit: '' })).toBe(1000)
    expect(balanceOf({ total: '', deposit: '10' })).toBeNull()
  })
})

describe('validateDraft', () => {
  it('pide cliente, producto y fecha', () => {
    expect(validateDraft(emptyDraft())).toEqual({
      customerName: expect.any(String),
      items: expect.any(String),
      dueDate: expect.any(String),
    })
  })
  it('seña mayor al total es error', () => {
    const d = {
      ...emptyDraft(),
      customerName: 'A',
      items: [item('X')],
      dueDate: '2026-10-01',
      total: '100',
      deposit: '200',
    }
    expect(validateDraft(d)).toEqual({
      deposit: 'La seña no puede superar el total.',
    })
  })
  it('un pedido completo es válido', () => {
    const d = {
      ...emptyDraft(),
      customerName: 'A',
      items: [item('X')],
      dueDate: '2026-10-01',
    }
    expect(validateDraft(d)).toEqual({})
  })
})
