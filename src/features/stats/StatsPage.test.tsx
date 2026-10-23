import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StatsPage from './StatsPage'

const api = vi.hoisted(() => ({ loadStats: vi.fn() }))
vi.mock('./stats.api', () => api)
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({ byId: (id: string) => ({ name: id === 'op-2' ? 'sabri' : 'nicolas' }) }),
}))

const current = {
  sales: [
    {
      id: 's1', created_at: '2026-10-08T13:30:00Z', operator_id: 'op-2', color_id: 'c1',
      line_label: '3N3 PLA', color_label: 'Rojo', refill: false, quantity: 2,
      unit_price: 12000, total: 24000, payment: 'cash', customer: 'Juan',
      voided_at: null, voided_by: null, void_reason: null,
    },
    {
      id: 's2', created_at: '2026-10-08T14:00:00Z', operator_id: 'op-1', color_id: 'c2',
      line_label: '3N3 PLA', color_label: 'Azul', refill: false, quantity: 1,
      unit_price: 12000, total: 12000, payment: 'transfer', customer: null,
      voided_at: '2026-10-08T15:00:00Z', voided_by: 'op-1', void_reason: 'error',
    },
  ],
  log: [
    { id: 'l1', created_at: '2026-10-08T12:00:00Z', operator_id: 'op-2', kind: 'transfer', line_label: '3N3 PLA', color_label: 'Rojo', refill: false, delta: -1, note: null },
  ],
  delivered: [
    { id: 'o1', kind: 'order', at: '2026-10-07', exact: false, customerName: 'María', productLabel: 'Trofeo', amount: 55000, method: null, href: '/admin/orders/o1' },
    { id: 't1', kind: 'product', at: '2026-10-07T18:00:00Z', exact: true, customerName: null, productLabel: 'Llavero', amount: 8000, method: 'transfer', href: null },
    { id: 't2', kind: 'product', at: '2026-10-07T19:00:00Z', exact: true, customerName: null, productLabel: 'Imán', amount: 2500, method: 'uala', href: null },
  ],
}
const empty = { sales: [], log: [], delivered: [] }

async function renderPage() {
  render(
    <MemoryRouter>
      <StatsPage />
    </MemoryRouter>,
  )
  await act(async () => {})
}

describe('StatsPage', () => {
  beforeEach(() => {
    api.loadStats.mockReset()
    api.loadStats.mockResolvedValueOnce(current).mockResolvedValueOnce(empty)
  })

  it('arranca en Semana y pide el período y el anterior', async () => {
    await renderPage()
    expect(screen.getByRole('button', { name: 'Semana' })).toHaveAttribute('aria-pressed', 'true')
    expect(api.loadStats).toHaveBeenCalledTimes(2)
  })

  it('totales sin la venta anulada y cobros sumando ventas directas', async () => {
    await renderPage()
    // Some labels repeat as section titles: pick the one inside a tile.
    const tile = (name: string) =>
      screen
        .getAllByText(name)
        .map((el) => el.closest('.st-tile'))
        .find(Boolean) as HTMLElement
    expect(within(tile('Ventas de filamento')).getByText('$24.000')).toBeInTheDocument()
    expect(within(tile('Efectivo esperado')).getByText('$24.000')).toBeInTheDocument()
    expect(within(tile('Transferencias esperadas')).getByText('$8.000')).toBeInTheDocument()
    expect(within(tile('Pedidos entregados')).getByText('1')).toBeInTheDocument()
  })

  it('muestra el monto de otros / sin forma de cobro y la etiqueta en la tabla', async () => {
    await renderPage()
    expect(screen.getByText(/Otros \/ sin forma de cobro/)).toHaveTextContent('$2.500')
    const table = screen.getByRole('table', { name: 'Entregados' })
    expect(within(table).getByText('Ualá')).toBeInTheDocument()
  })

  it('por persona no cuenta las ventas anuladas', async () => {
    await renderPage()
    const table = screen.getByRole('table', { name: 'Por persona' })
    // nicolas only has a voided sale: must not appear; sabri sold 2.
    expect(within(table).queryByText('nicolas')).not.toBeInTheDocument()
    const row = within(table).getByText('sabri').closest('tr') as HTMLElement
    expect(within(row).getAllByRole('cell')[1]).toHaveTextContent('2')
  })

  it('lista las ventas con persona, cobro y la anulada tachada', async () => {
    await renderPage()
    const table = screen.getByRole('table', { name: 'Ventas de filamento' })
    expect(within(table).getByText('sabri')).toBeInTheDocument()
    expect(within(table).getByText('Efectivo')).toBeInTheDocument()
    expect(within(table).getByText(/Anulada: error/)).toBeInTheDocument()
  })

  it('marca la fecha prometida en entregados', async () => {
    await renderPage()
    const table = screen.getByRole('table', { name: 'Entregados' })
    expect(within(table).getByText(/prometida/)).toBeInTheDocument()
  })

  it('cambiar a Mes vuelve a cargar', async () => {
    await renderPage()
    api.loadStats.mockResolvedValue(empty)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mes' }))
    })
    expect(api.loadStats).toHaveBeenCalledTimes(4)
    expect(screen.getAllByText('Sin ventas en este período.').length).toBeGreaterThan(0)
  })

  it('muestra el error de carga', async () => {
    api.loadStats.mockReset()
    api.loadStats.mockRejectedValue(new Error('sin conexión'))
    await renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent('sin conexión')
  })
})
