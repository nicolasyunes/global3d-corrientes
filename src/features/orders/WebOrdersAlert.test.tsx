import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WebOrdersAlert } from './WebOrdersAlert'
import {
  confirmWebOrder,
  discardWebOrder,
  listPendingWebOrders,
  type WebOrder,
} from './webOrders'

vi.mock('./webOrders', async (orig) => ({
  ...(await orig<typeof import('./webOrders')>()),
  listPendingWebOrders: vi.fn(),
  confirmWebOrder: vi.fn(),
  discardWebOrder: vi.fn(),
}))

const order = (id: string, createdAt: string, extra: Partial<WebOrder> = {}) =>
  ({
    id,
    code: id.toUpperCase(),
    createdAt,
    customer: 'Lucía Pérez',
    whatsapp: '3794123456',
    total: 22500,
    delivery: { mode: 'retiro' },
    payment: { mode: 'sena', method: 'transfer', deposit: 11250 },
    notes: null,
    items: [
      { description: 'Vaso camiseta', personalization: 'Facu', quantity: 1 },
    ],
    ...extra,
  }) as WebOrder

function setup() {
  render(
    <MemoryRouter>
      <WebOrdersAlert />
    </MemoryRouter>,
  )
}

describe('WebOrdersAlert', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    document.title = 'Global3D · Taller'
  })

  it('avisa un pedido nuevo por confirmar y lo confirma desde el panel', async () => {
    vi.mocked(listPendingWebOrders).mockResolvedValue([
      order('a1', '2026-11-05T12:00:00Z'),
    ])
    vi.mocked(confirmWebOrder).mockResolvedValue(true)
    setup()
    expect(
      await screen.findByText('Pedido de la tienda por confirmar'),
    ).toBeInTheDocument()
    expect(document.title).toBe('(1) Global3D · Taller')

    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('1 × Vaso camiseta (Facu)')
    expect(dialog).toHaveTextContent('seña')
    expect(
      screen.getByRole('link', { name: 'WhatsApp' }).getAttribute('href'),
    ).toContain('https://wa.me/5493794123456')

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await vi.waitFor(() => expect(confirmWebOrder).toHaveBeenCalledWith('a1'))
  })

  it('después de verlos queda una pastilla con los pendientes', async () => {
    vi.mocked(listPendingWebOrders).mockResolvedValue([
      order('a1', '2026-11-05T12:00:00Z'),
      order('b2', '2026-11-05T13:00:00Z'),
    ])
    setup()
    expect(
      await screen.findByText('2 pedidos de la tienda por confirmar'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Después' }))
    expect(
      screen.getByRole('button', { name: /Tienda: 2 por confirmar/ }),
    ).toBeInTheDocument()
    expect(document.title).toBe('Global3D · Taller')
  })

  it('descartar pide confirmación', async () => {
    vi.mocked(listPendingWebOrders).mockResolvedValue([
      order('a1', '2026-11-05T12:00:00Z'),
    ])
    vi.mocked(discardWebOrder).mockResolvedValue(true)
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false)
    setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(ask).toHaveBeenCalled()
    expect(discardWebOrder).not.toHaveBeenCalled()
    ask.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    await vi.waitFor(() => expect(discardWebOrder).toHaveBeenCalledWith('a1'))
  })

  it('sin pendientes no muestra nada, y si la base falla tampoco', async () => {
    vi.mocked(listPendingWebOrders).mockRejectedValue(new Error('no existe'))
    setup()
    await vi.waitFor(() => expect(listPendingWebOrders).toHaveBeenCalled())
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
