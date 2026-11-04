import { useEffect, useRef, useState } from 'react'
import type { ShopSettings } from '../lib/types'
import { waLink } from '../lib/whatsapp'
import { IconPin, IconTruck, IconWhatsApp } from './Icons'

const AUTO_MS = 4000
const MOBILE = '(max-width: 899px)'

/**
 * Franja de beneficios. En desktop van los tres en fila; en mobile es un
 * slider de a uno que se desliza con el dedo y avanza solo cada AUTO_MS
 * hasta que la persona lo toca (o si pidió reducir el movimiento, nunca).
 */
export function Perks({ settings }: { settings: ShopSettings }) {
  const list = useRef<HTMLUListElement>(null)
  const touched = useRef(false)
  const [active, setActive] = useState(0)
  const count = 3

  const goTo = (i: number) => {
    const el = list.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  useEffect(() => {
    const mq = window.matchMedia?.(MOBILE)
    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    if (!mq || reduce) return
    const timer = setInterval(() => {
      const el = list.current
      if (!el || touched.current || !mq.matches || document.hidden) return
      const i = Math.round(el.scrollLeft / el.clientWidth)
      goTo((i + 1) % count)
    }, AUTO_MS)
    return () => clearInterval(timer)
  }, [])

  const stop = () => (touched.current = true)

  return (
    <section className="perks" aria-label="Envíos, retiro y atención">
      <ul
        className="container perks-list"
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget
          setActive(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)))
        }}
        onPointerDown={stop}
        onTouchStart={stop}
        onFocus={stop}
      >
        <li>
          <IconTruck size={28} />
          <strong>Envíos a todo el país</strong>
          <span>En Corrientes y al resto del país</span>
        </li>
        <li>
          <IconPin size={28} />
          <strong>Retirá en el local</strong>
          <span>{settings.local.direccion}</span>
        </li>
        <li>
          <a
            href={waLink(
              settings.whatsapp,
              '¡Hola Global3D! Tengo una consulta.',
            )}
            target="_blank"
            rel="noreferrer"
          >
            <IconWhatsApp size={28} />
            <strong>Te atendemos por WhatsApp</strong>
            <span>Consultas y pedidos a medida</span>
          </a>
        </li>
      </ul>
      <div className="perks-dots">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Ver beneficio ${i + 1} de ${count}`}
            aria-current={i === active ? 'true' : undefined}
            onClick={() => {
              stop()
              goTo(i)
            }}
          />
        ))}
      </div>
    </section>
  )
}
