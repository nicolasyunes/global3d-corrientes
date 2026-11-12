import { useEffect, useRef, useState } from 'react'

/**
 * Mapa de Google que recién se pide cuando la sección está por verse. Con
 * `loading="lazy"` solo, el navegador lo cargaba al arrancar, porque mientras
 * llegan los datos la página es corta y el mapa queda "cerca" de la pantalla.
 * Hasta entonces ocupa el mismo lugar, así que no hay saltos al aparecer.
 */
export function LazyMap({ title, src }: { title: string; src: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el) return
    if (!('IntersectionObserver' in window)) {
      setShow(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true)
          io.disconnect()
        }
      },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div className="map-box" ref={box}>
      {show && (
        <iframe
          title={title}
          src={src}
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
    </div>
  )
}
