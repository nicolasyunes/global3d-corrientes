import { useEffect } from 'react'
import Icon from '@/components/Icon'

const KEYS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '',
  '0',
  'del',
] as const

interface PinPadProps {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  error?: boolean
}

export default function PinPad({
  value,
  onChange,
  onComplete,
  disabled,
  error,
}: PinPadProps) {
  function press(key: string) {
    if (disabled) return
    if (key === 'del') return onChange(value.slice(0, -1))
    if (value.length >= 4) return
    const next = value + key
    onChange(next)
    if (next.length === 4) onComplete?.(next)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (/^[0-9]$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('del')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="pinpad">
      <div
        className={`pinpad__dots${error ? ' pinpad__dots--error' : ''}`}
        aria-live="polite"
      >
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={i < value.length ? 'is-filled' : undefined} />
        ))}
        <span className="visually-hidden">{value.length} de 4 dígitos</span>
      </div>
      <div className="pinpad__keys">
        {KEYS.map((key, i) =>
          key === '' ? (
            <span key={i} />
          ) : (
            <button
              key={key}
              type="button"
              className="pinpad__key"
              disabled={disabled}
              aria-label={key === 'del' ? 'Borrar' : key}
              onClick={() => press(key)}
            >
              {key === 'del' ? <Icon name="del" size={22} /> : key}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
