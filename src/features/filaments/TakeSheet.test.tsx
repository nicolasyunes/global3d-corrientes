import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TakeSheet from './TakeSheet'
import { designLines } from './fixtures'

const api = vi.hoisted(() => ({
  sellFilament: vi.fn(),
  takeFilament: vi.fn(),
  adjustFilament: vi.fn(),
}))
vi.mock('./filaments.api', () => api)

const operator = vi.hoisted(() => ({ isAdmin: false }))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({ current: { id: 'op-1' }, isAdmin: operator.isAdmin }),
}))

function setup(direction: 'out' | 'in' = 'out') {
  const line = designLines().find((l) => l.presentation !== 'both' && l.price != null)!
  const color = { ...line.colors[0], stock: 3, price: null }
  const onDone = vi.fn()
  render(
    <TakeSheet
      line={line}
      color={color}
      refill={false}
      direction={direction}
      onClose={vi.fn()}
      onDone={onDone}
    />,
  )
  return { line, color, onDone }
}

describe('TakeSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    operator.isAdmin = false
    api.sellFilament.mockResolvedValue({})
    api.takeFilament.mockResolvedValue({})
  })

  it('venta: exige forma de cobro y vende al precio de lista', async () => {
    const { color, onDone } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Elegí cómo te pagaron.')
    expect(api.sellFilament).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Efectivo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() =>
      expect(api.sellFilament).toHaveBeenCalledWith(color.id, false, 1, 'cash', 'op-1', ''),
    )
    expect(onDone).toHaveBeenCalledWith(expect.stringMatching(/^Venta · 1 ×/))
  })

  it('el precio no se puede editar', () => {
    setup()
    expect(screen.queryByLabelText(/precio/i)).toBeNull()
  })

  it('a la otra sede usa takeFilament', async () => {
    const { color } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'A la otra sede' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() =>
      expect(api.takeFilament).toHaveBeenCalledWith(color.id, false, 1, 'transfer', 'op-1', ''),
    )
  })

  it('un operador no ve "Ajuste"', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Ajuste' })).toBeNull()
  })

  it('no deja sacar más que el stock', () => {
    setup()
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Efectivo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Solo quedan 3.')
  })

  it('admin suma con ajuste y motivo', async () => {
    operator.isAdmin = true
    api.adjustFilament.mockResolvedValue({})
    const { color } = setup('in')
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'conteo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() =>
      expect(api.adjustFilament).toHaveBeenCalledWith(color.id, false, 1, 'op-1', 'conteo'),
    )
  })

  it('muestra el error de la base', async () => {
    api.sellFilament.mockRejectedValue(new Error('No hay stock suficiente (quedan 0)'))
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Transferencia MP' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No hay stock suficiente')
  })
})
