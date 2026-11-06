import { useSyncExternalStore } from 'react'

// Carrito del visitante, guardado en este navegador. No es estado compartido:
// el pedido real se crea en Supabase recién al confirmar el checkout.

export interface CartItem {
  key: string
  familySlug: string
  productId: string | null
  name: string
  variantLabel: string
  image: string | null
  unitPrice: number | null
  minQty: number
  leadDays: number
  stock: number
  quantity: number
  personalization: Record<string, string>
  /** "Nombre: Facu · Frase: …", lo que viaja al pedido */
  personalizationText: string
}

const STORAGE_KEY = 'g3d.tienda.cart.v1'
const listeners = new Set<() => void>()

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as CartItem[]) : []
  } catch {
    return []
  }
}

let items: CartItem[] = load()

function save(next: CartItem[]) {
  items = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Sin almacenamiento (modo privado): el carrito vive en memoria
  }
  listeners.forEach((l) => l())
}

// Otra pestaña cambió el carrito
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      items = load()
      listeners.forEach((l) => l())
    }
  })
}

export function itemKey(
  familySlug: string,
  productId: string | null,
  perso: Record<string, string>,
): string {
  const p = Object.entries(perso)
    .filter(([, v]) => v.trim())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v.trim()}`)
    .join('|')
  return `${familySlug}:${productId ?? '-'}:${p}`
}

export const cart = {
  add(item: Omit<CartItem, 'key'>) {
    const key = itemKey(item.familySlug, item.productId, item.personalization)
    const existing = items.find((i) => i.key === key)
    if (existing) {
      save(
        items.map((i) =>
          i.key === key ? { ...i, quantity: i.quantity + item.quantity } : i,
        ),
      )
    } else {
      save([...items, { ...item, key }])
    }
  },
  setQuantity(key: string, quantity: number) {
    save(
      items.map((i) =>
        i.key === key
          ? { ...i, quantity: Math.max(i.minQty, Math.min(500, quantity)) }
          : i,
      ),
    )
  },
  remove(key: string) {
    save(items.filter((i) => i.key !== key))
  },
  clear() {
    save([])
  },
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useCart(): CartItem[] {
  return useSyncExternalStore(
    subscribe,
    () => items,
    () => items,
  )
}

export function cartCount(list: CartItem[]): number {
  return list.reduce((a, i) => a + i.quantity, 0)
}

export function cartTotal(list: CartItem[]): number {
  return list.reduce((a, i) => a + (i.unitPrice ?? 0) * i.quantity, 0)
}

export function cartHasQuote(list: CartItem[]): boolean {
  return list.some((i) => i.unitPrice === null)
}

/** "Nombre: Facu · Frase: …" para guardar en el pedido */
export function personalizationText(
  perso: Record<string, string>,
  labels: Record<string, string>,
): string {
  return Object.entries(perso)
    .filter(([, v]) => v.trim())
    .map(
      ([k, v]) =>
        `${(labels[k] ?? k).replace(/\s*\(opcional\)\s*/i, '')}: ${v.trim()}`,
    )
    .join(' · ')
}
