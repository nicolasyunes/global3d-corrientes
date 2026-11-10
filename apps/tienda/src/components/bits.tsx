import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import type { Availability } from '../lib/catalog'
import { businessDays } from '../lib/format'
import { optimizedSrc, type ImgSize } from '../lib/img'

export function AvailabilityBadge({
  a,
  personalizable,
}: {
  a: Availability
  personalizable?: boolean
}) {
  if (a.kind === 'cotizar')
    return <span className="badge b-perso">A cotizar</span>
  if (a.kind === 'stock')
    return (
      <span className="badge b-stock">
        {a.units === 1 ? 'Queda 1 · retiralo hoy' : 'Listo para retirar'}
      </span>
    )
  return (
    <span className={personalizable ? 'badge b-perso' : 'badge b-pedido'}>
      {personalizable ? 'Personalizado' : 'A pedido'} · {businessDays(a.days)}
    </span>
  )
}

export function Img({
  src,
  alt,
  label,
  size = 'card',
  eager = false,
  priority = false,
}: {
  src: string | null
  alt: string
  label?: string
  size?: ImgSize
  eager?: boolean
  /** La imagen más importante de la pantalla (LCP): carga ya y con prioridad alta */
  priority?: boolean
}) {
  // Primero la versión achicada; si falla, la original; si falla, placeholder.
  const [failed, setFailed] = useState<string[]>([])
  const current = src
    ? [optimizedSrc(src, size), src].find((s) => !failed.includes(s))
    : undefined
  if (!current)
    return (
      <div
        className="ph"
        style={{ width: '100%', height: '100%' }}
        role="img"
        aria-label={alt}
      >
        {label ?? 'Global3D'}
      </div>
    )
  return (
    <img
      src={current}
      alt={alt}
      loading={eager || priority ? 'eager' : 'lazy'}
      // React 18 solo reconoce el atributo en minúscula (el camelCase llega en 19)
      {...(priority ? { fetchpriority: 'high' } : {})}
      decoding="async"
      onError={() => setFailed((f) => [...f, current])}
    />
  )
}

export function QtyStepper({
  value,
  min,
  max = 500,
  onChange,
  label = 'Cantidad',
}: {
  value: number
  min: number
  max?: number
  onChange: (n: number) => void
  label?: string
}) {
  return (
    <div className="qty" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Restar uno"
      >
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Sumar uno"
      >
        +
      </button>
    </div>
  )
}

// ---------- Toast ----------
interface ToastMsg {
  text: string
  link?: { to: string; label: string }
}
const ToastCtx = createContext<(m: ToastMsg) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<ToastMsg | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((m: ToastMsg) => {
    setMsg(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), 3500)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite">
        {msg && (
          <div className="toast" role="status">
            <span>{msg.text}</span>
            {msg.link && <Link to={msg.link.to}>{msg.link.label}</Link>}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      aria-label={`Copiar ${label}`}
      onClick={() => {
        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setDone(true)
            window.setTimeout(() => setDone(false), 1800)
          })
          .catch(() => {})
      }}
    >
      {done ? 'Copiado' : 'Copiar'}
    </button>
  )
}
