// read-pending-orders: called directly from the signed-in app (not a
// webhook) to show the "Pendientes" section in /admin/orders. Read-only —
// never writes to the sheet. `verify_jwt` stays on (default) so only an
// authenticated operator's session can call this.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { getAccessToken, readSheetRows } from './google-sheets-read.ts'
import { toPendingOrders } from './parse.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

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
    return new Response(JSON.stringify({ error: 'Sync not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (
    !cfg.google_service_account_email ||
    !cfg.google_service_account_private_key
  ) {
    return new Response(
      JSON.stringify({ error: 'Google credentials not configured' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  try {
    const accessToken = await getAccessToken(
      cfg.google_service_account_email,
      cfg.google_service_account_private_key,
    )
    const rows = await readSheetRows(
      accessToken,
      cfg.sheet_id,
      cfg.sheet_tab_name ?? 'Pedidos',
    )
    const orders = toPendingOrders(rows)

    return new Response(JSON.stringify({ orders }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('read-pending-orders failed', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
