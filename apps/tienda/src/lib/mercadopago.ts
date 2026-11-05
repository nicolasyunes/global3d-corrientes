import type { ShopSettings } from './types'

// Pago con tarjeta por Mercado Pago (Card Payment Brick). Se ofrece si está
// prendido en shop_settings.mercadopago, o para probar en producción sin que
// lo vean los clientes: entrar una vez con ?mp=prueba (queda en la pestaña).

const TEST_FLAG = 'g3d.mp.prueba'
const SDK = 'https://sdk.mercadopago.com/js/v2'

/** Se llama al abrir la tienda: con ?mp=prueba en cualquier página, queda anotado. */
export function rememberMpTestFlag(
  search: string = typeof window !== 'undefined' ? window.location.search : '',
): void {
  try {
    if (new URLSearchParams(search).get('mp') === 'prueba')
      sessionStorage.setItem(TEST_FLAG, '1')
  } catch {
    // Sin storage solo funciona entrando con el parámetro en el checkout.
  }
}

export function mpAvailable(
  settings: Pick<ShopSettings, 'mercadopago'>,
  search: string = typeof window !== 'undefined' ? window.location.search : '',
): boolean {
  const cfg = settings.mercadopago
  if (!cfg?.publicKey) return false
  if (cfg.enabled) return true
  rememberMpTestFlag(search)
  try {
    return sessionStorage.getItem(TEST_FLAG) === '1'
  } catch {
    return false
  }
}

let sdkPromise: Promise<void> | null = null

/** Carga una sola vez el SDK oficial de Mercado Pago. */
export function loadMpSdk(): Promise<void> {
  if (typeof window !== 'undefined' && 'MercadoPago' in window)
    return Promise.resolve()
  sdkPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SDK
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      sdkPromise = null
      reject(new Error('sdk'))
    }
    document.head.appendChild(s)
  })
  return sdkPromise
}

/** Mensaje para el cliente según el resultado de Mercado Pago. */
export function mpResultMessage(
  status: string | null,
  detail: string | null,
): { ok: boolean; text: string } {
  if (status === 'approved')
    return { ok: true, text: '¡Pago aprobado! Ya arrancamos con tu pedido.' }
  if (status === 'in_process' || status === 'pending')
    return {
      ok: true,
      text: 'Tu pago quedó en revisión. Te avisamos apenas se acredite; no hace falta pagar de nuevo.',
    }
  const reasons: Record<string, string> = {
    cc_rejected_insufficient_amount: 'La tarjeta no tiene fondos suficientes.',
    cc_rejected_bad_filled_security_code: 'Revisá el código de seguridad.',
    cc_rejected_bad_filled_date: 'Revisá la fecha de vencimiento.',
    cc_rejected_bad_filled_other: 'Revisá los datos de la tarjeta.',
    cc_rejected_call_for_authorize:
      'Tenés que autorizar el pago con el banco de tu tarjeta.',
    cc_rejected_card_disabled:
      'La tarjeta está inactiva: llamá al banco para activarla.',
    cc_rejected_duplicated_payment:
      'Ya hiciste un pago igual. Si fue un error, escribinos.',
    cc_rejected_high_risk:
      'Mercado Pago rechazó el pago. Probá con otra tarjeta o pagá por transferencia.',
  }
  return {
    ok: false,
    text:
      (detail && reasons[detail]) ??
      'El pago no se pudo hacer. Probá con otra tarjeta o pagá por transferencia.',
  }
}
