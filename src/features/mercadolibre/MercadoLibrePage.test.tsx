import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

const { soon } = vi.hoisted(() => ({
  soon: new Date(Date.now() + 3 * 3_600_000).toISOString(),
}))

vi.mock('./ml.api', () => ({
  latestRuns: vi.fn().mockResolvedValue([
    {
      task: 'ventas',
      ran_at: new Date().toISOString(),
      ok: true,
      summary: { registradas: 2 },
    },
  ]),
  listPendingDispatches: vi.fn().mockResolvedValue([
    {
      ml_order_id: 2000001,
      pack_id: null,
      sale_id: 's1',
      status: 'paid',
      buyer_nickname: 'COMPRADOR1',
      shipping_status: 'ready_to_ship',
      handling_limit: soon,
      created_at: soon,
      items: [
        {
          product_id: 'p1',
          description: 'Vaso Camiseta River',
          quantity: 2,
          stock_descontado: 0,
        },
      ],
    },
  ]),
  listFamilies: vi.fn().mockResolvedValue([
    {
      id: 'f1',
      name: 'Vaso camiseta',
      slug: 'vaso-camiseta',
      sale_mode: 'stock',
      lead_days: 3,
      published: true,
      shop_family_products: [
        {
          position: 0,
          products: { id: 'p1', name: 'Vaso Camiseta River', stock_quantity: 0, active: true },
        },
        {
          position: 1,
          products: { id: 'p2', name: 'Vaso Camiseta Boca', stock_quantity: 4, active: true },
        },
      ],
    },
  ]),
  listListings: vi.fn().mockResolvedValue([
    {
      id: 'l1',
      family_id: 'f1',
      product_id: 'p2',
      ml_item_id: 'MLA1',
      status: 'active',
      title: 'Vaso Camiseta Boca',
      ml_price: 20000,
      ml_stock: 4,
      permalink: 'https://articulo.mercadolibre.com.ar/MLA-1',
      needs_review: false,
      last_synced_at: null,
    },
  ]),
  listProductPrices: vi.fn().mockResolvedValue([
    { product_id: 'p1', name: 'Vaso Camiseta River', price_web: 20000, price_efectivo: 18000, price_ml: 24000, efectivo_manual: false, ml_manual: false },
    { product_id: 'p2', name: 'Vaso Camiseta Boca', price_web: 20000, price_efectivo: 18000, price_ml: 24000, efectivo_manual: false, ml_manual: false },
  ]),
}))

import MercadoLibrePage from './MercadoLibrePage'

describe('MercadoLibrePage', () => {
  it('despachos: urgencia y lo que hay que imprimir', async () => {
    render(
      <MemoryRouter>
        <MercadoLibrePage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Despachar hoy')).toBeInTheDocument()
    expect(screen.getByText('A fabricar para ML')).toBeInTheDocument()
    expect(screen.getByText(/Imprimir: 2× Vaso Camiseta River/)).toBeInTheDocument()
    expect(screen.getByText(/Ventas registradas/)).toBeInTheDocument()
  })

  it('publicaciones: estado, plazo y diferencia de precio', async () => {
    render(
      <MemoryRouter initialEntries={['/?tab=publicaciones']}>
        <MercadoLibrePage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Vaso Camiseta Boca')).toBeInTheDocument()
    expect(screen.getByText('Publicada')).toBeInTheDocument()
    expect(screen.getByText('Sin publicar')).toBeInTheDocument()
    // River no tiene stock pero se fabrica en 3 días: ML publica 3 unidades.
    expect(screen.getByText(/se fabrica en 3 días/)).toBeInTheDocument()
    // Boca está publicado a $20.000 y debería estar a $24.000 (+20%).
    expect(screen.getByText('publicado $20.000')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Sin publicar/ }))
    expect(screen.queryByText('Vaso Camiseta Boca')).toBeNull()
  })
})
