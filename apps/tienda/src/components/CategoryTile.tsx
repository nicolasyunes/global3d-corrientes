import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { optimizedSrc } from '../lib/img'
import { Img } from './bits'

// Cada cuánto cambia la foto de un recuadro. Los recuadros arrancan
// escalonados para que nunca cambien dos a la vez.
const INTERVAL_MS = 6000
const STAGGER_MS = 1200

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Recuadro del mosaico del hero. Lleva a la categoría y va mostrando, de a
 * una, las fotos de sus productos con un fundido. No rota si hay una sola
 * foto, si el usuario pidió reducir el movimiento, con el mouse o el foco
 * encima, ni con la pestaña oculta. Precarga la foto siguiente antes de
 * mostrarla.
 */
export function CategoryTile({
  slug,
  label,
  images,
  big = false,
  order = 0,
}: {
  slug: string
  label: string
  images: string[]
  big?: boolean
  order?: number
}) {
  const size = big ? 'full' : 'card'
  const [cur, setCur] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const curRef = useRef(0)
  const paused = useRef(false)

  useEffect(() => {
    curRef.current = 0
    setCur(0)
    setPrev(null)
    if (images.length < 2 || prefersReducedMotion()) return
    let alive = true
    let timer: ReturnType<typeof setInterval> | undefined
    const tick = () => {
      if (paused.current || document.hidden) return
      const next = (curRef.current + 1) % images.length
      const pre = new Image()
      const show = () => {
        if (!alive) return
        setPrev(curRef.current)
        curRef.current = next
        setCur(next)
      }
      pre.onload = show
      pre.onerror = show
      pre.src = optimizedSrc(images[next], size)
    }
    const start = setTimeout(() => {
      timer = setInterval(tick, INTERVAL_MS)
    }, order * STAGGER_MS)
    return () => {
      alive = false
      clearTimeout(start)
      if (timer) clearInterval(timer)
    }
  }, [images, order, size])

  const pause = () => (paused.current = true)
  const resume = () => (paused.current = false)

  return (
    <Link
      to={`/c/${slug}`}
      className={big ? 'bento-tile bento-big' : 'bento-tile'}
      aria-label={label}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      {prev !== null && (
        <span className="bento-layer" key={`p-${images[prev]}`}>
          <Img src={images[prev]} alt="" label={label} size={size} />
        </span>
      )}
      <span
        className={prev !== null ? 'bento-layer is-in' : 'bento-layer'}
        key={images[cur] ?? 'vacio'}
        onAnimationEnd={() => setPrev(null)}
      >
        <Img
          src={images[cur] ?? null}
          alt=""
          label={label}
          size={size}
          eager={big && cur === 0}
        />
      </span>
    </Link>
  )
}
