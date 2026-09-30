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
}

function renderRow(onEdit = vi.fn().mockResolvedValue(true)) {
  render(
    <ul>
      <PieceRow
        piece={piece}
        busy={false}
        usedColors={['negro']}
        onCycle={vi.fn()}
        onIncrement={vi.fn()}
        onFail={vi.fn()}
        onRemove={vi.fn()}
        onEdit={onEdit}
      />
    </ul>,
  )
  return onEdit
}

describe('PieceRow editing', () => {
  it('renames a piece from the pencil and saves name, color and quantity', () => {
    const onEdit = renderRow()
    fireEvent.click(screen.getByRole('button', { name: /Editar pintar/ }))
    fireEvent.change(screen.getByLabelText('Nombre de la pieza'), {
      target: { value: 'pintar detalles en fuego' },
    })
    fireEvent.change(screen.getByLabelText('Cantidad'), {
      target: { value: '6' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onEdit).toHaveBeenCalledWith(piece, {
      label: 'pintar detalles en fuego',
      color: 'negro',
      quantityTotal: 6,
    })
  })

  it('does not let the total drop below what is already printed', () => {
    const onEdit = renderRow()
    fireEvent.click(screen.getByRole('button', { name: /Editar pintar/ }))
    fireEvent.change(screen.getByLabelText('Cantidad'), {
      target: { value: '1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onEdit).toHaveBeenCalledWith(
      piece,
      expect.objectContaining({ quantityTotal: 2 }),
    )
  })

  it('cancels without saving', () => {
    const onEdit = renderRow()
    fireEvent.click(screen.getByRole('button', { name: /Editar pintar/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onEdit).not.toHaveBeenCalled()
    expect(screen.getByText(/pintar detalles/)).toBeInTheDocument()
  })
})
