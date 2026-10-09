import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PieceRow from './PieceRow'
import type { PieceRow as Piece } from './production.api'

vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({ byId: () => undefined }),
}))

const piece: Piece = {
  id: 'p1',
  order_id: 'o1',
  order_item_id: 'i1',
  label: 'pintar detalles',
  location: null,
  color: 'negro',
  quantity_total: 4,
  quantity_done: 2,
  status: 'printing',
  updated_by: null,
  position: 0,
  created_at: '',
  updated_at: '2026-09-30T10:00:00Z',
  filament_color_id: null,
}

function renderRow(over: Partial<Piece> = {}) {
  const onEdit = vi.fn().mockResolvedValue(true)
  const onCycle = vi.fn()
  render(
    <ul>
      <PieceRow
        piece={{ ...piece, ...over }}
        busy={false}
        usedColors={['negro']}
        onCycle={onCycle}
        onIncrement={vi.fn()}
        onRemove={vi.fn()}
        onEdit={onEdit}
      />
    </ul>,
  )
  return { onEdit, onCycle }
}

describe('PieceRow inline editing', () => {
  it('renames a piece by typing over its name', () => {
    const { onEdit } = renderRow()
    const input = screen.getByLabelText('Nombre de la pieza')
    fireEvent.change(input, { target: { value: 'pintar detalles en fuego' } })
    fireEvent.blur(input)
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), {
      label: 'pintar detalles en fuego',
      color: 'negro',
      quantityTotal: 4,
    })
  })

  it('does not save an unchanged or empty name', () => {
    const { onEdit } = renderRow()
    const input = screen.getByLabelText('Nombre de la pieza')
    fireEvent.blur(input)
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.blur(input)
    expect(onEdit).not.toHaveBeenCalled()
    expect(input).toHaveValue('pintar detalles')
  })

  it('steps the quantity, never below what is already printed', () => {
    const { onEdit } = renderRow({ quantity_total: 2 })
    expect(screen.getByRole('button', { name: /Una menos/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Una más/ }))
    expect(onEdit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ quantityTotal: 3 }),
    )
  })

  it('changes the color from the popover', () => {
    const { onEdit } = renderRow()
    fireEvent.click(screen.getByRole('button', { name: /Color de pintar/ }))
    fireEvent.click(screen.getByRole('button', { name: 'rojo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }))
    expect(onEdit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ color: 'rojo' }),
    )
  })

  it('moves the state from the circle', () => {
    const { onCycle } = renderRow()
    fireEvent.click(screen.getByRole('button', { name: /Tocar para avanzar/ }))
    expect(onCycle).toHaveBeenCalledTimes(1)
  })
})
