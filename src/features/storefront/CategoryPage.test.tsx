import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { CartProvider } from './CartContext'
import CategoryPage from './CategoryPage'
import { ToastProvider } from './ToastContext'

function setDesktop() {
  window.matchMedia = ((q: string) => ({
    matches: q.includes('min-width: 900px'),
    media: q,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

const renderAt = (entry: string) =>
  render(
    <CartProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/categoria/:slug?" element={<CategoryPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </CartProvider>,
  )

describe('CategoryPage', () => {
  beforeEach(setDesktop)

  it('redirects an alias slug to the canonical category', () => {
    renderAt('/categoria/vasos')
    // "Vasos Ferneteros" appears as the sub-filter heading once the redirect lands
    expect(screen.getAllByText('Vasos Ferneteros').length).toBeGreaterThan(0)
  })

  it('pre-selects the sub-link from ?sub=', () => {
    renderAt('/categoria/vasos-ferneteros?sub=silk-clasicos')
    expect(screen.getByRole('button', { name: 'Silk y Clásicos' }).className).toContain(
      'sf-filters__item--active',
    )
  })

  it('pre-checks a theme from ?tema=', () => {
    renderAt('/categoria/vasos-ferneteros?tema=mundial')
    expect((screen.getByLabelText('Mundial / Selección') as HTMLInputElement).checked).toBe(true)
  })

  it('shows the brand facet only for impresion-3d', () => {
    renderAt('/categoria/impresion-3d')
    expect(screen.getByText('Marca')).toBeInTheDocument()
  })

  it('keeps the personalizable + price filters on /categoria/todas (FR-1)', () => {
    renderAt('/categoria/todas')
    expect(screen.getByLabelText('Sólo personalizables (a medida)')).toBeInTheDocument()
    expect(screen.getByText('Precio')).toBeInTheDocument()
  })

  it('surfaces and clears an active ?tema= filter on /categoria/todas (FR-2)', () => {
    renderAt('/categoria/todas?tema=mundial')
    const count = () => Number(screen.getByText(/^\d+ resultados?$/).textContent!.split(' ')[0])
    const filtered = count()
    const clear = screen.getByRole('button', { name: 'Limpiar filtros' })
    fireEvent.click(clear)
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument()
    expect(count()).toBeGreaterThan(filtered)
  })
})
