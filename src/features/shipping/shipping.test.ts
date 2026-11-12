import { describe, expect, it } from 'vitest'
import {
  boxKey,
  configError,
  DEFAULT_BOXES,
  normalizePostalCode,
  packageError,
  quoteText,
  type ShipRate,
} from './shipping'

describe('envíos del admin', () => {
  it('normaliza el CP', () => {
    expect(normalizePostalCode('w3400abc')).toBe('3400')
    expect(normalizePostalCode('34')).toBeNull()
  })

  it('revisa los límites de MiCorreo', () => {
    const ok = { quantity: 1, weight: 500, height: 10, width: 10, length: 10 }
    expect(packageError(ok)).toBeNull()
    expect(packageError({ ...ok, weight: 0 })).toMatch(/peso/)
    expect(packageError({ ...ok, length: 250 })).toMatch(/200 cm/)
  })

  it('valida la configuración de cajas', () => {
    expect(configError({ cpOrigen: '3400', cajas: DEFAULT_BOXES })).toBeNull()
    expect(configError({ cpOrigen: 'x', cajas: DEFAULT_BOXES })).toMatch(/CP/)
    expect(configError({ cpOrigen: '3400', cajas: [] })).toMatch(/al menos/)
  })

  it('arma claves de caja sin repetir', () => {
    expect(boxKey('Caja Tubo', [])).toBe('caja-tubo')
    expect(boxKey('Caja Tubo', ['caja-tubo'])).toBe('caja-tubo-2')
  })

  it('arma el texto para WhatsApp', () => {
    const rates: ShipRate[] = [
      { deliveredType: 'S', productType: 'CP', productName: 'Correo Argentino Clasico', price: 6890, deliveryTimeMin: '2', deliveryTimeMax: '5' },
      { deliveredType: 'D', productType: 'CP', productName: 'Correo Argentino Clasico', price: 9420, deliveryTimeMin: '2', deliveryTimeMax: '5' },
    ]
    const text = quoteText('1842', rates)
    expect(text).toContain('Envío por Correo Argentino a CP 1842')
    expect(text).toMatch(/A sucursal: Clásico \$\s?6\.890 \(2 a 5 días hábiles\)/)
    expect(text).toMatch(/A domicilio: Clásico \$\s?9\.420/)
  })
})
