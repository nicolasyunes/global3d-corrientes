// index.html pide el catálogo y los ajustes apenas llega el HTML, en paralelo
// con el JS (si no, las fotos del inicio esperaban a que bajara y corriera el
// bundle para recién ahí pedir el catálogo). Cada pedido se usa una sola vez:
// los reintentos vuelven a la base.

export type EarlyKey = 'catalog' | 'settings'

declare global {
  interface Window {
    __g3dEarly?: Partial<Record<EarlyKey, Promise<unknown>>>
  }
}

export function takeEarly<T>(key: EarlyKey): Promise<T> | null {
  const box = typeof window === 'undefined' ? undefined : window.__g3dEarly
  const p = box?.[key]
  if (!p) return null
  delete box[key]
  return p as Promise<T>
}
