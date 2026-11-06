import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cart, type CartItem } from '../lib/cart'
import type { ShopSettings } from '../lib/types'

const { quoteMock, agenciesMock, createMock, navigateMock } = vi.hoisted(() => ({
  quoteMock: vi.fn(),
  agenciesMock: vi.fn(),
  createMock: vi.fn(),
  navigateMock: vi.fn(),
}))

vi.mock('../lib/api', async (orig) => ({
  ...(await orig<typeof import('../lib/api')>()),
  api: {
    quoteShipping: quoteMock,
    agencies: agenciesMock,
    createOrder: createMock,
  },
}))
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}))

const SETTINGS = {
  whatsapp: '5493794684473',
  instagram: 'global3d_corrientes',
  local: { direccion: 'Junín 862', horarios: 'de 9 a 21', mapsQuery: '' },
  transferencia: { alias: 'global.3d', cbu: '00000', titular: 'G3D', banco: 'Banco' },
  sena: { porcentaje: 50 },
  envios: { corrientes: 'A coordinar', pais: 'Te pasamos el costo' },
  descuento_efectivo: { porcentaje: 10 },
} as ShopSettings

vi.mock('../lib/data', () => ({ useShop: () => ({ settings: SETTINGS }) }))

import { Checkout } from './Checkout'

const ITEM: CartItem = {
  key: 'k1',
  familySlug: 'vaso-camiseta',
  productId: 'p1',
  name: 'Vaso camiseta',
  variantLabel: 'River',
  image: null,
  unitPrice: 10000,
  minQty: 1,
  leadDays: 3,
  stock: 5,
  quantity: 1,
  personalization: {},
  personalizationText: '',
}

const RATES = [
  { deliveredType: 'S' as const, productType: 'CP', productName: 'Correo Argentino Clasico', price: 6890, deliveryTimeMin: '2', deliveryTimeMax: '5' },
  { deliveredType: 'D' as const, productType: 'CP', productName: 'Correo Argentino Clasico', price: 9420, deliveryTimeMin: '2', deliveryTimeMax: '5' },
]

const AGENCY = {
  code: 'B0107',
  name: 'Monte Grande',
  address: 'Vicente Lopez 448',
  city: 'Esteban Echeverría',
  postalCode: '1842',
  hours: 'Lun a Vie 09:30–18:00',
}

function setup() {
  render(
    <MemoryRouter>
      <Checkout />
    </MemoryRouter>,
  )
}

/** Elige "Correo Argentino", cotiza y espera las opciones. */
async function quote(cp = 'B1842ZAB') {
  fireEvent.click(screen.getByRole('radio', { name: /Correo Argentino/ }))
  fireEvent.change(screen.getByLabelText('Código postal'), {
    target: { value: cp },
  })
  fireEvent.click(screen.getByRole('button', { name: /Calcular|Recalcular/ }))
  await screen.findByRole('radio', { name: /Clásico a sucursal/ })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  cart.clear()
  cart.add(ITEM)
  quoteMock.mockResolvedValue({
    ok: true,
    quote: { quoteId: 'q-1', postalCode: '1842', rates: RATES },
  })
  agenciesMock.mockResolvedValue([AGENCY])
  createMock.mockResolvedValue({
    token: 'a'.repeat(32),
    code: 'AAAAAA',
    total: 15890,
    deposit: 11390,
    shipping: 6890,
    quote: false,
    dueDate: '2026-11-10',
  })
})

describe('Checkout con Correo Argentino', () => {
  it('suma el envío al total y cobra el envío entero con la seña', async () => {
    setup()
    await quote()
    fireEvent.click(screen.getByRole('radio', { name: /Clásico a sucursal/ }))

    // 10.000 − 10% = 9.000 de productos, + 6.890 de envío
    await waitFor(() =>
      expect(document.querySelector('.summary')?.textContent).toContain(
        '$ 15.890',
      ),
    )
    // Seña: 50% de 9.000 = 4.500, más el envío entero
    expect(screen.getAllByText('$ 11.390').length).toBeGreaterThan(0)
  })

  it('manda la cotización y la sucursal elegidas', async () => {
    setup()
    await quote()
    fireEvent.click(screen.getByRole('radio', { name: /Clásico a sucursal/ }))
    fireEvent.change(
      await screen.findByLabelText('Sucursal donde lo retirás'),
      { target: { value: 'B0107' } },
    )
    fireEvent.change(screen.getByLabelText('Nombre y apellido'), {
      target: { value: 'Ana Gómez' },
    })
    fireEvent.change(screen.getByLabelText('WhatsApp'), {
      target: { value: '3794123456' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Confirmar pedido' })[0])

    await waitFor(() => expect(createMock).toHaveBeenCalled())
    expect(createMock.mock.calls[0][0].delivery).toEqual({
      mode: 'pais',
      address: undefined,
      shipping: {
        quoteId: 'q-1',
        type: 'S',
        product: 'CP',
        agencyCode: 'B0107',
        agencyName: 'Monte Grande — Vicente Lopez 448, Esteban Echeverría',
      },
    })
  })

  it('a sucursal no pide dirección; a domicilio sí', async () => {
    setup()
    await quote()
    fireEvent.click(screen.getByRole('radio', { name: /Clásico a sucursal/ }))
    expect(screen.queryByLabelText(/^Dirección/)).toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: /Clásico a domicilio/ }))
    expect(await screen.findByLabelText(/^Dirección/)).toBeInTheDocument()
  })

  it('no deja confirmar sin elegir opción ni sucursal', async () => {
    setup()
    await quote()
    fireEvent.change(screen.getByLabelText('Nombre y apellido'), {
      target: { value: 'Ana Gómez' },
    })
    fireEvent.change(screen.getByLabelText('WhatsApp'), {
      target: { value: '3794123456' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Confirmar pedido' })[0])
    expect(createMock).not.toHaveBeenCalled()
    expect(screen.getByText(/elegí una opción/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /Clásico a sucursal/ }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Confirmar pedido' })[0])
    expect(createMock).not.toHaveBeenCalled()
    expect(screen.getByText(/Elegí la sucursal/)).toBeInTheDocument()
  })

  it('sin Correo configurado vuelve a "a cotizar" con dirección', async () => {
    quoteMock.mockResolvedValue({ ok: false, error: 'correo_no_configurado' })
    setup()
    fireEvent.click(screen.getByRole('radio', { name: /Correo Argentino/ }))
    fireEvent.change(screen.getByLabelText('Código postal'), {
      target: { value: '1842' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Calcular' }))

    await screen.findByLabelText(/^Dirección/)
    expect(screen.getByText('Envío al resto del país')).toBeInTheDocument()
    expect(screen.queryByLabelText('Código postal')).toBeNull()
  })
})
