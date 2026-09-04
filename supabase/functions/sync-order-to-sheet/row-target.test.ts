import { describe, expect, it } from 'vitest'
import { resolveTargetRow } from './row-target.ts'

// B:K rows — CLIENTE (0) .. ESTADO (8) .. id (9). Helper keeps the tests
// readable: name + optional id, padded to the id slot.
function bkRow(name: string, id = ''): string[] {
  const row = new Array<string>(10).fill('')
  row[0] = name
  row[9] = id
  return row
}

describe('resolveTargetRow', () => {
  it('updates in place when an id matches, returning the 1-indexed row', () => {
    const rows = [
      bkRow('CLIENTE'), // header
      bkRow('Ada', 'order-1'),
      bkRow('Linus', 'order-2'),
    ]
    expect(resolveTargetRow(rows, 'order-2')).toEqual({ row: 3, mode: 'updated' })
  })

  it('appends after the last row when no id matches', () => {
    const rows = [bkRow('CLIENTE'), bkRow('Ada', 'order-1'), bkRow('Linus')]
    expect(resolveTargetRow(rows, 'order-9')).toEqual({ row: 4, mode: 'appended' })
  })

  it('counts hand-typed rows with an empty id toward the row count', () => {
    // K:K would have stopped at row 2; B:K sees all four rows.
    const rows = [
      bkRow('CLIENTE'),
      bkRow('Ada', 'order-1'),
      bkRow('Grace'), // no id
      bkRow('Katherine'), // no id
    ]
    expect(resolveTargetRow(rows, 'order-x')).toEqual({ row: 5, mode: 'appended' })
  })

  it('writes to row 1 when the sheet read comes back empty', () => {
    expect(resolveTargetRow([], 'order-1')).toEqual({ row: 1, mode: 'appended' })
  })
})
