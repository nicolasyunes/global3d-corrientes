export interface Impresora {
  clave: string
  nombre: string
  modelo: string
  perfilImpresora: string
  perfilProceso: string
  perfilFilamento: string
  cama: [number, number]
  alturaMaxima: number
}

// Bambu Studio profile names follow "<model> 0.4 nozzle", "0.20mm Standard @BBL <code>"
// and "Bambu PLA Basic @BBL <code>". P1P/P1S/X1 share the X1C profiles.
function bambu(
  clave: string,
  nombre: string,
  codigo: string,
  cama: [number, number],
  alturaMaxima: number,
): Impresora {
  return {
    clave,
    nombre,
    modelo: `Bambu Lab ${nombre}`,
    perfilImpresora: `Bambu Lab ${nombre} 0.4 nozzle`,
    perfilProceso: `0.20mm Standard @BBL ${codigo}`,
    perfilFilamento: `Bambu PLA Basic @BBL ${codigo}`,
    cama,
    alturaMaxima,
  }
}

export const IMPRESORAS: Impresora[] = [
  bambu('a1', 'A1', 'A1', [256, 256], 256),
  bambu('a1-mini', 'A1 mini', 'A1M', [180, 180], 180),
  bambu('p1s', 'P1S', 'X1C', [256, 256], 250),
  bambu('p1p', 'P1P', 'X1C', [256, 256], 250),
  bambu('x1c', 'X1 Carbon', 'X1C', [256, 256], 250),
  bambu('x1', 'X1', 'X1C', [256, 256], 250),
  bambu('x1e', 'X1E', 'X1E', [256, 256], 250),
  bambu('p2s', 'P2S', 'P2S', [256, 256], 256),
  bambu('h2s', 'H2S', 'H2S', [340, 320], 340),
  bambu('a2l', 'A2L', 'A2L', [330, 320], 320),
]

export const IMPRESORA_DEFAULT = IMPRESORAS[0]
