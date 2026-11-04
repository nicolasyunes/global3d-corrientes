// Función de Vercel: vista previa (Open Graph) de una ficha de la tienda.
// Ver api/_og.ts. Si la base no responde, devuelve la vista previa genérica.

import { productMeta, renderHtml, type OgFamily } from './_og.js'

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? 'https://bukjmleercxlxbexekos.supabase.co'
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''

async function catalog(): Promise<OgFamily[]> {
  if (!SUPABASE_KEY) return []
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/shop_catalog`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) return []
  return (await res.json()) as OgFamily[]
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const slug = (url.searchParams.get('slug') ?? '').slice(0, 120)
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const origin = host ? `https://${host}` : url.origin
  const families = await catalog().catch(() => [])
  return new Response(renderHtml(productMeta(slug, families, origin)), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
