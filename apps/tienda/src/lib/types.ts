// Formas que devuelven las funciones shop_* de Supabase.

export type SaleMode = 'stock' | 'a_pedido' | 'cotizacion'

export interface OptionAxis {
  key: string
  label: string
}

export interface PersonalizationField {
  key: string
  label: string
  type: 'text'
  max?: number
  required?: boolean
  placeholder?: string
}

export interface Variant {
  id: string
  name: string
  description: string | null
  options: Record<string, string>
  price: number
  stock: number
  images: string[]
}

export interface Family {
  slug: string
  name: string
  category: string
  description: string | null
  saleMode: SaleMode
  leadDays: number
  minQty: number
  optionAxes: OptionAxis[]
  personalization: PersonalizationField[]
  priceFrom: number | null
  featured: boolean
  /** Fotos propias de la familia; se usan si sus productos no tienen fotos */
  images?: string[]
  variants: Variant[]
}

export interface FilamentColor {
  id: string
  name: string
  swatch: string | null
  finish: string | null
  price: number
  stock: number
  refillStock: number
}

export interface FilamentLine {
  id: string
  brand: string
  name: string
  material: string
  presentation: string
  price: number
  refillPrice: number | null
  colors: FilamentColor[]
}

export interface ShopSettings {
  whatsapp: string
  instagram: string
  local: { direccion: string; horarios: string; mapsQuery: string }
  transferencia: { alias: string; cbu: string; titular: string; banco: string }
  sena: { porcentaje: number }
  envios: { corrientes: string; pais: string }
  /** Links de publicaciones elegidas a mano; se usan si no hay token de la API */
  instagram_posts?: string[]
  /** Pago con tarjeta; apagado hasta que se active (ver lib/mercadopago.ts) */
  mercadopago?: { enabled: boolean; publicKey: string }
  /** % de descuento pagando en efectivo o transferencia */
  descuento_efectivo?: { porcentaje: number }
  /** Reseñas de Google elegidas a mano y link para dejar una (ver lib/reviews.ts) */
  resenas?: ReviewSettings
}

export interface ReviewSettings {
  /** Place ID de Google del local; arma el link directo al formulario de reseña */
  placeId?: string
  /** Nota promedio en Google (1 a 5) */
  nota?: number
  /** Cantidad de reseñas en Google */
  total?: number
  items?: ShopReview[]
}

export interface ShopReview {
  nombre: string
  texto: string
  estrellas: number
  /** Texto libre, como lo muestra Google: "hace 2 meses" */
  fecha?: string
}

export interface InstagramPost {
  id: string
  url: string
  image: string
  isVideo: boolean
  caption: string
  date: string
}

export type DeliveryMode = 'retiro' | 'corrientes' | 'pais'
export type PaymentMode = 'sena' | 'total'
export type PaymentMethod = 'transfer' | 'cash' | 'mercadopago'

export interface CreateOrderInput {
  customer: { name: string; whatsapp: string }
  items: Array<{
    productId?: string
    familySlug?: string
    quantity: number
    personalization?: string
  }>
  delivery: { mode: DeliveryMode; address?: string }
  payment: { mode: PaymentMode; method: PaymentMethod }
  notes?: string
}

export interface CreateOrderResult {
  token: string
  code: string
  total: number
  deposit: number
  quote: boolean
  dueDate: string
}

export type OrderStatus =
  | 'new'
  | 'in_queue'
  | 'printing'
  | 'post_processing'
  | 'finished'
  | 'delivered'
  | 'cancelled'

export interface OrderStatusResult {
  code: string
  status: OrderStatus
  /** El taller todavía no lo confirmó (se cancela solo a las 72 h) */
  pendingConfirmation?: boolean
  createdAt: string
  dueDate: string
  total: number | null
  deposit: number
  pendingBalance: number | null
  customerFirstName: string
  delivery: { mode: DeliveryMode; address: string | null }
  payment: { mode: PaymentMode; method: PaymentMethod; deposit: number }
  items: Array<{
    description: string
    personalization: string | null
    quantity: number
    unitPrice: number | null
  }>
}
