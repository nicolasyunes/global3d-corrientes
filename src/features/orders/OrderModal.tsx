import { useEffect, useRef, useState, type FormEvent } from 'react'
import Icon from '@/components/Icon'
import {
  ORIGIN_CHANNEL,
  ORIGIN_CHANNEL_LABELS,
  PAYMENT_METHOD,
  PAYMENT_METHOD_LABELS,
} from '@/lib/domain-constants'
import { addDaysISO } from './list'
import { formatMoney } from './format'
import {
  balanceOf,
  buildDescription,
  buildTitle,
  emptyDraft,
  emptyItem,
  parseMoney,
  qtyOf,
  validateDraft,
  type DraftErrors,
  type ItemDraft,
  type OrderDraft,
} from './orderDraft'
import {
  createOrderFromDraft,
  listProductSuggestions,
  loadDraft,
  searchCustomers,
  updateOrderFromDraft,
  type CustomerHit,
} from './orderSave.api'
import type { OrderRow } from './orders.api'
import { toISODate } from './validation'
import { useOperator } from '@/features/operators/operator-context'
import { listProductTemplates } from '@/features/products/products.api'
import { findTemplate, type ProductTemplate } from '@/features/products/parts'
import { colorSwatch } from '@/features/production/pieces'
import { AddAttachment, AttachmentGrid } from './attachments'
import {
  DEFAULT_WAITING_REASON,
  FOLLOW_UP_CHOICES,
  WAITING_REASONS,
} from './orderFlow'
import {
  deleteOrderImage,
  isPdf,
  listOrderImages,
  publicImageUrl,
  uploadOrderImage,
  type OrderImageRow,
} from './orderImages.api'
import './order-modal.css'

interface OrderModalProps {
  orderId: string | null
  onClose: () => void
  onSaved: (order: OrderRow, warning?: string) => void
}

interface PendingFile {
  id: string
  file: File
  note: string
  url: string
}

const QUICK_DATES: [string, number][] = [
  ['Hoy', 0],
  ['Mañana', 1],
  ['En 3 días', 3],
  ['En una semana', 7],
]

