import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  eventDate,
  initialRecipient,
  isCorreoShipping,
  recipientError,
  shipmentErrorMessage,
  type SavedShipping,
} from './shipment'

const { getMock, importMock, trackMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  importMock: vi.fn(),
  trackMock: vi.fn(),
}))
vi.mock('./shipment.api', () => ({
  getOrderShipment: getMock,
  importShipment: importMock,
  refreshTracking: trackMock,
}))

import OrderShipment from './OrderShipment'

const HOME: SavedShipping = {
  carrier: 'correo_argentino',
  type: 'D',
  productName: 'Correo Argentino Clasico',
  price: 9420,
  postalCode: '1842',
  recipient: {
    email: 'ana@mail.com',
    province: 'B',
    street: 'Vicente Lopez',
    number: '448',
    city: 'Monte Grande',
  },
}

const IMPORTED = {
  order_id: 'o1',
  ext_order_id: 'G3D-ABC123',
  imported_at: '2026-11-12T19:00:00Z',
  tracking_number: null,
  tracking_events: [],
  tracking_checked_at: null,
  last_error: null,
}

describe('datos del envío', () => {
  it('solo los pedidos cotizados con Correo', () => {
    expect(isCorreoShipping(HOME)).toBe(true)
    expect(isCorreoShipping({ ...HOME, carrier: 'andreani' })).toBe(false)
    expect(isCorreoShipping(null)).toBe(false)
  })
  it('arma el formulario con lo guardado y el cliente', () => {
    const r = initialRecipient(HOME, {
      name: 'Ana Gómez',
      whatsapp: '3794123456',
    })
    expect(r).toMatchObject({
      name: 'Ana Gómez',
      phone: '3794123456',
      street: 'Vicente Lopez',
      province: 'B',
    })
    expect(recipientError(r, 'D')).toBeNull()
    expect(recipientError({ ...r, email: '' }, 'D')).toMatch(/email/)
    expect(recipientError({ ...r, street: '' }, 'D')).toMatch(/calle/)
    expect(recipientError({ ...r, street: '' }, 'S')).toBeNull()
  })
  it('traduce errores y fechas', () => {
    expect(shipmentErrorMessage('micorreo', 'Verifique la sucursal')).toBe(
      'MiCorreo lo rechazó: Verifique la sucursal',
    )
    expect(shipmentErrorMessage('correo_no_configurado')).toMatch(
      /credenciales/,
    )
    expect(eventDate('28-08-2024 10:33')).toBe('28/08 10:33')
  })
})

describe('tarjeta Envío por Correo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('no aparece si el pedido no es de Correo', async () => {
    getMock.mockResolvedValue({ shipping: null, shipment: null })
    const { container } = render(
      <OrderShipment orderId="o1" customer={{ name: 'Ana' }} />,
    )
    await waitFor(() => expect(getMock).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  it('crea el envío con los datos (corregidos) del destinatario', async () => {
    getMock
      .mockResolvedValueOnce({ shipping: HOME, shipment: null })
      .mockResolvedValue({ shipping: HOME, shipment: IMPORTED })
    importMock.mockResolvedValue({
      ok: true,
      imported: true,
      already: false,
      extOrderId: 'G3D-ABC123',
    })
    render(
      <OrderShipment
        orderId="o1"
        customer={{ name: 'Ana Gómez', phone: '3794123456' }}
      />,
    )
    const piso = await screen.findByLabelText('Piso')
    fireEvent.change(piso, { target: { value: '2' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Crear envío en Correo' }),
    )
    await waitFor(() => expect(importMock).toHaveBeenCalled())
    expect(importMock.mock.calls[0]).toEqual([
      'o1',
      expect.objectContaining({
        name: 'Ana Gómez',
        email: 'ana@mail.com',
        floor: '2',
        province: 'B',
      }),
    ])
    expect(await screen.findByText('G3D-ABC123')).toBeInTheDocument()
    expect(screen.getByText('En MiCorreo')).toBeInTheDocument()
  })

  it('sin email no llama a MiCorreo', async () => {
    getMock.mockResolvedValue({
      shipping: { ...HOME, recipient: { ...HOME.recipient, email: undefined } },
      shipment: null,
    })
    render(<OrderShipment orderId="o1" customer={{ name: 'Ana Gómez' }} />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Crear envío en Correo' }),
    )
    expect(importMock).not.toHaveBeenCalled()
    expect(screen.getByText(/Falta el email/)).toBeInTheDocument()
  })

  it('muestra el rechazo de MiCorreo', async () => {
    getMock.mockResolvedValue({ shipping: HOME, shipment: null })
    importMock.mockResolvedValue({
      ok: false,
      error: 'micorreo',
      message: 'La provincia es invalida.',
    })
    render(<OrderShipment orderId="o1" customer={{ name: 'Ana Gómez' }} />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Crear envío en Correo' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'MiCorreo lo rechazó: La provincia es invalida.',
    )
  })

  it('guarda el número de seguimiento y muestra los movimientos', async () => {
    getMock.mockResolvedValue({ shipping: HOME, shipment: IMPORTED })
    trackMock.mockResolvedValue({
      ok: true,
      trackingNumber: '000500076393019A3G0C701',
      events: [
        {
          event: 'PREIMPOSICION',
          date: '28-08-2024 10:33',
          branch: 'CORREO ARGENTINO',
          status: '',
        },
      ],
      checkedAt: '2026-11-12T20:00:00Z',
    })
    render(<OrderShipment orderId="o1" customer={{ name: 'Ana Gómez' }} />)
    fireEvent.change(await screen.findByLabelText('Número de seguimiento'), {
      target: { value: '000500076393019a3g0c701' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y seguir' }))
    await waitFor(() =>
      expect(trackMock).toHaveBeenCalledWith('o1', '000500076393019a3g0c701'),
    )
    expect(await screen.findByText('PREIMPOSICION')).toBeInTheDocument()
  })
})
