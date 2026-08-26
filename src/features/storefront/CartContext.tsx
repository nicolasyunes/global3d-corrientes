import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Product } from './data/products'
import { lineTotal } from './pricing'
import type { CartLine } from './cart-types'

export type { CartLine }

type CartContextValue = {
  lines: CartLine[]
  count: number
  subtotal: number
  add: (product: Product, color: string | null, engraving: string, qty: number) => void
  inc: (lineId: string) => void
  dec: (lineId: string) => void
  remove: (lineId: string) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = 'global3d.cart.v1'

function lineKey(productId: string, color: string | null, engraving: string): string {
  return [productId, color || '', engraving || ''].join('|')
}

function loadCart(): CartLine[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CartLine[]) : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(loadCart)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  }, [lines])

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((a, l) => a + l.qty, 0)
    const subtotal = lines.reduce((a, l) => a + lineTotal(l), 0)

    return {
      lines,
      count,
      subtotal,
      add: (product, color, engraving, qty) => {
        const key = lineKey(product.id, color, engraving)
        setLines((prev) => {
          const idx = prev.findIndex((l) => l.id === key)
          if (idx >= 0) {
            const next = prev.slice()
            next[idx] = { ...next[idx], qty: next[idx].qty + qty }
            return next
          }
          return [
            ...prev,
            {
              id: key,
              productId: product.id,
              cat: product.cat,
              name: product.name,
              price: product.price,
              color,
              engraving,
              qty,
            },
          ]
        })
      },
      inc: (lineId) => setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, qty: l.qty + 1 } : l))),
      dec: (lineId) =>
        setLines((prev) => prev.map((l) => (l.id === lineId && l.qty > 1 ? { ...l, qty: l.qty - 1 } : l))),
      remove: (lineId) => setLines((prev) => prev.filter((l) => l.id !== lineId)),
      clear: () => setLines([]),
    }
  }, [lines])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}
