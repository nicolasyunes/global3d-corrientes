// link-preview: lee título, imagen y autor (Open Graph) de un link para la
// sección Ideas del panel. Solo para sesiones del panel. Nunca devuelve
// error por un sitio que no se deja leer: responde campos vacíos.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_BYTES = 1024 * 1024
const TIMEOUT_MS = 6000
const MAX_REDIRECTS = 3

interface Preview {
  title: string | null
  image: string | null
  author: string | null
  site: string | null
}

const EMPTY: Preview = { title: null, image: null, author: null, site: null }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// Only public http(s) hosts: no localhost, private ranges or bare names.
function isPublicUrl(raw: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!host.includes('.') && !host.includes(':')) return null
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  )
    return null
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    )
      return null
  }
  if (host.includes(':')) {
    if (
      host === '::1' ||
      host === '::' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe80') ||
      host.startsWith('::ffff:')
    )
      return null
  }
  return url
}

async function readHead(res: Response): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done || !value) break
    chunks.push(value)
    size += value.length
    // The metadata lives in <head>; stop once it is over.
    if (new TextDecoder().decode(value).includes('</head>')) break
  }
  await reader.cancel().catch(() => {})
  const all = new Uint8Array(size)
  let offset = 0
  for (const c of chunks) {
    all.set(c, offset)
    offset += c.length
  }
  return new TextDecoder().decode(all)
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .trim()
}

function meta(html: string, keys: string[]): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? []
  for (const key of keys) {
    for (const tag of tags) {
      const name = tag.match(
        /\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i,
      )
      if (name && name[1].toLowerCase() === key) {
        const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)
        if (content && content[1].trim()) return decodeEntities(content[1])
      }
    }
  }
  return null
}

function parse(html: string, base: URL): Preview {
  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]
  const title =
    meta(html, ['og:title', 'twitter:title']) ??
    (titleTag ? decodeEntities(titleTag) : null)
  let image = meta(html, ['og:image', 'og:image:url', 'twitter:image'])
  if (image) {
    try {
      image = new URL(image, base).toString()
      if (!image.startsWith('https://') && !image.startsWith('http://'))
        image = null
    } catch {
      image = null
    }
  }
  return {
    title: title ? title.slice(0, 200) : null,
    image,
    author:
      meta(html, ['author', 'article:author', 'twitter:creator'])?.slice(
        0,
        120,
      ) ?? null,
    site: meta(html, ['og:site_name'])?.slice(0, 80) ?? null,
  }
}

async function preview(start: URL): Promise<Preview> {
  let url = start
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Global3D-LinkPreview/1.0)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
      },
    })
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location')
      await res.body?.cancel()
      const checked = next ? isPublicUrl(new URL(next, url).toString()) : null
      if (!checked) return EMPTY
      url = checked
      continue
    }
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) {
      await res.body?.cancel()
      return EMPTY
    }
    return parse(await readHead(res), url)
  }
  return EMPTY
}

// A signed-in panel user, not just the public anon key.
async function isPanelUser(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization')
  if (!auth) return false
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: {
      Authorization: auth,
      apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    },
  })
  await res.body?.cancel()
  return res.ok
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  if (!(await isPanelUser(req))) return json({ error: 'auth' }, 401)

  let body: { url?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'body' }, 400)
  }
  const url = typeof body.url === 'string' ? isPublicUrl(body.url.trim()) : null
  if (!url) return json(EMPTY)
  try {
    return json(await preview(url))
  } catch {
    return json(EMPTY)
  }
})
