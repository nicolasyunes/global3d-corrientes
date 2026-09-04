// sync-insumo-to-sheet: receives the pg_net webhook fired by
// trg_inventory_sync_to_sheet (see supabase/migrations/20260827130100) and
// upserts the spool's row in the insumos tab. Auth is the shared
// X-Webhook-Secret (this endpoint is called by Postgres, not a signed-in
// client), so `verify_jwt` is off for this function.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { toSheetRow, type InventoryRecord } from './mapping.ts'
import { getAccessToken, upsertInsumoRow } from './google-sheets.ts'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
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
    return new Response('Sync not configured', { status: 500 })
  }

  const secretHeader = req.headers.get('X-Webhook-Secret')
  if (secretHeader !== cfg.webhook_secret) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Not fully configured yet — skip cleanly so a stock change is never affected.
  if (
    !cfg.google_service_account_email ||
    !cfg.google_service_account_private_key ||
    !cfg.insumos_tab_name
  ) {
    console.log(
      'insumo sync skipped: insumos tab or Google credentials not configured',
    )
    return new Response('OK (skipped — not configured)', { status: 200 })
  }

  let payload: { type: string; record: InventoryRecord }
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const inv = payload.record
  if (!inv?.sku) {
    return new Response('Missing inventory record in payload', { status: 400 })
  }

  const rowValues = toSheetRow(inv)

  try {
    const accessToken = await getAccessToken(
      cfg.google_service_account_email,
      cfg.google_service_account_private_key,
    )
    const result = await upsertInsumoRow(
      accessToken,
      cfg.sheet_id,
      cfg.insumos_tab_name,
      inv.sku,
      rowValues,
    )
    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    // Non-2xx here does not touch `inventory` — the trigger already committed.
    console.error('insumo sheet sync failed', err)
    return new Response(`Sync failed: ${(err as Error).message}`, {
      status: 500,
    })
  }
})
