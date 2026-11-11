import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { cleanPostLinks } from '../lib/instagram'
import type { InstagramPost } from '../lib/types'

const EMBED_SCRIPT = 'https://www.instagram.com/embed.js'

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } }
  }
}

// Últimas publicaciones de Instagram. Con token de la API muestra una grilla
// propia; si no, las publicaciones elegidas a mano (`instagram_posts` en
// shop_settings) con el embed oficial. Sin ninguna de las dos, no se muestra.
export function InstagramFeed({
  handle,
  links,
  settled = true,
}: {
  handle: string
  links?: string[]
  /** Los ajustes (de donde salen los links elegidos) ya llegaron */
  settled?: boolean
}) {
  const [posts, setPosts] = useState<InstagramPost[]>([])
  const [near, setNear] = useState(false)
  const section = useRef<HTMLElement>(null)
  const picked = cleanPostLinks(links)

  // Con publicaciones elegidas a mano, la API es solo una mejora: se la pide
  // recién cuando la sección está por verse, para no sumar una llamada (de
  // ~1 s si la función estaba dormida) a la carga de la página. Sin
  // elegidas, la API es la única fuente y se pide enseguida.
  // `settled`: los ajustes ya llegaron. Antes de eso la lista elegida está
  // vacía aunque después no lo esté, y no hay que confundirlo con "sin elegidas".
  const hasPicked = picked.length > 0
  const fetchNow = settled && (!hasPicked || near)

  useEffect(() => {
    const el = section.current
    if (!hasPicked || !el) return
    if (!('IntersectionObserver' in window)) {
      setNear(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true)
          io.disconnect()
        }
      },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasPicked])

  useEffect(() => {
    if (!fetchNow) return
    let alive = true
    api
      .instagram()
      .then((p) => alive && setPosts(p.slice(0, 6)))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [fetchNow])

  const useApi = posts.length >= 3
  if (!useApi && picked.length === 0) return null

  return (
    <section className="section" aria-labelledby="ig-title" ref={section}>
      <div className="container">
        <div className="section-head">
          <h2 id="ig-title">En Instagram</h2>
          <a
            href={`https://www.instagram.com/${handle}/`}
            target="_blank"
            rel="noreferrer"
          >
            @{handle}
          </a>
        </div>
        {useApi ? <ApiGrid posts={posts} /> : <Embeds links={picked} />}
      </div>
    </section>
  )
}

function ApiGrid({ posts }: { posts: InstagramPost[] }) {
  return (
    <ul className="ig-grid">
      {posts.map((p) => (
        <li key={p.id}>
          <a
            href={p.url}
            target="_blank"
            rel="noreferrer"
            aria-label={p.caption || 'Publicación de Instagram'}
          >
            <img src={p.image} alt="" loading="lazy" decoding="async" />
            {p.isVideo && (
              <svg className="ig-play" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            )}
          </a>
        </li>
      ))}
    </ul>
  )
}

// El script de Instagram se carga recién cuando la sección está por verse.
function Embeds({ links }: { links: string[] }) {
  const ref = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const run = () => {
      if (window.instgrm) {
        window.instgrm.Embeds.process()
        return
      }
      if (document.querySelector(`script[src="${EMBED_SCRIPT}"]`)) return
      const s = document.createElement('script')
      s.src = EMBED_SCRIPT
      s.async = true
      document.body.appendChild(s)
    }
    if (!('IntersectionObserver' in window)) {
      run()
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          run()
        }
      },
      { rootMargin: '400px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [links])

  return (
    <ul className="ig-embeds" ref={ref}>
      {links.map((url) => (
        <li key={url}>
          <blockquote
            className="instagram-media"
            data-instgrm-permalink={url}
            data-instgrm-version="14"
          >
            <a href={url} target="_blank" rel="noreferrer">
              Ver esta publicación en Instagram
            </a>
          </blockquote>
        </li>
      ))}
    </ul>
  )
}
