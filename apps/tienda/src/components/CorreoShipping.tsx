import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../lib/api'
import type { CartItem } from '../lib/cart'
import { ars } from '../lib/format'
import {
  cartShippingKey,
  deliveryTime,
  loadShippingPlace,
  normalizePostalCode,
  provinceFromPostalCode,
  PROVINCES,
  quoteErrorMessage,
  quoteUnavailable,
  rateKey,
  rateLabel,
  saveShippingPlace,
  shippingItems,
  type Agency,
  type ShippingChoice,
  type ShippingQuote,
} from '../lib/shipping'

interface Props {
  items: CartItem[]
  /** "checkout" deja elegir opción y sucursal; "preview" solo muestra precios */
  mode: 'checkout' | 'preview'
  value?: ShippingChoice | null
  onChange?: (choice: ShippingChoice | null) => void
  /** Correo no está configurado: el checkout vuelve a "a cotizar" */
  onUnavailable?: () => void
  /** Cambiarlo fuerza a cotizar de nuevo (p. ej. si la cotización venció) */
  refresh?: number
  /** Título que se muestra arriba (y se oculta junto con el cotizador) */
  heading?: ReactNode
  /** Marcar la sucursal como inválida si falta (el usuario ya intentó confirmar) */
  showErrors?: boolean
}

type Status = 'idle' | 'loading' | 'done' | 'error'

