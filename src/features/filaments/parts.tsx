export function Dot({
  swatch,
  className,
}: {
  swatch: string
  className?: string
}) {
  return (
    <span
      className={`fl-dot${className ? ` ${className}` : ''}`}
      style={{ background: swatch }}
      aria-hidden="true"
    />
  )
}

// − n + for one stock. The label names the color so each button reads alone.
export function Stepper({
  value,
  label,
  onChange,
  min = 0,
  large = false,
  disabled = false,
  canAdd = true,
}: {
  value: number
  label: string
  onChange: (delta: number) => void
  min?: number
  large?: boolean
  disabled?: boolean
  canAdd?: boolean
}) {
  return (
    <span className={`fl-step${large ? ' fl-step--lg' : ''}`}>
      <button
        type="button"
        aria-label={`Restar bobina de ${label}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(-1)}
      >
        −
      </button>
      <span className={`fl-mono${value === 0 ? ' is-zero' : ''}`}>{value}</span>
      {canAdd && (
        <button
          type="button"
          aria-label={`Sumar bobina de ${label}`}
          disabled={disabled}
          onClick={() => onChange(1)}
        >
          +
        </button>
      )}
    </span>
  )
}
