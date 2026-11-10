import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SummaryTab from './SummaryTab'

const api = vi.hoisted(() => ({ loadSummary: vi.fn() }))
vi.mock('./summary.api', () => api)

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).toISOString()

function order(over: Record<string, unknown> = {}) {
  return {
    id: 'o', customer_id: 'c1', created_at: at(2026, 11, 3), due_date: '2026-11-20',
    status: 'in_queue', total_amount: 10000, pending_balance: 0, flexible: false,
    origin_channel: 'whatsapp', quantity: 2, ...over,
  }
}

// Martes 10 de noviembre de 2026: el mes en curso se compara con octubre.
const data = {
  orders: [
    order({ id: 'a', customer_id: 'c1', total_amount: 30000, pending_balance: 5000, quantity: 3 }),
    order({ id: 'b', customer_id: 'c2', total_amount: 10000, origin_channel: 'instagram' }),
    order({ id: 'old', customer_id: 'c3', created_at: at(2026, 10, 5), total_amount: 20000 }),
    order({ id: 'legacy', customer_id: 'c4', created_at: at(2026, 9, 29), pending_balance: 7000, total_amount: 7000 }),
  ],
  payments: [
    { id: 'p1', amount: 20000, method: 'cash', at: at(2026, 11, 4), source: 'order' },
    { id: 'p2', amount: 2000, method: null, at: at(2026, 11, 5), source: 'direct' },
    { id: 'p3', amount: 10000, method: 'cash', at: at(2026, 10, 6), source: 'order' },
  ],
  deliveredAt: new Map([['a', at(2026, 11, 8)]]),
}

function Where() {
  const loc = useLocation()
  return <output data-testid="where">{loc.search}</output>
}

async function renderTab(search = '') {
  render(
    <MemoryRouter initialEntries={[`/admin/estadisticas${search}`]}>
      <SummaryTab />
      <Where />
    </MemoryRouter>,
  )
  await act(async () => {})
}

const tile = (label: string) => screen.getByText(label).closest('.st-tile') as HTMLElement

describe('SummaryTab', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 10, 12))
    api.loadSummary.mockReset()
    api.loadSummary.mockResolvedValue(data)
  })
  afterEach(() => vi.useRealTimers())

  it('arranca en el mes en curso y pide el rango y la comparación', async () => {
    await renderTab()
    expect(screen.getByText('Noviembre 2026')).toBeInTheDocument()
    expect(screen.getByText('comparado con octubre')).toBeInTheDocument()
    const [range, cmp] = api.loadSummary.mock.calls[0]
    expect(range.from).toEqual(new Date(2026, 10, 1))
    expect(cmp.from).toEqual(new Date(2026, 9, 1))
  })

  it('tarjetas con sus valores y comparaciones', async () => {
    await renderTab()
    const sold = tile('Vendido')
    expect(within(sold).getByText('$40.000')).toBeInTheDocument()
    expect(within(sold).getByText('2 pedidos · 5 unidades')).toBeInTheDocument()
    expect(within(sold).getByText(/100 %/)).toBeInTheDocument() // 40.000 contra 20.000

    const cobrado = tile('Cobrado')
    expect(within(cobrado).getByText('$22.000')).toBeInTheDocument()
    expect(within(cobrado).getByText(/pedidos \$20\.000/)).toBeInTheDocument()

    const porCobrar = tile('Por cobrar')
    expect(within(porCobrar).getByText('$5.000')).toBeInTheDocument()
    expect(within(porCobrar).queryByText(/%/)).not.toBeInTheDocument()

    expect(within(tile('Ticket promedio')).getByText('$20.000')).toBeInTheDocument()
    expect(within(tile('Entregados a tiempo')).getByText('100%')).toBeInTheDocument()
    expect(within(tile('Clientes nuevos')).getByText('2')).toBeInTheDocument()
  })

  it('avisa de los saldos anteriores sin confirmar, sin sumarlos', async () => {
    await renderTab()
    expect(screen.getByText(/1 pedido anterior al 30\/9 con saldo sin confirmar/)).toHaveTextContent(
      '$7.000',
    )
  })

  it('gráficos: canal y medio', async () => {
    await renderTab()
    const canal = screen.getByRole('list', { name: 'Pedidos por canal' })
    expect(within(canal).getByText('WhatsApp')).toBeInTheDocument()
    expect(within(canal).getByText('Instagram')).toBeInTheDocument()
    const medio = screen.getByRole('list', { name: 'Cobrado por medio' })
    expect(within(medio).getByText('Efectivo')).toBeInTheDocument()
    expect(within(medio).getByText('Sin medio')).toBeInTheDocument()
  })

  it('las flechas cambian el ancla en la URL', async () => {
    await renderTab('?tab=resumen')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Período anterior' }))
    })
    expect(screen.getByTestId('where')).toHaveTextContent('tab=resumen')
    expect(screen.getByTestId('where')).toHaveTextContent('p=mes')
    expect(screen.getByTestId('where')).toHaveTextContent('d=2026-10')
    expect(screen.getByText('Octubre 2026')).toBeInTheDocument()
  })

  it('no se puede avanzar más allá del período en curso', async () => {
    await renderTab()
    expect(screen.getByRole('button', { name: 'Período siguiente' })).toBeDisabled()
  })

  it('cambiar a Año carga el año', async () => {
    await renderTab()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Año' }))
    })
    expect(screen.getByText('2026')).toBeInTheDocument()
    expect(api.loadSummary).toHaveBeenCalledTimes(2)
  })

  it('septiembre: banner de planilla y sin comparación', async () => {
    await renderTab('?p=mes&d=2026-09')
    expect(screen.getByText(/Datos de la planilla, incompletos/)).toBeInTheDocument()
    expect(api.loadSummary.mock.calls[0][1]).toBeNull()
    expect(within(tile('Vendido')).queryByText(/%/)).not.toBeInTheDocument()
  })

  it('período vacío: ceros y avisos, sin NaN', async () => {
    api.loadSummary.mockResolvedValue({ orders: [], payments: [], deliveredAt: new Map() })
    await renderTab()
    expect(within(tile('Vendido')).getByText('$0')).toBeInTheDocument()
    expect(within(tile('Ticket promedio')).getByText('—')).toBeInTheDocument()
    expect(within(tile('Entregados a tiempo')).getByText('—')).toBeInTheDocument()
    expect(screen.getAllByText('Sin datos en este período.').length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/)
  })

  it('muestra el error de carga', async () => {
    api.loadSummary.mockRejectedValue(new Error('sin conexión'))
    await renderTab()
    expect(screen.getByRole('alert')).toHaveTextContent('sin conexión')
  })
})
