import { useState, type FormEvent } from 'react'
import Icon from '@/components/Icon'
import { isUrl, type Collection } from '@/features/ideas/ideas'

export default function FoundIt({
  collection,
  onSave,
}: {
  collection: Collection | null
  onSave: (url: string) => Promise<void>
}) {
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = isUrl(link.trim())

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!ok || busy) return
    setBusy(true)
    try {
      await onSave(link.trim())
      setLink('')
    } catch {
      // The page says it failed; keep the link to retry.
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card rs-side" aria-label="¿Encontraste algo?">
      <h2 className="rs-side__title">¿Encontraste algo?</h2>
      <p className="rs-side__hint">
        Pegá el link del modelo y queda guardado en Ideas con su foto.
      </p>
      {collection && (
        <p className="rs-found__col">
          <Icon name="bulb" size={14} />
          Se guarda en Colección {collection.name}
        </p>
      )}
      <form className="rs-found" onSubmit={submit}>
        <label className="rs-link">
          <Icon name="link" size={16} />
          <input
            aria-label="Link del modelo encontrado"
            placeholder="Pegá el link…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="btn btn--ghost btn--block"
          disabled={!ok || busy}
        >
          <Icon name="bulb" size={16} />
          Guardar como idea
        </button>
      </form>
    </section>
  )
}
