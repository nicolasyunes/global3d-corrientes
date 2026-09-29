import { parseMoney } from '@/features/orders/orderDraft'

// Same formulas as the Calculadora_3D_GLOBAL3D sheet (Erexit3D calculator):
//   horas        = h + min/60
//   material     = (g/1000) · filamento
//   luz          = horas · (W/1000) · kWh
//   desgaste     = horas · (repuestos / vida útil)
//   margen error = (material + luz + desgaste) · %error
//   costo        = material + luz + desgaste + margen error
//   insumos      = insumos extra · 1,3
//   TOTAL        = costo · margen + insumos
//   MercadoLibre = costo · (margen + recargo ML) + insumos

export const EXTRAS_MARKUP = 1.3

export interface CostSettings {
  filamentPrice: number // $/kg
  kwhPrice: number // $/kWh
  watts: number
  lifeHours: number
  spareParts: number // $ for the machine's life
  errorPct: number // 5 = 5 %
  mlSurcharge: number // added to the multiplier for the ML price
}

export interface PieceInput {
  hours: number
  minutes: number
  grams: number
  extras: number // $ of non-printed supplies (argollas, imanes…)
}

export interface Quote {
  material: number
  power: number
  wear: number
  error: number
  cost: number
  extras: number
  total: number
  mercadoLibre: number
}

export function quote(
  s: CostSettings,
  p: PieceInput,
  multiplier: number,
): Quote {
  const hours = p.hours + p.minutes / 60
  const material = (p.grams / 1000) * s.filamentPrice
  const power = hours * (s.watts / 1000) * s.kwhPrice
  const wear = s.lifeHours > 0 ? hours * (s.spareParts / s.lifeHours) : 0
  const error = (material + power + wear) * (s.errorPct / 100)
  const cost = material + power + wear + error
  const extras = p.extras * EXTRAS_MARKUP
  return {
    material,
    power,
    wear,
    error,
    cost,
    extras,
    total: cost * multiplier + extras,
    mercadoLibre: cost * (multiplier + s.mlSurcharge) + extras,
  }
}

// "3,5", "16.000", "" → number; blank or garbage counts as 0 so the result
// updates live while typing.
export function num(raw: string): number {
  const n = parseMoney(raw)
  return n === null || Number.isNaN(n) || n < 0 ? 0 : n
}

export const MULTIPLIERS: { value: number; hint: string }[] = [
  { value: 2, hint: 'Alto volumen / descuento' },
  { value: 2.5, hint: 'Volumen medio' },
  { value: 3, hint: 'Mayorista' },
  { value: 3.5, hint: 'Intermedio' },
  { value: 4, hint: 'Minorista' },
  { value: 5, hint: 'Llaveros / piezas chicas' },
]

// Average draw while printing PLA; "Otro" unlocks the watts field.
export const PRINTER_MODELS: { name: string; watts: number }[] = [
  { name: 'Bambu Lab P1S', watts: 100 },
  { name: 'Bambu Lab P1P', watts: 100 },
  { name: 'Bambu Lab X1 Carbon', watts: 105 },
  { name: 'Bambu Lab A1', watts: 95 },
  { name: 'Bambu Lab A1 mini', watts: 80 },
  { name: 'Creality K1', watts: 150 },
  { name: 'Creality Ender 3 V2', watts: 120 },
  { name: 'Prusa MK4', watts: 80 },
]
export const CUSTOM_PRINTER = 'Otro / Personalizado'

export function formatAmount(value: number, currency: string): string {
  return value.toLocaleString('es-AR', {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function multiplierLabel(value: number): string {
  return `×${String(value).replace('.', ',')}`
}
