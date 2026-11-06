import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Icon from '@/components/Icon'
import { useOperator } from '@/features/operators/operator-context'
import {
  ORIGIN_CHANNEL_LABELS,
  PAYMENT_METHOD_LABELS,
  type OriginChannel,
  type PaymentMethod,
} from '@/lib/domain-constants'
import '@/features/orders/order-modal.css'
import './sales.css'
import NewSaleSheet from './NewSaleSheet'
import { logLabel, pesos } from './sales'
import {
  getSaleLog,
  voidSale,
  type SaleLogRow,
  type SaleWithRefs,
} from './sales.api'

function when(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// One sale: lines, totals and history. Only an admin can correct or void
// (also enforced in the database).
export default function SaleDetail({
  sale,
  onClose,
  onChanged,
}: {
  sale: SaleWithRefs
  onClose: () => void
  onChanged: () => void
}) {
  const { current, isAdmin, byId } = useOperator()
  const [log, setLog] = useState<SaleLogRow[]>([])
  const [voiding, setVoiding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    getSaleLog(sale.id)
      .then((rows) => {
        if (alive) setLog(rows)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [sale.id])

  const name = (id: string | null) => (id ? (byId(id)?.name ?? '—') : 'Sistema')
  const discount = Math.max(0, Number(sale.list_total) - Number(sale.amount))
  const items = [...sale.sale_items].sort((a, b) => a.position - b.position)

  async function submitVoid(e: FormEvent) {
    e.preventDefault()
    const text = reason.trim()
    if (!text) {
      setError('Escribí el motivo de la anulación.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await voidSale(sale.id, current?.id ?? null, text)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo anular.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="omodal" role="dialog" aria-modal="true" aria-label="Venta">
      <button
        type="button"
        className="omodal__scrim"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onClose}
      />
      <div className="omodal__panel omodal__panel--sm">
        <header className="omodal__head">
          <div>
            <p className="eyebrow">{when(sale.sold_at)}</p>
            <h2 className="omodal__title">Venta</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="omodal__body">
          <section className="omodal__section">
            {sale.voided_at && (
              <p className="banner banner--error">
                Anulada: {sale.void_reason}
              </p>
            )}
            <p className="muted">
              {sale.channel
                ? ORIGIN_CHANNEL_LABELS[sale.channel as OriginChannel]
                : 'Sin canal'}
              {' · '}
              {sale.method
                ? PAYMENT_METHOD_LABELS[sale.method as PaymentMethod]
                : 'Sin medio'}
              {' · Vendió '}
              {sale.operator_id ? name(sale.operator_id) : '—'}
            </p>
            {sale.customers && (
              <p>
                {sale.customers.name}
                {sale.customers.wholesale && ' · Mayorista'}
              </p>
            )}
            {sale.order_id && (
              <p>
                <Link to={`/admin/orders/${sale.order_id}`}>
                  Ver pedido{sale.orders?.title ? `: ${sale.orders.title}` : ''}
                </Link>
              </p>
            )}

            <ul className="sale-detail__items">
              {items.map((i) => (
                <li key={i.id}>
                  <span>{i.description}</span>
                  <span>
                    {i.quantity > 1 && `${i.quantity} × `}
                    {pesos(i.unit_price)}
                    {Number(i.unit_price) !== Number(i.list_unit_price) && (
                      <>
                        {' '}
                        <s className="muted">{pesos(i.list_unit_price)}</s>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            <p className="sale-totals">
              <span>Lista {pesos(sale.list_total)}</span>
              {discount > 0 && <span>Descuento {pesos(discount)}</span>}
              <strong>{`Cobrado ${pesos(sale.amount)}`}</strong>
            </p>
            {sale.note && <p className="muted">{sale.note}</p>}

            <p className="field-label">Historial</p>
            <ul className="sale-detail__log">
              {log.map((row) => (
                <li key={row.id}>
                  <span>{logLabel(row, name)}</span>{' '}
                  <span className="muted">· {when(row.created_at)}</span>
                </li>
              ))}
            </ul>

            {!sale.voided_at &&
              (isAdmin ? (
                voiding ? (
                  <form onSubmit={(e) => void submitVoid(e)} noValidate>
                    <label className="field-label" htmlFor="void-reason">
                      Motivo
                    </label>
                    <textarea
                      id="void-reason"
                      className="input"
                      rows={2}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    {error && <p className="omodal__err">{error}</p>}
                    <div className="sale-detail__actions">
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => {
                          setVoiding(false)
                          setError(null)
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="btn btn--danger"
                        disabled={saving}
                      >
                        Confirmar anulación
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="sale-detail__actions">
                    {!sale.order_id && (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => setEditing(true)}
                      >
                        Corregir
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() => setVoiding(true)}
                    >
                      Anular
                    </button>
                  </div>
                )
              ) : (
                <p className="muted">Solo un admin puede corregir o anular</p>
              ))}
          </section>
        </div>
      </div>

      <NewSaleSheet
        open={editing}
        editing={sale}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false)
          onChanged()
        }}
      />
    </div>
  )
}
