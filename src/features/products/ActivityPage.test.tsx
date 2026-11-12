import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listProductLogMock } = vi.hoisted(() => ({
  listProductLogMock: vi.fn(),
}))

vi.mock('./products.api', () => ({ listProductLog: listProductLogMock }))

vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({
    byId: (id: string | null) =>
      id === 'op-1'
        ? { id: 'op-1', name: 'nicolas', initials: 'NI', color: '#f60' }
        : undefined,
  }),
}))

import ActivityPage from './ActivityPage'

function log(i: number) {
  return {
    id: 'l' + i,
    created_at: new Date().toISOString(),
    operator_id: 'op-1',
    kind: 'created',
    product_id: 'p1',
    product_label: 'Vaso milkshake Spiderman',
    delta: 2,
    stock_after: 2,
    note: null,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('ActivityPage', () => {
  it('muestra quién creó o cambió cada producto', async () => {
    listProductLogMock.mockResolvedValue([log(1)])
    render(
      <MemoryRouter>
        <ActivityPage />
      </MemoryRouter>,
    )
    const activity = await screen.findByRole('region', { name: 'Actividad' })
    await waitFor(() =>
      expect(activity.textContent).toContain(
        'nicolas creó Vaso milkshake Spiderman',
      ),
    )
    expect(activity.textContent).toContain('Stock inicial 2')
    expect(screen.queryByText('Ver más')).toBeNull()
  })

  it('con la página llena ofrece ver más', async () => {
    listProductLogMock.mockResolvedValue(
      Array.from({ length: 50 }, (_, i) => log(i)),
    )
    render(
      <MemoryRouter>
        <ActivityPage />
      </MemoryRouter>,
    )
    fireEvent.click(await screen.findByText('Ver más'))
    await waitFor(() =>
      expect(listProductLogMock).toHaveBeenLastCalledWith({
        productId: undefined,
        limit: 100,
      }),
    )
  })
})
