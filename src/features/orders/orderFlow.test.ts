import { describe, expect, it } from 'vitest'
import { isUrgentFlow, isWaiting, needsReview, urgentFirst } from './orderFlow'
import { sortQueueGroups, type QueueGroup } from '@/features/production/pieces'

const base = {
  waiting_reason: null as string | null,
  follow_up_on: null as string | null,
  flexible: false,
  status: 'new',
}
const TODAY = '2026-09-30'

describe('orderFlow', () => {
  it('an order with a reason is waiting', () => {
    expect(isWaiting(base)).toBe(false)
    expect(isWaiting({ ...base, waiting_reason: 'Esperando seña' })).toBe(true)
    expect(isWaiting({ ...base, waiting_reason: '  ' })).toBe(false)
  })

  it('a waiting order needs review once its follow-up date arrives', () => {
    const w = { ...base, waiting_reason: 'Falta que confirme' }
    expect(needsReview({ ...w, follow_up_on: '2026-10-07' }, TODAY)).toBe(false)
    expect(needsReview({ ...w, follow_up_on: TODAY }, TODAY)).toBe(true)
    expect(needsReview({ ...w, follow_up_on: '2026-09-01' }, TODAY)).toBe(true)
    expect(needsReview({ ...w, follow_up_on: null }, TODAY)).toBe(true)
    expect(
      needsReview({ ...w, follow_up_on: TODAY, status: 'cancelled' }, TODAY),
    ).toBe(false)
    expect(needsReview({ ...base, follow_up_on: TODAY }, TODAY)).toBe(false)
  })

  it('only confirmed, open, real-deadline orders are urgent flow', () => {
    expect(isUrgentFlow(base)).toBe(true)
    expect(isUrgentFlow({ ...base, flexible: true })).toBe(false)
    expect(isUrgentFlow({ ...base, waiting_reason: 'x' })).toBe(false)
    expect(isUrgentFlow({ ...base, status: 'finished' })).toBe(false)
  })
})

describe('sortQueueGroups', () => {
  const entry = (id: string, created: string) => ({
    id,
    color: null,
    due_date: '2026-10-01',
    order_created_at: created,
  })
  const groups: QueueGroup<ReturnType<typeof entry>>[] = [
    {
      key: 'a',
      label: 'A',
      swatch: null,
      earliest: '2026-10-01',
      entries: [entry('a1', '2026-09-01'), entry('a2', '2026-09-20')],
    },
    {
      key: 'b',
      label: 'B',
      swatch: null,
      earliest: '2026-10-02',
      entries: [entry('b1', '2026-09-25')],
    },
  ]

  it('keeps the urgency order for "due"', () => {
    expect(sortQueueGroups(groups, 'due')).toBe(groups)
  })

  it('puts the most recently loaded orders first', () => {
    const out = sortQueueGroups(groups, 'newest')
    expect(out.map((g) => g.key)).toEqual(['b', 'a'])
    expect(out[1].entries.map((e) => e.id)).toEqual(['a2', 'a1'])
  })

  it('puts the oldest loaded orders first', () => {
    const out = sortQueueGroups(groups, 'oldest')
    expect(out.map((g) => g.key)).toEqual(['a', 'b'])
    expect(out[0].entries.map((e) => e.id)).toEqual(['a1', 'a2'])
  })
})

describe('urgentFirst', () => {
  const byDue = (
    a: { due: string; urgent: boolean },
    b: { due: string; urgent: boolean },
  ) => a.due.localeCompare(b.due)
  const rows = [
    { id: 'late', due: '2026-09-01', urgent: false },
    { id: 'event', due: '2026-12-20', urgent: true },
    { id: 'soon', due: '2026-10-02', urgent: false },
  ]

  it('pins urgent orders above late ones, whatever their date', () => {
    const out = [...rows].sort(urgentFirst(byDue))
    expect(out.map((r) => r.id)).toEqual(['event', 'late', 'soon'])
  })

  it('keeps the normal order when nothing is urgent', () => {
    const out = rows
      .map((r) => ({ ...r, urgent: false }))
      .sort(urgentFirst(byDue))
    expect(out.map((r) => r.id)).toEqual(['late', 'soon', 'event'])
  })
})
