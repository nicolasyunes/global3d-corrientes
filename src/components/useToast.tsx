import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon'

export function useToast(duration = 1800) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(
    (text: string) => {
      setMessage(text)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setMessage(null), duration)
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
    <div className="toast" role="status" key={message}>
      <Icon name="check" />
      {message}
    </div>
  ) : null

  return [node, show] as const
}
