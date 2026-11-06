import { beforeEach, describe, expect, it } from 'vitest'
import { mpAvailable, mpResultMessage } from './mercadopago'

const KEY = 'APP_USR-test'

describe('Mercado Pago en la tienda', () => {
  beforeEach(() => sessionStorage.clear())

  it('apagado no se ofrece, salvo con ?mp=prueba (queda en la pestaña)', () => {
    const off = { mercadopago: { enabled: false, publicKey: KEY } }
    expect(mpAvailable(off, '')).toBe(false)
    expect(mpAvailable(off, '?mp=prueba')).toBe(true)
    expect(mpAvailable(off, '')).toBe(true)
  })

  it('prendido se ofrece; sin clave nunca', () => {
    expect(
      mpAvailable({ mercadopago: { enabled: true, publicKey: KEY } }, ''),
    ).toBe(true)
    expect(
      mpAvailable(
        { mercadopago: { enabled: true, publicKey: '' } },
        '?mp=prueba',
      ),
    ).toBe(false)
    expect(mpAvailable({}, '?mp=prueba')).toBe(false)
  })

  it('mensajes según el resultado', () => {
    expect(mpResultMessage('approved', 'accredited').ok).toBe(true)
    expect(mpResultMessage('in_process', null).text).toMatch(/revisión/)
    expect(
      mpResultMessage('rejected', 'cc_rejected_bad_filled_security_code').text,
    ).toBe('Revisá el código de seguridad.')
    const unknown = mpResultMessage(null, null)
    expect(unknown.ok).toBe(false)
    expect(unknown.text).toMatch(/transferencia/)
  })
})
