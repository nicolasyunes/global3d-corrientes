import { describe, expect, it } from 'vitest'
import {
  availableColors,
  availableMarcas,
  availableTipos,
  emptyInsumoFilters,
  filterInsumos,
  formatRolls,
  insumoLabel,
  insumoMarca,
  insumoTipo,
  isLowStock,
} from './insumos'

type Row = {
  material: string
  color: string | null
  remaining_grams: number | null
}
const rows: Row[] = [
  { material: '3N3 PLA 1kg', color: 'Negro', remaining_grams: 2000 },
  { material: '3N3 PLA 1kg', color: 'Rústico', remaining_grams: 0 },
  { material: 'Grilon3 PLA 1kg', color: 'Negro', remaining_grams: 500 },
  { material: 'BAMBU LAB PLA 1kg', color: null, remaining_grams: null },
]

describe('formatRolls', () => {
  it('shows whole rolls without decimals and partials with one', () => {
    expect(formatRolls(3000)).toBe('3')
    expect(formatRolls(3400)).toBe('3,4')
    expect(formatRolls(0)).toBe('0')
    expect(formatRolls(null)).toBe('0')
  })
})

describe('isLowStock', () => {
  it('flags anything under a full roll', () => {
    expect(isLowStock({ remaining_grams: 999 })).toBe(true)
    expect(isLowStock({ remaining_grams: 1000 })).toBe(false)
    expect(isLowStock({ remaining_grams: null })).toBe(true)
  })
})

describe('insumoLabel', () => {
  it('joins producto · color and drops a blank color', () => {
    expect(insumoLabel({ material: '3N3 PLA 1kg', color: 'Negro' })).toBe(
      '3N3 PLA 1kg · Negro',
    )
    expect(insumoLabel({ material: 'BAMBU LAB PLA 1kg', color: null })).toBe(
      'BAMBU LAB PLA 1kg',
    )
  })
})

describe('insumoTipo', () => {
  it('reconoce PLA y PETG como palabra, sin importar espaciado', () => {
    expect(insumoTipo('3N3 PLA 1kg')).toBe('PLA')
    expect(insumoTipo('3n3 PETG 1 kg')).toBe('PETG')
    expect(insumoTipo('Grilon3 PLA 1kg especial')).toBe('PLA')
  })

  it('cae en Otro cuando el nombre no trae tipo', () => {
    expect(insumoTipo('ELEGOO 1kg')).toBe('Otro')
    expect(insumoTipo('FLASHFORGE 1kg')).toBe('Otro')
    expect(insumoTipo('3NFLEX 1kg')).toBe('Otro')
  })
})

describe('insumoMarca', () => {
  it('normaliza las marcas conocidas a su forma legible', () => {
    expect(insumoMarca('3N3 PLA 1kg')).toBe('3N3')
    expect(insumoMarca('3n3 PETG 1 kg')).toBe('3N3')
    expect(insumoMarca('3NFLEX 1kg')).toBe('3NFlex')
    expect(insumoMarca('3nMax PLA 1kg')).toBe('3nMax')
    expect(insumoMarca('BAMBU LAB PLA 1kg')).toBe('BambuLab')
    expect(insumoMarca('FILA NOVA PLA 1kg')).toBe('FilaNova')
    expect(insumoMarca('FLASHFORGE 1kg')).toBe('FlashForge')
    expect(insumoMarca('FREEMOVER PLA 1kg')).toBe('FreeMover')
    expect(insumoMarca('Grilon3 PLA 1kg especial')).toBe('Grilon3')
    expect(insumoMarca('GST3D PLA 1 kg')).toBe('GST3D')
    expect(insumoMarca('ELEGOO 1kg')).toBe('ELEGOO')
  })

  it('para una marca desconocida saca tipo y peso del texto', () => {
    expect(insumoMarca('ACME PLA 1kg')).toBe('ACME')
    expect(insumoMarca('Otra Marca PETG 2 kg')).toBe('Otra Marca')
  })
})

describe('availableMarcas', () => {
  it('lista marcas distintas, colapsando grafías y ordenando es-AR', () => {
    expect(
      availableMarcas([
        { material: '3n3 PETG 1 kg' },
        { material: '3N3 PLA 1kg' },
        { material: 'Grilon3 PLA 1kg' },
        { material: 'ELEGOO 1kg' },
      ]),
    ).toEqual(['3N3', 'ELEGOO', 'Grilon3'])
  })
})

describe('availableTipos', () => {
  it('mantiene el orden PLA, PETG y deja Otro al final', () => {
    expect(
      availableTipos([
        { material: 'ELEGOO 1kg' },
        { material: '3n3 PETG 1 kg' },
        { material: '3N3 PLA 1kg' },
      ]),
    ).toEqual(['PLA', 'PETG', 'Otro'])
  })

  it('sólo ofrece los tipos presentes', () => {
    expect(availableTipos([{ material: '3N3 PLA 1kg' }])).toEqual(['PLA'])
  })
})

describe('availableColors', () => {
  it('lists distinct non-empty colors, sorted', () => {
    expect(availableColors(rows)).toEqual(['Negro', 'Rústico'])
  })
})

describe('filterInsumos', () => {
  it('no filters → everything', () => {
    expect(filterInsumos(rows, emptyInsumoFilters())).toHaveLength(4)
  })

  it('query matches producto or color, accent-insensitive', () => {
    expect(
      filterInsumos(rows, { ...emptyInsumoFilters(), query: 'grilon' }),
    ).toHaveLength(1)
    expect(
      filterInsumos(rows, { ...emptyInsumoFilters(), query: 'rustico' }).map(
        (r) => r.color,
      ),
    ).toEqual(['Rústico'])
  })

  it('color filter is exact', () => {
    expect(
      filterInsumos(rows, { ...emptyInsumoFilters(), color: 'Negro' }),
    ).toHaveLength(2)
  })

  it('marca filter matchea la marca derivada', () => {
    expect(
      filterInsumos(rows, { ...emptyInsumoFilters(), marca: '3N3' }).map(
        (r) => r.color,
      ),
    ).toEqual(['Negro', 'Rústico'])
    expect(
      filterInsumos(rows, { ...emptyInsumoFilters(), marca: 'BambuLab' }),
    ).toHaveLength(1)
  })

  it('tipo filter separa PLA de PETG y Otro', () => {
    const mixed = [
      { material: 'Grilon3 PLA 1kg', color: 'Negro', remaining_grams: 1000 },
      { material: '3n3 PETG 1 kg', color: 'Azul', remaining_grams: 1000 },
      { material: 'ELEGOO 1kg', color: 'Gris', remaining_grams: 1000 },
    ]
    expect(
      filterInsumos(mixed, { ...emptyInsumoFilters(), tipo: 'PETG' }).map(
        (r) => r.color,
      ),
    ).toEqual(['Azul'])
    expect(
      filterInsumos(mixed, { ...emptyInsumoFilters(), tipo: 'Otro' }).map(
        (r) => r.color,
      ),
    ).toEqual(['Gris'])
  })

  it('stock buckets are disjoint', () => {
    expect(
      filterInsumos(rows, { ...emptyInsumoFilters(), stock: 'in' }).map(
        (r) => r.material,
      ),
    ).toEqual(['3N3 PLA 1kg'])
    expect(
      filterInsumos(rows, { ...emptyInsumoFilters(), stock: 'low' }).map(
        (r) => r.color,
      ),
    ).toEqual(['Negro'])
    expect(
      filterInsumos(rows, { ...emptyInsumoFilters(), stock: 'out' }).map(
        (r) => r.color,
      ),
    ).toEqual(['Rústico', null])
  })
})
