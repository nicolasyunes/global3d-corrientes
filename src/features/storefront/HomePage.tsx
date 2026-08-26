import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BANNERS,
  CATEGORIES,
  FEATURED_PRODUCT_IDS,
  PAYMENT_BADGES,
  PRODUCTS,
  TESTIMONIALS,
  TRUST_ITEMS,
} from './data/products'
import ProductCard from './ProductCard'
import { useToast } from './ToastContext'
import { waHref } from '@/lib/whatsapp'

const BANNER_INTERVAL_MS = 5000
const STORE_MAPS_URL =
  'https://www.google.com/maps/place/COTICOR.+Cotillon+%26+insumos/@-27.4676422,-58.8403492,19z/data=!4m6!3m5!1s0x94456ca4c7d6384d:0x5c4795f33a123d55!8m2!3d-27.4674354!4d-58.8396152!16s%2Fg%2F11bw6_ypk7?entry=ttu&g_ep=EgoyMDI2MDgxOS4wIKXMDSoASAFQAw%3D%3D'
const STORE_MAPS_EMBED_URL = 'https://www.google.com/maps?q=-27.4674354,-58.8396152&z=17&output=embed'
const INSTAGRAM_URL = 'https://instagram.com/global3d_corrientes'

const CATEGORY_ICON: Record<string, string> = {
  combos: '📦',
  figuras: '🧍',
  vasos: '🥤',
  trofeos: '🏆',
  llaveros: '🔑',
  golosineros: '🍬',
  filamentos: '🧵',
  impresoras: '🖨️',
}
const TRUST_ICON: Record<string, string> = { truck: '🚚', pin: '📍', edit: '✏️', card: '💳' }

const featuredProducts = FEATURED_PRODUCT_IDS.map((id) => PRODUCTS.find((p) => p.id === id)).filter(
  (p): p is NonNullable<typeof p> => !!p,
)

