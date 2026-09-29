import { supabase } from '@/lib/supabase'
import {
  PRODUCT_TYPE_LABELS,
  type OriginChannel,
  type ProductType,
} from '@/lib/domain-constants'
import {
  balanceOf,
  buildDescription,
  buildTitle,
  filledItems,
  parseMoney,
  qtyOf,
  type ItemDraft,
  type OrderDraft,
} from './orderDraft'
import { piecesForItem } from '@/features/products/parts'
import { DEFAULT_WAITING_REASON, followUpFrom } from './orderFlow'
import { toISODate } from './validation'
import type { OrderRow } from './orders.api'

export interface CustomerHit {
  id: string
  name: string
  phone: string | null
}

export async function searchCustomers(query: string): Promise<CustomerHit[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone')
    .ilike('name', `%${q.replace(/[%_]/g, '')}%`)
    .order('updated_at', { ascending: false })
    .limit(6)
  if (error) throw error
  return data ?? []
}

// Products typed before (and catalog names) as optional suggestions — never a
// closed list: anything new can be typed freely.
export async function listProductSuggestions(): Promise<string[]> {
  const [items, products] = await Promise.all([
    supabase
      .from('order_items')
      .select('description')
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('products').select('name').eq('active', true).limit(300),
  ])
  const names = [
    ...(items.data ?? []).map((r) => r.description),
    ...(products.data ?? []).map((r) => r.name),
  ]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s))
  return [...new Set(names)].slice(0, 200)
}

function orderFields(draft: OrderDraft) {
  const items = filledItems(draft.items)
  return {
    title: buildTitle(items),
    description: buildDescription(items, draft.notes) || null,
    observations: draft.notes.trim() || null,
    // due_date is required; a waiting order without one gets a placeholder
    // two weeks out (it's replaced when the order is confirmed).
    due_date: draft.dueDate || followUpFrom(toISODate(new Date()), 14),
    total_amount: parseMoney(draft.total),
    deposit: parseMoney(draft.deposit),
    pending_balance: balanceOf(draft),
    origin_channel: draft.channel,
    reference_link: draft.referenceLink.trim() || null,
    waiting_reason: draft.waiting
      ? draft.waitingReason.trim() || DEFAULT_WAITING_REASON
      : null,
    follow_up_on: draft.waiting
      ? draft.followUpOn || followUpFrom(toISODate(new Date()))
      : null,
    flexible: draft.flexible,
  }
}

export function sameName(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
  return norm(a) === norm(b)
}

async function resolveCustomer(draft: OrderDraft): Promise<string> {
  const name = draft.customerName.trim()
  const phone = draft.customerPhone.trim() || null
  if (draft.customerId) {
    const { error } = await supabase
      .from('customers')
      .update({ name, phone })
      .eq('id', draft.customerId)
    if (error) throw error
    return draft.customerId
  }
  // Reuse a customer by phone only when the name also matches: the name typed
  // in the modal must always be the one saved on the order.
  if (phone) {
    const { data } = await supabase
      .from('customers')
      .select('id, name')
      .eq('phone', phone)
    const same = (data ?? []).find((c) => sameName(c.name, name))
    if (same) return same.id
  }
  const { data, error } = await supabase
    .from('customers')
    .insert({ name, phone })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

// Copies each new item's preset parts into the order's checklist.
async function insertPresetPieces(
  orderId: string,
  created: { id: string; item: ItemDraft }[],
  operatorId: string | null,
): Promise<void> {
  if (created.length === 0) return
  const { count } = await supabase
    .from('order_production_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId)
  let position = count ?? 0
  // An item without parts still has to show up in "¿Qué imprimo?", so it
  // becomes a single piece named after the product.
  const rows = created.flatMap(({ id, item }) =>
    (item.parts?.length
      ? piecesForItem(item.parts, qtyOf(item))
      : [{ label: item.product.trim(), color: null, quantity: qtyOf(item) }]
    ).map((piece) => ({
      order_id: orderId,
      order_item_id: id,
      label: piece.label,
      color: piece.color,
      quantity_total: piece.quantity,
      position: position++,
      updated_by: operatorId,
    })),
  )
  const { error } = await supabase.from('order_production_tasks').insert(rows)
  if (error) throw error
}

export async function createOrderFromDraft(
  draft: OrderDraft,
  operatorId: string | null = null,
): Promise<OrderRow> {
  const customerId = await resolveCustomer(draft)
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      customer_id: customerId,
      product_type: 'other',
      ...orderFields(draft),
    })
    .select('*')
    .single()
  if (error) throw error

  const filled = filledItems(draft.items)
  const items = filled.map((item, position) => ({
    order_id: order.id,
    product_type: 'other',
    product_id: item.productId ?? null,
    description: item.product.trim(),
    personalization: item.details.trim() || null,
    quantity: qtyOf(item),
    position,
  }))
  const { data: inserted, error: itemsError } = await supabase
    .from('order_items')
    .insert(items)
    .select('id, position')
  if (itemsError) throw itemsError
  await insertPresetPieces(
    order.id,
    (inserted ?? []).map((row) => ({ id: row.id, item: filled[row.position] })),
    operatorId,
  )
  return order
}

