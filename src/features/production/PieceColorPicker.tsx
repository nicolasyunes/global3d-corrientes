import { useMemo, useState } from 'react'
import Icon from '@/components/Icon'
import { colorSwatch, normalizeColor } from './pieces'

export const BASE_COLORS = [
  'negro',
  'blanco',
  'rojo',
  'azul',
  'amarillo',
  'dorado',
]

interface PieceColorPickerProps {
  value: string
  onChange: (color: string) => void
  // Colors already used in this order, offered after the base ones.
  usedColors: string[]
}

// Swatch row to pick a piece's color; "+" lets you type any other name.
export default function PieceColorPicker({
  value,
  onChange,
  usedColors,
}: PieceColorPickerProps) {
  const palette = useMemo(() => {
    const seen = new Set(BASE_COLORS.map(normalizeColor))
    const extra = usedColors.filter((c) => {
      const key = normalizeColor(c)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return [...BASE_COLORS, ...extra.slice(0, 4)]
  }, [usedColors])

  const [custom, setCustom] = useState(
    () =>
      value.trim() !== '' &&
      !palette.some((c) => normalizeColor(c) === normalizeColor(value)),
  )

  return (
    <div className="add-piece__palette" role="group" aria-label="Color">
      {palette.map((c) => {
        const hex = colorSwatch(c)
        return (
          <button
            key={c}
            type="button"
            className={`add-piece__dot${hex ? '' : ' swatch--unknown'}`}
            style={hex ? { background: hex } : undefined}
            aria-pressed={
              !custom && normalizeColor(value) === normalizeColor(c)
            }
            aria-label={c}
            title={c}
            onClick={() => {
              setCustom(false)
              onChange(c)
            }}
          />
        )
      })}
      <button
        type="button"
        className="add-piece__dot add-piece__dot--other"
        aria-pressed={custom}
        aria-label="Otro color"
        title="Otro color"
        onClick={() => {
          setCustom(true)
          onChange('')
        }}
      >
        <Icon name="plus" size={14} />
      </button>
      {custom && (
        <input
          className="input add-piece__custom"
          placeholder="¿Qué color?"
          aria-label="Otro color"
          list="piece-colors"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}
