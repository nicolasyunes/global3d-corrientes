import { describe, expect, it } from 'vitest'
import { reduceProductionTaskCounts } from './orders.api'

describe('reduceProductionTaskCounts', () => {
  it('collapses task rows into done/total per order', () => {
    const counts = reduceProductionTaskCounts([
      { order_id: 'a', done: true },
      { order_id: 'a', done: false },
      { order_id: 'a', done: true },
      { order_id: 'b', done: false },
    ])
    expect(counts).toEqual({
      a: { done: 2, total: 3 },
      b: { done: 0, total: 1 },
    })
  })

  it('returns an empty map for no rows', () => {
    expect(reduceProductionTaskCounts([])).toEqual({})
  })
})