export default function HomePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [bannerIndex, setBannerIndex] = useState(0)
  const [newsletterEmail, setNewsletterEmail] = useState('')

  useEffect(() => {
    const t = setInterval(() => setBannerIndex((i) => (i + 1) % BANNERS.length), BANNER_INTERVAL_MS)
    return () => clearInterval(t)
  }, [])

  return (
    <div>
      <section className="sf-hero">
        <div className="sf-hero__content">
          <div className="sf-hero__kicker">Corrientes, Argentina</div>
          <h1 className="sf-hero__title">Impresión 3D, coleccionables y regalos personalizados</h1>
          <p className="sf-hero__copy sf-muted">
            Figuras, vasos, trofeos, llaveros y golosineros impresos en 3D. Filamentos, resinas e impresoras.
            Envíos a todo el país.
          </p>
          <button type="button" className="btn btn--primary" onClick={() => navigate('/categoria/todas')}>
            Explorar catálogo
          </button>
        </div>
        <div className="sf-hero__image sf-ph">Foto de producto o taller</div>
      </section>

      <div className="sf-section" style={{ paddingBottom: 0 }}>
        <div className="sf-banner">
          {BANNERS.map((bn, i) => (
            <div
              key={bn.id}
              className="sf-banner__slide"
              style={{ opacity: i === bannerIndex ? 1 : 0, pointerEvents: i === bannerIndex ? 'auto' : 'none' }}
            >
              <div>
                <div className="sf-banner__title">{bn.title}</div>
                <button type="button" className="btn btn--primary" onClick={() => navigate(`/categoria/${bn.cat}`)}>
                  {bn.cta}
                </button>
              </div>
            </div>
          ))}
          <div className="sf-banner__dots">
            {BANNERS.map((bn, i) => (
              <button
                key={bn.id}
                type="button"
                aria-label={`Ver banner ${i + 1}`}
                className={`sf-banner__dot ${i === bannerIndex ? 'sf-banner__dot--active' : ''}`}
                onClick={() => setBannerIndex(i)}
              />
            ))}
          </div>
        </div>
      </div>

      <section className="sf-trust">
        <div className="sf-trust__grid">
          {TRUST_ITEMS.map((t) => (
            <div key={t.key} className="sf-trust__item">
              <span className="sf-trust__icon" aria-hidden="true">{TRUST_ICON[t.key]}</span>
              <span>{t.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sf-section">
        <h2 className="sf-h2">Categorías</h2>
        <div className="sf-cat-grid">
          {CATEGORIES.map((c) => (
            <button
              key={c.slug}
              type="button"
              className="sf-cat-card"
              onClick={() => navigate(`/categoria/${c.slug}`)}
            >
              <span className="sf-cat-card__icon" aria-hidden="true">{CATEGORY_ICON[c.slug]}</span>
              <span className="sf-cat-card__name">{c.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="sf-section">
        <h2 className="sf-h2">Destacados</h2>
        <div className="sf-product-grid">
          {featuredProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <section className="sf-section">
        <h2 className="sf-h2">Lo que dicen nuestros clientes</h2>
        <div className="sf-testimonial-grid">
          {TESTIMONIALS.map((tm) => (
            <div key={tm.name} className="sf-card">
              <p className="sf-card__quote">&ldquo;{tm.quote}&rdquo;</p>
              <div className="sf-card__author">{tm.name}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="sf-section">
        <h2 className="sf-h2">Visitanos</h2>
        <div className="sf-visit">
          <div className="sf-visit__info">
            <div className="sf-visit__row">
              <span className="sf-visit__icon" aria-hidden="true">📍</span>
              <div>
                <div className="sf-visit__label">Nuestro local</div>
                <div className="sf-muted">Corrientes, Argentina</div>
                <a className="sf-visit__link" href={STORE_MAPS_URL} target="_blank" rel="noopener noreferrer">
                  Cómo llegar
                </a>
              </div>
            </div>
            <div className="sf-visit__row">
              <span className="sf-visit__icon" aria-hidden="true">💬</span>
              <div>
                <div className="sf-visit__label">WhatsApp</div>
                <a
                  className="sf-visit__link"
                  href={waHref('Hola! Quiero hacer una consulta.')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Escribinos
                </a>
              </div>
            </div>
            <div className="sf-visit__row">
              <span className="sf-visit__icon" aria-hidden="true">📷</span>
              <div>
                <div className="sf-visit__label">Instagram</div>
                <a className="sf-visit__link" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                  @global3d_corrientes
                </a>
              </div>
            </div>
          </div>
          <div className="sf-visit__map">
            <iframe
              title="Ubicación de Global3D en el mapa"
              src={STORE_MAPS_EMBED_URL}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      <footer className="sf-footer">
        <div className="sf-footer__grid">
          <div>
            <div className="sf-footer__brand">
              GLOBAL<span style={{ color: 'var(--color-orange)' }}>3D</span>
            </div>
            <p className="sf-footer__copy">
              Diseño e impresiones 3D, coleccionables y regalos personalizados. Envíos a todo el país.
            </p>
          </div>
          <div>
            <div className="sf-footer__heading">Contacto</div>
            <p className="sf-footer__line">Instagram: @global3d_corrientes</p>
            <p className="sf-footer__line">Corrientes, Argentina</p>
          </div>
          <div>
            <div className="sf-footer__heading">Medios de pago</div>
            <div className="sf-footer__badges">
              {PAYMENT_BADGES.map((pb) => (
                <span key={pb} className="sf-tag sf-tag--outline" style={{ borderColor: 'var(--color-carbon-muted)', color: 'var(--color-white)' }}>
                  {pb}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="sf-footer__heading">Newsletter</div>
            <p className="sf-footer__copy" style={{ marginBottom: '0.625rem' }}>
              Enterate de novedades y promos.
            </p>
            <div className="sf-newsletter">
              <input
                className="sf-input"
                type="email"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="Tu email"
              />
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  if (!newsletterEmail) return
                  setNewsletterEmail('')
                  toast.show('¡Gracias por suscribirte!')
                }}
              >
                Sumarme
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
