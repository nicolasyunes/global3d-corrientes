// Test data: the stock surveyed in the design ("Filamentos — por marca").
import raw from './fixtures.json'
import type { FilamentColor, FilamentLine } from './filaments'

type RawColor = [
  string,
  string,
  string,
  number | null,
  number,
  number | null,
  boolean,
]

export function designLines(): FilamentLine[] {
  return raw.map((l, i) => ({
    id: `l${i}`,
    brand: l.brand,
    name: l.name,
    material: l.material,
    presentation: l.presentation,
    price: l.price,
    refill_price: l.refill_price,
    accent: l.accent,
    position: i,
    created_at: '',
    updated_at: '',
    colors: (l.colors as RawColor[]).map(
      (
        [name, swatch, finish, price, stock, stockRefill, spool],
        j,
      ): FilamentColor => ({
        id: `l${i}c${j}`,
        line_id: `l${i}`,
        name,
        swatch,
        finish,
        price,
        stock,
        stock_refill: stockRefill,
        spool_available: spool,
        min_stock: 1,
        position: j,
        created_at: '',
        updated_at: '',
      }),
    ),
  }))
}
