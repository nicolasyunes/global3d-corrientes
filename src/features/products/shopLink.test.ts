import { describe, expect, it } from 'vitest'
import {
  categoryLabel,
  emptyShopLink,
  slugify,
  uniqueSlug,
  usedValues,
  validateShopLink,
  type ShopFamilyOption,
} from './shopLink'

const fam: ShopFamilyOption = {
  id: 'f1',
  slug: 'portalatas',
  name: 'Portalatas',
  category: 'regalos',
  published: true,
  axes: [{ key: 'diseno', label: 'Diseño' }],
  members: [
    { productId: 'a', values: { diseno: 'River rojo' }, position: 0 },
    { productId: 'b', values: { diseno: 'Boca blanco' }, position: 1 },
    { productId: 'c', values: { diseno: 'River rojo ' }, position: 2 },
  ],
}

describe('tienda desde la ficha del producto', () => {
  it('slug sin tildes ni símbolos, y único', () => {
    expect(slugify('Vaso Milkshake Pikachú 500ml!')).toBe(
      'vaso-milkshake-pikachu-500ml',
    )
    expect(uniqueSlug('Portalatas', ['portalatas', 'portalatas-2'])).toBe(
      'portalatas-3',
    )
    expect(uniqueSlug('¡¡!!', [])).toBe('producto')
  })

  it('sugiere los valores ya usados sin repetir', () => {
    expect(usedValues(fam, 'diseno')).toEqual(['Boca blanco', 'River rojo'])
  })

  it('valida según el modo', () => {
    expect(validateShopLink(emptyShopLink(), [fam], null)).toBeNull()
    expect(
      validateShopLink({ ...emptyShopLink(), mode: 'existing' }, [fam], null),
    ).toBe('Elegí la ficha de la tienda.')
    expect(
      validateShopLink(
        { ...emptyShopLink(), mode: 'new', newName: 'Mate', newCategory: '' },
        [fam],
        null,
      ),
    ).toBe('Elegí en qué categoría de la tienda va.')
    expect(
      validateShopLink(
        {
          ...emptyShopLink(),
          mode: 'existing',
          familyId: 'f1',
          options: { diseno: 'AFA' },
        },
        [fam],
        null,
      ),
    ).toBeNull()
  })

  it('el mismo producto puede guardar sus propios valores', () => {
    const d = {
      ...emptyShopLink(),
      mode: 'existing' as const,
      familyId: 'f1',
      options: { diseno: 'Boca blanco' },
    }
    expect(validateShopLink(d, [fam], 'b')).toBeNull()
    expect(validateShopLink(d, [fam], 'a')).toMatch(/Ya hay otro producto/)
  })

  it('nombres de categoría', () => {
    expect(categoryLabel('didactico')).toBe('Didáctico')
    expect(categoryLabel('vasos')).toBe('Vasos')
  })
})
