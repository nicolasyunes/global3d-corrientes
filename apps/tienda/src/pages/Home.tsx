import { Link } from 'react-router-dom'
import { Img } from '../components/bits'
import { ProductCard } from '../components/ProductCard'
import {
  CATEGORIES,
  familyImage,
  inStock,
  type CategoryMeta,
} from '../lib/catalog'
import { useShop } from '../lib/data'
import { usePageTitle } from '../lib/usePageTitle'
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
    >
      <Img
        src={t.image}
        alt=""
        label={t.label}
        size={big ? 'full' : 'card'}
        eager={big}
      />
      <span className="bento-label">{t.label}</span>
    </Link>
  )
}

export function Home() {
  usePageTitle(null)
  const { families, status, reload } = useShop()
  const featured = families.filter((f) => f.featured)
  const inStockNow = families.filter(
    (f) => f.saleMode === 'stock' && inStock(f),
  )
  const readyCount = inStockNow.length
  const ready = inStockNow.filter((f) => !f.featured).slice(0, 8)
  const usedCats = CATEGORIES.filter((c) =>
    families.some((f) => f.category === c.slug),
  )
  // Vidriera: la primera categoría va grande, las tres siguientes chicas.
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
    .slice(0, 4)

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-head">
            <h1>Impreso en 3D en Corrientes</h1>
            <Link to="/catalogo">Ver todo el catálogo</Link>
          </div>
          {status === 'ready' ? (
            <div className="bento">
              {tiles.slice(0, 1).map((t) => (
                <CategoryTile key={t.slug} t={t} big />
              ))}
              <Link
                to={readyCount > 0 ? '/catalogo?stock=1' : '/catalogo'}
                className="bento-tile bento-ready"
              >
                <span>Listo para retirar</span>
                <span>
                  <b>{readyCount}</b>
                  {readyCount === 1 ? 'producto hoy →' : 'productos hoy →'}
                </span>
              </Link>
              {tiles.slice(1).map((t) => (
                <CategoryTile key={t.slug} t={t} />
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

      <section
        className="section"
        aria-labelledby="how-title"
        style={{ paddingTop: 8 }}
      >
        <div className="container stack">
          <h2 id="how-title">Cómo comprar</h2>
          <ol className="steps">
            <li>
              <span>
                <strong>Elegí o pedí a medida.</strong> Lo que está en stock lo
                retirás hoy; lo personalizado se hace en pocos días.
              </span>
            </li>
            <li>
              <span>
                <strong>Confirmá con la seña del 50% o el total.</strong> Por
                transferencia o en efectivo en el local.
              </span>
            </li>
            <li>
              <span>
                <strong>Mandanos el pedido por WhatsApp</strong> y seguilo con
                tu link hasta que esté listo.
              </span>
            </li>
          </ol>
        </div>
      </section>

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
    </>
  )
}
