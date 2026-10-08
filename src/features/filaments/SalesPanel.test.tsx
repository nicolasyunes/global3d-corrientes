import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SalesPanel from './SalesPanel'

const api = vi.hoisted(() => ({
  listFilamentSales: vi.fn(),
  voidFilamentSale: vi.fn(),
}))
vi.mock('./filaments.api', () => api)
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({
    current: { id: 'admin-1' },
    byId: () => ({ name: 'sabri' }),
  }),
}))

const sale = {
  id: 's1',
  created_at: '2026-10-08T15:30:00Z',
  operator_id: 'op-2',
  color_id: 'c1',
  line_label: '3N3 PLA',
  color_label: 'Rojo',
  refill: false,
  quantity: 2,
  unit_price: 12000,
  total: 24000,
  payment: 'cash',
  customer: 'Juan',
  voided_at: null,
  voided_by: null,
  void_reason: null,
}

describe('SalesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listFilamentSales.mockResolvedValue([sale])
    api.voidFilamentSale.mockResolvedValue({ ...sale, voided_at: 'x', void_reason: 'error' })
  })

  it('lista la venta con persona, total y forma de cobro', async () => {
    render(<SalesPanel reloadKey={0} onChanged={vi.fn()} />)
    expect(await screen.findByText(/Rojo · 3N3 PLA/)).toBeInTheDocument()
    expect(screen.getByText(/sabri/)).toBeInTheDocument()
    expect(screen.getByText(/\$24\.000/)).toBeInTheDocument()
    expect(screen.getByText(/Efectivo/)).toBeInTheDocument()
  })

  it('anular pide motivo y llama a la base', async () => {
    const onChanged = vi.fn()
    render(<SalesPanel reloadKey={0} onChanged={onChanged} />)
    fireEvent.click(await screen.findByRole('button', { name: /Anular venta/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Escribí el motivo')
    fireEvent.change(screen.getByLabelText('Motivo de la anulación'), {
      target: { value: 'cargada de más' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }))
    })
    await waitFor(() =>
      expect(api.voidFilamentSale).toHaveBeenCalledWith('s1', 'admin-1', 'cargada de más'),
    )
    expect(onChanged).toHaveBeenCalled()
  })

  it('una venta anulada se ve tachada y sin botón', async () => {
    api.listFilamentSales.mockResolvedValue([
      { ...sale, voided_at: '2026-10-08T16:00:00Z', void_reason: 'error' },
    ])
    render(<SalesPanel reloadKey={0} onChanged={vi.fn()} />)
    expect(await screen.findByText(/Anulada: error/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Anular venta/ })).toBeNull()
  })
})
