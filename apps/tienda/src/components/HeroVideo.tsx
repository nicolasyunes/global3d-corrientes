import { Link } from 'react-router-dom'

const BASE = import.meta.env.BASE_URL
const VIDEO = `${BASE}hero/global3d-hero.mp4`
const POSTER = `${BASE}hero/global3d-hero-poster.jpg`

// Con "reducir movimiento" el video no arranca solo: queda el poster.
function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

// Portada: la impresora imprimiendo, con el título y las dos acciones encima.
export function HeroVideo() {
  const still = prefersReducedMotion()
  return (
    <div className="hero-video">
      <video
        className="hero-video-media"
        src={VIDEO}
        poster={POSTER}
        autoPlay={!still}
        muted
        loop
        playsInline
        preload={still ? 'none' : 'auto'}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className="hero-video-copy">
        <h1>
          Impresión 3D <span>en Corrientes</span>
        </h1>
        <p>
          Llaveros, vasos, trofeos y piezas grandes, impresas en nuestro
          taller.
        </p>
        <div className="hero-video-cta">
          <Link to="/catalogo" className="btn btn-primary">
            Ver catálogo
          </Link>
          <Link to="/a-medida" className="btn hero-video-ghost">
            Pedir a medida
          </Link>
        </div>
      </div>
    </div>
  )
}
