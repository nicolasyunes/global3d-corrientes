export type CartLine = {
  id: string // productId|color|engraving
  productId: string
  cat: string
  name: string
  price: number
  color: string | null
  engraving: string
  qty: number
}
