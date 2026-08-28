import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { OrderWithCustomer } from './orders.api'
import OrdersKanban from './OrdersKanban'

function order(overrides: Partial<OrderWithCustomer> = {}): OrderWithCustomer {
  return {
    id: 'order-1',
    customer_id: 'cust-1',
    product_type: 'cup',
    color_spec: { tapa: 'negro' },
    personalization: 'Texto grabado de ejemplo',
    measurements: null,
    observations: null,
    order_date: '2026-01-01',
    due_date: '2026-01-10',
    total_amount: null,
    deposit: null,
    pending_balance: 1500,
    payment_method: null,
    status: 'printing',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    origin_channel: null,
    reference_link: null,
    customers: { name: 'Ada', phone: null },
    ...overrides,
  }
}

function renderBoard(
  props: Partial<React.ComponentProps<typeof OrdersKanban>> = {},
) {
  const onAdvance = vi.fn()
  render(
    <MemoryRouter>
      <OrdersKanban
        orders={[order()]}
        today="2026-01-05"
        advancingId={null}
        onAdvance={onAdvance}
        taskCounts={{ 'order-1': { done: 2, total: 5 } }}
        {...props}
      />
    </MemoryRouter>,
  )
  return { onAdvance }
}

describe('OrdersKanban card', () => {
  it('shows colours and the engraving snippet', () => {
    renderBoard()
    expect(screen.getByText(/tapa negro/)).toBeInTheDocument()
    expect(screen.getByText('Texto grabado de ejemplo')).toBeInTheDocument()
  })

  it('shows the checklist progress pill', () => {
    renderBoard()
    expect(screen.getByText('2/5')).toBeInTheDocument()
  })

  it('omits the pill when the order has no tasks', () => {
    renderBoard({ taskCounts: {} })
    expect(screen.queryByText('2/5')).not.toBeInTheDocument()
  })

  it('still advances a card', () => {
    const { onAdvance } = renderBoard()
    screen
      .getByRole('button', { name: /Avanzar a Post-procesado/i })
      .click()
    expect(onAdvance).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'order-1' }),
    )
  })

  it('links the card to the production screen', () => {
    renderBoard()
    expect(screen.getByRole('link', { name: /Ada/ })).toHaveAttribute(
      'href',
      '/admin/orders/order-1',
    )
  })
})
