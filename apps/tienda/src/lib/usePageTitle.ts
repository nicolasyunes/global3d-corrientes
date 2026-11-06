import { useEffect } from 'react'

const BASE = 'Global3D · Impresión 3D en Corrientes'

export function usePageTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · Global3D` : BASE
  }, [title])
}
