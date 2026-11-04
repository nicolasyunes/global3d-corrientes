import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OrderModalContext } from './order-modal-context'
import { WebOrdersAlert } from './WebOrdersAlert'
import { listNewWebOrders } from './webOrders'

vi.mock('./webOrders', async (orig) => ({
  ...(await orig<typeof import('./webOrders')>()),
  listNewWebOrders: vi.fn(),
}))

function setup() {
  const openEdit = vi.fn()
  render(
    <MemoryRouter>
      <OrderModalContext.Provider value={{ openNew: vi.fn(), openEdit }}>
        <WebOrdersAlert />
      </OrderModalContext.Provider>
    </MemoryRouter>,
  )
  return { openEdit }
}

describe('WebOrdersAlert', () => {
  beforeEach(() => {
    localStorage.clear()
    document.title = 'Global3D · Taller'
  })

  it('avisa un pedido nuevo de la tienda y "Ver" lo abre', async () => {
    vi.mocked(listNewWebOrders).mockResolvedValue([
      {
        id: 'o1',
        createdAt: '2026-11-04T12:00:00Z',
        total: 22500,
        customer: 'Lucía',
      },
    ])
    const { openEdit } = setup()
    expect(
      await screen.findByText('Pedido nuevo de la tienda'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Lucía/)).toBeInTheDocument()
    expect(document.title).toBe('(1) Global3D · Taller')

    fireEvent.click(screen.getByRole('button', { name: 'Ver' }))
    expect(openEdit).toHaveBeenCalledWith('o1')
    expect(screen.queryByText('Pedido nuevo de la tienda')).toBeNull()
    expect(document.title).toBe('Global3D · Taller')
  })

  it('no vuelve a avisar lo que ya se marcó como visto', async () => {
    const orders = [
      {
        id: 'o1',
        createdAt: '2026-11-04T12:00:00Z',
        total: null,
        customer: null,
      },
      {
        id: 'o2',
        createdAt: '2026-11-04T13:00:00Z',
        total: null,
        customer: null,
      },
    ]
    vi.mocked(listNewWebOrders).mockResolvedValue(orders)
    setup()
    expect(
      await screen.findByText('2 pedidos nuevos de la tienda'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ya lo vi' }))
    expect(localStorage.getItem('g3d.webOrders.seen')).toBe(
      '2026-11-04T13:00:00Z',
    )
  })

  it('sin pedidos nuevos no muestra nada', async () => {
    vi.mocked(listNewWebOrders).mockResolvedValue([])
    setup()
    await vi.waitFor(() => expect(listNewWebOrders).toHaveBeenCalled())
    expect(screen.queryByRole('status')).toBeNull()
  })
})
