import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import {
  DEFAULT_BOXES,
  type CorreoConfig,
  type ShipPackage,
  type ShipRate,
} from './shipping'

// shop_settings no está en los tipos generados de la base.
const db = supabase as unknown as SupabaseClient

export async function getCorreoConfig(): Promise<CorreoConfig> {
  const { data, error } = await db
    .from('shop_settings')
    .select('value')
    .eq('key', 'correo')
    .maybeSingle()
  if (error) throw error
  const v = (data?.value ?? {}) as Partial<CorreoConfig>
  return {
    cpOrigen: v.cpOrigen ?? '3400',
    cajas: v.cajas?.length ? v.cajas : DEFAULT_BOXES,
  }
}

export async function saveCorreoConfig(cfg: CorreoConfig): Promise<void> {
  const { error } = await db
    .from('shop_settings')
    .upsert({ key: 'correo', value: cfg, updated_at: new Date().toISOString() })
  if (error) throw error
}

export type RatesResult =
  | { ok: true; rates: ShipRate[]; postalCode: string }
  | { ok: false; error: string | null }

/** Cotiza con medidas libres (edge function correo-cotizar, solo logueados). */
export async function quotePackages(
  postalCode: string,
  packages: ShipPackage[],
): Promise<RatesResult> {
  const { data, error } = await supabase.functions.invoke<{
    rates: ShipRate[]
    postalCode: string
  }>('correo-cotizar', { body: { action: 'rates', postalCode, packages } })
  if (error || !data) {
    const ctx = (error as { context?: unknown } | null)?.context
    let code: string | null = null
    if (ctx instanceof Response) {
      const body = await ctx.json().catch(() => null)
      if (body && typeof body.error === 'string') code = body.error
    }
    return { ok: false, error: code }
  }
  return { ok: true, rates: data.rates, postalCode: data.postalCode }
}
