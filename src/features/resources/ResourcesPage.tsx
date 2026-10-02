import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '@/components/Icon'
import { useToast } from '@/components/useToast'
import { useOperator } from '@/features/operators/operator-context'
import {
  createIdea,
  listCollections,
  readLink,
} from '@/features/ideas/ideas.api'
import { detectSource, type Collection } from '@/features/ideas/ideas'
import FoundIt from './FoundIt'
import MultiSearch from './MultiSearch'
import { PinnedCard, ResourceCard } from './ResourceCard'
import ResourceModal from './ResourceModal'
import SavedSearches from './SavedSearches'
import {
  buildSearchUrl,
  domainOf,
  openSearch,
  pinnedResources,
  searchSites,
  sections,
  type Category,
  type Resource,
  type SavedSearch,
} from './resources'
import {
  createSavedSearch,
  deleteSavedSearch,
  listResources,
  listSavedSearches,
  touchSavedSearch,
  updateResource,
} from './resources.api'
import './resources.css'

const EXCLUDED_KEY = 'rs-sites-off'

function readExcluded(): string[] {
  try {
    const raw = localStorage.getItem(EXCLUDED_KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

// The team's bookmarks, plus one box to search every model site at once.
export default function ResourcesPage() {
  const { current } = useOperator()
  const me = current?.id ?? null
  const navigate = useNavigate()
  const [toast, showToast] = useToast(3000)
  const [resources, setResources] = useState<Resource[] | null>(null)
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')
  const [excluded, setExcluded] = useState<string[]>(readExcluded)
  const [blocked, setBlocked] = useState<{ name: string; url: string }[]>([])
  const [active, setActive] = useState<SavedSearch | null>(null)
  const [modal, setModal] = useState<{
    resource: Resource | null
    category: Category
  } | null>(null)

  const load = useCallback(async () => {
    try {
      const [rs, ss] = await Promise.all([listResources(), listSavedSearches()])
      setResources(rs)
      setSearches(ss)
      setError(null)
    } catch (err) {
      setResources([])
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los recursos.',
      )
    }
    try {
      setCollections(await listCollections())
    } catch {
      setCollections([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const all = resources ?? []
  const sites = searchSites(all)
  const selected = sites
    .filter((s) => !excluded.includes(s.id))
    .map((s) => s.id)
  const pinned = pinnedResources(all)
  const groups = sections(all, filter)
  const activeCollection =
    collections.find((c) => c.id === active?.collection_id) ?? null

  function run(q: string, ids: readonly string[]) {
    const chosen = sites.filter((s) => ids.includes(s.id))
    const links = chosen.map((s) => ({
      name: s.name,
      url: buildSearchUrl(s.search_url!, q),
    }))
    const off = openSearch(links.map((l) => l.url))
    setBlocked(links.filter((l) => off.includes(l.url)))
  }

  function toggleSite(id: string) {
    setExcluded((list) => {
      const next = list.includes(id)
        ? list.filter((x) => x !== id)
        : [...list, id]
      try {
        localStorage.setItem(EXCLUDED_KEY, JSON.stringify(next))
      } catch {
        // Only a convenience.
      }
      return next
    })
  }

  async function saveSearch(name: string, collectionId: string | null) {
    try {
      const created = await createSavedSearch(
        {
          name,
          query: query.trim(),
          resource_ids: selected,
          collection_id: collectionId,
        },
        me,
      )
      setSearches((list) => [created, ...list])
      setActive(created)
      showToast('Búsqueda guardada')
    } catch (err) {
      showToast('No se pudo guardar la búsqueda.')
      throw err
    }
  }

  function openSaved(s: SavedSearch) {
    const ids = s.resource_ids.filter((id) => sites.some((x) => x.id === id))
    setQuery(s.query)
    setActive(s)
    run(s.query, ids.length ? ids : selected)
    void touchSavedSearch(s.id)
      .then((t) =>
        setSearches((list) => list.map((x) => (x.id === t.id ? t : x))),
      )
      .catch(() => {})
  }

  async function removeSaved(s: SavedSearch) {
    try {
      await deleteSavedSearch(s.id)
      setSearches((list) => list.filter((x) => x.id !== s.id))
      if (active?.id === s.id) setActive(null)
    } catch {
      showToast('No se pudo borrar la búsqueda.')
    }
  }

  async function togglePin(r: Resource) {
    const next = { ...r, pinned: !r.pinned }
    setResources((list) => (list ?? []).map((x) => (x.id === r.id ? next : x)))
    try {
      await updateResource(r.id, { pinned: next.pinned })
    } catch {
      setResources((list) => (list ?? []).map((x) => (x.id === r.id ? r : x)))
      showToast('No se pudo cambiar.')
    }
  }

  async function saveIdea(url: string) {
    try {
      const preview = await readLink(url)
      await createIdea({
        title: preview.title?.trim() || domainOf(url),
        url,
        source: detectSource(url),
        preview_image_url: preview.image,
        preview_author: preview.author,
        collection_id: active?.collection_id ?? null,
        created_by: me,
      })
      showToast('Guardada en Ideas', {
        label: 'Ver',
        onClick: () => navigate('/admin/ideas'),
      })
    } catch (err) {
      showToast('No se pudo guardar la idea.')
      throw err
    }
  }

  function saved(r: Resource) {
    setResources((list) => {
      const l = list ?? []
      return l.some((x) => x.id === r.id)
        ? l.map((x) => (x.id === r.id ? r : x))
        : [...l, r]
    })
    setModal(null)
  }

  return (
    <main className="rs">
      <header className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">Herramientas</p>
          <h1 className="page-title">Recursos</h1>
        </div>
        <div className="page-head__actions">
          <label className="rs-filter">
            <Icon name="search" size={16} />
            <input
              aria-label="Buscar en recursos"
              placeholder="Buscar en recursos"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setModal({ resource: null, category: 'modelos' })}
          >
            <Icon name="plus" size={18} />
            Agregar recurso
          </button>
        </div>
      </header>

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}

      <MultiSearch
        sites={sites}
        selected={selected}
        query={query}
        blocked={blocked}
        active={active}
        collections={collections}
        onQuery={setQuery}
        onToggle={toggleSite}
        onSearch={() => run(query, selected)}
        onClearActive={() => setActive(null)}
        onSave={saveSearch}
      />

      <div className="rs-layout">
        <div className="rs-main">
          {resources == null ? (
            <p className="rs-empty">Cargando…</p>
          ) : (
            <>
              {pinned.length > 0 && !filter.trim() && (
                <section className="rs-section" aria-label="Fijados">
                  <h2 className="rs-section__title">
                    <Icon name="star" size={18} className="rs-section__star" />
                    Fijados
                  </h2>
                  <div className="rs-pins">
                    {pinned.map((r) => (
                      <PinnedCard key={r.id} resource={r} />
                    ))}
                  </div>
                </section>
              )}
              {groups.length === 0 && (
                <p className="rs-empty">No hay recursos que coincidan.</p>
              )}
              {groups.map(({ section, items }) => (
                <section
                  key={section.key}
                  className="rs-section"
                  aria-label={section.title}
                >
                  <h2 className="rs-section__title">{section.title}</h2>
                  <div className="rs-grid">
                    {items.map((r) => (
                      <ResourceCard
                        key={r.id}
                        resource={r}
                        onTogglePin={(x) => void togglePin(x)}
                        onEdit={(x) =>
                          setModal({
                            resource: x,
                            category: x.category as Category,
                          })
                        }
                      />
                    ))}
                    {section.add && !filter.trim() && (
                      <button
                        type="button"
                        className="rs-add"
                        onClick={() =>
                          setModal({
                            resource: null,
                            category: section.add!.category,
                          })
                        }
                      >
                        <strong>
                          <Icon name="plus" size={16} />
                          {section.add.label}
                        </strong>
                        {items.length === 0 && <span>{section.add.hint}</span>}
                      </button>
                    )}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>
        <aside className="rs-aside">
          <SavedSearches
            searches={searches}
            collections={collections}
            siteCount={(s) =>
              s.resource_ids.filter((id) => sites.some((x) => x.id === id))
                .length
            }
            onOpen={openSaved}
            onDelete={(s) => void removeSaved(s)}
          />
          <FoundIt collection={activeCollection} onSave={saveIdea} />
        </aside>
      </div>

      {modal && (
        <ResourceModal
          resource={modal.resource}
          category={modal.category}
          operatorId={me}
          onClose={() => setModal(null)}
          onSaved={saved}
          onDeleted={(id) => {
            setResources((list) => (list ?? []).filter((x) => x.id !== id))
            setModal(null)
            showToast('Recurso borrado')
          }}
        />
      )}
      {toast}
    </main>
  )
}
