import { toLab } from './color'
import { cleanup } from './cleanup'
import { quantize, type Cuantizada, type PixelData } from './quantize'

// Image → flat zones: quantize to `n` colors, then clean up what a nozzle
// can't print (noise, tiny islands, antialiasing halos).
export function procesar(
  img: PixelData,
  n: number,
  pixelMm: number,
): Cuantizada {
  return cleanup(quantize(img, n), pixelMm)
}

// Index of the lightest color (highest L*): the base layer takes its filament.
export function masClaro(q: Cuantizada): number {
  let best = 0
  let bl = -Infinity
  q.paleta.forEach((c, i) => {
    const l = toLab(c).l
    if (l > bl) {
      bl = l
      best = i
    }
  })
  return best
}
