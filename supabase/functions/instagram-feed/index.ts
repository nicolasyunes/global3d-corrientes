// instagram-feed: últimas publicaciones de Instagram para la portada de la
// tienda. Pública (sin sesión) y de solo lectura. Guarda el resultado en
// shop_instagram y vuelve a pedirlo a Instagram cada CACHE_MIN minutos.
// Renueva el token cuando le quedan menos de REFRESH_DAYS días.
// Nunca falla hacia la tienda: si algo sale mal responde lo último guardado
// o una lista vacía, y la sección no se muestra.

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const CACHE_MIN = 30
const REFRESH_DAYS = 20
const LIMIT = 12
const IG = 'https://graph.instagram.com'

interface Post {
  id: string
  url: string
  image: string
  isVideo: boolean
  caption: string
  date: string
}

interface IgMedia {
  id: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_url?: string
  thumbnail_url?: string
  permalink: string
  caption?: string
  timestamp: string
}

function json(posts: Post[], maxAge: number): Response {
  return new Response(JSON.stringify({ posts }), {
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${maxAge}`,
    },
  })
}

function toPost(m: IgMedia): Post | null {
  const image = m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url
  if (!image || !m.permalink) return null
  const caption = (m.caption ?? '').replace(/\s+/g, ' ').trim()
  return {
    id: m.id,
    url: m.permalink,
    image,
    isVideo: m.media_type === 'VIDEO',
    caption: caption.length > 140 ? caption.slice(0, 139) + '…' : caption,
    date: m.timestamp,
  }
}

async function fetchMedia(token: string): Promise<Post[]> {
  const fields =
    'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp'
  const url = `${IG}/me/media?fields=${fields}&limit=${LIMIT}&access_token=${encodeURIComponent(token)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`media ${res.status}`)
  const body = (await res.json()) as { data?: IgMedia[] }
  return (body.data ?? []).map(toPost).filter((p): p is Post => p !== null)
}

async function refreshToken(
  token: string,
): Promise<{ token: string; expiresAt: string } | null> {
  const url = `${IG}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) return null
  const body = (await res.json()) as {
    access_token?: string
    expires_in?: number
  }
  if (!body.access_token || !body.expires_in) return null
  return {
    token: body.access_token,
    expiresAt: new Date(Date.now() + body.expires_in * 1000).toISOString(),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'GET') return new Response(null, { status: 405 })

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
  const { data: row } = await db
    .from('shop_instagram')
    .select('token, token_expires_at, feed, fetched_at')
    .eq('id', 1)
    .maybeSingle()

  const cached = (row?.feed ?? []) as Post[]
  const fresh =
    row?.fetched_at &&
    Date.now() - new Date(row.fetched_at).getTime() < CACHE_MIN * 60_000
  if (fresh) return json(cached, 600)

  let token: string | null =
    row?.token ?? Deno.env.get('INSTAGRAM_TOKEN') ?? null
  if (!token) return json([], 600)

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  // Un token sin vencimiento conocido viene del secret: se renueva para
  // empezar a guardarlo acá con su fecha.
  const expiresAt = row?.token_expires_at
    ? new Date(row.token_expires_at).getTime()
    : 0
  if (expiresAt - Date.now() < REFRESH_DAYS * 86_400_000) {
    const next = await refreshToken(token).catch(() => null)
    if (next) {
      token = next.token
      update.token = next.token
      update.token_expires_at = next.expiresAt
    }
  }

  let posts = cached
  try {
    posts = await fetchMedia(token)
    update.feed = posts
    update.fetched_at = new Date().toISOString()
    update.last_error = null
  } catch (e) {
    update.last_error = String(e)
    // Reintenta en unos minutos, no en cada visita.
    update.fetched_at = new Date(
      Date.now() - (CACHE_MIN - 5) * 60_000,
    ).toISOString()
  }

  await db.from('shop_instagram').update(update).eq('id', 1)
  return json(posts, 600)
})
