import Icon from '@/components/Icon'
import { dueInfo } from '@/features/production/due'
import { colorSpecEntries, swatchFor } from './colorSpec'
import { formatDueDate, formatMoney } from './format'
import type { OrderItemRow, OrderWithCustomer } from './orders.api'
import { isWaiting } from './orderFlow'

export interface PieceStats {
  pieces: number
  piecesDone: number
  units: number
  unitsDone: number
}

// wa.me needs the full international number; local Corrientes numbers
// ("3794123456") get Argentina's mobile prefix.
export function whatsappLink(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length < 8) return null
  const full = digits.startsWith('54') ? digits : `549${digits}`
  return `https://wa.me/${full}`
}

// Right-hand "Qué hay que hacer" panel of the order detail: the numbers at a
// glance, every item with its full title and details, notes and the customer.
export default function OrderSummary({
  order,
  items,
  stats,
  today,
  channel,
}: {
  order: OrderWithCustomer
  items: OrderItemRow[]
  stats: PieceStats | null
  today: string
  channel: string | null
}) {
  const closed = ['finished', 'delivered', 'cancelled'].includes(order.status)
  const due = isWaiting(order)
    ? { label: 'En espera, sin confirmar', tone: 'ok' as const }
    : order.flexible
      ? { label: 'Sin apuro', tone: 'ok' as const }
      : dueInfo(order.due_date, today)
  const colors = colorSpecEntries(order.color_spec)
  const balance = order.pending_balance
  const pct =
    stats && stats.units > 0
      ? Math.round((stats.unitsDone / stats.units) * 100)
      : null
  const phone = order.customers?.phone ?? null
  const wa = whatsappLink(phone)
  const notes = order.observations?.trim()
  // Free-text orders keep the sheet's DESCRIPCION on the order; show it only
  // when it says more than the item details already shown.
  const extra = order.description?.trim()
  const itemDetails = items.map((i) => i.personalization?.trim()).join(' ')
  const showDescription =
    extra && !itemDetails.includes(extra) && extra !== notes

  return (
    <section className="card osum">
      <div className="card__head">
        <h2 className="card__title">Qué hay que hacer</h2>
      </div>

      <div className="osum__stats">
        <div className={`osum__stat osum__stat--${closed ? 'ok' : due.tone}`}>
          <span className="osum__label">Entrega</span>
          <strong>{formatDueDate(order.due_date)}</strong>
          <span className="osum__hint">{closed ? 'Cerrado' : due.label}</span>
        </div>
        <div className="osum__stat">
          <span className="osum__label">Avance</span>
          <strong className="num">
            {stats ? `${stats.unitsDone}/${stats.units}` : '—'}
          </strong>
          <span className="osum__hint">
            {stats
              ? `${stats.piecesDone} de ${stats.pieces} pieza${stats.pieces === 1 ? '' : 's'} lista${stats.pieces === 1 ? '' : 's'}`
              : 'Sin piezas'}
          </span>
          {pct !== null && (
            <div
              className={`progress${pct === 100 ? ' progress--done' : ''}`}
              aria-hidden="true"
            >
              <i style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        <div
          className={`osum__stat${balance && balance > 0 ? ' osum__stat--due' : ' osum__stat--paid'}`}
        >
          <span className="osum__label">Saldo</span>
          <strong className="num">{formatMoney(balance)}</strong>
          <span className="osum__hint num">
            Total {formatMoney(order.total_amount)} · Seña{' '}
            {formatMoney(order.deposit)}
          </span>
        </div>
      </div>

      <h3 className="osum__heading">Qué pidió</h3>
      {items.length > 0 ? (
        <ol className="osum__items">
          {items.map((item) => (
            <li key={item.id}>
              <span className="osum__qty num">{item.quantity}×</span>
              <div>
                <p className="osum__title">{item.description}</p>
                {item.personalization?.trim() ? (
                  <p className="osum__details">{item.personalization}</p>
                ) : (
                  <p className="osum__details muted">Sin detalles</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="osum__details">{order.title ?? 'Pedido'}</p>
      )}

      {showDescription && (
        <>
          <h3 className="osum__heading">Descripción</h3>
          <p className="osum__text">{extra}</p>
        </>
      )}

      {(colors.length > 0 || order.measurements || order.personalization) && (
        <dl className="spec osum__legacy">
          {colors.length > 0 && (
            <div>
              <dt>Colores</dt>
              <dd>
                <ul className="spec__colors">
                  {colors.map(({ part, color }) => {
                    const hex = swatchFor(color)
                    return (
                      <li key={part}>
                        <span
                          className="swatch"
                          style={hex ? { background: hex } : undefined}
                        />
                        {part}: {color}
                      </li>
                    )
                  })}
                </ul>
              </dd>
            </div>
          )}
          {order.measurements && (
            <div>
              <dt>Medidas</dt>
              <dd>{order.measurements}</dd>
            </div>
          )}
          {order.personalization && (
            <div>
              <dt>Texto / personalización</dt>
              <dd className="spec__engraving">{order.personalization}</dd>
            </div>
          )}
        </dl>
      )}

      {notes && (
        <>
          <h3 className="osum__heading">Notas</h3>
          <p className="osum__text osum__note">{notes}</p>
        </>
      )}

      <h3 className="osum__heading">Cliente</h3>
      <div className="osum__customer">
        <span className="avatar avatar--sm" aria-hidden="true">
          {(order.customers?.name ?? '?').slice(0, 1).toUpperCase()}
        </span>
        <div>
          <p className="osum__title">
            {order.customers?.name ?? 'Sin cliente'}
          </p>
          <p className="osum__details">
            {[phone, channel].filter(Boolean).join(' · ') || 'Sin teléfono'}
          </p>
        </div>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--ghost btn--sm"
          >
            WhatsApp
            <Icon name="external" size={14} />
          </a>
        )}
      </div>
    </section>
  )
}