/** Cotizador de Correo Argentino: CP → sucursal y domicilio con precio. */
export function CorreoShipping({
  items,
  mode,
  value = null,
  onChange,
  onUnavailable,
  refresh = 0,
  heading,
  showErrors = false,
}: Props) {
  const saved = loadShippingPlace()
  const [cp, setCp] = useState(saved.postalCode)
  const [province, setProvince] = useState(saved.province)
  const [status, setStatus] = useState<Status>('idle')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [quote, setQuote] = useState<ShippingQuote | null>(null)
  const [quotedKey, setQuotedKey] = useState('')
  const [agencies, setAgencies] = useState<Agency[] | null>(null)
  const [agencyStatus, setAgencyStatus] = useState<Status>('idle')
  const reqId = useRef(0)
  // Lo último que mandó el padre, para no usar valores viejos después de await.
  const latest = useRef({ value, onChange, onUnavailable })
  useEffect(() => {
    latest.current = { value, onChange, onUnavailable }
  })
  const cartKey = cartShippingKey(items)
  const checkout = mode === 'checkout'

  const cpOk = normalizePostalCode(cp)
  const selectedRate = value
    ? quote?.rates.find((r) => rateKey(r) === `${value.type}-${value.product}`)
    : undefined

  const run = useCallback(
    async (rawCp: string) => {
      const postal = normalizePostalCode(rawCp)
      if (!postal) {
        setStatus('error')
        setErrorCode('cp')
        return
      }
      const id = ++reqId.current
      setStatus('loading')
      setErrorCode(null)
      const res = await api.quoteShipping(shippingItems(items), postal)
      if (id !== reqId.current) return
      const { value, onChange, onUnavailable } = latest.current
      if (!res.ok) {
        setStatus('error')
        setErrorCode(res.error)
        setQuote(null)
        onChange?.(null)
        if (quoteUnavailable(res.error)) onUnavailable?.()
        return
      }
      setQuote(res.quote)
      setQuotedKey(cartShippingKey(items))
      setStatus('done')
      saveShippingPlace(rawCp.trim(), province)
      // Si ya había una opción elegida, se mantiene con el precio nuevo.
      if (value) {
        const same = res.quote.rates.find(
          (r) => rateKey(r) === `${value.type}-${value.product}`,
        )
        onChange?.(
          same
            ? {
                ...value,
                quoteId: res.quote.quoteId,
                price: same.price,
                label: rateLabel(same),
              }
            : null,
        )
      }
    },
    [items, province],
  )

  // Cotizar solo al entrar si ya había un CP guardado, y de nuevo si cambia
  // el carrito o el padre lo pide.
  useEffect(() => {
    if (normalizePostalCode(cp)) void run(cp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh])
  useEffect(() => {
    if (quote && quotedKey && quotedKey !== cartKey) void run(cp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey])

  // Sucursales: al elegir "a sucursal" con provincia.
  const wantsAgencies = checkout && value?.type === 'S' && !!province
  useEffect(() => {
    if (!wantsAgencies) return
    let alive = true
    setAgencyStatus('loading')
    setAgencies(null)
    api
      .agencies(province, normalizePostalCode(cp) ?? '')
      .then((list) => {
        if (!alive) return
        setAgencies(list)
        setAgencyStatus('done')
      })
      .catch(() => alive && setAgencyStatus('error'))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsAgencies, province, quote?.postalCode])

  const onCpChange = (v: string) => {
    setCp(v)
    const p = provinceFromPostalCode(v)
    if (p) setProvince(p)
  }

  const pickRate = (key: string) => {
    const r = quote?.rates.find((x) => rateKey(x) === key)
    if (!r || !quote) return
    onChange?.({
      quoteId: quote.quoteId,
      type: r.deliveredType,
      product: r.productType,
      price: r.price,
      label: rateLabel(r),
      // Al cambiar de tipo se vuelve a elegir sucursal.
      ...(value?.type === r.deliveredType
        ? { agencyCode: value.agencyCode, agencyName: value.agencyName }
        : {}),
    })
  }

  const pickAgency = (code: string) => {
    if (!value) return
    const a = agencies?.find((x) => x.code === code)
    onChange?.({
      ...value,
      agencyCode: a?.code,
      agencyName: a
        ? `${a.name} — ${a.address}${a.city && a.city !== a.name ? `, ${a.city}` : ''}`
        : undefined,
    })
  }

  const selectedAgency = agencies?.find((a) => a.code === value?.agencyCode)
  const stale = status === 'done' && quotedKey !== cartKey
  // Sin Correo configurado, en el carrito no se muestra nada.
  if (!checkout && status === 'error' && quoteUnavailable(errorCode)) return null

  return (
    <div className={checkout ? 'ship-quote' : 'ship-quote cart-ship'}>
      {heading && <div>{heading}</div>}
      <div className="ship-quote-form">
        <label className="field">
          <span className="label">Código postal</span>
          <input
            className="input"
            inputMode="text"
            autoComplete="postal-code"
            placeholder="Ej: 3400"
            maxLength={10}
            value={cp}
            onChange={(e) => onCpChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void run(cp)
              }
            }}
            aria-invalid={(status === 'error' && errorCode === 'cp') || undefined}
          />
        </label>
        {checkout && (
          <label className="field">
            <span className="label">Provincia</span>
            <select
              className="select"
              autoComplete="address-level1"
              value={province}
              onChange={(e) => {
                setProvince(e.target.value)
                saveShippingPlace(cp.trim(), e.target.value)
              }}
            >
              <option value="">Elegí…</option>
              {PROVINCES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="btn btn-ghost ship-quote-btn"
          onClick={() => void run(cp)}
          disabled={status === 'loading' || !cpOk}
        >
          {status === 'loading' ? 'Calculando…' : status === 'done' ? 'Recalcular' : 'Calcular'}
        </button>
      </div>

      <div aria-live="polite">
        {status === 'error' && (
          <div className="notice n-danger">{quoteErrorMessage(errorCode)}</div>
        )}
        {status === 'done' && quote && !stale && (
          <div className="choice-list">
            {quote.rates.map((r) => {
              const key = rateKey(r)
              const body = (
                <>
                  <span>
                    <strong>{rateLabel(r)}</strong>
                    <small>
                      {r.deliveredType === 'S'
                        ? 'Lo retirás en una sucursal de Correo'
                        : 'Te lo llevan a tu casa'}
                      {deliveryTime(r) && ` · ${deliveryTime(r)} desde el despacho`}
                    </small>
                  </span>
                  <span className="end num">{ars(r.price)}</span>
                </>
              )
              return checkout ? (
                <label key={key} className="choice">
                  <input
                    type="radio"
                    name="correo-opcion"
                    checked={!!selectedRate && rateKey(selectedRate) === key}
                    onChange={() => pickRate(key)}
                  />
                  {body}
                </label>
              ) : (
                <div key={key} className="choice ship-rate">
                  {body}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {wantsAgencies || (checkout && value?.type === 'S' && !province) ? (
        <label className="field">
          <span className="label">Sucursal donde lo retirás</span>
          {!province ? (
            <span className="hint">Elegí tu provincia para ver las sucursales.</span>
          ) : agencyStatus === 'loading' ? (
            <span className="hint">Buscando sucursales…</span>
          ) : agencyStatus === 'error' ? (
            <span className="error-text">
              No pudimos traer las sucursales. Probá de nuevo en un rato.
            </span>
          ) : agencies && agencies.length === 0 ? (
            <span className="error-text">
              No hay sucursales de retiro en esa provincia. Elegí envío a domicilio.
            </span>
          ) : (
            <select
              className="select"
              value={value?.agencyCode ?? ''}
              onChange={(e) => pickAgency(e.target.value)}
              aria-invalid={(showErrors && !value?.agencyCode) || undefined}
            >
              <option value="">Elegí una sucursal…</option>
              {agencies?.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.name} — {a.address}
                  {a.city && a.city !== a.name ? `, ${a.city}` : ''}
                </option>
              ))}
            </select>
          )}
          {selectedAgency?.hours && (
            <span className="hint">Horario: {selectedAgency.hours}</span>
          )}
        </label>
      ) : null}
    </div>
  )
}
