export const WHATSAPP_NUMBER = '543794684473'

export function waHref(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}
