import { Link } from 'react-router-dom'

export function GridSkeleton({ n = 8 }: { n?: number }) {
  return (
    <div className="grid" aria-busy="true" aria-label="Cargando productos">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="skeleton" style={{ aspectRatio: '3 / 4' }} />
      ))}
    </div>
  )
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="empty">
      <h3>No pudimos cargar el catálogo</h3>
      <p className="muted">
        Revisá tu conexión. Si sigue sin andar, escribinos por WhatsApp.
      </p>
      <button className="btn btn-dark" type="button" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="container empty">
      <h1>No encontramos esta página</h1>
      <p className="muted">Puede que el producto ya no esté publicado.</p>
      <Link to="/catalogo" className="btn btn-primary">
        Ver el catálogo
      </Link>
    </div>
  )
}
