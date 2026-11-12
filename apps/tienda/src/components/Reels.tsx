import { useEffect, useRef, useState } from 'react'
import { cleanReels, type Reel } from '../lib/reels'
import type { ShopSettings } from '../lib/types'

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

// Videos cortos (los reels que usamos en Instagram) cargados a mano en
// `reels` de shop_settings. Se ven en tarjetas verticales que se reproducen
// solas, mudas y en loop, mientras están a la vista. Sin videos cargados, no
// se muestra la sección.
export function Reels({ settings }: { settings: ShopSettings }) {
  const reels = cleanReels(settings.reels, import.meta.env.BASE_URL)
  if (reels.length === 0) return null

  return (
    <section className="section" aria-labelledby="reels-title">
      <div className="container">
        <div className="section-head">
          <h2 id="reels-title">Mirá cómo quedan</h2>
          <a
            href={`https://www.instagram.com/${settings.instagram}/`}
            target="_blank"
            rel="noreferrer"
          >
            Más en @{settings.instagram}
          </a>
        </div>
        <ul className="reels">
          {reels.map((r) => (
            <li key={r.video}>
              <ReelCard reel={r} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/**
 * Una tarjeta. El archivo recién se pide cuando la tarjeta está cerca de la
 * pantalla y se reproduce solo mientras se ve más de la mitad. Se pausa con la
 * pestaña oculta. Si el usuario pidió menos movimiento no arranca sola: queda
 * la imagen y el botón de reproducir.
 */
function ReelCard({ reel }: { reel: Reel }) {
  const card = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [near, setNear] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [reduced] = useState(prefersReducedMotion)

  useEffect(() => {
    const el = card.current
    if (!el || !('IntersectionObserver' in window)) {
      setNear(true)
      return
    }
    const load = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true)
          load.disconnect()
        }
      },
      { rootMargin: '300px' },
    )
    load.observe(el)
    return () => load.disconnect()
  }, [])

  useEffect(() => {
    const el = card.current
    const v = video.current
    if (!el || !v || !near || reduced) return
    let visible = false
    const sync = () => {
      if (visible && !document.hidden) {
        v.play().catch(() => {})
      } else {
        v.pause()
      }
    }
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting)
        sync()
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    document.addEventListener('visibilitychange', sync)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [near, reduced])

  const toggle = () => {
    const v = video.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }

  const label = reel.title || 'Video de Global3D'

  return (
    <div className="reel" ref={card}>
      <video
        ref={video}
        // #t=0.1 hace que se vea el primer cuadro aunque todavía no se reproduzca
        src={near ? `${reel.video}#t=0.1` : undefined}
        poster={reel.poster ?? undefined}
        muted
        loop
        playsInline
        preload={near ? 'metadata' : 'none'}
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={toggle}
      />
      <button
        type="button"
        className={playing ? 'reel-btn is-playing' : 'reel-btn'}
        onClick={toggle}
        aria-label={playing ? `Pausar: ${label}` : `Reproducir: ${label}`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {playing ? (
            <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
          ) : (
            <path d="M8 5v14l11-7z" fill="currentColor" />
          )}
        </svg>
      </button>
      {(reel.title || reel.link) && (
        <div className="reel-foot">
          {reel.title && <strong>{reel.title}</strong>}
          {reel.link && (
            <a href={reel.link} target="_blank" rel="noreferrer">
              Ver en Instagram
            </a>
          )}
        </div>
      )}
    </div>
  )
}
