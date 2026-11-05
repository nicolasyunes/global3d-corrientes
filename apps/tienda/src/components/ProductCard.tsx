import { Link } from 'react-router-dom'
import {
  familyAvailability,
  familyImage,
  maxPrice,
  minPrice,
} from '../lib/catalog'
import { ars } from '../lib/format'
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

export function ProductCard({ f }: { f: Family }) {
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
