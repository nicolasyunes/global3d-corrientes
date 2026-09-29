import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listMock, updateMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  updateMock: vi.fn(),
}))

vi.mock('./calculator.api', () => ({
  listCalcProfiles: listMock,
  updateCalcProfile: updateMock,
  createCalcProfile: vi.fn(),
  deleteCalcProfile: vi.fn(),
}))
vi.mock('@/features/products/products.api', () => ({
  listProducts: vi.fn().mockResolvedValue([]),
  updateProduct: vi.fn(),
}))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({ current: { id: 'op-1' }, isAdmin: false }),
}))

import CalculatorPage from './CalculatorPage'

const P1S = {
  id: 'p1s',
  name: 'P1S',
  currency: 'ARS',
  filament_price: 16000,
  kwh_price: 140,
  printer_model: 'Bambu Lab P1S',
  printer_watts: 100,
  machine_life_hours: 3000,
  spare_parts_cost: 50000,
  error_margin_pct: 5,
  ml_surcharge: 0.8,
  updated_by: null,
  created_at: '',
  updated_at: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  listMock.mockResolvedValue([P1S])
  updateMock.mockImplementation((_id, fields) =>
    Promise.resolve({ ...P1S, ...fields }),
  )
})

describe('CalculatorPage', () => {
  it('calcula el total como la planilla', async () => {
    render(<CalculatorPage />)
    await waitFor(() =>
      expect(screen.getByLabelText('Precio del filamento ($/kg)')).toHaveValue(
        '16000',
      ),
    )
    fireEvent.change(screen.getByLabelText('Horas de impresión'), {
      target: { value: '10' },
    })
    fireEvent.change(screen.getByLabelText('Gramos de filamento'), {
      target: { value: '400' },
    })
    expect(screen.getByText(/24\.647,00/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '×2' }))
    expect(screen.getByText(/14\.084,00/)).toBeInTheDocument()
  })

  it('guarda los cambios del perfil', async () => {
    render(<CalculatorPage />)
    const kwh = await screen.findByLabelText('Precio del kWh ($)')
    await waitFor(() => expect(kwh).toHaveValue('140'))
    fireEvent.change(kwh, { target: { value: '180' } })
    fireEvent.click(screen.getByRole('button', { name: /actualizar perfil/i }))
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
    expect(updateMock.mock.calls[0][1]).toMatchObject({
      kwh_price: 180,
      updated_by: 'op-1',
    })
  })
})
