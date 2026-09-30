import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import Icon from '@/components/Icon'
import { useToast } from '@/components/useToast'
import { toISODate } from '@/features/orders/validation'
import IdeaCard from './IdeaCard'
import IdeaDrawer from './IdeaDrawer'
import IdeaModal from './IdeaModal'
import {
  collectionCountdown,
  filterIdeas,
  groupByCollection,
  shortDate,
  statusSummary,
  STATUS_LABEL,
  STATUSES,
  type Collection,
  type Idea,
  type IdeaStatus,
} from './ideas'
import {
  createCollection,
  deleteCollection,
  listCollections,
  listIdeas,
  updateCollection,
  updateIdea,
} from './ideas.api'
import '@/features/orders/taller.css'
import './ideas.css'

type View = 'gallery' | 'board'
const VIEW_KEY = 'g3d.ideasView'
const BOARD_SHOWN = 5

const NEXT: Record<IdeaStatus, IdeaStatus | null> = {
  idea: 'to_test',
  to_test: 'tested',
  tested: null,
}

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'gallery'
  } catch {
    return 'gallery'
  }
}

interface CollectionForm {
  id: string | null
  name: string
  date: string
}

export default function IdeasPage() {
  const [toast, showToast] = useToast()
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setViewState] = useState<View>(readView)
  const [chip, setChip] = useState('all')
  const [onlyHigh, setOnlyHigh] = useState(false)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState<{ collection: string | null } | null>(
    null,
  )
  const [openId, setOpenId] = useState<string | null>(null)
  const [form, setForm] = useState<CollectionForm | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const today = useMemo(() => toISODate(new Date()), [])

  const reload = useCallback(async () => {
    try {
      const [i, c] = await Promise.all([listIdeas(), listCollections()])
      setIdeas(i)
      setCollections(c)
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudieron cargar las ideas.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  function setView(next: View) {
    setViewState(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      /* preferencia opcional */
    }
  }

  const byId = useMemo(
    () => new Map(collections.map((c) => [c.id, c])),
    [collections],
  )
  const shown = filterIdeas(ideas, { collection: chip, onlyHigh, query })
  const narrowed = onlyHigh || query.trim() !== ''
  const groups = groupByCollection(
    shown,
    chip === 'all'
      ? collections
      : chip === 'none'
        ? []
        : collections.filter((c) => c.id === chip),
  ).filter((g) => g.ideas.length > 0 || !narrowed)
  const loose = ideas.filter((i) => !i.collection_id).length
  const open = ideas.find((i) => i.id === openId) ?? null

  function replace(next: Idea) {
    setIdeas((prev) => prev.map((i) => (i.id === next.id ? next : i)))
  }

  async function move(idea: Idea, status: IdeaStatus) {
    try {
      await updateIdea(idea.id, { status })
      replace({ ...idea, status })
      showToast(`${idea.title}: ${STATUS_LABEL[status].toLowerCase()}`, {
        label: 'Deshacer',
        onClick: () =>
          void updateIdea(idea.id, { status: idea.status }).then(() =>
            replace(idea),
          ),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo mover.')
    }
  }

  async function saveCollection(e: FormEvent) {
    e.preventDefault()
    if (!form || !form.name.trim()) return
    try {
      if (form.id) {
        await updateCollection(form.id, {
          name: form.name.trim(),
          target_date: form.date || null,
        })
      } else {
        const created = await createCollection(
          form.name,
          form.date || null,
          collections.length,
        )
        setChip(created.id)
      }
      setForm(null)
      await reload()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar la colección.',
      )
    }
  }

  async function removeCollection(c: CollectionForm) {
    if (
      !c.id ||
      !window.confirm(
        `¿Borrar la colección “${c.name}”? Sus ideas quedan en “Sin colección”.`,
      )
    )
      return
    try {
      await deleteCollection(c.id)
      setForm(null)
      if (chip === c.id) setChip('all')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar.')
    }
  }

  const editCollection = (c: Collection) =>
    setForm({ id: c.id, name: c.name, date: c.target_date ?? '' })

  return (
    <main className="ideas">
      <header className="page-head">
        <div className="page-head__main">
          <p className="eyebrow">Próximos productos</p>
          <h1 className="page-title">Ideas</h1>
        </div>
        <div className="page-head__actions">
          <div className="segmented" role="group" aria-label="Vista">
            <button
              type="button"
              aria-pressed={view === 'gallery'}
              onClick={() => setView('gallery')}
            >
              <Icon name="image" size={16} />
              Galería
            </button>
            <button
              type="button"
              aria-pressed={view === 'board'}
              onClick={() => setView('board')}
            >
              <Icon name="kanban" size={16} />
              Tablero
            </button>
          </div>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() =>
              setAdding({
                collection: chip !== 'all' && chip !== 'none' ? chip : null,
              })
            }
          >
            <Icon name="plus" size={18} />
            Agregar idea
          </button>
        </div>
      </header>

      <div className="ifilters">
        <div className="ichips" role="group" aria-label="Colecciones">
          <button
            type="button"
            className="ichip"
            aria-pressed={chip === 'all'}
            onClick={() => setChip('all')}
          >
            Todas <span className="ichip__n">{ideas.length}</span>
          </button>
          {collections.map((c) => {
            const n = ideas.filter((i) => i.collection_id === c.id).length
            const left = collectionCountdown(c.target_date, today)
            return (
              <button
                key={c.id}
                type="button"
                className="ichip"
                aria-pressed={chip === c.id}
                onClick={() => setChip(c.id)}
                onDoubleClick={() => editCollection(c)}
              >
                {c.name}
                {c.target_date && (
                  <span className="ichip__date">
                    {shortDate(c.target_date)}
                    {left ? ` · ${left}` : ''}
                  </span>
                )}
                <span className="ichip__n">{n}</span>
              </button>
            )
          })}
          <button
            type="button"
            className="ichip"
            aria-pressed={chip === 'none'}
            onClick={() => setChip('none')}
          >
            Sin colección <span className="ichip__n">{loose}</span>
          </button>
          <button
            type="button"
            className="ichip ichip--add"
            onClick={() => setForm({ id: null, name: '', date: '' })}
          >
            <Icon name="plus" size={16} />
            Colección
          </button>
        </div>
        <div className="ifilters__right">
          <label className="orders-search isearch">
            <Icon name="search" size={18} />
            <span className="visually-hidden">Buscar</span>
            <input
              type="search"
              placeholder="Buscar idea"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="ichip ichip--high"
            aria-pressed={onlyHigh}
            onClick={() => setOnlyHigh((v) => !v)}
          >
            <Icon name="flag" size={16} />
            Solo alta
          </button>
        </div>
      </div>

      {form && (
        <form className="icoll-form" onSubmit={saveCollection}>
          <label className="imodal__field imodal__field--grow">
            <span className="field-label">
              {form.id ? 'Editar colección' : 'Nueva colección'}
            </span>
            <input
              className="input"
              autoFocus
              placeholder="Día de la Madre, Navidad…"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="imodal__field">
            <span className="field-label">Fecha (opcional)</span>
            <input
              className="input"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </label>
          <div className="icoll-form__actions">
            {form.id && (
              <button
                type="button"
                className="btn btn--ghost idrawer__danger"
                onClick={() => void removeCollection(form)}
              >
                Borrar
              </button>
            )}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setForm(null)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!form.name.trim()}
            >
              Guardar
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="muted">Cargando…</p>
      ) : ideas.length === 0 && collections.length === 0 ? (
        <div className="card empty">
          <strong>Todavía no hay ideas</strong>
          Pegá un link de MakerWorld, Cults o Instagram, o una captura, y queda
          guardada para cuando haya tiempo de probarla.
        </div>
      ) : view === 'gallery' ? (
        <div className="igallery">
          {groups.length === 0 && (
            <p className="muted">Nada con estos filtros.</p>
          )}
          {groups.map((g) => {
            const left = g.collection
              ? collectionCountdown(g.collection.target_date, today)
              : null
            return (
              <section
                key={g.collection?.id ?? 'none'}
                className="isection"
                aria-label={g.collection?.name ?? 'Sin colección'}
              >
                <header className="isection__head">
                  <h2>
                    {g.collection?.name ?? 'Sin colección'}
                    {g.collection?.target_date && (
                      <span className="isection__date">
                        {shortDate(g.collection.target_date)}
                        {left ? ` · ${left}` : ''}
                      </span>
                    )}
                    {g.collection && (
                      <button
                        type="button"
                        className="icon-btn isection__edit"
                        aria-label={`Editar ${g.collection.name}`}
                        onClick={() => editCollection(g.collection!)}
                      >
                        <Icon name="edit" size={16} />
                      </button>
                    )}
                  </h2>
                  <span className="isection__sum">
                    {g.collection
                      ? statusSummary(g.ideas)
                      : `${g.ideas.length} ${g.ideas.length === 1 ? 'idea' : 'ideas'}`}
                  </span>
                </header>
                <ul className="icards">
                  {g.ideas.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      onOpen={() => setOpenId(idea.id)}
                    />
                  ))}
                  <li>
                    <button
                      type="button"
                      className="icard-add"
                      onClick={() =>
                        setAdding({ collection: g.collection?.id ?? null })
                      }
                    >
                      <Icon name="plus" size={22} />
                      Agregar acá
                    </button>
                  </li>
                </ul>
              </section>
            )
          })}
        </div>
      ) : (
        <div className="iboard">
          {STATUSES.map((s) => {
            const col = shown.filter((i) => i.status === s)
            const all = expanded[s]
            const list = all ? col : col.slice(0, BOARD_SHOWN)
            return (
              <section
                key={s}
                className={`icol icol--${s}`}
                aria-label={STATUS_LABEL[s]}
              >
                <h2 className="icol__head">
                  <i aria-hidden="true" />
                  {STATUS_LABEL[s]}
                  <span>{col.length}</span>
                </h2>
                {col.length === 0 ? (
                  <p className="icol__empty">Nada acá.</p>
                ) : (
                  <ul className="icol__cards">
                    {list.map((idea) => {
                      const next = NEXT[idea.status as IdeaStatus]
                      return (
                        <IdeaCard
                          key={idea.id}
                          idea={idea}
                          collectionName={
                            idea.collection_id
                              ? (byId.get(idea.collection_id)?.name ?? null)
                              : null
                          }
                          onOpen={() => setOpenId(idea.id)}
                        >
                          {next && (
                            <button
                              type="button"
                              className="icard__move"
                              onClick={() => void move(idea, next)}
                            >
                              Pasar a {STATUS_LABEL[next]}
                              <Icon name="next" size={14} />
                            </button>
                          )}
                        </IdeaCard>
                      )
                    })}
                  </ul>
                )}
                {col.length > BOARD_SHOWN && (
                  <button
                    type="button"
                    className="icol__more"
                    onClick={() => setExpanded((e) => ({ ...e, [s]: !all }))}
                  >
                    {all
                      ? 'Mostrar menos'
                      : `+ ${col.length - BOARD_SHOWN} más`}
                  </button>
                )}
              </section>
            )
          })}
        </div>
      )}

      {adding && (
        <IdeaModal
          collections={collections}
          defaultCollectionId={adding.collection}
          onClose={() => setAdding(null)}
          onSaved={(idea, warning) => {
            setAdding(null)
            setIdeas((prev) => [idea, ...prev])
            showToast(warning ?? `Idea guardada: ${idea.title}`)
          }}
        />
      )}
      {open && (
        <IdeaDrawer
          idea={open}
          collections={collections}
          onClose={() => setOpenId(null)}
          onChange={replace}
          onDeleted={(id) => {
            setOpenId(null)
            setIdeas((prev) => prev.filter((i) => i.id !== id))
            showToast('Idea borrada')
          }}
        />
      )}
      {toast}
    </main>
  )
}
