import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon'

export interface ToastAction {
  label: string
  onClick: () => void
}

// Short confirmation at the bottom of the screen; an optional action (e.g.
// "Deshacer") keeps it up a little longer.
export function useToast(duration = 1800) {
  const [message, setMessage] = useState<{
    text: string
    action?: ToastAction
    id: number
  } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(
    (text: string, action?: ToastAction) => {
      setMessage({ text, action, id: Date.now() })
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(
        () => setMessage(null),
        action ? Math.max(duration, 4500) : duration,
      )
    },
    [duration],
  )

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const node = message ? (
    <div className="toast" role="status" key={message.id}>
      <Icon name="check" />
      {message.text}
      {message.action && (
        <button
          type="button"
          className="toast__action"
          onClick={() => {
            message.action!.onClick()
            setMessage(null)
          }}
        >
          {message.action.label}
        </button>
      )}
    </div>
  ) : null

  return [node, show] as const
}