// Item-by-item upsert: replacing all items would cascade-delete the pieces
// already registered against them.
export async function updateOrderFromDraft(
  orderId: string,
  draft: OrderDraft,
  operatorId: string | null = null,
): Promise<OrderRow> {
  const customerId = await resolveCustomer(draft)
  const { data: order, error } = await supabase
    .from('orders')
    .update({ customer_id: customerId, ...orderFields(draft) })
    .eq('id', orderId)
    .select('*')
    .single()
  if (error) throw error

  const { data: existing, error: listError } = await supabase
    .from('order_items')
    .select('id')
    .eq('order_id', orderId)
  if (listError) throw listError

  const items = filledItems(draft.items)
  const keep = new Set(items.map((i) => i.id).filter(Boolean))
  const removed = (existing ?? [])
    .filter((row) => !keep.has(row.id))
    .map((row) => row.id)
  if (removed.length) {
    const { error: delError } = await supabase
      .from('order_items')
      .delete()
      .in('id', removed)
    if (delError) throw delError
  }

  const added: { id: string; item: ItemDraft }[] = []
  for (const [position, item] of items.entries()) {
    const fields = {
      description: item.product.trim(),
      personalization: item.details.trim() || null,
      quantity: qtyOf(item),
      position,
    }
    if (item.id) {
      const { error: itemError } = await supabase
        .from('order_items')
        .update(fields)
        .eq('id', item.id)
      if (itemError) throw itemError
    } else {
      const { data: row, error: itemError } = await supabase
        .from('order_items')
        .insert({
          ...fields,
          order_id: orderId,
          product_type: 'other',
          product_id: item.productId ?? null,
        })
        .select('id')
        .single()
      if (itemError) throw itemError
      added.push({ id: row.id, item })
    }
  }
  await insertPresetPieces(orderId, added, operatorId)
  return order
}

export async function loadDraft(orderId: string): Promise<OrderDraft> {
  const [{ data: order, error }, { data: items, error: itemsError }] =
    await Promise.all([
      supabase
        .from('orders')
        .select('*, customers(id, name, phone)')
        .eq('id', orderId)
        .single(),
      supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('position'),
    ])
  if (error) throw error
  if (itemsError) throw itemsError
  const customer = (order as unknown as { customers: CustomerHit | null })
    .customers
  const fromItems = (items ?? []).map((i) => ({
    id: i.id,
    product: i.description,
    quantity: String(i.quantity),
    details: i.personalization ?? '',
    productId: i.product_id,
  }))
  const legacyProduct =
    order.title ??
    PRODUCT_TYPE_LABELS[order.product_type as ProductType] ??
    order.product_type
  const money = (v: number | null) => (v === null ? '' : String(v))
  return {
    customerId: customer?.id ?? null,
    customerName: customer?.name ?? '',
    customerPhone: customer?.phone ?? '',
    items: fromItems.length
      ? fromItems
      : [
          {
            product: legacyProduct,
            quantity: '1',
            details: order.personalization ?? '',
          },
        ],
    dueDate: order.due_date,
    total: money(order.total_amount),
    deposit: money(order.deposit),
    channel: (order.origin_channel as OriginChannel | null) ?? null,
    referenceLink: order.reference_link ?? '',
    notes: order.observations ?? '',
    waiting: Boolean(order.waiting_reason),
    waitingReason: order.waiting_reason ?? '',
    followUpOn: order.follow_up_on ?? '',
    flexible: order.flexible ?? false,
  }
}
