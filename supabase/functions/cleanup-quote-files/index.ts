// cleanup-quote-files: borra los archivos de "Pedido a medida" de la tienda
// (bucket shop-quote-files, carpeta a-medida/AAAA-MM/) con más de MAX_DAYS
// días. La llama pg_cron una vez por día. Solo borra archivos vencidos, así
// que no necesita sesión: llamarla de más no hace daño.

import { createClient } from 'npm:@supabase/supabase-js@2'

const BUCKET = 'shop-quote-files'
const ROOT = 'a-medida'
const MAX_DAYS = 30
const PAGE = 1000

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 })

  const storage = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  ).storage.from(BUCKET)

  const limit = Date.now() - MAX_DAYS * 86_400_000
  const { data: months, error } = await storage.list(ROOT, { limit: PAGE })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  let deleted = 0
  for (const month of months ?? []) {
    // Las carpetas vienen sin id; los archivos sueltos en la raíz no deberían existir.
    if (month.id) continue
    const folder = `${ROOT}/${month.name}`
    for (let offset = 0; ; offset += PAGE) {
      const { data: files, error: e } = await storage.list(folder, {
        limit: PAGE,
        offset,
        sortBy: { column: 'created_at', order: 'asc' },
      })
      if (e) return Response.json({ error: e.message }, { status: 500 })
      const old = (files ?? [])
        .filter((f) => f.id && new Date(f.created_at).getTime() < limit)
        .map((f) => `${folder}/${f.name}`)
      if (old.length) {
        const { error: rm } = await storage.remove(old)
        if (rm) return Response.json({ error: rm.message }, { status: 500 })
        deleted += old.length
      }
      // Ordenados por fecha: si en esta página hubo alguno nuevo, no hay más viejos.
      if (!files || files.length < PAGE || old.length < files.length) break
      offset -= old.length
    }
  }

  return Response.json({ deleted })
})
