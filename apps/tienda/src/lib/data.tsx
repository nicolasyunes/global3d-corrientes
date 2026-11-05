import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api } from './api'
import type { Family, ShopSettings } from './types'

// Si la base no responde, la tienda igual muestra cómo contactarnos
export const DEFAULT_SETTINGS: ShopSettings = {
  whatsapp: '5493794684473',
  instagram: 'global3d_corrientes',
  local: {
    direccion: 'Junín 862, Corrientes',
    horarios: 'De 9 a 12:30 y de 16:30 a 21 hs',
    mapsQuery: 'Junín 862, Corrientes, Argentina',
  },
  transferencia: {
    alias: 'global3d.corrientes',
    cbu: '3840200500000008276162',
    titular: 'Agustina Alejandra Romero Lucena',
    banco: 'Ualá Bank S.A.U.',
  },
  sena: { porcentaje: 50 },
  envios: {
    corrientes: 'A coordinar por WhatsApp según la zona',
    pais: 'Te pasamos el costo por WhatsApp antes de despachar',
  },
}

interface ShopData {
  families: Family[]
  settings: ShopSettings
  status: 'loading' | 'ready' | 'error'
  reload: () => void
}

const Ctx = createContext<ShopData | null>(null)

export function ShopDataProvider({ children }: { children: ReactNode }) {
  const [families, setFamilies] = useState<Family[]>([])
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SETTINGS)
  const [status, setStatus] = useState<ShopData['status']>('loading')

  const load = useCallback(() => {
    setStatus('loading')
    Promise.all([api.catalog(), api.settings().catch(() => null)])
      .then(([cat, s]) => {
        setFamilies(cat ?? [])
        if (s) setSettings({ ...DEFAULT_SETTINGS, ...s })
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(load, [load])

  return (
    <Ctx.Provider value={{ families, settings, status, reload: load }}>
      {children}
    </Ctx.Provider>
  )
}

export function useShop(): ShopData {
  const v = useContext(Ctx)
  if (!v) throw new Error('useShop fuera de ShopDataProvider')
  return v
}
