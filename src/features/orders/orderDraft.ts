import type { OriginChannel, PaymentMethod } from '@/lib/domain-constants'
import type { PartLine } from '@/features/products/parts'

export interface ItemDraft {
  id?: string
  product: string
  quantity: string
  details: string
  // Set when the product name matches a preset: its parts (per unit, colors
  // editable for this order) become the item's pieces on save.
  productId?: string | null
  parts?: PartLine[]
}

export interface OrderDraft {
  customerId: string | null
  customerName: string
  customerPhone: string
  items: ItemDraft[]
  dueDate: string
  total: string
  deposit: string
  channel: OriginChannel | null
  // How the deposit was paid; only asked when creating
  depositMethod: PaymentMethod | null
  referenceLink: string
  notes: string
  // "En espera": not confirmed yet; reason + when to check again.
  waiting: boolean
  waitingReason: string
  followUpOn: string
  // "Sin apuro": the due date is only a guide.
  flexible: boolean
  // "Urgente": pinned above everything else, whatever its date.
  urgent: boolean
  // Postprocess for the whole order, once everything is printed.
  ppSand: boolean
  ppPaint: boolean
}

export type DraftErrors = Partial<
  Record<
    | 'customerName'
    | 'items'
    | 'dueDate'
    | 'total'
    | 'deposit'
    | 'channel'
    | 'depositMethod',
    string
  >
>

export function emptyItem(): ItemDraft {
  return { product: '', quantity: '1', details: '' }
}

export function emptyDraft(): OrderDraft {
  return {
    customerId: null,
    customerName: '',
    customerPhone: '',
    items: [emptyItem()],
    dueDate: '',
    total: '',
    deposit: '',
    channel: null,
    depositMethod: null,
    referenceLink: '',
    notes: '',
    waiting: false,
    waitingReason: '',
    followUpOn: '',
    flexible: false,
    urgent: false,
    ppSand: false,
    ppPaint: false,
  }
}

// "245.500", "245500", "245500,50" → number; '' → null; garbage → NaN.
export function parseMoney(raw: string): number | null {
  const s = raw.trim().replace(/\$/g, '').replace(/\s/g, '')
  if (!s) return null
  const normalized = s.includes(',')
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(/\.(?=\d{3}(\D|$))/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : Number.NaN
}

export function qtyOf(item: ItemDraft): number {
  const n = Math.floor(Number(item.quantity))
  return Number.isFinite(n) && n > 0 ? n : 1
}

export function filledItems(items: readonly ItemDraft[]): ItemDraft[] {
  return items.filter((i) => i.product.trim() !== '')
}

// PRODUCTO column: "10× Vaso 500 ml + 3× Vaso 1 lt".
export function buildTitle(items: readonly ItemDraft[]): string {
  return filledItems(items)
    .map((i) => `${qtyOf(i) > 1 ? `${qtyOf(i)}× ` : ''}${i.product.trim()}`)
    .join(' + ')
}

// DESCRIPCION column: item details (prefixed by product when there are
// several) plus the free notes.
export function buildDescription(
  items: readonly ItemDraft[],
  notes: string,
): string {
  const list = filledItems(items)
  const parts = list
    .filter((i) => i.details.trim())
    .map((i) =>
      list.length > 1
        ? `${i.product.trim()}: ${i.details.trim()}`
        : i.details.trim(),
    )
  if (notes.trim()) parts.push(notes.trim())
  return parts.join(' — ')
}

export function balanceOf(
  draft: Pick<OrderDraft, 'total' | 'deposit'>,
): number | null {
  const total = parseMoney(draft.total)
  if (total === null || Number.isNaN(total)) return null
  const deposit = parseMoney(draft.deposit) ?? 0
  return Number.isNaN(deposit) ? null : Math.max(total - deposit, 0)
}

export function validateDraft(
  draft: OrderDraft,
  opts: { creating?: boolean } = {},
): DraftErrors {
  const errors: DraftErrors = {}
  if (!draft.customerName.trim())
    errors.customerName = 'Poné el nombre del cliente.'
  if (filledItems(draft.items).length === 0)
    errors.items = 'Agregá al menos un producto.'
  // A waiting order may not have a date yet.
  if (!draft.dueDate && !draft.waiting)
    errors.dueDate = 'Elegí la fecha de entrega.'
  const total = parseMoney(draft.total)
  const deposit = parseMoney(draft.deposit)
  if (Number.isNaN(total) || (total !== null && total < 0))
    errors.total = 'Revisá el total.'
  if (Number.isNaN(deposit) || (deposit !== null && deposit < 0))
    errors.deposit = 'Revisá la seña.'
  else if (
    deposit !== null &&
    total !== null &&
    !Number.isNaN(total) &&
    deposit > total
  )
    errors.deposit = 'La seña no puede superar el total.'
  if (opts.creating) {
    if (!draft.channel) errors.channel = 'Elegí el canal.'
    if (deposit !== null && !Number.isNaN(deposit) && deposit > 0) {
      if (!draft.depositMethod)
        errors.depositMethod = 'Elegí cómo pagó la seña.'
      if (total === null)
        errors.total ??= 'Poné el total para registrar la seña.'
    }
  }
  return errors
}
