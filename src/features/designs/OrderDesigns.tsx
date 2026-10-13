import { useEffect, useState } from 'react'
import Icon from '@/components/Icon'
import {
  KIND_LABEL,
  designFileUrl,
  designFiles,
  designUrl,
  listOrderDesigns,
  type DesignKind,
  type DesignRow,
} from './designs.api'
import './designs.css'

// Diseños 3D del pedido (guardados desde /herramientas): miniatura, link para
// volver a abrirlo en el generador y los archivos generados para descargar.
export default function OrderDesigns({ orderId }: { orderId: string }) {
  const [designs, setDesigns] = useState<DesignRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    listOrderDesigns(orderId)
      .then((rows) => !cancelled && setDesigns(rows))
      .catch(() => undefined)
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [orderId])

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">Diseños 3D</h2>
        <span className="spacer" />
        <a
          href={`/herramientas/letra-caja.html?pedido=${orderId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--ghost btn--sm"
        >
          Nueva letra caja
          <Icon name="external" size={16} />
        </a>
      </div>
      {loading ? null : designs.length === 0 ? (
        <p className="designs__empty">
          Sin diseños. Los que se guarden en Herramientas con este pedido
          aparecen acá.
        </p>
      ) : (
        <ul className="designs__list">
          {designs.map((d) => (
            <li key={d.id} className="designs__item">
              {d.thumbnail_path ? (
                <img
                  className="designs__thumb"
                  src={designFileUrl(d.thumbnail_path)}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <span className="designs__thumb" aria-hidden="true" />
              )}
              <div className="designs__body">
                <a
                  className="designs__name"
                  href={designUrl(d)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {d.name}
                </a>
                <span className="designs__meta">
                  {KIND_LABEL[d.kind as DesignKind] ?? d.kind} ·{' '}
                  {new Date(d.updated_at).toLocaleDateString('es-AR')}
                </span>
                <span className="designs__files">
                  {designFiles(d).map((f) => (
                    <a
                      key={f.path}
                      href={designFileUrl(f.path)}
                      download={f.name}
                    >
                      {f.kind.toUpperCase()}
                    </a>
                  ))}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
