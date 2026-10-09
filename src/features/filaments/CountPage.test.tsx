import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CountPage from './CountPage'
import { designLines } from './fixtures'

const mocks = vi.hoisted(() => ({
  listLines: vi.fn(),
  submitStockCount: vi.fn(),
  resolveStockCount: vi.fn(),
  listStockCounts: vi.fn(),
  listCountStatus: vi.fn(),
}))
const operator = vi.hoisted(() => ({ isAdmin: false }))
vi.mock('./filaments.api', () => ({ listLines: mocks.listLines }))
vi.mock('./stockCount.api', () => ({
  submitStockCount: mocks.submitStockCount,
  resolveStockCount: mocks.resolveStockCount,
  listStockCounts: mocks.listStockCounts,
  listCountStatus: mocks.listCountStatus,
}))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({
    current: { id: 'op-1', name: 'sabri' },
    isAdmin: operator.isAdmin,
    byId: (id: string) => ({ name: id === 'op-2' ? 'sabri' : 'nicolas' }),
  }),
}))

const pendingCount = {
  id: 'k1',
  created_at: new Date().toISOString(),
  operator_id: 'op-2',
  status: 'pending',
  resolved_at: null,
  resolved_by: null,
  items: [
    { id: 'i1', count_id: 'k1', color_id: 'c1', line_label: '3N3 PLA', color_label: 'Rojo', refill: false, counted: 3, expected: 5 },
    { id: 'i2', count_id: 'k1', color_id: 'c2', line_label: '3N3 PLA', color_label: 'Azul', refill: false, counted: 4, expected: 4 },
  ],
}

async function renderPage() {
  render(
    <MemoryRouter>
      <CountPage />
    </MemoryRouter>,
  )
  await act(async () => {})
}

function firstInput() {
  return screen.getAllByRole('textbox', { name: /^Contados de / })[0]
}

describe('CountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    operator.isAdmin = false
    mocks.listLines.mockResolvedValue(designLines())
    mocks.listCountStatus.mockResolvedValue([])
    mocks.listStockCounts.mockResolvedValue([])
    mocks.submitStockCount.mockResolvedValue({ id: 'k9' })
  })

  it('es a ciegas: no muestra el stock del sistema ni "esperado"', async () => {
    await renderPage()
    expect(screen.queryByText(/esperado/i)).toBeNull()
    expect(screen.queryByText(/Valor del stock/)).toBeNull()
    expect(
      screen.getByText(/No se muestra cuánto debería haber/),
    ).toBeInTheDocument()
  })

  it('cierra el conteo mandando solo lo contado', async () => {
    window.confirm = vi.fn(() => true)
    await renderPage()
    fireEvent.change(firstInput(), { target: { value: '3' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar conteo' }))
    })
    expect(window.confirm).toHaveBeenCalled() // faltan filas
    expect(mocks.submitStockCount).toHaveBeenCalledWith('op-1', [
      expect.objectContaining({ refill: false, counted: 3 }),
    ])
    expect(screen.getByText('Conteo enviado. Gracias.')).toBeInTheDocument()
  })

  it('no cierra con cantidades inválidas', async () => {
    await renderPage()
    fireEvent.change(firstInput(), { target: { value: '2,5' } })
    // el botón solo se habilita con al menos una fila válida
    fireEvent.change(screen.getAllByRole('textbox', { name: /^Contados de / })[1], { target: { value: '3' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar conteo' }))
    })
    expect(mocks.submitStockCount).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('solo números enteros')
  })

  it('el botón queda apagado sin nada contado y el borrador sobrevive', async () => {
    const first = await (async () => {
      await renderPage()
      return screen.getByRole('button', { name: 'Cerrar conteo' })
    })()
    expect(first).toBeDisabled()
    fireEvent.change(firstInput(), { target: { value: '4' } })
    expect(JSON.parse(localStorage.getItem('g3d.countDraft')!)).toMatchObject({})
    expect(Object.values(JSON.parse(localStorage.getItem('g3d.countDraft')!))).toContain('4')
  })

  it('un error de la base se muestra y se conserva lo cargado', async () => {
    window.confirm = vi.fn(() => true)
    mocks.submitStockCount.mockRejectedValue(new Error('Hay colores que ya no existen; recargá la pantalla'))
    await renderPage()
    fireEvent.change(firstInput(), { target: { value: '1' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar conteo' }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('ya no existen')
    expect(firstInput()).toHaveValue('1')
  })

  it('el operador no ve la revisión', async () => {
    mocks.listStockCounts.mockResolvedValue([pendingCount])
    await renderPage()
    expect(screen.queryByRole('button', { name: /Aprobar ajustes/ })).toBeNull()
    expect(mocks.listStockCounts).not.toHaveBeenCalled()
  })
})

describe('CountPage como admin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    operator.isAdmin = true
    mocks.listLines.mockResolvedValue(designLines())
    mocks.listCountStatus.mockResolvedValue([])
    mocks.listStockCounts.mockResolvedValue([pendingCount])
    mocks.resolveStockCount.mockResolvedValue({ id: 'k1', status: 'approved' })
  })

  it('muestra solo las diferencias, con quién contó', async () => {
    await renderPage()
    const card = screen.getByRole('article', { name: /Conteo de nicolas|Conteo de sabri/ })
    expect(within(card).getByText(/esperado 5/)).toBeInTheDocument()
    expect(within(card).queryByText('Azul')).toBeNull() // sin diferencia
    expect(within(card).getByText('−2')).toBeInTheDocument()
  })

  it('aprueba los ajustes', async () => {
    await renderPage()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Aprobar ajustes/ }))
    })
    expect(mocks.resolveStockCount).toHaveBeenCalledWith('k1', 'op-1', true)
  })

  it('descartar pide confirmación y no mueve stock', async () => {
    window.confirm = vi.fn(() => true)
    await renderPage()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    })
    expect(window.confirm).toHaveBeenCalled()
    expect(mocks.resolveStockCount).toHaveBeenCalledWith('k1', 'op-1', false)
  })

  it('no resuelve si no confirma el descarte', async () => {
    window.confirm = vi.fn(() => false)
    await renderPage()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Descartar' }))
    })
    expect(mocks.resolveStockCount).not.toHaveBeenCalled()
  })
})
