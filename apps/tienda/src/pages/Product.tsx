import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  AvailabilityBadge,
  Img,
  QtyStepper,
  useToast,
} from '../components/bits'
import { IconClock, IconTruck } from '../components/Icons'
import { ProductCard } from '../components/ProductCard'
import { cart, personalizationText } from '../lib/cart'
import {
  axisValues,
  categoryLabel,
  findVariant,
  initialSelection,
  valueExists,
  variantAvailability,
} from '../lib/catalog'
import { selectionForVariant } from '../lib/catalogCards'
import { useShop } from '../lib/data'
import { cashDiscountPct, cashPrice } from '../lib/discount'
import { ars, businessDays } from '../lib/format'
import type { Family } from '../lib/types'
import { usePageTitle } from '../lib/usePageTitle'
import { waLink } from '../lib/whatsapp'
import { NotFound } from './states'

export function Product() {
  const { slug } = useParams()
  const { families, status } = useShop()
  const f = families.find((x) => x.slug === slug)
  usePageTitle(f?.name ?? null)

  if (status === 'loading')
    return (
      <div className="container pdp" style={{ paddingTop: 20 }}>
        <div className="skeleton" style={{ aspectRatio: '1 / 1' }} />
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    )
  if (!f) return <NotFound />
  return (
    <ProductView
      key={f.slug}
      f={f}
      related={families
        .filter((x) => x.category === f.category && x.slug !== f.slug)
        .slice(0, 4)}
    />
  )
}

