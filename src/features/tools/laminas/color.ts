export interface RGB {
  r: number
  g: number
  b: number
}

export interface Lab {
  l: number
  a: number
  b: number
}

const lin = (c: number) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
const f = (t: number) =>
  t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29

// sRGB → CIELAB (D65)
export function toLab({ r, g, b }: RGB): Lab {
  const R = lin(r)
  const G = lin(g)
  const B = lin(b)
  const x = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047
  const y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B
  const z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) }
}

// ΔE76 between two Lab colors
export const labDistance = (p: Lab, q: Lab) =>
  Math.hypot(p.l - q.l, p.a - q.a, p.b - q.b)

export const deltaE = (p: RGB, q: RGB) => labDistance(toLab(p), toLab(q))

export const hexToRgb = (hex: string): RGB => {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

const h2 = (n: number) => n.toString(16).padStart(2, '0')
export const rgbToHex = ({ r, g, b }: RGB) => `#${h2(r)}${h2(g)}${h2(b)}`
