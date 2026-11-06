import { useEffect, useRef, useState } from 'react'
import { SWATCH_PRESETS } from './filaments'

const HEX = /^#[0-9a-f]{6}$/i

// A hex the native color input accepts; gradients (silk, multicolor) start
// from a neutral grey until a plain color is chosen.
function asHex(swatch: string): string {
  return HEX.test(swatch) ? swatch.toLowerCase() : '#b8b0a6'
}

// The color dot of a filament. Tap it to match the real spool: the color
// wheel, an exact hex code, or one of the usual filament colors.
export default function SwatchPicker({
  value,
  label,
  onChange,
}: {
  value: string
  label: string
  onChange: (swatch: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [hex, setHex] = useState(asHex(value))
  const box = useRef<HTMLSpanElement>(null)

  useEffect(() => setHex(asHex(value)), [value])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Closing the picker must not close the drawer behind it.
      e.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  function typeHex(text: string) {
    const next = text.startsWith('#') ? text : `#${text}`
    setHex(next)
    if (HEX.test(next)) onChange(next.toLowerCase())
  }

  return (
    <span className="fl-swp" ref={box}>
      <button
        type="button"
        className="fl-swatch"
        style={{ background: value }}
        aria-label={`Cambiar el color de ${label}`}
        aria-expanded={open}
        title="Cambiar el color de la muestra"
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div
          className="fl-swp__pop"
          role="dialog"
          aria-label={`Color de ${label}`}
        >
          <div className="fl-swp__top">
            <input
              type="color"
              className="fl-swp__wheel"
              aria-label="Selector de color"
              value={asHex(value)}
              onChange={(e) => onChange(e.target.value)}
            />
            <label className="fl-field">
              Código
              <input
                className="fl-input fl-mono"
                aria-label="Código del color"
                value={hex}
                maxLength={7}
                spellCheck={false}
                onChange={(e) => typeHex(e.target.value)}
              />
            </label>
          </div>
          <div
            className="fl-swp__grid"
            role="group"
            aria-label="Colores comunes"
          >
            {SWATCH_PRESETS.map(([name, code]) => (
              <button
                key={code}
                type="button"
                className="fl-swp__dot"
                style={{ background: code }}
                aria-label={name}
                title={name}
                aria-pressed={value.toLowerCase() === code}
                onClick={() => onChange(code)}
              />
            ))}
          </div>
        </div>
      )}
    </span>
  )
}
