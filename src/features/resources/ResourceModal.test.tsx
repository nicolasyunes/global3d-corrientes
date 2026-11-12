import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ResourceModal from './ResourceModal'
import type { Resource } from './resources'

const mocks = vi.hoisted(() => ({
  createResource: vi.fn(),
  updateResource: vi.fn(),
  deleteResource: vi.fn(),
  readLink: vi.fn(),
}))
vi.mock('./resources.api', () => ({
  createResource: mocks.createResource,
  updateResource: mocks.updateResource,
  deleteResource: mocks.deleteResource,
}))
vi.mock('@/features/ideas/ideas.api', () => ({ readLink: mocks.readLink }))

const aspose = {
  id: 'r1',
  name: 'Reparar STL (Aspose)',
  url: 'https://products.aspose.app/3d/es/repairing/stl',
  category: 'reparar',
  description: 'Arregla STL',
  price: 'gratis',
  needs_account: false,
  account_hint: null,
  search_url: null,
  pinned: false,
  position: 1,
  created_by: null,
  created_at: '',
} as Resource

function renderModal(resource: Resource | null, category = 'modelos' as const) {
  const props = {
    onClose: vi.fn(),
    onSaved: vi.fn(),
    onDeleted: vi.fn(),
  }
  render(
    <ResourceModal
      resource={resource}
      category={category}
      operatorId="op-1"
      {...props}
    />,
  )
  return props
}

describe('ResourceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readLink.mockResolvedValue({
      title: 'Thingiverse - Digital Designs',
      image: null,
      author: null,
      site: null,
    })
  })

  it('reads the link and saves a search site', async () => {
    mocks.createResource.mockResolvedValue({ id: 'new' })
    const props = renderModal(null)
    const link = screen.getByLabelText('Link del recurso')
    fireEvent.change(link, { target: { value: 'https://www.thingiverse.com' } })
    await act(async () => {
      fireEvent.blur(link)
    })
    expect(
      screen.getByText('Thingiverse - Digital Designs'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue(
      'Thingiverse - Digital Designs',
    )
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Thingiverse' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Con cuenta' }))
    fireEvent.change(screen.getByLabelText('Con qué cuenta entramos'), {
      target: { value: 'global3d@mail.com' },
    })
    fireEvent.click(
      screen.getByLabelText('Incluir en "Buscar en todos los sitios"'),
    )
    fireEvent.change(screen.getByLabelText('Dirección de búsqueda'), {
      target: { value: 'https://www.thingiverse.com/search?q={q}' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar recurso' }))
    })
    expect(mocks.createResource).toHaveBeenCalledWith(
      {
        name: 'Thingiverse',
        url: 'https://www.thingiverse.com',
        category: 'modelos',
        description: null,
        price: 'gratis',
        needs_account: true,
        account_hint: 'global3d@mail.com',
        search_url: 'https://www.thingiverse.com/search?q={q}',
        pinned: false,
      },
      'op-1',
    )
    expect(props.onSaved).toHaveBeenCalledWith({ id: 'new' })
  })

  it('refuses a search address without {q}', async () => {
    renderModal(aspose)
    fireEvent.click(
      screen.getByLabelText('Incluir en "Buscar en todos los sitios"'),
    )
    fireEvent.change(screen.getByLabelText('Dirección de búsqueda'), {
      target: { value: 'https://products.aspose.app/buscar' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar recurso' }))
    })
    expect(mocks.updateResource).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('{q}')
  })

  it('asks inside the modal before deleting', async () => {
    mocks.deleteResource.mockResolvedValue(undefined)
    const props = renderModal(aspose)
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(mocks.deleteResource).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }))
    })
    expect(mocks.deleteResource).toHaveBeenCalledWith('r1')
    expect(props.onDeleted).toHaveBeenCalledWith('r1')
  })
})
