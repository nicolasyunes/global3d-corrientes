import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CategoryTile } from '../components/CategoryTile'
import { InstagramFeed } from '../components/InstagramFeed'
import { Perks } from '../components/Perks'
import { ProductCard } from '../components/ProductCard'
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

const HERO_ORDER = ['vasos', 'trofeos', 'llaveros', 'figuras']
// Tope de seguridad: alcanza para todas las fotos de una categoría.
const PHOTOS_PER_TILE = 60

export function Home() {
  usePageTitle(null)
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
        .slice(0, 5),
    [families],
  )

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-intro">
            <div className="hero-copy">
              <h1>
                Vasos, trofeos, llaveros y regalos con el logo de tu empresa
              </h1>
              <p className="lead">
                Para empresas, clubes y eventos. Pedí tu presupuesto y lo tenés
                antes de fin de año.
              </p>
            </div>
            <div className="hero-cta">
              <Link to="/a-medida?tipo=empresa" className="btn btn-primary">
                Pedir presupuesto
              </Link>
              <Link to="/catalogo" className="btn btn-ghost">
                Ver catálogo
              </Link>
            </div>
          </div>
          {status === 'ready' ? (
            <div className="bento">
              {tiles.map((t, i) => (
                <CategoryTile
                  key={t.slug}
                  slug={t.slug}
                  label={t.label}
                  images={t.images}
                  big={i === 0}
                  order={i}
                />
              ))}
            </div>
          ) : status === 'error' ? (
            <LoadError onRetry={reload} />
          ) : (
            <div className="bento" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={
                    i === 0
                      ? 'bento-tile bento-big skeleton'
                      : 'bento-tile skeleton'
                  }
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
          <div className="cat-grid">
            {(usedCats.length ? usedCats : CATEGORIES).map((c) => (
              <Link key={c.slug} to={`/c/${c.slug}`} className="cat-card">
                <strong>{c.label}</strong>
                <span>{c.blurb}</span>
              </Link>
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
            <div className="grid">
              {featured.map((f) => (
                <ProductCard key={f.slug} f={f} />
              ))}
            </div>
          )}
        </div>
      </section>

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
            <div className="grid">
              {ready.map((f) => (
                <ProductCard key={f.slug} f={f} />
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

      <InstagramFeed
        handle={settings.instagram}
        links={settings.instagram_posts}
      />

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
            <iframe
              title={`Mapa: ${settings.local.direccion}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(settings.local.mapsQuery)}&z=16&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
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
    </>
  )
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1)
}
