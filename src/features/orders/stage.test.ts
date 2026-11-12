import { describe, expect, it } from 'vitest'
import {
  computeStage,
  initialsOf,
  nextStepHint,
  partsProgress,
  stageOf,
} from './stage'

const order = {
  status: 'new' as const,
  waiting_reason: null as string | null,
  pp_sand: false,
  pp_paint: false,
  sand_done: false,
  paint_done: false,
  stage_manual: false,
}
const part = (status: string, total = 1, done = 0) => ({
  status,
  quantity_total: total,
  quantity_done: done,
})

describe('computeStage', () => {
  it('is new without parts or with every part pending', () => {
    expect(computeStage(order, [])).toBe('new')
    expect(computeStage(order, [part('pending'), part('pending')])).toBe('new')
  })

  it('is printing while any part is not printed', () => {
    expect(computeStage(order, [part('done'), part('pending')])).toBe(
      'printing',
    )
    expect(computeStage(order, [part('printing')])).toBe('printing')
  })

  it('goes straight to finished when there is no postprocess', () => {
    expect(computeStage(order, [part('done')])).toBe('finished')
  })

  it('waits in postprocess until what the order needs is done', () => {
    const o = { ...order, pp_sand: true, pp_paint: true }
    expect(computeStage(o, [part('done')])).toBe('post_processing')
    expect(computeStage({ ...o, sand_done: true }, [part('done')])).toBe(
      'post_processing',
    )
    expect(
      computeStage({ ...o, sand_done: true, paint_done: true }, [part('done')]),
    ).toBe('finished')
  })

  it('keeps on hold, delivered and cancelled orders where they are', () => {
    expect(
      computeStage({ ...order, waiting_reason: 'Esperando seña' }, [
        part('done'),
      ]),
    ).toBe('on_hold')
    expect(computeStage({ ...order, status: 'delivered' }, [])).toBe(
      'delivered',
    )
  })
})

describe('stageOf', () => {
  it('shows an unconfirmed order as on hold', () => {
    expect(stageOf({ status: 'printing', waiting_reason: 'x' })).toBe('on_hold')
    expect(stageOf({ status: 'in_queue', waiting_reason: null })).toBe('new')
  })
})

describe('partsProgress', () => {
  it('counts units, not rows', () => {
    expect(
      partsProgress([part('printing', 20, 12), part('done', 1, 1)]),
    ).toEqual({ printed: 13, total: 21 })
  })
})

describe('nextStepHint', () => {
  it('explains the automatic transition', () => {
    expect(
      nextStepHint({ ...order, status: 'printing' }, [part('printing')]),
    ).toMatch(/Pasa solo a Terminado cuando la pieza esté impresa/)
    expect(
      nextStepHint({ ...order, status: 'printing', pp_paint: true }, [
        part('printing'),
        part('pending'),
      ]),
    ).toMatch(/Post-procesado cuando todas las piezas/)
  })

  it('says so when the stage is pinned by hand', () => {
    expect(nextStepHint({ ...order, stage_manual: true }, [])).toMatch(
      /fijada a mano/,
    )
  })
})

describe('initialsOf', () => {
  it('takes the first letters of the first two words', () => {
    expect(initialsOf('Maxi comparsa luz')).toBe('MC')
    expect(initialsOf('Angie')).toBe('A')
    expect(initialsOf('')).toBe('?')
  })
})
