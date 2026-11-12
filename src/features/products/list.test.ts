import { describe, expect, it } from 'vitest'
import {
  emptyProductFilter,
  filterFromParams,
  filterProducts,
  filterToParams,
  stockLevel,
  stockStatus,
} from './list'
import type { ProductCatalogInfo } from './products.api'
import type { ProductRow } from './products.api'

function product(overrides: Partial<ProductRow>): ProductRow {
  return {
    id: 'id',
    name: 'Taza térmica',
    description: null,
    base_price: 1000,
    stock_quantity: 10,
    image_url: null,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    updated_by: null,
    ...overrides,
  }
}

describe('stockLevel', () => {
  it('is "out" at zero or below', () => {
    expect(stockLevel(product({ stock_quantity: 0 }))).toBe('out')
  })

  it('is "low" below the threshold but above zero', () => {
    expect(stockLevel(product({ stock_quantity: 1 }))).toBe('low')
    expect(stockLevel(product({ stock_quantity: 4 }))).toBe('low')
  })

  it('is "ok" at or above the threshold', () => {
    expect(stockLevel(product({ stock_quantity: 5 }))).toBe('ok')
    expect(stockLevel(product({ stock_quantity: 50 }))).toBe('ok')
  })
})

describe('filterProducts', () => {
  it('returns everything when the filter is empty', () => {
    const products = [product({ id: 'a' }), product({ id: 'b' })]
    expect(
      filterProducts(products, {
        ...emptyProductFilter(),
        query: '',
      }),
    ).toHaveLength(2)
  })

  it('matches the query against name case-insensitively', () => {
    const products = [
      product({ id: 'a', name: 'Llavero Zelda' }),
      product({ id: 'b', name: 'Taza térmica' }),
    ]
    const result = filterProducts(products, {
      ...emptyProductFilter(),
      query: 'zelda',
    })
    expect(result.map((p) => p.id)).toEqual(['a'])
  })

  it('matches the query against description too', () => {
    const products = [
      product({ id: 'a', name: 'Producto', description: 'Edición especial' }),
      product({ id: 'b', name: 'Otro', description: null }),
    ]
    const result = filterProducts(products, {
      ...emptyProductFilter(),
      query: 'especial',
    })
    expect(result.map((p) => p.id)).toEqual(['a'])
  })

  it('busca por palabras en cualquier orden, sin acentos ni mayúsculas', () => {
    const products = [
      product({ id: 'a', name: 'Vaso camiseta 650 ml BOCA' }),
      product({ id: 'b', name: 'Vaso Camiseta 650 ml RIVER' }),
      product({ id: 'c', name: 'Vaso Camiseta 650ml Mandiyú' }),
    ]
    const ids = (query: string) =>
      filterProducts(products, { ...emptyProductFilter(), query }).map(
        (p) => p.id,
      )
    expect(ids('vaso boca')).toEqual(['a'])
    expect(ids('boca 650')).toEqual(['a'])
    expect(ids('MANDIYU')).toEqual(['c'])
    expect(ids('vaso camiseta')).toEqual(['a', 'b', 'c'])
    expect(ids('vaso talleres')).toEqual([])
  })

  it('excludes inactive products when only active ones are asked', () => {
    const products = [
      product({ id: 'a', active: true }),
      product({ id: 'b', active: false }),
    ]
    const result = filterProducts(products, {
      ...emptyProductFilter(),
      query: '',
      active: 'active',
    })
    expect(result.map((p) => p.id)).toEqual(['a'])
  })
})

const fam = (
  over: Partial<NonNullable<ProductCatalogInfo['family']>> = {},
) => ({
  id: 'f1',
  name: 'Mates Boca',
  slug: 'mates-boca',
  category: 'regalos',
  saleMode: 'stock',
  leadDays: 3,
  ...over,
})

describe('stockStatus', () => {
  it('sigue la regla de la sincronización con ML', () => {
    expect(stockStatus({ stock_quantity: 2 }, undefined)).toBe('con_stock')
    expect(stockStatus({ stock_quantity: 0 }, undefined)).toBe('sin_stock')
    expect(
      stockStatus({ stock_quantity: 0 }, { family: fam(), mlStatus: null }),
    ).toBe('a_pedido')
    expect(
      stockStatus(
        { stock_quantity: 0 },
        { family: fam({ leadDays: 0 }), mlStatus: null },
      ),
    ).toBe('sin_stock')
    expect(
      stockStatus(
        { stock_quantity: 5 },
        { family: fam({ saleMode: 'a_pedido' }), mlStatus: null },
      ),
    ).toBe('a_pedido')
  })
})

describe('filtros combinados', () => {
  const base = {
    description: null,
    base_price: null,
    image_url: null,
    created_at: '',
    updated_at: '',
    updated_by: null,
  }
  const products = [
    {
      ...base,
      id: 'a',
      name: 'Mate imperial',
      stock_quantity: 3,
      active: true,
    },
    {
      ...base,
      id: 'b',
      name: 'Mate camionero',
      stock_quantity: 0,
      active: true,
    },
    {
      ...base,
      id: 'c',
      name: 'Llavero Pistón',
      stock_quantity: 0,
      active: false,
    },
  ]
  const catalog: Record<string, ProductCatalogInfo> = {
    a: { family: fam(), mlStatus: 'active' },
    b: { family: fam(), mlStatus: 'paused' },
  }
  const ids = (over: Parameters<typeof filterProducts>[1]) =>
    filterProducts(products, over, catalog).map((p) => p.id)

  it('busca por familia, slug y sin acentos', () => {
    const f = emptyProductFilter()
    expect(ids({ ...f, query: 'boca mate' })).toEqual(['a', 'b'])
    expect(ids({ ...f, query: 'mates-boca' })).toEqual(['a', 'b'])
    expect(ids({ ...f, query: 'piston' })).toEqual(['c'])
    expect(ids({ ...f, query: 'regal' })).toEqual(['a', 'b'])
  })

  it('combina categoría, stock, ML y estado', () => {
    const f = emptyProductFilter()
    expect(ids({ ...f, category: 'regalos', stock: 'con_stock' })).toEqual([
      'a',
    ])
    expect(ids({ ...f, ml: 'paused' })).toEqual(['b'])
    expect(ids({ ...f, ml: 'none' })).toEqual(['c'])
    expect(ids({ ...f, ml: 'published', stock: 'a_pedido' })).toEqual(['b'])
    expect(ids({ ...f, family: '__none__', active: 'inactive' })).toEqual(['c'])
    expect(ids({ ...f, saleMode: 'stock', active: 'inactive' })).toEqual([])
  })

  it('los filtros van y vuelven de la URL', () => {
    const f = { ...emptyProductFilter(), query: 'mate', ml: 'none' as const }
    const params = filterToParams(f)
    expect(params.toString()).toBe('q=mate&ml=none')
    expect(filterFromParams(params)).toEqual(f)
    expect(filterFromParams(new URLSearchParams('ml=raro'))).toEqual(
      emptyProductFilter(),
    )
  })
})
