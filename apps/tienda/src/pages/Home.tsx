import { Link } from 'react-router-dom'
import { Img } from '../components/bits'
import { IconPin, IconTruck, IconWhatsApp } from '../components/Icons'
import { InstagramFeed } from '../components/InstagramFeed'
import { ProductCard } from '../components/ProductCard'
import {
  CATEGORIES,
  familyImage,
  inStock,
  type CategoryMeta,
} from '../lib/catalog'
import { useShop } from '../lib/data'
import { usePageTitle } from '../lib/usePageTitle'
import { waLink } from '../lib/whatsapp'
import { GridSkeleton, LoadError } from './states'

const HERO_ORDER = ['vasos', 'trofeos', 'llaveros', 'figuras']

function CategoryTile({
  t,
  big = false,
}: {
  t: CategoryMeta & { image: string | null }
  big?: boolean
}) {
  return (
    <Link
      to={`/c/${t.slug}`}
      className={big ? 'bento-tile bento-big' : 'bento-tile'}
      aria-label={t.label}
    >
      <Img
        src={t.image}
        alt=""
        label={t.label}
        size={big ? 'full' : 'card'}
        eager={big}
      />
    </Link>
  )
}

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
  // Cada una muestra la foto de un producto suyo, destacado si hay.
  const tiles = [
    ...HERO_ORDER.map((slug) => CATEGORIES.find((c) => c.slug === slug)),
    ...CATEGORIES,
  ]
    .filter((c, i, all): c is CategoryMeta => !!c && all.indexOf(c) === i)
    .map((c) => {
      const inCat = families.filter((f) => f.category === c.slug)
      const pick =
        inCat.find((f) => f.featured && familyImage(f)) ??
        inCat.find((f) => familyImage(f))
      return {
        ...c,
        image: pick ? familyImage(pick) : null,
        any: inCat.length > 0,
      }
    })
    .filter((t) => t.any)
    .slice(0, 5)

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1 className="sr-only">Global3D · Impresión 3D en Corrientes</h1>
          {status === 'ready' ? (
            <div className="bento">
              {tiles.map((t, i) => (
                <CategoryTile key={t.slug} t={t} big={i === 0} />
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

      <section className="perks" aria-label="Envíos, retiro y atención">
        <ul className="container perks-list">
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
      </section>

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

      <InstagramFeed handle={settings.instagram} />

      <section className="section" aria-labelledby="faq-title">
        <div className="container faq">
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
                Sí. En Corrientes: {lowerFirst(settings.envios.corrientes)}. Al
                resto del país: {lowerFirst(settings.envios.pais)}.
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
                En la mayoría no. Algunos productos con logo, como los llaveros,
                tienen un mínimo, que figura en la ficha.
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
      </section>
    </>
  )
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1)
}
