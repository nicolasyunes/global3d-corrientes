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
  listLog: vi.fn(),
}))

vi.mock('./filaments.api', () => mocks)
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({
    current: { id: 'op-1', name: 'nicolas' },
    operators: [
      { id: 'op-1', name: 'nicolas' },
      { id: 'op-2', name: 'sabri' },
    ],
    byId: (id: string) => ({ name: id === 'op-2' ? 'sabri' : 'nicolas' }),
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
    mocks.listLog.mockResolvedValue([
      {
        id: 'a',
        created_at: new Date().toISOString(),
        operator_id: 'op-2',
        kind: 'used',
        line_label: '3N3 PLA',
        color_label: 'Rojo',
        refill: false,
        delta: -1,
        note: null,
      },
      {
        id: 'b',
        created_at: new Date().toISOString(),
        operator_id: 'op-1',
        kind: 'color_removed',
        line_label: 'Elegoo PLA',
        color_label: 'Gris',
        refill: false,
        delta: -1,
        note: null,
      },
    ])
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

  it('lists the activity with who and when, and filters it', async () => {
    await renderPage()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Actividad' }))
    })
    const list = screen.getByRole('region', { name: /Hoy/ })
    expect(within(list).getByText('Rojo')).toBeInTheDocument()
    expect(within(list).getByText('sabri')).toBeInTheDocument()
    expect(
      within(list).getByText('A producción'),
    ).toBeInTheDocument()
    expect(within(list).getByText('Color borrado')).toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue('Todas las personas'), {
      target: { value: 'op-2' },
    })
    expect(within(list).queryByText('Gris')).not.toBeInTheDocument()
    expect(within(list).getByText('Rojo')).toBeInTheDocument()
  })

  it('changes the color of a swatch from the editor', async () => {
    mocks.saveLine.mockResolvedValue({ line: {}, colorIds: [] })
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Editar 3N3 PLA' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Cambiar el color de Blanco' }),
    )
    const code = screen.getByRole('textbox', { name: 'Código del color' })
    fireEvent.change(code, { target: { value: '#ff0000' } })
    expect(
      screen.getByRole('button', { name: 'Cambiar el color de Blanco' }),
    ).toHaveStyle({ background: 'rgb(255, 0, 0)' })
    fireEvent.click(screen.getByRole('button', { name: 'Celeste' }))
    expect(code).toHaveValue('#7cc4ec')
  })

  it('downloads the palette as a PDF with the chosen options', async () => {
    const create = vi.fn(() => 'blob:fake')
    const revoke = vi.fn()
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }),
    )
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Exportar PDF/ }))
    const dialog = screen.getByRole('dialog', { name: 'Exportar a PDF' })
    expect(
      within(dialog).getByText('126 colores en 8 marcas'),
    ).toBeInTheDocument()

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Solo con stock' }),
    )
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Elegir marcas' }),
    )
    expect(
      within(dialog).getByText('No hay colores con esa selección'),
    ).toBeInTheDocument()
    fireEvent.click(within(dialog).getByLabelText('Grilon3'))
    expect(
      within(dialog).getByText('15 colores en 1 marca'),
    ).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Descargar PDF' }),
      )
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300))
    })
    expect(create).toHaveBeenCalledTimes(1)
    const blob = (create.mock.calls[0] as unknown[])[0] as Blob
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(1000)
    expect(click).toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Exportar a PDF' })).toBeNull()
    click.mockRestore()
  })

  it('copies the list as plain text for a chat', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Exportar PDF/ }))
    const dialog = screen.getByRole('dialog', { name: 'Exportar a PDF' })
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Solo con stock' }),
    )
    fireEvent.click(within(dialog).getByLabelText('Cantidad de bobinas'))
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Copiar lista' }),
      )
    })
    const text = writeText.mock.calls[0][0] as string
    expect(text).toContain('*3N3 PLA* (PLA)')
    expect(text).toContain('• Rojo (15 bob.)')
    // 3N3 PLA has no blue in stock, so it is not listed under that line.
    const section = text.split('*3N3 PLA*')[1].split('*')[0]
    expect(section).not.toContain('Azul')
  })
})
