import { medidaUtil, type Producto } from './productos'

const PLANTILLA = `Creá una ilustración: {descripcion}

Medidas: {ancho_mm} mm de ancho por {alto_mm} mm de alto. {formato}.

Usar este estilo gráfico en toda la ilustración: máximo {max_colores} colores planos (sin degradados ni transparencias), sé muy estricto con el máximo. Contornos gruesos y bien definidos. Sin detalles finos ni texturas. Líneas de grosor medio/grueso uniformes. Sombras solo con masas de color plano. Estética sticker / logo / serigrafía apta para impresión 3D multicolor. Cada color debe formar una región continua, sin islotes. Evitar detalles menores a 2-3 mm. Alto contraste. Aspecto de arte vectorial profesional. Agregá márgenes de {margen_lados_mm} mm a cada lado y {margen_arriba_mm} mm arriba y abajo.`

// Text to paste in ChatGPT/Gemini so the generated art fits the product.
// Margins keep the proportions of the matera (30 mm sides, 10 mm top of 215 × 84).
export function armarPrompt(
  p: Producto,
  descripcion: string,
  colores: number,
): string {
  const { ancho, alto } = medidaUtil(p)
  const formato = ancho >= alto ? 'Formato apaisado' : 'Formato vertical'
  const vars: Record<string, string> = {
    descripcion: descripcion.trim() || '(describí acá qué querés ilustrar)',
    ancho_mm: String(ancho),
    alto_mm: String(alto),
    formato,
    max_colores: String(colores),
    margen_lados_mm: String(Math.round((ancho * 30) / 215)),
    margen_arriba_mm: String(Math.round((alto * 10) / 84)),
  }
  return PLANTILLA.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '')
}
