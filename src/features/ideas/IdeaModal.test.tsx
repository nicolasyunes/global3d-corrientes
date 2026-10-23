import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IdeaModal from './IdeaModal'
import type { Collection } from './ideas'

const { createIdeaMock, readLinkMock, uploadMock } = vi.hoisted(() => ({
  createIdeaMock: vi.fn(),
  readLinkMock: vi.fn(),
  uploadMock: vi.fn(),
}))

vi.mock('./ideas.api', () => ({
  createIdea: createIdeaMock,
  readLink: readLinkMock,
  uploadIdeaFile: uploadMock,
}))
vi.mock('@/features/operators/operator-context', () => ({
  useOperator: () => ({ current: { id: 'op-1' } }),
}))

const collections: Collection[] = [
  {
    id: 'c1',
    name: 'Día de la Madre',
    target_date: '2026-10-18',
    position: 0,
    created_at: '',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  createIdeaMock.mockImplementation(async (input) => ({
    id: 'new',
    files: [],
    ...input,
  }))
  readLinkMock.mockResolvedValue({
    title: 'Maceta geométrica',
    image: 'https://img/og.jpg',
    author: 'Ana',
    site: 'MakerWorld',
  })
})

describe('IdeaModal', () => {
  it('reads the link and fills the name', async () => {
    render(
      <IdeaModal
        collections={collections}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByLabelText('Link'), {
      target: { value: 'https://makerworld.com/es/models/1' },
    })
    expect(await screen.findByText('Leído del link')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue('Maceta geométrica')
    expect(readLinkMock).toHaveBeenCalledWith(
      'https://makerworld.com/es/models/1',
    )
  })

  it('does not save without a name', async () => {
    render(
      <IdeaModal
        collections={collections}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )
    await act(async () => {
      screen.getByRole('button', { name: 'Guardar idea' }).click()
    })
    expect(createIdeaMock).not.toHaveBeenCalled()
    expect(screen.getByText('Poné un nombre.')).toBeInTheDocument()
  })

  it('saves in the preselected collection with its priority', async () => {
    const onSaved = vi.fn()
    render(
      <IdeaModal
        collections={collections}
        defaultCollectionId="c1"
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    )
    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Joyero con tapa' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Alta' }))
    await act(async () => {
      screen.getByRole('button', { name: 'Guardar idea' }).click()
    })
    expect(createIdeaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Joyero con tapa',
        collection_id: 'c1',
        priority: 'high',
        created_by: 'op-1',
        url: null,
      }),
    )
    expect(onSaved).toHaveBeenCalled()
  })
})
