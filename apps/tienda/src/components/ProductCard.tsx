import { Link } from 'react-router-dom'
import {
  familyAvailability,
  familyImage,
  maxPrice,
  minPrice,
} from '../lib/catalog'
import { ars } from '../lib/format'
import type { CatalogCard } from '../lib/catalogCards'
import type { Family } from '../lib/types'
import { AvailabilityBadge, Img } from './bits'

export function priceLabel(f: Family): string {
  const lo = minPrice(f)
  const hi = maxPrice(f)
  if (lo === null) return 'A cotizar'
  const unit = f.minQty > 1 ? ' c/u' : ''
  if (f.variants.length === 0 || (hi !== null && hi > lo))
    return `desde ${ars(lo)}${unit}`
  return ars(lo) + unit
}

export function ProductCard({
  f,
  card,
}: {
  f: Family
  /** Tarjeta de una variante puntual: foto, precio y disponibilidad propios */
  card?: CatalogCard
}) {
  const v = card?.variant ?? null
  if (v && card) {
    const price = f.saleMode === 'cotizacion' ? 'A cotizar' : ars(v.price)
    return (
      <Link to={`/p/${f.slug}?v=${encodeURIComponent(v.id)}`} className="card">
        <div className="media">
          <Img
            src={card.image}
            alt={`${f.name} · ${card.label}`}
            label={`${f.name} ${card.label}`}
          />
        </div>
        <div className="card-body">
          <AvailabilityBadge
            a={card.availability}
            personalizable={f.saleMode === 'a_pedido'}
          />
          <span className="card-name">{f.name}</span>
          <span className="card-meta">{card.label}</span>
          <span className="price">{price}</span>
        </div>
      </Link>
    )
  }
  const variantsInfo =
    f.variants.length > 1
      ? `${f.variants.length} opciones`
      : f.minQty > 1
        ? `Mínimo ${f.minQty} unidades`
        : ''
  return (
    <Link to={`/p/${f.slug}`} className="card">
      <div className="media">
        <Img src={familyImage(f)} alt={f.name} label={f.name} />
      </div>
      <div className="card-body">
        <AvailabilityBadge
          a={familyAvailability(f)}
          personalizable={f.saleMode === 'a_pedido'}
        />
        <span className="card-name">{f.name}</span>
        {variantsInfo && <span className="card-meta">{variantsInfo}</span>}
        <span className="price">{priceLabel(f)}</span>
      </div>
    </Link>
  )
}
