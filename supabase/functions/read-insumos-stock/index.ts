// read-insumos-stock: called directly from the signed-in admin (not a webhook)
// by the "Sincronizar desde planilla" button on /admin/insumos. Reads the
// insumos tab of the Google Sheet and reconciles it into `public.inventory`.
// `verify_jwt` stays on (default) so only an authenticated operator can run it.
//
// Sheet is the source of truth: each row's roll count (× 1000) overwrites the
// spool's `remaining_grams`, price overwrites `unit_price`, and an `inventory`
// row whose sku is no longer in the sheet is deactivated. Only rows that
// actually differ are written, so the DB → Sheet trigger doesn't bounce.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { getAccessToken, readSheetRows } from './google-sheets-read.ts'
import { toInsumos, type ParsedInsumo } from './parse.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type SupabaseClient = ReturnType<typeof createClient>

interface InventoryRow {
  id: string
  sku: string | null
  material: string | null
  color: string | null
  remaining_grams: number | null
  quantity_grams: number | null
  unit_price: number | null
  active: boolean
}

const money = (v: number | null | undefined): number =>
  v == null ? 0 : Number(v)
const str = (v: string | null | undefined): string => v ?? ''

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders,
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: cfg, error: cfgError } = await supabase
    .from('sheet_sync_config')
    .select('*')
    .eq('id', true)
    .maybeSingle()

  if (cfgError || !cfg) {
    console.error('sheet_sync_config missing or unreadable', cfgError)
    return json({ error: 'Sync not configured' }, 500)
  }
  if (
    !cfg.google_service_account_email ||
    !cfg.google_service_account_private_key
  ) {
    return json({ error: 'Google credentials not configured' }, 500)
  }
  if (!cfg.insumos_tab_name) {
    return json({ error: 'Insumos tab not configured' }, 500)
  }

  try {
    const accessToken = await getAccessToken(
      cfg.google_service_account_email,
      cfg.google_service_account_private_key,
    )
    const rows = await readSheetRows(
      accessToken,
      cfg.sheet_id,
      cfg.insumos_tab_name,
    )
    const parsed = toInsumos(rows)
    const summary = await reconcile(supabase, parsed)

    return json({ summary }, 200)
  } catch (err) {
    console.error('read-insumos-stock failed', err)
    return json({ error: (err as Error).message }, 502)
  }
})

async function reconcile(supabase: SupabaseClient, parsed: ParsedInsumo[]) {
  const { data, error } = await supabase.from('inventory').select('*')
  if (error) throw error
  const current = (data ?? []) as InventoryRow[]

  const bySku = new Map<string, InventoryRow>(
    current.filter((r) => r.sku).map((r) => [r.sku as string, r]),
  )
  const seen = new Set<string>()
  let created = 0
  let updated = 0
  let deactivated = 0

  for (const it of parsed) {
    seen.add(it.sku)
    const grams = it.rolls * 1000
    const existing = bySku.get(it.sku)

    if (!existing) {
      const { error: insErr } = await supabase.from('inventory').insert({
        sku: it.sku,
        material: it.material,
        color: it.color || null,
        unit_price: it.unit_price,
        quantity_grams: grams,
        remaining_grams: grams,
        active: true,
      })
      if (insErr) throw insErr
      created++
      continue
    }

    const changed =
      money(existing.remaining_grams) !== grams ||
      money(existing.unit_price) !== money(it.unit_price) ||
      str(existing.material) !== it.material ||
      str(existing.color) !== it.color ||
      existing.active !== true

    if (changed) {
      const { error: updErr } = await supabase
        .from('inventory')
        .update({
          material: it.material,
          color: it.color || null,
          unit_price: it.unit_price,
          quantity_grams: grams,
          remaining_grams: grams,
          active: true,
        })
        .eq('id', existing.id)
      if (updErr) throw updErr
      updated++
    }
  }

  for (const r of current) {
    if (r.active && (!r.sku || !seen.has(r.sku))) {
      const { error: deErr } = await supabase
        .from('inventory')
        .update({ active: false })
        .eq('id', r.id)
      if (deErr) throw deErr
      deactivated++
    }
  }

  return { created, updated, deactivated }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
