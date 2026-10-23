export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

// Working grid for the product size. 0.2 mm/px is the floor; a bigger piece
// gets coarser pixels, and a small source image lowers the resolution to its own.
export function gridFor(wMm: number, hMm: number, srcPx?: number) {
  const area = Math.sqrt((wMm * hMm) / 640_000)
  let px = Math.max(0.2, Math.max(wMm, hMm) / 1100, area)
  // srcPx = crop width in source pixels: a coarser source can't fill a finer grid
  if (srcPx && wMm / srcPx > px) px = Math.max(wMm / srcPx, 0.1, area)
  return {
    ancho: Math.max(1, Math.round(wMm / px)),
    alto: Math.max(1, Math.round(hMm / px)),
    pixelMm: px,
  }
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image()
  await new Promise<void>((ok, ko) => {
    img.onload = () => ok()
    img.onerror = () => ko(new Error('No se pudo leer la imagen'))
    img.src = src
  })
  return img
}

// Draws the crop on a white canvas of the grid size (the crop may stick out of
// the image: that part stays white).
export function cropToGrid(
  img: HTMLImageElement,
  area: CropArea,
  w: number,
  h: number,
): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Sin canvas')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}
