import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ResourcesPage from './ResourcesPage'
import type { Resource, SavedSearch } from './resources'

const mocks = vi.hoisted(() => ({
  listResources: vi.fn(),
  createResource: vi.fn(),
  updateResource: vi.fn(),
  deleteResource: vi.fn(),
  listSavedSearches: vi.fn(),
  createSavedSearch: vi.fn(),
  touchSavedSearch: vi.fn(),
  deleteSavedSearch: vi.fn(),
  listCollections: vi.fn(),
  readLink: vi.fn(),
  createIdea: vi.fn(),
}))
vi.mock('./resources.api', () => ({
  listResources: mocks.listResources,
  createResource: mocks.createResource,
  updateResource: mocks.updateResource,
  deleteResource: mocks.deleteResource,
  listSavedSearches: mocks.listSavedSearches,
  createSavedSearch: mocks.createSavedSearch,
  touchSavedSearch: mocks.touchSavedSearch,
  deleteSavedSearch: mocks.deleteSavedSearch,
}))
vi.mock('@/features/ideas/ideas.api', () => ({
  listCollections: mocks.listCollections,
  readLink: mocks.readLink,
  createIdea: mocks.createIdea,
}))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({ current: { id: 'op-1', name: 'nicolas' } }),
}))

function res(over: Partial<Resource>): Resource {
  return {
    id: 'r',
    name: 'Sitio',
    url: 'https://sitio.com',
    category: 'modelos',
    description: null,
    price: 'gratis',
    needs_account: false,
    account_hint: null,
    search_url: null,
    pinned: false,
    position: 0,
    created_by: null,
    created_at: '',
    ...over,
  }
}

const RESOURCES = [
  res({
    id: 'mw',
    name: 'MakerWorld',
    url: 'https://makerworld.com',
    search_url: 'https://makerworld.com/es/search/models?keyword={q}',
    pinned: true,
    position: 1,
  }),
  res({
    id: 'pr',
    name: 'Printables',
    url: 'https://www.printables.com',
    search_url: 'https://www.printables.com/search/models?q={q}',
    position: 2,
  }),
  res({ id: 'hy', name: 'Hunyuan 3D', category: 'ia' }),
]

const SEARCH: SavedSearch = {
  id: 's1',
  name: 'Día de la Madre',
  query: 'regalo mamá',
  resource_ids: ['pr'],
  collection_id: 'c1',
  last_used_at: null,
  created_by: null,
  created_at: '',
}

describe('ResourcesPage', () => {
  let open: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    open = vi.fn(() => ({ opener: {} }))
    vi.stubGlobal('open', open)
    mocks.listResources.mockResolvedValue(RESOURCES)
    mocks.listSavedSearches.mockResolvedValue([SEARCH])
    mocks.listCollections.mockResolvedValue([
      {
        id: 'c1',
        name: 'Día de la Madre',
        target_date: null,
        position: 0,
        created_at: '',
      },
    ])
    mocks.touchSavedSearch.mockResolvedValue({
      ...SEARCH,
      last_used_at: new Date().toISOString(),
    })
    mocks.readLink.mockResolvedValue({
      title: 'Maceta flor',
      image: 'https://x/og.jpg',
      author: null,
      site: null,
    })
    mocks.createIdea.mockResolvedValue({ id: 'i1' })
  })

  async function renderPage() {
    render(
      <MemoryRouter>
        <ResourcesPage />
      </MemoryRouter>,
    )
    await act(async () => {})
  }

  it('shows pinned resources and the sections', async () => {
    await renderPage()
    const pinned = screen.getByRole('region', { name: 'Fijados' })
    expect(within(pinned).getByText('MakerWorld')).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Modelos para descargar' }),
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByRole('region', { name: 'Crear, personalizar y reparar' }),
      ).getByText('Hunyuan 3D'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Agregar proveedor/ }),
    ).toBeInTheDocument()
  })

  it('opens one tab per chosen site', async () => {
    await renderPage()
    fireEvent.change(screen.getByLabelText('Qué modelo buscás'), {
      target: { value: 'portalápices gato' },
    })
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Dónde buscar' })).getByRole(
        'button',
        { name: 'Printables' },
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: /Buscar en 1 sitio/ }))
    expect(open).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith(
      'https://makerworld.com/es/search/models?keyword=portal%C3%A1pices%20gato',
      '_blank',
    )
  })

  it('offers links for the tabs the browser blocked', async () => {
    open.mockReturnValueOnce({ opener: {} }).mockReturnValueOnce(null)
    await renderPage()
    fireEvent.change(screen.getByLabelText('Qué modelo buscás'), {
      target: { value: 'mate' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Buscar en 2 sitios/ }))
    expect(screen.getByText(/Se bloqueó 1 pestaña/)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Abrir Printables' }),
    ).toHaveAttribute('href', 'https://www.printables.com/search/models?q=mate')
  })

  it('runs a saved search and saves the find into its collection', async () => {
    await renderPage()
    fireEvent.click(
      screen.getByRole('button', { name: 'Abrir búsqueda Día de la Madre' }),
    )
    expect(open).toHaveBeenCalledWith(
      'https://www.printables.com/search/models?q=regalo%20mam%C3%A1',
      '_blank',
    )
    expect(mocks.touchSavedSearch).toHaveBeenCalledWith('s1')
    expect(
      screen.getByText(/Se guarda en Colección Día de la Madre/),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Link del modelo encontrado'), {
      target: { value: 'https://makerworld.com/es/models/123' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar como idea' }))
    })
    expect(mocks.createIdea).toHaveBeenCalledWith({
      title: 'Maceta flor',
      url: 'https://makerworld.com/es/models/123',
      source: 'makerworld',
      preview_image_url: 'https://x/og.jpg',
      preview_author: null,
      collection_id: 'c1',
      created_by: 'op-1',
    })
    expect(screen.getByText('Guardada en Ideas')).toBeInTheDocument()
  })

  it('saves the current search with a collection', async () => {
    mocks.createSavedSearch.mockResolvedValue({
      ...SEARCH,
      id: 's2',
      name: 'Llaveros',
      query: 'llavero',
      collection_id: null,
    })
    await renderPage()
    fireEvent.change(screen.getByLabelText('Qué modelo buscás'), {
      target: { value: 'llavero' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /Guardar esta búsqueda/ }),
    )
    fireEvent.change(screen.getByLabelText('Nombre de la búsqueda'), {
      target: { value: 'Llaveros' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar búsqueda' }))
    })
    expect(mocks.createSavedSearch).toHaveBeenCalledWith(
      {
        name: 'Llaveros',
        query: 'llavero',
        resource_ids: ['mw', 'pr'],
        collection_id: null,
      },
      'op-1',
    )
  })

  it('adds a provider from its empty slot', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Agregar proveedor/ }))
    const dialog = screen.getByRole('dialog', { name: 'Agregar recurso' })
    expect(
      within(dialog).getByRole('button', { name: 'Proveedores' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })
})
