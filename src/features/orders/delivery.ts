export type DeliveryKind = 'pickup' | 'shipping'

export interface DeliveryFields {
  delivery_kind: string | null
  delivery_place: string | null
  delivery_time: string | null
  delivery_person: string | null
  delivery_note: string | null
}

export const DELIVERY_LABEL: Record<DeliveryKind, string> = {
  pickup: 'Retira en el local',
  shipping: 'Envío',
}

export function hasDelivery(o: DeliveryFields): boolean {
  return Boolean(
    o.delivery_kind ||
    o.delivery_place?.trim() ||
    o.delivery_time ||
    o.delivery_person?.trim() ||
    o.delivery_note?.trim(),
  )
}

// One line for lists: "Envío · Av. Libertad 1234 · 17:00" or "Retira Ana ·
// 16:00". Empty when nothing was filled in.
export function deliveryLine(o: DeliveryFields): string {
  const parts: string[] = []
  const place = o.delivery_place?.trim()
  const person = o.delivery_person?.trim()
  if (o.delivery_kind === 'shipping') {
    parts.push('Envío')
    if (place) parts.push(place)
    if (person) parts.push(`recibe ${person}`)
  } else if (o.delivery_kind === 'pickup') {
    parts.push(person ? `Retira ${person}` : 'Retira en el local')
    if (place) parts.push(place)
  } else {
    if (place) parts.push(place)
    if (person) parts.push(person)
  }
  if (o.delivery_time) parts.push(`a las ${o.delivery_time}`)
  return parts.join(' · ')
}

export function deliveryNote(o: DeliveryFields): string {
  return o.delivery_note?.trim() ?? ''
}

// "9:30", "17", "1730" and "17.30" are common ways to type an hour: all
// become HH:MM. Anything that is not a valid time gives ''.
export function normalizeTime(raw: string): string {
  const s = raw.trim().replace(/\s/g, '')
  if (!s) return ''
  let h: number
  let min = 0
  const compact = /^(\d{1,2})(\d{2})$/.exec(s)
  const split = /^(\d{1,2})[:.h](\d{1,2})$/.exec(s)
  if (compact) {
    h = Number(compact[1])
    min = Number(compact[2])
  } else if (split) {
    h = Number(split[1])
    min = Number(split[2])
  } else if (/^\d{1,2}$/.test(s)) {
    h = Number(s)
  } else return ''
  if (h > 23 || min > 59) return ''
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}
