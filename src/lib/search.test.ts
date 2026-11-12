import { describe, expect, it } from 'vitest'
import { matchesQuery, normalizeSearchText, searchTokens } from './search'

describe('normalizeSearchText', () => {
  it('pasa a minúsculas y saca acentos', () => {
    expect(normalizeSearchText('Mandiyú PÁDEL Ñandú')).toBe(
      'mandiyu padel nandu',
    )
  })
})

describe('searchTokens', () => {
  it('separa por espacios y descarta vacíos', () => {
    expect(searchTokens('  Vaso   Boca ')).toEqual(['vaso', 'boca'])
    expect(searchTokens('   ')).toEqual([])
  })
})

describe('matchesQuery', () => {
  const name = 'Vaso Camiseta 650 ml BOCA'

  it('encuentra por palabras sueltas en cualquier orden', () => {
    expect(matchesQuery(name, 'vaso boca')).toBe(true)
    expect(matchesQuery(name, 'boca vaso')).toBe(true)
    expect(matchesQuery(name, 'camiseta 650')).toBe(true)
  })

  it('acepta partes de palabra', () => {
    expect(matchesQuery(name, 'cami bo')).toBe(true)
  })

  it('ignora mayúsculas y acentos de los dos lados', () => {
    expect(matchesQuery('Vaso Camiseta 650ml Mandiyú', 'MANDIYU')).toBe(true)
    expect(matchesQuery('Vaso Camiseta 650ml Mandiyu', 'mandiyú')).toBe(true)
  })

  it('exige todas las palabras', () => {
    expect(matchesQuery(name, 'vaso river')).toBe(false)
  })

  it('busca en varios campos e ignora los vacíos', () => {
    expect(
      matchesQuery(
        ['Vaso milkshake', null, 'Spiderman rojo'],
        'milkshake rojo',
      ),
    ).toBe(true)
    expect(matchesQuery([null, undefined], 'vaso')).toBe(false)
  })

  it('una búsqueda vacía encuentra todo', () => {
    expect(matchesQuery(name, '')).toBe(true)
    expect(matchesQuery(null, '  ')).toBe(true)
  })
})
