import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { categoryTint } from '../lib/blister'
import { familyAvailability, familyImage } from '../lib/catalog'
import { optimizedSrc } from '../lib/img'
import type { Family } from '../lib/types'
import { AvailabilityBadge, Img } from './bits'
import { priceLabel } from './ProductCard'

// Variante de prueba "blíster" (ruta /nueva): cada producto se muestra como
// un juguete en su blíster, con la pestaña para colgar y el fondo del color
// de su categoría.

function tintStyle(slug: string): CSSProperties {
  return { '--tint': categoryTint(slug) } as CSSProperties
}

function Tab() {
  return (
    <span className="bl-tab" aria-hidden="true">
      <span className="bl-hole" />
    </span>
  )
}

/** Tarjeta de producto en blíster. Mismos datos que ProductCard. */
export function BlisterCard({ f }: { f: Family }) {
  const variantsInfo =
    f.variants.length > 1
      ? `${f.variants.length} opciones`
      : f.minQty > 1
        ? `Mínimo ${f.minQty} unidades`
        : ''
  return (
    <Link to={`/p/${f.slug}`} className="bl" style={tintStyle(f.category)}>
      <Tab />
      <span className="bl-bubble">
        <Img src={familyImage(f)} alt={f.name} label={f.name} />
      </span>
      <span className="bl-body">
        <span className="bl-name">{f.name}</span>
        {variantsInfo && <span className="bl-meta">{variantsInfo}</span>}
        <span className="bl-row">
          <span className="price">{priceLabel(f)}</span>
          <span className="bl-go" aria-hidden="true">
            +
          </span>
        </span>
        <AvailabilityBadge
          a={familyAvailability(f)}
          personalizable={f.saleMode === 'a_pedido'}
        />
      </span>
    </Link>
  )
}

/** Categoría como blíster chico, con la primera foto de sus productos */
export function BlisterCategory({
  slug,
  label,
  blurb,
  image,
}: {
  slug: string
  label: string
  blurb: string
  image: string | null
}) {
  return (
    <Link to={`/c/${slug}`} className="bl bl-cat" style={tintStyle(slug)}>
      <Tab />
      <span className="bl-bubble">
        {image ? (
          <Img src={image} alt="" label={label} size="thumb" />
        ) : (
          <span className="bl-initial" aria-hidden="true">
            {label.charAt(0)}
          </span>
        )}
      </span>
      <span className="bl-body">
        <span className="bl-name">{label}</span>
        <span className="bl-meta">{blurb}</span>
      </span>
    </Link>
  )
}

// Cada cuánto cambia la foto de un blíster del hero. Arrancan escalonados
// para que nunca cambien dos a la vez.
const INTERVAL_MS = 2400 * 3
const STAGGER_MS = 2400

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Blíster grande del hero: lleva a la categoría y va rotando las fotos de sus
 * productos con un fundido. No rota con una sola foto, con movimiento
 * reducido, con el mouse o el foco encima, ni con la pestaña oculta.
 */
export function RotatingBlister({
  slug,
  label,
  images,
  order,
}: {
  slug: string
  label: string
  images: string[]
  order: number
}) {
  const [cur, setCur] = useState(0)
  const curRef = useRef(0)
  const paused = useRef(false)

  useEffect(() => {
    curRef.current = 0
    setCur(0)
    if (images.length < 2 || prefersReducedMotion()) return
    let alive = true
    let timer: ReturnType<typeof setInterval> | undefined
    const tick = () => {
      if (paused.current || document.hidden) return
      const next = (curRef.current + 1) % images.length
      const pre = new Image()
      const show = () => {
        if (!alive) return
        curRef.current = next
        setCur(next)
      }
      pre.onload = show
      pre.onerror = show
      pre.src = optimizedSrc(images[next], 'card')
    }
    const start = setTimeout(
      () => {
        tick()
        timer = setInterval(tick, INTERVAL_MS)
      },
      (order + 1) * STAGGER_MS,
    )
    return () => {
      alive = false
      clearTimeout(start)
      if (timer) clearInterval(timer)
    }
  }, [images, order])

  const pause = () => (paused.current = true)
  const resume = () => (paused.current = false)

  return (
    <Link
      to={`/c/${slug}`}
      className={`bl bl-hero bl-hero-${order}`}
      style={tintStyle(slug)}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <Tab />
      <span className="bl-bubble">
        <span className="bl-fade" key={images[cur] ?? 'vacio'}>
          <Img
            src={images[cur] ?? null}
            alt=""
            label={label}
            eager={cur === 0}
            priority={order === 1 && cur === 0}
          />
        </span>
      </span>
      <span className="bl-name">{label}</span>
    </Link>
  )
}
