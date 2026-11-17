import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  BlisterCard,
  BlisterCategory,
  RotatingBlister,
} from '../components/Blister'
import { InstagramFeed } from '../components/InstagramFeed'
import { LazyMap } from '../components/LazyMap'
import { Perks } from '../components/Perks'
import { Reels } from '../components/Reels'
import { Reviews } from '../components/Reviews'
import {
  CATEGORIES,
  heroPhotos,
  inStock,
  shuffle,
  type CategoryMeta,
} from '../lib/catalog'
import { useShop } from '../lib/data'
import { usePageTitle } from '../lib/usePageTitle'
import { waLink } from '../lib/whatsapp'
import { GridSkeleton, LoadError } from './states'
import '../styles/blister.css'

// Variante de prueba "blíster" del inicio, en /nueva. Misma estructura y
// datos que Home; cambia cómo se ven el hero, las categorías y los productos.
// Si se adopta, reemplaza a Home; si no, se borra este archivo, su ruta,
// components/Blister.tsx, lib/blister.ts y styles/blister.css.

const HERO_ORDER = ['milkshake', 'trofeos', 'vasos']
// Tope de seguridad: alcanza para todas las fotos de una categoría.
const PHOTOS_PER_TILE = 60

export function HomeNueva() {
  usePageTitle(null)
  useNoIndex()
  const { families, settings, status, reload } = useShop()
  const featured = families.filter((f) => f.featured)
  const inStockNow = families.filter(
    (f) => f.saleMode === 'stock' && inStock(f),
  )
  const ready = inStockNow.filter((f) => !f.featured).slice(0, 8)
  const usedCats = CATEGORIES.filter((c) =>
    families.some((f) => f.category === c.slug),
  )
  // Vidriera: la primera categoría va grande, las cuatro siguientes chicas.
  // Cada recuadro rota entre todas las fotos de productos de su categoría, en
  // un orden distinto en cada visita (así no se ven siempre las mismas).
  const tiles = useMemo(
    () =>
      [
        ...HERO_ORDER.map((slug) => CATEGORIES.find((c) => c.slug === slug)),
        ...CATEGORIES,
      ]
        .filter((c, i, all): c is CategoryMeta => !!c && all.indexOf(c) === i)
        .map((c) => {
          const inCat = families.filter((f) => f.category === c.slug)
          const ordered = [
            ...inCat.filter((f) => f.featured),
            ...inCat.filter((f) => !f.featured),
          ]
          return {
            ...c,
            images: shuffle(heroPhotos(ordered, PHOTOS_PER_TILE)),
            any: inCat.length > 0,
          }
        })
        .filter((t) => t.any)
        .slice(0, 3),
    [families],
  )
  const catImage = (slug: string) =>
    heroPhotos(
      families.filter((f) => f.category === slug),
      1,
    )[0] ?? null

  return (
    <div className="bl-page">
      <section className="bl-hero-band">
        <div className="container bl-hero-wrap">
          <div className="hero-copy">
            <h1>Regalos impresos en 3D, con tu nombre, tu club o tu logo</h1>
            <p className="lead">
              Vasos, trofeos, figuras, llaveros y más, para vos, tu familia, tu
              equipo o tu empresa. Retirá en {settings.local.direccion} o te lo
              enviamos.
            </p>
            <div className="hero-cta">
              <Link to="/catalogo" className="btn btn-primary">
                Ver catálogo
              </Link>
              <Link to="/a-medida" className="btn btn-ghost">
                Pedir a medida
              </Link>
            </div>
          </div>
          {status === 'error' ? (
            <LoadError onRetry={reload} />
          ) : (
            <div className="bl-hero-cards">
              {status === 'ready'
                ? tiles.map((t, i) => (
                    <RotatingBlister
                      key={t.slug}
                      slug={t.slug}
                      label={t.label}
                      images={t.images}
                      order={i}
                    />
                  ))
                : [0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={`bl bl-hero bl-hero-${i} skeleton`}
                      style={{ aspectRatio: '4 / 5.6' }}
                      aria-hidden="true"
                    />
                  ))}
            </div>
          )}
        </div>
      </section>

      <Perks settings={settings} />

      <section className="section" aria-labelledby="cats-title">
        <div className="container">
          <div className="section-head">
            <h2 id="cats-title">¿Qué estás buscando?</h2>
          </div>
          <div className="bl-cats">
            {(usedCats.length ? usedCats : CATEGORIES).map((c) => (
              <BlisterCategory
                key={c.slug}
                slug={c.slug}
                label={c.label}
                blurb={c.blurb}
                image={catImage(c.slug)}
              />
            ))}
          </div>
        </div>
      </section>

      <section
        className="section"
        aria-labelledby="feat-title"
        style={{ paddingTop: 8 }}
      >
        <div className="container">
          <div className="section-head">
            <h2 id="feat-title">Los más pedidos</h2>
            <Link to="/catalogo">Ver todo</Link>
          </div>
          {status === 'loading' && <GridSkeleton n={8} />}
          {status === 'error' && <LoadError onRetry={reload} />}
          {status === 'ready' && (
            <div className="bl-grid">
              {featured.map((f) => (
                <BlisterCard key={f.slug} f={f} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Reels settings={settings} />

      <section className="section" aria-labelledby="how-title">
        <div className="container">
          <div className="how">
            <h2 id="how-title">Cómo comprar</h2>
            <ol className="how-steps">
              <li>
                <strong>Elegí tu producto</strong>
                <span>
                  Del catálogo o a medida, con tu nombre, tu club o tu logo.
                </span>
              </li>
              <li>
                <strong>
                  Señá el {settings.sena.porcentaje}% o pagá el total
                </strong>
                <span>
                  Por transferencia, o en efectivo si lo retirás en el local.
                </span>
              </li>
              <li>
                <strong>Retiralo o te lo enviamos</strong>
                <span>
                  Seguí tu pedido con el link y te avisamos por WhatsApp cuando
                  está listo.
                </span>
              </li>
            </ol>
            <div className="how-cta">
              <Link to="/catalogo" className="btn btn-dark">
                Ver catálogo
              </Link>
              <a
                href={waLink(
                  settings.whatsapp,
                  '¡Hola Global3D! Quiero hacer un pedido.',
                )}
                target="_blank"
                rel="noreferrer"
                className="how-wa"
              >
                Prefiero pedirlo por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 8 }}>
        <div className="container">
          <div className="band band-dark">
            <div className="stack" style={{ gap: 8 }}>
              <span
                className="badge"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--on-accent)',
                }}
              >
                Fin de año
              </span>
              <h2>Regalos, trofeos y egresados</h2>
              <p className="muted">
                Pedidos personalizados para fin de año. Para empresas, precios
                por cantidad.
              </p>
            </div>
            <Link to="/a-medida?tipo=empresa" className="btn btn-primary">
              Cotizar mi pedido
            </Link>
          </div>
        </div>
      </section>

      {ready.length > 0 && (
        <section
          className="section"
          aria-labelledby="ready-title"
          style={{ paddingTop: 8 }}
        >
          <div className="container">
            <div className="section-head">
              <h2 id="ready-title">Listo para llevar hoy</h2>
              <Link to="/catalogo?stock=1">Ver todo</Link>
            </div>
            <div className="bl-grid">
              {ready.map((f) => (
                <BlisterCard key={f.slug} f={f} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section" style={{ paddingTop: 8 }}>
        <div className="container grid-2">
          <div className="band band-line">
            <div className="stack" style={{ gap: 8 }}>
              <h2>Filamento para tu impresora</h2>
              <p className="muted">
                PLA, PETG y TPU de 3N3, Grilon3, Elegoo, Bambu Lab y más, con
                stock por color.
              </p>
            </div>
            <Link to="/filamentos" className="btn btn-dark">
              Ver colores
            </Link>
          </div>
          <div className="band band-line">
            <div className="stack" style={{ gap: 8 }}>
              <h2>Empresas y eventos</h2>
              <p className="muted">
                Trofeos, medallas, llaveros con logo y regalos corporativos.
              </p>
            </div>
            <Link to="/a-medida?tipo=empresa" className="btn btn-dark">
              Pedir presupuesto
            </Link>
          </div>
        </div>
      </section>

      {settings.instagram_visible === true && (
        <InstagramFeed
          handle={settings.instagram}
          links={settings.instagram_posts}
          settled={status === 'ready'}
        />
      )}

      <Reviews settings={settings} />

      <section className="section" aria-labelledby="faq-title">
        <div className="container faq">
          <div>
            <h2 id="faq-title">Preguntas frecuentes</h2>
            <div className="faq-list">
              <details>
                <summary>¿Cuánto tarda un pedido?</summary>
                <p>
                  Lo que está en stock lo retirás en el día. Lo personalizado
                  depende del producto: cada ficha dice cuántos días hábiles
                  tarda.
                </p>
              </details>
              <details>
                <summary>¿Cuánto tengo que pagar para empezar?</summary>
                <p>
                  Una seña del {settings.sena.porcentaje}%. El saldo lo pagás al
                  retirar o antes del envío. Si querés, podés pagar el total de
                  una.
                </p>
              </details>
              <details>
                <summary>¿Cómo pago?</summary>
                <p>
                  Por transferencia al alias{' '}
                  <strong>{settings.transferencia.alias}</strong>, o en efectivo
                  si lo retirás en el local.
                </p>
              </details>
              <details>
                <summary>¿Hacen envíos?</summary>
                <p>
                  Sí. En Corrientes: {lowerFirst(settings.envios.corrientes)}.
                  Al resto del país: {lowerFirst(settings.envios.pais)}.
                </p>
              </details>
              <details>
                <summary>¿Cómo les mando mi logo o mi diseño?</summary>
                <p>
                  Por WhatsApp, cuando hacés el pedido. Mandá la imagen en la
                  mejor calidad que tengas; si tenés el archivo en PDF o vector,
                  mejor.
                </p>
              </details>
              <details>
                <summary>¿Hay cantidad mínima?</summary>
                <p>
                  En la mayoría no. Algunos productos con logo, como los
                  llaveros, tienen un mínimo, que figura en la ficha.
                </p>
              </details>
              <details>
                <summary>¿Dónde están?</summary>
                <p>
                  En {settings.local.direccion}. Abrimos{' '}
                  {lowerFirst(settings.local.horarios)}.
                </p>
              </details>
            </div>
          </div>
          <aside className="faq-map" aria-labelledby="map-title">
            <h2 id="map-title">Dónde estamos</h2>
            <LazyMap
              title={`Mapa: ${settings.local.direccion}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(settings.local.mapsQuery)}&z=16&output=embed`}
            />
            <p>
              <strong>{settings.local.direccion}</strong>
              <span>{settings.local.horarios}</span>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.local.mapsQuery)}`}
                target="_blank"
                rel="noreferrer"
              >
                Cómo llegar
              </a>
            </p>
          </aside>
        </div>
      </section>
    </div>
  )
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1)
}

/** Mientras dure la prueba, que Google no indexe /nueva */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
}
