// sync-order-to-sheet: receives the pg_net webhook fired by
// trg_orders_sync_to_sheet (see supabase/migrations for the trigger) and
// upserts the order's row in "Pedidos - Nueva". Auth is a shared secret
// (X-Webhook-Secret), not a Supabase JWT — this endpoint is called by
// Postgres, not by a signed-in client, so `verify_jwt` is off for this
// function and this header check is the real gate.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { toSheetRow, type OrderRecord } from './mapping.ts'
import { getAccessToken, upsertOrderRow } from './google-sheets.ts'

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

  // Phase 0 (Google Cloud service account) not completed yet — skip cleanly
  // rather than error, so the order save is never affected either way.
  if (!cfg.google_service_account_email || !cfg.google_service_account_private_key) {
    console.log('sync skipped: Google service account not configured yet')
    return new Response('OK (skipped — Google credentials not configured)', { status: 200 })
  }

  let payload: { type: string; record: OrderRecord }
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const order = payload.record
  if (!order?.id) {
    return new Response('Missing order record in payload', { status: 400 })
  }

  const { data: customer } = await supabase
    .from('customers')
    .select('name')
    .eq('id', order.customer_id)
    .maybeSingle()

  const rowValues = toSheetRow(order, customer?.name ?? '')

  try {
    const accessToken = await getAccessToken(
      cfg.google_service_account_email,
      cfg.google_service_account_private_key,
    )
    const result = await upsertOrderRow(
      accessToken,
      cfg.sheet_id,
      cfg.sheet_tab_name ?? 'Pedidos',
      order.id,
      rowValues,
    )
    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    // Non-2xx here does not touch the order — the trigger already committed.
    // It only means this particular sync attempt needs a retry (e.g. re-save
    // the order, or a future scheduled reconciliation).
    console.error('sheet sync failed', err)
    return new Response(`Sync failed: ${(err as Error).message}`, { status: 500 })
  }
})