function PresetParts({
  item,
  template,
  onColor,
  onRemove,
}: {
  item: ItemDraft
  template: ProductTemplate | undefined
  onColor: (partIndex: number, color: string) => void
  onRemove: (partIndex: number) => void
}) {
  const parts = item.parts ?? []
  const qty = qtyOf(item)
  return (
    <div className="omodal__preset">
      <p className="omodal__preset-head">
        <Icon name="layers" size={16} />
        <span>
          {parts.length
            ? `Producto guardado · se cargan ${parts.length} pieza${parts.length === 1 ? '' : 's'} al checklist`
            : 'Producto guardado · sin piezas para cargar'}
        </span>
        {template?.basePrice != null && (
          <span className="omodal__preset-price num">
            {formatMoney(template.basePrice)} c/u
          </span>
        )}
      </p>
      {parts.length > 0 && (
        <ul className="omodal__parts">
          {parts.map((part, pi) => {
            const hex = colorSwatch(part.color)
            return (
              <li key={pi}>
                <span
                  className={`swatch${hex ? '' : ' swatch--unknown'}`}
                  style={hex ? { background: hex } : undefined}
                  aria-hidden="true"
                />
                <span className="omodal__part-label">{part.label}</span>
                <span className="num muted">×{part.quantity * qty}</span>
                <input
                  className="input omodal__part-color"
                  list="om-colors"
                  placeholder="color"
                  aria-label={`Color de ${part.label}`}
                  value={part.color}
                  onChange={(e) => onColor(pi, e.target.value)}
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`No cargar ${part.label}`}
                  onClick={() => onRemove(pi)}
                >
                  <Icon name="close" size={16} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function OrderModal({
  orderId,
  onClose,
  onSaved,
}: OrderModalProps) {
  const editing = orderId !== null
  const [draft, setDraft] = useState<OrderDraft>(emptyDraft)
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<DraftErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [templates, setTemplates] = useState<ProductTemplate[]>([])
  const { current } = useOperator()
  const [files, setFiles] = useState<PendingFile[]>([])
  const [savedFiles, setSavedFiles] = useState<OrderImageRow[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [hits, setHits] = useState<CustomerHit[]>([])
  const [showHits, setShowHits] = useState(false)
  const firstField = useRef<HTMLInputElement>(null)
  const dirty = useRef(false)
  const today = toISODate(new Date())

  useEffect(() => {
    void listProductSuggestions()
      .then(setSuggestions)
      .catch(() => undefined)
    void listProductTemplates()
      .then(setTemplates)
      .catch(() => undefined)
    if (!orderId) return
    void listOrderImages(orderId)
      .then(setSavedFiles)
      .catch(() => undefined)
    loadDraft(orderId)
      .then(setDraft)
      .catch((err) =>
        setSaveError(
          err instanceof Error ? err.message : 'No se pudo cargar el pedido.',
        ),
      )
      .finally(() => setLoading(false))
  }, [orderId])

  useEffect(() => {
    if (!loading) firstField.current?.focus()
  }, [loading])

  // Free the local previews of files that were never uploaded.
  const filesRef = useRef(files)
  filesRef.current = files
  useEffect(
    () => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.url)),
    [],
  )

  function addFiles(list: File[], note: string) {
    dirty.current = true
    setFiles((prev) => [
      ...prev,
      ...list.map((file) => ({
        id: crypto.randomUUID(),
        file,
        note,
        url: URL.createObjectURL(file),
      })),
    ])
  }

  function dropFile(id: string) {
    setFiles((prev) => {
      const gone = prev.find((f) => f.id === id)
      if (gone) URL.revokeObjectURL(gone.url)
      return prev.filter((f) => f.id !== id)
    })
  }

  async function deleteSaved(image: OrderImageRow) {
    if (!window.confirm(`¿Borrar ${image.note ?? 'este archivo'}?`)) return
    try {
      await deleteOrderImage(image)
      setSavedFiles((prev) => prev.filter((row) => row.id !== image.id))
    } catch (err) {
      setFileError(
        err instanceof Error ? err.message : 'No se pudo borrar el archivo.',
      )
    }
  }

  // Lock page scroll behind the modal.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  function requestClose() {
    if (
      dirty.current &&
      !window.confirm('¿Descartar los cambios de este pedido?')
    )
      return
    onClose()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Debounced customer lookup while typing a name that isn't linked yet.
  useEffect(() => {
    if (draft.customerId || draft.customerName.trim().length < 2) {
      setHits([])
      return
    }
    const t = setTimeout(() => {
      void searchCustomers(draft.customerName)
        .then(setHits)
        .catch(() => setHits([]))
    }, 250)
    return () => clearTimeout(t)
  }, [draft.customerName, draft.customerId])

  function set<K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) {
    dirty.current = true
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function setItem(index: number, patch: Partial<ItemDraft>) {
    dirty.current = true
    setDraft((d) => ({
      ...d,
      items: d.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    }))
  }

  // Typing a preset's exact name links the item and pre-loads its parts;
  // anything else stays free text. Saved items keep their link and pieces.
  function setProduct(index: number, product: string) {
    const item = draft.items[index]
    if (item.id) {
      setItem(index, { product })
      return
    }
    const preset = findTemplate(product, templates)
    const samePreset = preset && preset.id === item.productId
    setItem(index, {
      product,
      productId: preset?.id ?? null,
      parts: samePreset
        ? item.parts
        : (preset?.parts.map((p) => ({ ...p })) ?? []),
    })
  }

  function setPartColor(index: number, partIndex: number, color: string) {
    const parts = draft.items[index].parts ?? []
    setItem(index, {
      parts: parts.map((p, i) => (i === partIndex ? { ...p, color } : p)),
    })
  }

  function removePart(index: number, partIndex: number) {
    const parts = draft.items[index].parts ?? []
    setItem(index, { parts: parts.filter((_, i) => i !== partIndex) })
  }

  function removeItem(index: number) {
    const item = draft.items[index]
    if (
      item.id &&
      !window.confirm(
        `¿Quitar “${item.product}”? También se borran sus piezas cargadas.`,
      )
    )
      return
    dirty.current = true
    setDraft((d) => ({ ...d, items: d.items.filter((_, i) => i !== index) }))
  }

  function pickCustomer(hit: CustomerHit) {
    dirty.current = true
    setDraft((d) => ({
      ...d,
      customerId: hit.id,
      customerName: hit.name,
      customerPhone: hit.phone ?? '',
    }))
    setShowHits(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const found = validateDraft(draft, { creating: !editing })
    // Editing: the deposit is locked, so the over-total error belongs on Total.
    if (editing && found.deposit && !found.total) {
      delete found.deposit
      found.total =
        'El total no puede ser menor a lo ya cobrado. Anulá un cobro desde el pedido si hace falta.'
    }
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    setSaveError(null)
    try {
      const order = editing
        ? await updateOrderFromDraft(orderId!, draft, current?.id ?? null)
        : await createOrderFromDraft(draft, current?.id ?? null)
      // The order is saved at this point; a failed upload must not block it
      // (saving again would duplicate the order), so it's reported instead.
      const failed: string[] = []
      for (const pending of files) {
        try {
          await uploadOrderImage(order.id, pending.file, pending.note)
        } catch {
          failed.push(pending.file.name)
        }
      }
      const uploadWarning = failed.length
        ? `Pedido guardado, pero no se pudo subir: ${failed.join(', ')}. Subilo desde el pedido.`
        : undefined
      const paymentWarning =
        'paymentWarning' in order ? order.paymentWarning : undefined
      onSaved(
        order,
        [uploadWarning, paymentWarning].filter(Boolean).join(' ') || undefined,
      )
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'No se pudo guardar el pedido.',
      )
    } finally {
      setSaving(false)
    }
  }

  const balance = balanceOf(draft)
  const title = buildTitle(draft.items)
  const description = buildDescription(draft.items, draft.notes)

  return (
    <div
      className="omodal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="omodal-title"
    >
      <button
        type="button"
        className="omodal__scrim"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={requestClose}
      />
      <form className="omodal__panel" onSubmit={handleSubmit} noValidate>
        <header className="omodal__head">
          <div>
            <p className="eyebrow">{editing ? 'Editar' : 'Nuevo'}</p>
            <h2 id="omodal-title" className="omodal__title">
              {editing ? 'Datos del pedido' : 'Nuevo pedido'}
            </h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Cerrar"
            onClick={requestClose}
          >
            <Icon name="close" />
          </button>
        </header>

        {loading ? (
          <p className="muted omodal__body">Cargando…</p>
        ) : (
          <div className="omodal__body">
            <section className="omodal__section">
              <h3 className="omodal__step">
                <span>1</span>Cliente
              </h3>
              <div className="omodal__row">
                <div className="omodal__field omodal__field--grow omodal__combo">
                  <label className="field-label" htmlFor="om-name">
                    Nombre
                  </label>
                  <input
                    ref={firstField}
                    id="om-name"
                    className="input"
                    autoComplete="off"
                    value={draft.customerName}
                    aria-invalid={Boolean(errors.customerName)}
                    onChange={(e) => {
                      set('customerName', e.target.value)
                      if (draft.customerId) set('customerId', null)
                      setShowHits(true)
                    }}
                    onFocus={() => setShowHits(true)}
                    onBlur={() => setTimeout(() => setShowHits(false), 150)}
                  />
                  {showHits && hits.length > 0 && (
                    <ul className="omodal__hits" role="listbox">
                      {hits.map((hit) => (
                        <li key={hit.id}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickCustomer(hit)}
                          >
                            <strong>{hit.name}</strong>
                            {hit.phone && (
                              <span className="muted"> · {hit.phone}</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {draft.customerId && (
                    <p className="omodal__ok">Cliente existente</p>
                  )}
                  {errors.customerName && (
                    <p className="omodal__err">{errors.customerName}</p>
                  )}
                </div>
                <div className="omodal__field">
                  <label className="field-label" htmlFor="om-phone">
                    Teléfono (opcional)
                  </label>
                  <input
                    id="om-phone"
                    className="input"
                    type="tel"
                    inputMode="tel"
                    value={draft.customerPhone}
                    onChange={(e) => set('customerPhone', e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="omodal__section">
              <h3 className="omodal__step">
                <span>2</span>¿Qué pidió?
              </h3>
              {draft.items.map((item, index) => (
                <div key={item.id ?? `new-${index}`} className="omodal__item">
                  <div className="omodal__row">
                    <div className="omodal__field omodal__field--grow">
                      <label
                        className="field-label"
                        htmlFor={`om-prod-${index}`}
                      >
                        Producto
                      </label>
                      <input
                        id={`om-prod-${index}`}
                        className="input"
                        list="om-products"
                        placeholder="Ej: Vaso texturizado 1 L Boca, trofeo pádel, algo nuevo…"
                        value={item.product}
                        onChange={(e) => setProduct(index, e.target.value)}
                      />
                    </div>
                    <div className="omodal__field omodal__field--qty">
                      <label
                        className="field-label"
                        htmlFor={`om-qty-${index}`}
                      >
                        Cant.
                      </label>
                      <input
                        id={`om-qty-${index}`}
                        className="input"
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={item.quantity}
                        onChange={(e) =>
                          setItem(index, { quantity: e.target.value })
                        }
                      />
                    </div>
                    {draft.items.length > 1 && (
                      <button
                        type="button"
                        className="icon-btn omodal__remove"
                        aria-label={`Quitar producto ${index + 1}`}
                        onClick={() => removeItem(index)}
                      >
                        <Icon name="trash" size={18} />
                      </button>
                    )}
                  </div>
                  <label className="field-label" htmlFor={`om-det-${index}`}>
                    Detalles
                  </label>
                  <textarea
                    id={`om-det-${index}`}
                    className="input omodal__textarea"
                    rows={2}
                    placeholder="Colores, nombres, medidas, texto a grabar, logo…"
                    value={item.details}
                    onChange={(e) =>
                      setItem(index, { details: e.target.value })
                    }
                  />
                  {!item.id && item.productId && (
                    <PresetParts
                      item={item}
                      template={templates.find((t) => t.id === item.productId)}
                      onColor={(pi, color) => setPartColor(index, pi, color)}
                      onRemove={(pi) => removePart(index, pi)}
                    />
                  )}
                </div>
              ))}
              {errors.items && <p className="omodal__err">{errors.items}</p>}
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  dirty.current = true
                  setDraft((d) => ({ ...d, items: [...d.items, emptyItem()] }))
                }}
              >
                <Icon name="plus" size={16} />
                Agregar otro producto
              </button>
              <datalist id="om-products">
                {templates.map((t) => (
                  <option
                    key={t.id}
                    value={t.name}
                    label={
                      t.parts.length
                        ? `Guardado · ${t.parts.length} piezas`
                        : 'Guardado'
                    }
                  />
                ))}
                {suggestions
                  .filter((s) => !findTemplate(s, templates))
                  .map((s) => (
                    <option key={s} value={s} />
                  ))}
              </datalist>
              <datalist id="om-colors">
                {[
                  ...new Set(
                    templates.flatMap((t) =>
                      t.parts.map((p) => p.color).filter(Boolean),
                    ),
                  ),
                ].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </section>

            <section className="omodal__section">
              <h3 className="omodal__step">
                <span>3</span>Entrega y pago
              </h3>
              <div
                className="segmented omodal__confirm"
                role="group"
                aria-label="¿Está confirmado?"
              >
                <button
                  type="button"
                  aria-pressed={!draft.waiting}
                  onClick={() => set('waiting', false)}
                >
                  <Icon name="check" size={16} />
                  Confirmado
                </button>
                <button
                  type="button"
                  aria-pressed={draft.waiting}
                  onClick={() => {
                    set('waiting', true)
                    if (!draft.followUpOn)
                      set('followUpOn', addDaysISO(today, 7))
                  }}
                >
                  <Icon name="alert" size={16} />
                  En espera
                </button>
              </div>
              {draft.waiting ? (
                <div className="omodal__waiting">
                  <p className="omodal__hint">
                    No entra a producción hasta que lo confirmes. Vuelve a
                    aparecer en <strong>Hoy</strong> el día que elijas para
                    revisarlo.
                  </p>
                  <div className="chips" role="group" aria-label="Motivo">
                    {WAITING_REASONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        className="chip"
                        aria-pressed={
                          (draft.waitingReason || DEFAULT_WAITING_REASON) ===
                          reason
                        }
                        onClick={() => set('waitingReason', reason)}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                  <div className="omodal__row omodal__row--wrap">
                    <div className="omodal__field">
                      <label className="field-label" htmlFor="om-follow">
                        Revisar el
                      </label>
                      <input
                        id="om-follow"
                        className="input"
                        type="date"
                        value={draft.followUpOn}
                        onChange={(e) => set('followUpOn', e.target.value)}
                      />
                    </div>
                    <div className="chips omodal__quick">
                      {FOLLOW_UP_CHOICES.map(([label, days]) => {
                        const value = addDaysISO(today, days)
                        return (
                          <button
                            key={label}
                            type="button"
                            className="chip"
                            aria-pressed={draft.followUpOn === value}
                            onClick={() => set('followUpOn', value)}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <label className="omodal__flex">
                  <input
                    type="checkbox"
                    checked={draft.flexible}
                    onChange={(e) => set('flexible', e.target.checked)}
                  />
                  <span>
                    <strong>Sin apuro</strong>
                    <small>
                      La fecha es orientativa: se imprime cuando haya tiempo y
                      no cuenta como atrasado.
                    </small>
                  </span>
                </label>
              )}
              {!draft.waiting && (
                <label className="omodal__flex omodal__flex--urgent">
                  <input
                    type="checkbox"
                    checked={draft.urgent}
                    onChange={(e) => {
                      set('urgent', e.target.checked)
                      if (e.target.checked) set('flexible', false)
                    }}
                  />
                  <span>
                    <strong>Urgente</strong>
                    <small>
                      Aparece primero en Pedidos, arriba de todo, aunque haya
                      otros atrasados. Sirve para eventos o fechas que no se
                      pueden mover.
                    </small>
                  </span>
                </label>
              )}
              <div className="omodal__post">
                <span className="field-label">
                  Posprocesado del pedido, cuando todo esté impreso
                </span>
                <div className="chips" role="group" aria-label="Posprocesado">
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={draft.ppSand}
                    onClick={() => set('ppSand', !draft.ppSand)}
                  >
                    <Icon name="sand" size={16} />
                    Lijar
                  </button>
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={draft.ppPaint}
                    onClick={() => set('ppPaint', !draft.ppPaint)}
                  >
                    <Icon name="brush" size={16} />
                    Pintar
                  </button>
                </div>
              </div>
              <div className="omodal__row omodal__row--wrap">
                <div className="omodal__field">
                  <label className="field-label" htmlFor="om-due">
                    {draft.waiting
                      ? 'Fecha estimada (opcional)'
                      : draft.flexible
                        ? 'Fecha orientativa'
                        : 'Fecha de entrega'}
                  </label>
                  <input
                    id="om-due"
                    className="input"
                    type="date"
                    value={draft.dueDate}
                    aria-invalid={Boolean(errors.dueDate)}
                    onChange={(e) => set('dueDate', e.target.value)}
                  />
                </div>
                <div className="chips omodal__quick">
                  {QUICK_DATES.map(([label, days]) => {
                    const value = addDaysISO(today, days)
                    return (
                      <button
                        key={label}
                        type="button"
                        className="chip"
                        aria-pressed={draft.dueDate === value}
                        onClick={() => set('dueDate', value)}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {errors.dueDate && (
                <p className="omodal__err">{errors.dueDate}</p>
              )}
              <div className="omodal__row omodal__money">
                <div className="omodal__field">
                  <label className="field-label" htmlFor="om-total">
                    Total ($)
                  </label>
                  <input
                    id="om-total"
                    className="input"
                    inputMode="decimal"
                    value={draft.total}
                    onChange={(e) => set('total', e.target.value)}
                  />
                  {errors.total && (
                    <p className="omodal__err">{errors.total}</p>
                  )}
                </div>
                <div className="omodal__field">
                  <label className="field-label" htmlFor="om-deposit">
                    Seña ($)
                  </label>
                  <input
                    id="om-deposit"
                    className="input"
                    inputMode="decimal"
                    value={draft.deposit}
                    disabled={editing}
                    onChange={(e) => set('deposit', e.target.value)}
                  />
                  {editing && (
                    <p className="omodal__hint">
                      Los cobros se registran desde el pedido.
                    </p>
                  )}
                  {!editing && (parseMoney(draft.deposit) ?? 0) > 0 && (
                    <div
                      className="chips"
                      role="group"
                      aria-label="Medio de la seña"
                    >
                      {PAYMENT_METHOD.map((m) => (
                        <button
                          key={m}
                          type="button"
                          className="chip"
                          aria-pressed={draft.depositMethod === m}
                          onClick={() =>
                            set(
                              'depositMethod',
                              draft.depositMethod === m ? null : m,
                            )
                          }
                        >
                          {PAYMENT_METHOD_LABELS[m]}
                        </button>
                      ))}
                    </div>
                  )}
                  {errors.depositMethod && (
                    <p className="omodal__err">{errors.depositMethod}</p>
                  )}
                  {errors.deposit && (
                    <p className="omodal__err">{errors.deposit}</p>
                  )}
                </div>
                <div className="omodal__field">
                  <p className="field-label">Saldo</p>
                  <p className="omodal__balance num">
                    {balance === null ? '—' : formatMoney(balance)}
                  </p>
                </div>
              </div>
            </section>

            <section className="omodal__section">
              <h3 className="omodal__step">
                <span>4</span>Canal y notas
              </h3>
              <span className="field-label">
                {editing ? 'Canal' : 'Canal (obligatorio)'}
              </span>
              <div className="chips" role="group" aria-label="Canal">
                {ORIGIN_CHANNEL.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    className="chip"
                    aria-pressed={draft.channel === ch}
                    onClick={() =>
                      set('channel', draft.channel === ch ? null : ch)
                    }
                  >
                    {ORIGIN_CHANNEL_LABELS[ch]}
                  </button>
                ))}
              </div>
              {errors.channel && (
                <p className="omodal__err">{errors.channel}</p>
              )}
              <label className="field-label" htmlFor="om-link">
                Link de referencia (opcional)
              </label>
              <input
                id="om-link"
                className="input"
                type="url"
                inputMode="url"
                placeholder="MakerWorld, Cults, Instagram…"
                value={draft.referenceLink}
                onChange={(e) => set('referenceLink', e.target.value)}
              />
              <label className="field-label" htmlFor="om-notes">
                Notas
              </label>
              <textarea
                id="om-notes"
                className="input omodal__textarea"
                rows={2}
                placeholder="Ej: mandó el modelo por WhatsApp, retira el viernes…"
                value={draft.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </section>

            <section className="omodal__section">
              <h3 className="omodal__step">
                <span>5</span>Archivos
                <em className="omodal__optional">opcional</em>
              </h3>
              <p className="muted omodal__hint">
                Foto de referencia, comprobante de la seña, diseño… Se guardan
                junto con el pedido.
              </p>
              <AddAttachment onFiles={addFiles} onError={setFileError} />
              {fileError && <p className="omodal__err">{fileError}</p>}
              <AttachmentGrid
                items={[
                  ...savedFiles.map((image) => ({
                    key: image.id,
                    url: publicImageUrl(image.storage_path),
                    pdf: isPdf(image.storage_path),
                    label: image.note,
                    onRemove: () => void deleteSaved(image),
                  })),
                  ...files.map((f) => ({
                    key: f.id,
                    url: f.url,
                    pdf: f.file.type === 'application/pdf',
                    label: f.note,
                    pending: true,
                    onRemove: () => dropFile(f.id),
                  })),
                ]}
              />
            </section>

            {(title || description) && (
              <section
                className="omodal__preview"
                aria-label="Así queda en la planilla"
              >
                <p className="omodal__preview-label">
                  Así queda en la planilla
                </p>
                <p>
                  <strong>PRODUCTO:</strong> {title || '—'}
                </p>
                <p>
                  <strong>DESCRIPCIÓN:</strong> {description || '—'}
                </p>
              </section>
            )}
          </div>
        )}

        <footer className="omodal__foot">
          {saveError && (
            <p className="banner banner--error" role="alert">
              {saveError}
            </p>
          )}
          <div className="omodal__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={requestClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || loading}
            >
              {saving
                ? files.length
                  ? 'Guardando y subiendo archivos…'
                  : 'Guardando…'
                : `${editing ? 'Guardar cambios' : 'Guardar pedido'}${
                    files.length
                      ? ` y ${files.length} archivo${files.length === 1 ? '' : 's'}`
                      : ''
                  }`}
            </button>
          </div>
        </footer>
      </form>
    </div>
  )
}
