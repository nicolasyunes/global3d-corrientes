import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ShareBars, WeeklyBars } from './charts'

const bars = [
  { start: new Date(2026, 9, 5), label: '5/10', count: 9, partial: false },
  { start: new Date(2026, 9, 12), label: '12/10', count: 4, partial: true },
]

describe('WeeklyBars', () => {
  it('dibuja una barra por semana con su número y marca la parcial', () => {
    const { container } = render(<WeeklyBars bars={bars} />)
    const svg = screen.getByRole('img', { name: /Pedidos por semana/ })
    expect(within(svg).getByText('9')).toBeInTheDocument()
    expect(within(svg).getByText('12/10')).toBeInTheDocument()
    expect(container.querySelectorAll('rect.st-bar')).toHaveLength(2)
    expect(container.querySelectorAll('rect.st-bar.is-partial')).toHaveLength(1)
  })

  it('trae una tabla alternativa con los mismos datos', () => {
    render(<WeeklyBars bars={bars} />)
    const table = screen.getByRole('table', { name: 'Pedidos por semana (tabla)' })
    expect(within(table).getAllByRole('row')).toHaveLength(3)
  })

  it('sin pedidos en ninguna semana avisa en vez de dibujar ceros', () => {
    render(<WeeklyBars bars={bars.map((b) => ({ ...b, count: 0 }))} />)
    expect(screen.getByText('Sin pedidos en estas semanas.')).toBeInTheDocument()
  })
})

describe('ShareBars', () => {
  const rows = [
    { key: 'whatsapp', label: 'WhatsApp', value: 27, pct: 57 },
    { key: 'instagram', label: 'Instagram', value: 11, pct: 23 },
  ]

  it('lista cada fila con valor formateado y porcentaje', () => {
    render(
      <ShareBars rows={rows} label="Por canal" empty="Sin datos" format={(n) => `${n} ped.`} />,
    )
    const list = screen.getByRole('list', { name: 'Por canal' })
    const first = within(list).getAllByRole('listitem')[0]
    expect(first).toHaveTextContent('WhatsApp')
    expect(first).toHaveTextContent('27 ped.')
    expect(first).toHaveTextContent('57%')
  })

  it('sin filas muestra el texto vacío', () => {
    render(<ShareBars rows={[]} label="Por canal" empty="Sin datos en este período." format={String} />)
    expect(screen.getByText('Sin datos en este período.')).toBeInTheDocument()
  })
})
