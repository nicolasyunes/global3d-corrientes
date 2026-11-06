import { useRef, type Dispatch, type SetStateAction } from 'react'
import { api } from '../lib/api'
import {
  fileSize,
  QUOTE_ACCEPT,
  QUOTE_MAX_FILES,
  quoteFileError,
  quoteFileType,
} from '../lib/quoteFiles'
import { IconClose } from './Icons'

export interface QuoteAttachment {
  id: string
  name: string
  size: number
  status: 'uploading' | 'done' | 'error'
  url?: string
  error?: string
}

/**
 * Adjuntos del pedido a medida. Cada archivo se sube apenas se elige, así el
 * botón de WhatsApp abre el chat al instante con los links ya escritos.
 */
export function QuoteFiles({
  files,
  setFiles,
}: {
  files: QuoteAttachment[]
  setFiles: Dispatch<SetStateAction<QuoteAttachment[]>>
}) {
  const input = useRef<HTMLInputElement>(null)
  const patch = (id: string, p: Partial<QuoteAttachment>) =>
    setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, ...p } : f)))

  const add = (list: FileList | null) => {
    if (!list) return
    const room = QUOTE_MAX_FILES - files.length
    for (const file of Array.from(list).slice(0, Math.max(room, 0))) {
      const id = crypto.randomUUID()
      const error = quoteFileError(file)
      setFiles((fs) => [
        ...fs,
        {
          id,
          name: file.name,
          size: file.size,
          status: error ? 'error' : 'uploading',
          error: error ?? undefined,
        },
      ])
      if (error) continue
      api
        .uploadQuoteFile(file, quoteFileType(file)!)
        .then((url) => patch(id, { status: 'done', url }))
        .catch(() =>
          patch(id, {
            status: 'error',
            error: 'No se pudo subir. Probá de nuevo o mandalo por WhatsApp.',
          }),
        )
    }
    if (input.current) input.current.value = ''
  }

  const full = files.length >= QUOTE_MAX_FILES

  return (
    <div className="field">
      <span className="label" id="adjuntos-label">
        Fotos, logo o plano (opcional)
      </span>
      {files.length > 0 && (
        <ul className="quote-files" aria-labelledby="adjuntos-label">
          {files.map((f) => (
            <li key={f.id} data-status={f.status}>
              <span className="quote-file-name">{f.name}</span>
              <span className="quote-file-meta" aria-live="polite">
                {f.status === 'uploading'
                  ? 'Subiendo…'
                  : f.status === 'done'
                    ? `Subido · ${fileSize(f.size)}`
                    : f.error}
              </span>
              <button
                type="button"
                className="quote-file-remove"
                aria-label={`Quitar ${f.name}`}
                onClick={() =>
                  setFiles((fs) => fs.filter((x) => x.id !== f.id))
                }
              >
                <IconClose size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!full && (
        <label className="quote-drop">
          <input
            ref={input}
            type="file"
            accept={QUOTE_ACCEPT}
            multiple
            className="sr-only"
            onChange={(e) => add(e.target.files)}
          />
          <strong>Elegir archivos</strong>
          <span>
            PNG, JPG, SVG o PDF · hasta {QUOTE_MAX_FILES} archivos de 10 MB
          </span>
        </label>
      )}
    </div>
  )
}
