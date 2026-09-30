import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IdeasPage from './IdeasPage'
import type { Collection, Idea } from './ideas'

const { listIdeasMock, listCollectionsMock, updateIdeaMock } = vi.hoisted(
  () => ({
    listIdeasMock: vi.fn(),
    listCollectionsMock: vi.fn(),
    updateIdeaMock: vi.fn(),
  }),
)

vi.mock('./ideas.api', () => ({
  listIdeas: listIdeasMock,
  listCollections: listCollectionsMock,
  updateIdea: updateIdeaMock,
  createCollection: vi.fn(),
  updateCollection: vi.fn(),
  deleteCollection: vi.fn(),
  ideaFileUrl: (p: string) => `pub/${p}`,
}))
vi.mock('./IdeaModal', () => ({ default: () => <div>MODAL</div> }))
vi.mock('./IdeaDrawer', () => ({ default: () => <div>DRAWER</div> }))

function idea(over: Partial<Idea>): Idea {
  return {
    id: 'x',
    title: 'x',
    url: null,
    source: 'other',
    preview_image_url: null,
    preview_author: null,
    collection_id: null,
    status: 'idea',
    priority: 'normal',
    notes: null,
    created_by: null,
    created_at: '',
    updated_at: '',
    files: [],
    ...over,
  }
}

const mom: Collection = {
  id: 'c1',
  name: 'Día de la Madre',
  target_date: null,
  position: 0,
  created_at: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  try {
    localStorage.clear()
  } catch {
    /* sin storage */
  }
  listCollectionsMock.mockResolvedValue([mom])
  listIdeasMock.mockResolvedValue([
    idea({
      id: 'a',
      title: 'Maceta low-poly',
      collection_id: 'c1',
      url: 'https://makerworld.com/m/1',
      priority: 'high',
    }),
    idea({ id: 'b', title: 'Llavero articulado', status: 'to_test' }),
  ])
  updateIdeaMock.mockResolvedValue(undefined)
})

async function renderPage() {
  render(
    <MemoryRouter>
      <IdeasPage />
    </MemoryRouter>,
  )
  await act(async () => {})
}

describe('IdeasPage', () => {
  it('shows the gallery grouped by collection', async () => {
    await renderPage()
    const momSection = screen.getByRole('region', { name: 'Día de la Madre' })
    expect(within(momSection).getByText('Maceta low-poly')).toBeInTheDocument()
    expect(within(momSection).getByText('MakerWorld')).toBeInTheDocument()
    const loose = screen.getByRole('region', { name: 'Sin colección' })
    expect(within(loose).getByText('Llavero articulado')).toBeInTheDocument()
  })

  it('filters by collection chip and by "Solo alta"', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Sin colección/ }))
    expect(screen.queryByText('Maceta low-poly')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Todas/ }))
    fireEvent.click(screen.getByRole('button', { name: /Solo alta/ }))
    expect(screen.queryByText('Llavero articulado')).not.toBeInTheDocument()
    expect(screen.getByText('Maceta low-poly')).toBeInTheDocument()
  })

  it('moves an idea to the next status from the board', async () => {
    await renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Tablero/ }))
    const col = screen.getByRole('region', { name: 'Idea' })
    await act(async () => {
      within(col)
        .getByRole('button', { name: /Pasar a Para probar/ })
        .click()
    })
    expect(updateIdeaMock).toHaveBeenCalledWith('a', { status: 'to_test' })
    const next = screen.getByRole('region', { name: 'Para probar' })
    expect(within(next).getByText('Maceta low-poly')).toBeInTheDocument()
  })
})
