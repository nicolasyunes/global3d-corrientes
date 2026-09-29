import { describe, expect, it } from 'vitest'
import {
  colorSwatch,
  groupQueueByColor,
  groupQueueByCustomer,
  itemState,
  normalizeColor,
  progressOf,
} from './pieces'

const p = (status: string, done: number, total: number) => ({
  status,
  quantity_done: done,
  quantity_total: total,
})

describe('normalizeColor', () => {
  it('ignora mayúsculas, tildes y espacios', () => {
    expect(normalizeColor('  Marrón  Claro ')).toBe('marron claro')
    expect(normalizeColor(null)).toBe('')
  })
})

describe('colorSwatch', () => {
  it('reconoce colores comunes escritos libremente', () => {
    expect(colorSwatch('Negro mate')).toBe('#111111')
    expect(colorSwatch('dorado seda')).toBe('#D4AF37')
    expect(colorSwatch('Gris espacial')).toBe('#8A8D91')
  })
  it('celeste no cae en azul', () => {
    expect(colorSwatch('celeste pastel')).toBe('#6EC1E4')
  })
  it('devuelve null si no lo conoce', () => {
    expect(colorSwatch('galaxia')).toBeNull()
    expect(colorSwatch('')).toBeNull()
  })
})

describe('itemState', () => {
  it('sin piezas', () => expect(itemState([])).toBe('none'))
  it('todas listas', () =>
    expect(itemState([p('done', 1, 1), p('done', 2, 2)])).toBe('done'))
  it('alguna en marcha', () =>
    expect(itemState([p('done', 1, 1), p('pending', 0, 1)])).toBe('printing'))
  it('nada empezado', () =>
    expect(itemState([p('pending', 0, 1)])).toBe('todo'))
})

describe('progressOf', () => {
  it('suma cantidades, no piezas', () => {
    expect(progressOf([p('printing', 21, 33), p('done', 1, 1)])).toEqual({
      done: 22,
      total: 34,
    })
  })
})

describe('groupQueueByColor', () => {
  it('agrupa por color normalizado y ordena por urgencia', () => {
    const groups = groupQueueByColor([
      { id: 'a', color: 'Blanco', due_date: '2026-10-05' },
      { id: 'b', color: 'negro', due_date: '2026-10-02' },
      { id: 'c', color: 'blanco ', due_date: '2026-10-01' },
      { id: 'd', color: null, due_date: '2026-10-09' },
    ])
    expect(groups.map((g) => g.label)).toEqual(['Blanco', 'negro', 'Sin color'])
    expect(groups[0].entries.map((e) => e.id)).toEqual(['c', 'a'])
    expect(groups[0].earliest).toBe('2026-10-01')
  })
})

describe('groupQueueByCustomer', () => {
  it('agrupa por cliente y ordena por la entrega más urgente', () => {
    const groups = groupQueueByCustomer([
      {
        customer_id: 'ana',
        customer_name: 'Ana',
        color: 'rojo',
        due_date: '2026-10-05',
      },
      {
        customer_id: 'beto',
        customer_name: 'Beto',
        color: 'negro',
        due_date: '2026-10-02',
      },
      {
        customer_id: 'ana',
        customer_name: 'Ana',
        color: 'azul',
        due_date: '2026-10-01',
      },
    ])
    expect(groups.map((g) => g.label)).toEqual(['Ana', 'Beto'])
    expect(groups[0].earliest).toBe('2026-10-01')
    expect(groups[0].entries.map((e) => e.color)).toEqual(['azul', 'rojo'])
  })
})
