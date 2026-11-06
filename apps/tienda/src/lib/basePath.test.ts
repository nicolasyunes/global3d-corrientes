import { describe, expect, it } from 'vitest'
import { shopBase } from './basePath'

describe('shopBase', () => {
  it('bajo /tienda usa /tienda', () => {
    expect(shopBase('/tienda')).toBe('/tienda')
    expect(shopBase('/tienda/')).toBe('/tienda')
    expect(shopBase('/tienda/p/vaso-camiseta')).toBe('/tienda')
  })

  it('en la raíz del dominio propio no lleva prefijo', () => {
    expect(shopBase('/')).toBe('')
    expect(shopBase('/p/vaso-camiseta')).toBe('')
    expect(shopBase('/tiendas')).toBe('')
  })
})
