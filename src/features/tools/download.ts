export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const svgDataUrl = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

// Rasterizes an SVG at a fixed pixel width (keeps its aspect ratio).
export function svgToPng(svg: string, width: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const ratio = img.naturalHeight / img.naturalWidth || 1
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = Math.round(width * ratio)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Sin canvas'))
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('PNG vacío'))),
        'image/png',
      )
    }
    img.onerror = () => reject(new Error('No se pudo dibujar el SVG'))
    img.src = svgDataUrl(svg)
  })
}

// "Logo Café 2.png" → "logo-cafe-2"
export function fileBase(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'archivo'
  )
}
