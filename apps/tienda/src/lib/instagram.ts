/** Deja solo links de publicaciones o reels de Instagram, sin parámetros ni repetidos. */
export function cleanPostLinks(links: string[] | undefined, max = 6): string[] {
  const out: string[] = []
  for (const raw of links ?? []) {
    const m = raw.match(
      /^https:\/\/(?:www\.)?instagram\.com\/(p|reel)\/([A-Za-z0-9_-]+)/,
    )
    if (m) out.push(`https://www.instagram.com/${m[1]}/${m[2]}/`)
  }
  return [...new Set(out)].slice(0, max)
}
