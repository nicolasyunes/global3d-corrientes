import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'g3d.tienda.theme'

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme
  return set === 'dark' || set === 'light' ? set : systemTheme()
}

/** Tema actual (el elegido o el del sistema) y un toggle que lo recuerda */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => currentTheme())

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const onChange = () => setTheme(currentTheme())
    mq?.addEventListener('change', onChange)
    return () => mq?.removeEventListener('change', onChange)
  }, [])

  const toggle = useCallback(() => {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // sin almacenamiento: vale solo para esta visita
    }
    setTheme(next)
  }, [])

  return [theme, toggle]
}
