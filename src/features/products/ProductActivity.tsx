import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOperator } from '@/features/operators/operator-context'
import { timeAgo } from '@/features/production/PieceRow'
import { listProductLog, type ProductLogRow } from './products.api'

const KIND_LABEL: Record<string, string> = {
  created: 'Creó',
  edited: 'Editó',
  adjust: 'Ajustó stock de',
  in: 'Sumó stock a',
  out: 'Descontó stock de',
  sale: 'Registró una venta de',
}

const KIND_VERB_SOLO: Record<string, string> = {
  created: 'Creó el producto',
  edited: 'Editó',
  adjust: 'Ajustó el stock',
  in: 'Sumó stock',
  out: 'Descontó stock',
  sale: 'Registró una venta',
}

// Qué pasó, en minúscula para ir después del nombre: "creó", "ajustó stock de".
// Con producto fijo (la ficha) no hace falta nombrarlo.
function describeLog(
  row: ProductLogRow,
  withProduct: boolean,
): { verb: string; detail: string | null } {
  const verb = (
    withProduct
      ? (KIND_LABEL[row.kind] ?? 'Cambió')
      : (KIND_VERB_SOLO[row.kind] ?? 'Cambió')
  ).toLowerCase()
  let detail: string | null = null
  if (row.delta != null && row.kind !== 'edited' && row.kind !== 'created') {
    const sign = row.delta > 0 ? '+' + row.delta : String(row.delta)
    detail =
      row.stock_after != null ? sign + ' · quedan ' + row.stock_after : sign
  } else if (row.kind === 'created' && row.stock_after) {
    detail = 'Stock inicial ' + row.stock_after
  }
  return { verb, detail }
}

// Quién creó o cambió productos y cuándo. Con `productId` muestra solo ese
// producto (en la ficha); sin él, lo último de todo el catálogo.
// Con `pageable` aparece "Ver más", que trae `limit` filas más cada vez.
export default function ProductActivity({
  productId,
  limit: pageSize = 15,
  pageable = false,
  title,
}: {
  productId?: string
  limit?: number
  pageable?: boolean
  title?: string
}) {
  const { byId } = useOperator()
  const [rows, setRows] = useState<ProductLogRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [limit, setLimit] = useState(pageSize)

  useEffect(() => {
    let cancelled = false
    listProductLog({ productId, limit })
      .then((r) => {
        if (!cancelled) setRows(r)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [productId, limit])

  return (
    <section className="card prod-activity" aria-label="Actividad">
      <div className="card__head">
        <h2 className="card__title">
          {title ?? (productId ? 'Historial' : 'Actividad reciente')}
        </h2>
      </div>
      {failed && <p className="muted">No se pudo cargar la actividad.</p>}
      {!failed && rows === null && <p className="muted">Cargando…</p>}
      {rows?.length === 0 && (
        <p className="muted">Todavía no hay movimientos registrados.</p>
      )}
      {rows && rows.length > 0 && (
        <ul className="prod-activity__list">
          {rows.map((row) => {
            const who = byId(row.operator_id)
            const desc = describeLog(row, !productId)
            const note = [desc.detail, row.note].filter(Boolean).join(' · ')
            return (
              <li key={row.id} className="prod-activity__row">
                <span
                  className="avatar avatar--sm"
                  style={{
                    background: who?.color ?? 'var(--color-carbon-muted)',
                  }}
                  aria-hidden="true"
                >
                  {who?.initials ?? '?'}
                </span>
                <div className="prod-activity__text">
                  <span>
                    <strong>{who?.name ?? 'Sin registrar'}</strong> {desc.verb}{' '}
                    {!productId &&
                      (row.product_id ? (
                        <Link to={`/admin/productos/${row.product_id}`}>
                          {row.product_label}
                        </Link>
                      ) : (
                        <span>{row.product_label}</span>
                      ))}
                  </span>
                  {note && (
                    <span className="muted prod-activity__note">{note}</span>
                  )}
                </div>
                <time
                  className="muted prod-activity__time"
                  dateTime={row.created_at}
                  title={new Date(row.created_at).toLocaleString('es-AR')}
                >
                  {timeAgo(row.created_at)}
                </time>
              </li>
            )
          })}
        </ul>
      )}
      {pageable && rows && rows.length === limit && (
        <button
          type="button"
          className="btn btn--ghost btn--sm prod-activity__more"
          onClick={() => setLimit((n) => n + pageSize)}
        >
          Ver más
        </button>
      )}
    </section>
  )
}
