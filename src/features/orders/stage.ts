import type { OrderStatus } from '@/lib/domain-constants'
import { isWaiting } from './orderFlow'

// What the workshop sees of an order: "En espera" is not a status in the
// database (it's an unconfirmed order), but on screen it is a stage like any
// other.
export type Stage =
  | 'on_hold'
  | 'new'
  | 'printing'
  | 'post_processing'
  | 'finished'
  | 'delivered'
  | 'cancelled'

export const STAGE_LABEL: Record<Stage, string> = {
  on_hold: 'En espera',
  new: 'Nuevo',
  printing: 'Imprimiendo',
  post_processing: 'Posprocesado',
  finished: 'Listo para avisar',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

interface StageFields {
  status: OrderStatus
  waiting_reason: string | null
}

// The stage shown for an order. The database keeps `status` in step with the
// pieces (see recompute_order_stage); this only folds "en espera" in.
export function stageOf(order: StageFields): Stage {
  if (order.status === 'delivered' || order.status === 'cancelled')
    return order.status
  if (isWaiting(order)) return 'on_hold'
  return order.status === 'in_queue' ? 'new' : order.status
}

export interface PartLike {
  status: string
  quantity_total: number
  quantity_done: number
}

export interface PostFields {
  pp_sand: boolean
  pp_paint: boolean
  sand_done: boolean
  paint_done: boolean
}

export function needsPostprocess(o: PostFields): boolean {
  return o.pp_sand || o.pp_paint
}

export function postprocessComplete(o: PostFields): boolean {
  return (!o.pp_sand || o.sand_done) && (!o.pp_paint || o.paint_done)
}

// Mirror of recompute_order_stage() in the database, as a pure function: what
// stage the pieces and the postprocess call for. Used to explain the automatic
// transition and to tell when the stored stage was set by hand.
export function computeStage(
  order: StageFields & PostFields,
  parts: readonly PartLike[],
): Stage {
  if (order.status === 'delivered' || order.status === 'cancelled')
    return order.status
  if (isWaiting(order)) return 'on_hold'
  if (parts.length === 0 || parts.every((p) => p.status === 'pending'))
    return 'new'
  if (parts.some((p) => p.status !== 'done')) return 'printing'
  if (needsPostprocess(order) && !postprocessComplete(order))
    return 'post_processing'
  return 'finished'
}

// Printed units over total units (20 llaveros count as 20).
export function partsProgress(parts: readonly PartLike[]): {
  printed: number
  total: number
} {
  return parts.reduce(
    (acc, p) => ({
      printed: acc.printed + p.quantity_done,
      total: acc.total + p.quantity_total,
    }),
    { printed: 0, total: 0 },
  )
}

// One sentence for the stepper: what will move this order on by itself.
export function nextStepHint(
  order: StageFields & PostFields & { stage_manual: boolean },
  parts: readonly PartLike[],
): string {
  const stage = stageOf(order)
  if (stage === 'delivered') return 'Pedido entregado.'
  if (stage === 'cancelled') return 'Pedido cancelado.'
  if (stage === 'on_hold')
    return 'Está en espera: no entra al taller hasta que lo confirmes.'
  if (order.stage_manual)
    return 'La etapa está fijada a mano: no cambia sola aunque avancen las piezas.'
  if (parts.length === 0)
    return 'Cargá las piezas: la etapa avanza sola a medida que se imprimen.'
  const allPrinted =
    parts.length === 1
      ? 'la pieza esté impresa'
      : 'todas las piezas estén impresas'
  if (stage === 'new')
    return 'Pasa solo a Imprimiendo cuando empiece la primera pieza.'
  if (stage === 'printing')
    return needsPostprocess(order)
      ? `Pasa solo a Post-procesado cuando ${allPrinted}.`
      : `Pasa solo a Terminado cuando ${allPrinted} (el pedido no lleva posprocesado).`
  if (stage === 'post_processing')
    return 'Pasa solo a Terminado cuando marques el posprocesado como hecho.'
  return 'Terminado: avisale al cliente y marcalo como entregado cuando lo retire.'
}

export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase()
}
