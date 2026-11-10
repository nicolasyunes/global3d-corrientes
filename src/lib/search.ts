// Búsqueda por palabras para las listas del admin. "vaso boca" encuentra
// "Vaso Camiseta 650 ml BOCA": cada palabra escrita tiene que aparecer en
// algún campo, en cualquier orden, sin importar mayúsculas ni acentos.

const ACCENTS = /[̀-ͯ]/g

/** Minúsculas y sin acentos ("Mandiyú" → "mandiyu"). */
export function normalizeSearchText(text: string): string {
  return text.normalize('NFD').replace(ACCENTS, '').toLowerCase()
}

/** Las palabras de la búsqueda, ya normalizadas; [] si está vacía. */
export function searchTokens(query: string): string[] {
  return normalizeSearchText(query).split(/\s+/).filter(Boolean)
}

/**
 * true si cada palabra de `query` aparece en alguno de los campos (como parte
 * de una palabra: "cami" encuentra "Camiseta"). Una búsqueda vacía encuentra
 * todo. Los campos null/undefined se ignoran.
 */
export function matchesQuery(
  fields: string | null | undefined | readonly (string | null | undefined)[],
  query: string,
): boolean {
  const tokens = searchTokens(query)
  if (tokens.length === 0) return true
  const list = typeof fields === 'string' || fields == null ? [fields] : fields
  const haystack = normalizeSearchText(
    list.filter((f): f is string => typeof f === 'string').join(' \n '),
  )
  return tokens.every((token) => haystack.includes(token))
}
