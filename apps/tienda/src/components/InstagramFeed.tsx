import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { InstagramPost } from '../lib/types'

// Últimas publicaciones de Instagram. Si no hay token cargado o la API falla,
// no se muestra nada.
export function InstagramFeed({ handle }: { handle: string }) {
  const [posts, setPosts] = useState<InstagramPost[]>([])

  useEffect(() => {
    let alive = true
    api
      .instagram()
      .then((p) => alive && setPosts(p.slice(0, 6)))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  if (posts.length < 3) return null

  return (
    <section className="section" aria-labelledby="ig-title">
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
                  <svg
                    className="ig-play"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M8 5v14l11-7z" fill="currentColor" />
                  </svg>
                )}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