function ProductView({ f, related }: { f: Family; related: Family[] }) {
  const { settings } = useShop()
  const cashPct = cashDiscountPct(settings)
  const toast = useToast()
  const [params] = useSearchParams()
  const [sel, setSel] = useState<Record<string, string>>(
    () => selectionForVariant(f, params.get('v')) ?? initialSelection(f),
  )
  const [qty, setQty] = useState(f.minQty)
  const [perso, setPerso] = useState<Record<string, string>>({})
  const [imgIdx, setImgIdx] = useState(0)
  const [tried, setTried] = useState(false)

  const variant = findVariant(f, sel)
  const hasVariants = f.variants.length > 0
  const personalized = Object.values(perso).some((v) => v.trim())
  const avail = variantAvailability(
    f,
    hasVariants ? variant : null,
    qty,
    personalized,
  )
  const unit = hasVariants
    ? (variant?.price ?? null)
    : f.saleMode === 'cotizacion'
      ? null
      : f.priceFrom
  const images = useMemo(() => {
    if (variant?.images.length) return variant.images
    const all = f.variants.flatMap((v) => v.images).slice(0, 6)
    return all.length ? all : (f.images ?? []).slice(0, 6)
  }, [variant, f.variants, f.images])

  useEffect(() => setImgIdx(0), [variant?.id])

  const missingRequired = f.personalization.filter(
    (p) => p.required && !perso[p.key]?.trim(),
  )
  const canAdd = (!hasVariants || !!variant) && missingRequired.length === 0

  const variantLabel = f.optionAxes
    .map((a) => sel[a.key])
    .filter(Boolean)
    .join(' · ')

  const add = () => {
    setTried(true)
    if (!canAdd) return
    const labels = Object.fromEntries(
      f.personalization.map((p) => [p.key, p.label]),
    )
    cart.add({
      familySlug: f.slug,
      productId: hasVariants ? variant!.id : null,
      name: f.name,
      variantLabel,
      image: images[0] ?? null,
      unitPrice: unit,
      minQty: f.minQty,
      leadDays: f.leadDays,
      stock: variant?.stock ?? 0,
      quantity: qty,
      personalization: perso,
      personalizationText: personalizationText(perso, labels),
    })
    setPerso({})
    setTried(false)
    toast({
      text: `Agregaste ${qty} × ${f.name}`,
      link: { to: '/carrito', label: 'Ver carrito' },
    })
  }

  const ask = waLink(
    settings.whatsapp,
    `¡Hola Global3D! Quiero consultar por: ${f.name}${variantLabel ? ` (${variantLabel})` : ''}.`,
  )

  return (
    <div className="container">
      <nav className="crumbs" aria-label="Ruta">
        <Link to="/">Inicio</Link> <span aria-hidden="true">/</span>
        <Link to={`/c/${f.category}`}>{categoryLabel(f.category)}</Link>
      </nav>
      <div className="pdp">
        <div className="pdp-gallery">
          <div className="media">
            <Img
              src={images[imgIdx] ?? null}
              alt={f.name + (variantLabel ? ` · ${variantLabel}` : '')}
              label={f.name}
              size="full"
              eager
            />
          </div>
          {images.length > 1 && (
            <div className="thumbs">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  className="thumb"
                  aria-pressed={i === imgIdx}
                  aria-label={`Foto ${i + 1}`}
                  onClick={() => setImgIdx(i)}
                >
                  <Img src={src} alt="" size="thumb" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pdp-info">
          <div className="stack" style={{ gap: 10 }}>
            <AvailabilityBadge
              a={avail}
              personalizable={personalized || f.saleMode === 'a_pedido'}
            />
            <h1 style={{ fontSize: 'clamp(1.7rem, 3.4vw, 2.5rem)' }}>
              {f.name}
            </h1>
            <div className="pdp-price">
              <span className="price">
                {unit === null
                  ? 'A cotizar'
                  : (f.saleMode === 'a_pedido' ? 'desde ' : '') + ars(unit)}
              </span>
              {f.minQty > 1 && (
                <span className="muted">c/u · mínimo {f.minQty}</span>
              )}
            </div>
            {unit !== null && cashPct > 0 && (
              <p className="pdp-cash">
                <strong>{ars(cashPrice(unit, cashPct))}</strong> pagando en
                efectivo o transferencia ({cashPct}% off)
              </p>
            )}
            {f.description && <p className="muted">{f.description}</p>}
          </div>

          {f.optionAxes.map((axis) => (
            <fieldset key={axis.key} className="opt-group">
              <legend>
                {axis.label}
                {sel[axis.key] && (
                  <span className="muted" style={{ fontWeight: 600 }}>
                    : {sel[axis.key]}
                  </span>
                )}
              </legend>
              <div className="opts">
                {axisValues(f, axis.key).map((val) => {
                  const exists = valueExists(f, sel, axis.key, val)
                  return (
                    <button
                      key={val}
                      type="button"
                      className="opt"
                      aria-pressed={sel[axis.key] === val}
                      data-missing={!exists}
                      onClick={() => {
                        const next = { ...sel, [axis.key]: val }
                        // Si la combinación no existe, saltamos a la primera variante con ese valor
                        if (!findVariant(f, next) || !exists) {
                          const v = f.variants.find(
                            (x) => x.options[axis.key] === val,
                          )
                          setSel(v ? { ...v.options } : next)
                        } else setSel(next)
                      }}
                    >
                      {val}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ))}

          {hasVariants && !variant && (
            <div className="notice n-warn">
              Esa combinación no está en el catálogo. Elegí otra o consultanos.
            </div>
          )}

          {f.personalization.length > 0 && (
            <div className="stack" style={{ gap: 12 }}>
              {f.personalization.map((p) => {
                const invalid = tried && p.required && !perso[p.key]?.trim()
                return (
                  <label key={p.key} className="field">
                    <span className="label">
                      {p.label}
                      {p.required && <span aria-hidden="true"> *</span>}
                    </span>
                    <input
                      className="input"
                      maxLength={p.max}
                      placeholder={p.placeholder}
                      value={perso[p.key] ?? ''}
                      required={p.required}
                      aria-invalid={invalid || undefined}
                      onChange={(e) =>
                        setPerso({ ...perso, [p.key]: e.target.value })
                      }
                    />
                    {invalid && (
                      <span className="error-text">
                        Completá este dato para seguir.
                      </span>
                    )}
                  </label>
                )
              })}
              {f.variants.length > 0 && (
                <p className="hint">
                  Con personalización se hace a pedido:{' '}
                  {businessDays(f.leadDays)}.
                </p>
              )}
            </div>
          )}

          <div className="stack" style={{ gap: 8 }}>
            <span className="label">Cantidad</span>
            <QtyStepper value={qty} min={f.minQty} onChange={setQty} />
            {variant &&
              variant.stock > 0 &&
              qty > variant.stock &&
              !personalized && (
                <span className="hint">
                  Hay {variant.stock} listo{variant.stock === 1 ? '' : 's'}; el
                  resto se hace a pedido ({businessDays(f.leadDays)}).
                </span>
              )}
          </div>

          <div className="facts">
            <div className="fact">
              <IconClock />
              <span>
                {avail.kind === 'stock'
                  ? 'Está listo: lo podés retirar hoy por el local.'
                  : avail.kind === 'pedido'
                    ? `Se hace a pedido: está en ${businessDays(avail.days)} desde que confirmás la seña.`
                    : 'Te pasamos precio y plazo por WhatsApp.'}
              </span>
            </div>
            <div className="fact">
              <IconTruck />
              <span>
                Retiro sin cargo en {settings.local.direccion}. Envíos en
                Corrientes y al resto del país: se coordinan por WhatsApp.
              </span>
            </div>
          </div>

          <div className="buy-bar">
            <div className="total">
              <small>Total</small>
              <strong className="price num">
                {unit === null ? 'A cotizar' : ars(unit * qty)}
              </strong>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={add}
              disabled={hasVariants && !variant}
            >
              Agregar al carrito
            </button>
          </div>
          <a
            href={ask}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost"
          >
            Consultar por WhatsApp
          </a>
        </div>
      </div>

      {related.length > 0 && (
        <section className="section" aria-labelledby="rel-title">
          <div className="section-head">
            <h2 id="rel-title">También te puede gustar</h2>
          </div>
          <div className="grid">
            {related.map((r) => (
              <ProductCard key={r.slug} f={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
