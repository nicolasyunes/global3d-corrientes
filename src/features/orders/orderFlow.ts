import { addDaysISO } from './list'

// Two ways an order steps out of urgent production without being lost:
//  - "En espera": not confirmed yet (waiting_reason set). Out of the print
//    queue and the late counts; comes back for review on follow_up_on.
//  - "Sin apuro": confirmed, but the due date is only a guide (flexible).
//    Printed when there's spare time, never counted as late.

export const WAITING_REASONS = [
  'Falta que confirme',
  'Esperando seña',
  'Esperando diseño / aprobación',
  'Presupuesto enviado',
] as const

export const DEFAULT_WAITING_REASON = WAITING_REASONS[0]

// Quick "revisar en…" choices, in days.
export const FOLLOW_UP_CHOICES: [string, number][] = [
  ['En 3 días', 3],
  ['En 1 semana', 7],
  ['En 2 semanas', 14],
]

export const DEFAULT_FOLLOW_UP_DAYS = 7

interface FlowFields {
  waiting_reason: string | null
  follow_up_on: string | null
  flexible: boolean
  status: string
}

const CLOSED = ['finished', 'delivered', 'cancelled']

export function isWaiting(order: Pick<FlowFields, 'waiting_reason'>): boolean {
  return Boolean(order.waiting_reason?.trim())
}

// A waiting order is due for a look once its follow-up date arrives (or if it
// never had one).
export function needsReview(order: FlowFields, today: string): boolean {
  if (!isWaiting(order) || CLOSED.includes(order.status)) return false
  return !order.follow_up_on || order.follow_up_on <= today
}

// Orders that belong to urgent production: open, confirmed and on a real
// deadline.
export function isUrgentFlow(order: FlowFields): boolean {
  return !CLOSED.includes(order.status) && !isWaiting(order) && !order.flexible
}

// "Urgente" pins an order above everything else, late or not: wrap any
// comparator so marked orders always come first and the rest keep their order.
export function urgentFirst<T extends { urgent: boolean }>(
  compare: (a: T, b: T) => number,
): (a: T, b: T) => number {
  return (a, b) => Number(b.urgent) - Number(a.urgent) || compare(a, b)
}

export function followUpFrom(today: string, days = DEFAULT_FOLLOW_UP_DAYS) {
  return addDaysISO(today, days)
}
