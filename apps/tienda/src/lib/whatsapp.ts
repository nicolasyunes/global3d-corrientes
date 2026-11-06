import type { CartItem } from './cart'
import { ars } from './format'
import type { DeliveryMode, PaymentMethod, PaymentMode } from './types'

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
}

export const DELIVERY_LABEL: Record<DeliveryMode, string> = {
  retiro: 'Retiro en el local',
  corrientes: 'Envío en Corrientes',
  pais: 'Envío al resto del país',
}

/** Mensaje que el cliente nos manda al terminar el pedido */
export function orderMessage(args: {
  code: string
  items: CartItem[]
  total: number
  deposit: number
  quote: boolean
  payMode: PaymentMode
  method: PaymentMethod
  delivery: DeliveryMode
  address: string
  /** Envío por Correo Argentino cotizado */
  shipping?: { label: string; price: number }
  trackingUrl: string
  name: string
}): string {
  const lines = args.items.map((i) => {
    const price =
      i.unitPrice === null ? 'a cotizar' : ars(i.unitPrice * i.quantity)
    const extra = [i.variantLabel, i.personalizationText]
      .filter(Boolean)
      .join(' · ')
    return `• ${i.quantity} × ${i.name}${extra ? ` (${extra})` : ''} — ${price}`
  })
  const pay =
    args.method === 'cash'
      ? 'Pago en efectivo al retirar'
      : args.method === 'mercadopago'
        ? `Pago con tarjeta (Mercado Pago): ${ars(args.payMode === 'sena' ? args.deposit : args.total)}`
        : args.payMode === 'sena'
          ? `Transfiero la seña: ${ars(args.deposit)}`
          : `Transfiero el total: ${ars(args.total)}`
  const entrega =
    args.delivery === 'retiro'
      ? DELIVERY_LABEL.retiro
      : args.shipping
        ? `Correo Argentino, ${args.shipping.label} (${ars(args.shipping.price)}): ${args.address}`
        : `${DELIVERY_LABEL[args.delivery]}: ${args.address}`
  return [
    `¡Hola Global3D! Soy ${args.name} e hice el pedido #${args.code} en la web:`,
    '',
    ...lines,
    '',
    `Total: ${ars(args.total)}${args.quote ? ' + ítems a cotizar' : ''}`,
    pay,
    entrega,
    '',
    args.method === 'transfer' ? 'Te mando el comprobante por acá.' : '',
    `Seguimiento: ${args.trackingUrl}`,
  ]
    .filter((l, idx, arr) => !(l === '' && arr[idx - 1] === ''))
    .join('\n')
}
