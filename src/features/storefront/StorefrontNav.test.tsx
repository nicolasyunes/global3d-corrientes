import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import StorefrontNav from './StorefrontNav'

function setViewport(width: number) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width: 900px') ? width >= 900 : width <= 899,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

const renderNav = () =>
  render(
    <MemoryRouter>
      <StorefrontNav />
    </MemoryRouter>,
  )

afterEach(() => {
  document.body.style.overflow = ''
})

describe('StorefrontNav — desktop', () => {
  beforeEach(() => setViewport(1200))

  it('shows all 11 category triggers plus "Todas"', () => {
    renderNav()
    expect(screen.getByRole('link', { name: 'Todas' })).toBeInTheDocument()
    expect(screen.getByText('Vasos Ferneteros')).toBeInTheDocument()
    expect(screen.getByText('Impresión 3D')).toBeInTheDocument()
  })

  it('opens a mega-menu panel on hover and lists its sub-links', async () => {
    renderNav()
    const group = screen.getByText('Vasos Ferneteros').closest('.sf-nav__group')!
    fireEvent.mouseEnter(group)
    const panel = await screen.findByRole('region', { name: 'Vasos Ferneteros' })
    expect(within(panel).getByRole('link', { name: 'Fútbol y Clubes' })).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Ver todo' })).toBeInTheDocument()
  })
})

describe('StorefrontNav — mobile', () => {
  beforeEach(() => setViewport(390))

  it('opens the drawer and expands one category at a time', () => {
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: /Categorías/ }))
    expect(screen.getByRole('link', { name: 'Todas las categorías' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /subcategorías de Vasos Milkshake/i }))
    expect(screen.getByRole('link', { name: 'Toy Story' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /subcategorías de Trofeos y Premios/i }))
    expect(screen.queryByRole('link', { name: 'Toy Story' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Deportivos' })).toBeInTheDocument()
  })
})
