import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import StatsPage from './StatsPage'

vi.mock('./SummaryTab', () => ({ default: () => <div>contenido del resumen</div> }))
vi.mock('./CashTab', () => ({ default: () => <div>contenido de caja</div> }))

function renderAt(search: string) {
  render(
    <MemoryRouter initialEntries={[`/admin/estadisticas${search}`]}>
      <StatsPage />
    </MemoryRouter>,
  )
}

describe('StatsPage', () => {
  it('abre en Resumen por defecto', () => {
    renderAt('')
    expect(screen.getByRole('heading', { name: 'Números' })).toBeInTheDocument()
    expect(screen.getByText('contenido del resumen')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resumen' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('?tab=caja abre Caja y filamento', () => {
    renderAt('?tab=caja')
    expect(screen.getByText('contenido de caja')).toBeInTheDocument()
  })

  it('un tab desconocido cae en Resumen', () => {
    renderAt('?tab=otra')
    expect(screen.getByText('contenido del resumen')).toBeInTheDocument()
  })

  it('cambiar de pestaña muestra la otra', () => {
    renderAt('')
    fireEvent.click(screen.getByRole('button', { name: 'Caja y filamento' }))
    expect(screen.getByText('contenido de caja')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Resumen' }))
    expect(screen.getByText('contenido del resumen')).toBeInTheDocument()
  })
})
