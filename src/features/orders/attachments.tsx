import { useRef, useState } from 'react'
import Icon from '@/components/Icon'
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_KINDS,
  validateAttachment,
} from './orderImages.api'
import './attachments.css'

export interface AttachmentItem {
  key: string
  url: string
  pdf: boolean
  label: string | null
  pending?: boolean
  onRemove?: () => void
}

// "Comprobante" + "seña transferencia" → "Comprobante · seña transferencia"
export function attachmentNote(kind: string, extra: string): string {
  const e = extra.trim()
  return e ? `${kind} · ${e}` : kind
}

export function AttachmentGrid({ items }: { items: AttachmentItem[] }) {
  if (items.length === 0) return null
  return (
    <ul className="att-grid">
      {items.map((item) => (
        <li
          key={item.key}
          className={`att${item.pending ? ' att--pending' : ''}`}
        >
          <a
            className="att__thumb"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir"
          >
            {item.pdf ? (
              <span className="att__pdf">
                <Icon name="receipt" size={26} />
                PDF
              </span>
            ) : (
              <img src={item.url} alt={item.label ?? 'Archivo del pedido'} />
            )}
          </a>
          {item.label && <span className="att__label">{item.label}</span>}
          {item.pending && (
            <span className="att__badge">Se guarda al final</span>
          )}
          {item.onRemove && (
            <button
              type="button"
              className="att__remove"
              aria-label={`Quitar ${item.label ?? 'archivo'}`}
              onClick={item.onRemove}
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

// Pick a kind, optionally add a note, then choose one or more files.
export function AddAttachment({
  onFiles,
  busy,
  onError,
}: {
  onFiles: (files: File[], note: string) => void
  busy?: boolean
  onError: (message: string | null) => void
}) {
  const [kind, setKind] = useState<string>(ATTACHMENT_KINDS[0])
  const [extra, setExtra] = useState('')
  const input = useRef<HTMLInputElement>(null)

  function handle(list: FileList | null) {
    const files = Array.from(list ?? [])
    if (input.current) input.current.value = ''
    if (files.length === 0) return
    const bad = files.map(validateAttachment).find(Boolean)
    if (bad) {
      onError(bad)
      return
    }
    onError(null)
    onFiles(files, attachmentNote(kind, extra))
    setExtra('')
  }

  return (
    <div className="att-add">
      <div className="chips" role="group" aria-label="Tipo de archivo">
        {ATTACHMENT_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className="chip"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
          >
            {k}
          </button>
        ))}
      </div>
      <div className="att-add__row">
        <input
          className="input"
          placeholder="Nota (opcional): ej. seña por transferencia"
          aria-label="Nota del archivo"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
        />
        <label className={`btn btn--dark${busy ? ' is-busy' : ''}`}>
          <Icon name="plus" size={18} />
          {busy ? 'Subiendo…' : 'Agregar archivo'}
          <input
            ref={input}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            multiple
            className="visually-hidden"
            disabled={busy}
            onChange={(e) => handle(e.target.files)}
          />
        </label>
      </div>
    </div>
  )
}
