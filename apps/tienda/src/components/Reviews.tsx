import {
  allReviewsUrl,
  cleanReviews,
  formatRating,
  writeReviewUrl,
} from '../lib/reviews'
import type { ShopSettings } from '../lib/types'

// Reseñas de Google elegidas a mano (`resenas` en shop_settings) y botón para
// dejar una. Sin reseñas cargadas, no se muestra.
export function Reviews({ settings }: { settings: ShopSettings }) {
  const r = settings.resenas
  const items = cleanReviews(r?.items)
  if (items.length === 0) return null

  const rating = formatRating(r?.nota)
  const mapsQuery = settings.local.mapsQuery

  return (
    <section className="section" aria-labelledby="rev-title">
      <div className="container">
        <div className="rev-head">
          <div className="stack" style={{ gap: 6 }}>
            <h2 id="rev-title">Lo que dicen nuestros clientes</h2>
            {rating && (
              <p className="rev-summary">
                <strong>{rating}</strong>
                <Stars n={Math.round(r!.nota!)} />
                <span className="muted">
                  {r?.total ? `${r.total} reseñas en Google` : 'en Google'}
                </span>
              </p>
            )}
          </div>
          <a
            className="btn btn-primary"
            href={writeReviewUrl(r, mapsQuery)}
            target="_blank"
            rel="noreferrer"
          >
            Dejá tu reseña
          </a>
        </div>

        <ul className="rev-list">
          {items.map((it, i) => (
            <li key={i} className="rev-card">
              <Stars n={it.estrellas} />
              <blockquote>{it.texto}</blockquote>
              <p className="rev-author">
                <strong>{it.nombre}</strong>
                {it.fecha && <span className="muted"> · {it.fecha}</span>}
              </p>
            </li>
          ))}
        </ul>

        <p className="rev-more">
          <a
            href={allReviewsUrl(r, mapsQuery)}
            target="_blank"
            rel="noreferrer"
          >
            Ver todas en Google
          </a>
        </p>
      </div>
    </section>
  )
}

export function Stars({ n }: { n: number }) {
  return (
    <span className="rev-stars" role="img" aria-label={`${n} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} aria-hidden="true" className={i <= n ? 'on' : ''}>
          ★
        </span>
      ))}
    </span>
  )
}
