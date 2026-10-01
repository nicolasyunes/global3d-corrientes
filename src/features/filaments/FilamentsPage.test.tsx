import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FilamentsPage from './FilamentsPage'
import { designLines } from './fixtures'

const mocks = vi.hoisted(() => ({
  listLines: vi.fn(),
  moveFilament: vi.fn(),
  saveLine: vi.fn(),
  listLineMovements: vi.fn(),
  deleteLine: vi.fn(),
}))

vi.mock('./filaments.api', () => mocks)
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({
    current: { id: 'op-1', name: 'nicolas' },
    byId: () => ({ name: 'nicolas' }),
  }),
}))

async function renderPage() {
  render(<FilamentsPage />)
  await act(async () => {})
}

describe('FilamentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.listLines.mockResolvedValue(designLines())
    mocks.moveFilament.mockResolvedValue({})
    mocks.listLineMovements.mockResolvedValue([])
  })

  it('shows the stock numbers and every brand', async () => {
    await renderPage()
    expect(screen.getByText('108')).toBeInTheDocument()
    expect(screen.getByText('$2.612.400')).toBeInTheDocument()
    expect(screen.getByText('83 de 126')).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Grilon3 PLA especial' }),
    ).toBeInTheDocument()
  })

  it('takes a spool out when one runs out', async () => {
    await renderPage()
    const card = screen.getByRole('region', { name: '3N3 PLA' })
    await act(async () => {
      fireEvent.click(
        within(card).getByRole('button', { name: 'Restar bobina de Rojo' }),
      )
    })
    expect(mocks.moveFilament).toHaveBeenCalledWith(
      'l0c2',
      -1,
      'used',
      'op-1',
      {
        refill: false,
      },
    )
    expect(within(card).getByText('14')).toBeInTheDocument()
  })

  it('moves the refill stock on lines sold both ways', async () => {
    await renderPage()
    const card = screen.getByRole('region', { name: 'Bambu Lab PLA Lite' })
    await act(async () => {
      fireEvent.click(
        within(card).getByRole('button', {
          name: 'Sumar bobina de Blanco recarga',
        }),
      )
    })
    expect(mocks.moveFilament).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'adjust',
      'op-1',
      { refill: true },
    )
  })

  it('switches to the view by color', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Por color' }))
    expect(
      screen.getByRole('region', { name: 'Rojos y bordó' }),
    ).toBeInTheDocument()
  })

  it('registers a purchase', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Registrar compra/ }))
    const dialog = screen.getByRole('dialog', { name: 'Registrar compra' })
    fireEvent.change(within(dialog).getByRole('combobox'), {
      target: { value: 'l6' },
    })
    const plus = within(dialog).getByRole('button', {
      name: 'Sumar bobina de Dorado',
    })
    fireEvent.click(plus)
    fireEvent.click(plus)
    expect(
      within(dialog).getByText(/2 bobinas · \$53\.200/),
    ).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar' }))
    })
    expect(mocks.moveFilament).toHaveBeenCalledWith(
      expect.any(String),
      2,
      'purchase',
      'op-1',
      { refill: false, note: null },
    )
  })
})
