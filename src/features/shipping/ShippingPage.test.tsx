import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_BOXES } from './shipping'

const { quoteMock, saveMock, admin } = vi.hoisted(() => ({
  quoteMock: vi.fn(),
  saveMock: vi.fn(),
  admin: { value: false },
}))

vi.mock('./shipping.api', () => ({
  getCorreoConfig: vi
    .fn()
    .mockResolvedValue({ cpOrigen: '3400', cajas: DEFAULT_BOXES }),
  saveCorreoConfig: saveMock,
  quotePackages: quoteMock,
}))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({ current: { id: 'op-1' }, isAdmin: admin.value }),
}))

import ShippingPage from './ShippingPage'

const RATES = [
  { deliveredType: 'S', productType: 'CP', productName: 'Correo Argentino Clasico', price: 6890, deliveryTimeMin: '2', deliveryTimeMax: '5' },
  { deliveredType: 'D', productType: 'CP', productName: 'Correo Argentino Clasico', price: 9420, deliveryTimeMin: '2', deliveryTimeMax: '5' },
  { deliveredType: 'D', productType: 'EP', productName: 'Correo Argentino Expreso', price: 14980, deliveryTimeMin: '1', deliveryTimeMax: '3' },
]

beforeEach(() => {
  vi.clearAllMocks()
  admin.value = false
  quoteMock.mockResolvedValue({ ok: true, postalCode: '1842', rates: RATES })
  saveMock.mockResolvedValue(undefined)
})

describe('ShippingPage', () => {
  it('cotiza con las cajas elegidas y muestra sucursal y domicilio', async () => {
    render(<ShippingPage />)
    await screen.findByText('Caja chica')
    fireEvent.change(screen.getByLabelText('Código postal'), {
      target: { value: 'B1842ZAB' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Una caja grande más' }))
    fireEvent.click(screen.getByRole('button', { name: /Cotizar/ }))

    await screen.findByText('A CP 1842')
    expect(quoteMock).toHaveBeenCalledWith('1842', [
      { quantity: 1, weight: 500, height: 10, width: 15, length: 20 },
      { quantity: 1, weight: 4000, height: 30, width: 30, length: 40 },
    ])
    expect(screen.getByText('A sucursal')).toBeInTheDocument()
    expect(screen.getByText('A domicilio')).toBeInTheDocument()
    expect(screen.getAllByText('Clásico')).toHaveLength(2)
    expect(screen.getByText('Expreso')).toBeInTheDocument()
    expect(screen.getByText(/6\.890/)).toBeInTheDocument()
  })

  it('con medidas a mano avisa si se pasan del límite de Correo', async () => {
    render(<ShippingPage />)
    await screen.findByText('Caja chica')
    fireEvent.click(screen.getByRole('button', { name: 'Medidas a mano' }))
    fireEvent.change(screen.getByLabelText('Código postal'), {
      target: { value: '1704' },
    })
    for (const [label, v] of [
      ['Peso (g)', '2000'],
      ['Largo (cm)', '150'],
      ['Ancho (cm)', '100'],
      ['Alto (cm)', '80'],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value: v } })
    fireEvent.click(screen.getByRole('button', { name: /Cotizar/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('300 cm')
    expect(quoteMock).not.toHaveBeenCalled()
  })

  it('muestra el error de Correo', async () => {
    quoteMock.mockResolvedValue({ ok: false, error: 'correo_no_configurado' })
    render(<ShippingPage />)
    await screen.findByText('Caja chica')
    fireEvent.change(screen.getByLabelText('Código postal'), {
      target: { value: '1704' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Cotizar/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('MICORREO')
  })

  it('solo el admin edita las cajas', async () => {
    const { unmount } = render(<ShippingPage />)
    await screen.findByText('Caja chica')
    expect(screen.queryByText('Editar cajas y CP de origen')).toBeNull()
    unmount()

    admin.value = true
    render(<ShippingPage />)
    fireEvent.click(await screen.findByText('Editar cajas y CP de origen'))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(saveMock).toHaveBeenCalledWith({
        cpOrigen: '3400',
        cajas: DEFAULT_BOXES,
      }),
    )
  })
})
