import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import QueueList from './QueueList'
import type { QueueGroup } from './pieces'
import type { QueuePiece } from './production.api'

function piece(over: Partial<QueuePiece>): QueuePiece {
  return {
    id: 'p1',
    order_id: 'o1',
    order_item_id: null,
    label: 'Llaveros',
    location: null,
    color: 'negro',
    quantity_total: 10,
    quantity_done: 0,
    status: 'pending',
    updated_by: null,
    position: 0,
    created_at: '',
    updated_at: '',
    due_date: '2026-09-30',
    order_status: 'new',
    customer_id: 'c1',
    customer_name: 'Ana',
    item_label: null,
    item_position: null,
    flexible: false,
    urgent: false,
    order_created_at: '2026-09-01',
    ...over,
  }
}

function renderList(entries: QueuePiece[], onAdd = vi.fn()) {
  const groups: QueueGroup<QueuePiece>[] = [
    {
      key: 'negro',
      label: 'negro',
      swatch: '#111111',
      earliest: entries[0].due_date,
      entries,
    },
  ]
  render(
    <MemoryRouter>
      <QueueList
        groups={groups}
        today="2026-09-30"
        busyId={null}
        onAdd={onAdd}
      />
    </MemoryRouter>,
  )
  return onAdd
}

afterEach(() => vi.useRealTimers())

describe('QueueList', () => {
  it('shows the date only in the group title when all pieces share it', () => {
    renderList([piece({}), piece({ id: 'p2', label: 'Tapas' })])
    expect(screen.getAllByText('Hoy')).toHaveLength(1)
  })

  it('marks where each due date starts inside a group', () => {
    renderList([
      piece({}),
      piece({ id: 'p2', label: 'Tapas', due_date: '2026-10-01' }),
    ])
    // group title + first separator, then the "Mañana" separator
    expect(screen.getAllByText('Hoy')).toHaveLength(2)
    expect(screen.getByText('Mañana')).toBeInTheDocument()
  })

  it('a tap adds one; "Marcar las N" adds everything left', () => {
    const onAdd = renderList([piece({ quantity_done: 4 })])
    const plus = screen.getByRole('button', { name: /Sumar 1 a Llaveros/ })
    fireEvent.pointerDown(plus)
    fireEvent.pointerUp(plus)
    expect(onAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'p1' }),
      1,
    )
    fireEvent.click(screen.getByRole('button', { name: /Marcar las 6/ }))
    expect(onAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'p1' }),
      6,
    )
  })

  it('holding the plus counts up and adds it all at once, capped at what is left', () => {
    vi.useFakeTimers()
    const onAdd = renderList([piece({ quantity_total: 3 })])
    const plus = screen.getByRole('button', { name: /Sumar 1 a Llaveros/ })
    fireEvent.pointerDown(plus)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(plus).toHaveTextContent('+3')
    fireEvent.pointerUp(plus)
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'p1' }),
      3,
    )
  })
})

describe('QueueList focus mode', () => {
  const group = (
    key: string,
    label: string,
    entries: QueuePiece[],
  ): QueueGroup<QueuePiece> => ({
    key,
    label,
    swatch: null,
    earliest: entries[0].due_date,
    entries,
  })

  function renderFocus() {
    render(
      <MemoryRouter>
        <QueueList
          focus
          today="2026-09-30"
          busyId={null}
          onAdd={vi.fn()}
          groups={[
            group('amarillo', 'Amarillo', [
              piece({ id: 'a', color: 'amarillo', order_id: 'o1' }),
              piece({ id: 'b', color: 'amarillo', order_id: 'o2' }),
            ]),
            group('verde', 'Verde', [
              piece({
                id: 'c',
                label: 'Macetas',
                color: 'verde',
                due_date: '2026-10-01',
              }),
            ]),
          ]}
        />
      </MemoryRouter>,
    )
  }

  it('opens the first batch as "Ahora" and folds the rest as "Después"', () => {
    renderFocus()
    expect(screen.getByText('Ahora')).toBeInTheDocument()
    expect(screen.getByText('Cargá amarillo')).toBeInTheDocument()
    expect(screen.getByText(/20 piezas · 2 pedidos/)).toBeInTheDocument()
    const later = screen.getByText('Verde').closest('details')
    expect(later).not.toBeNull()
    expect(later).not.toHaveAttribute('open')
    expect(screen.getByText(/10 piezas · Mañana/)).toBeInTheDocument()
  })
})
