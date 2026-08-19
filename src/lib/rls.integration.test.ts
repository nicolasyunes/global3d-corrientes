import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

// Cloud RLS integration test.
//
// The design originally called for pgTAP (`supabase test db`), which needs a
// local Docker daemon — unavailable on this machine. This test is the cloud
// replacement: it exercises the real RLS boundary over the Supabase session
// pooler with two clients:
//   - anon (VITE_SUPABASE_ANON_KEY)      -> must be blocked (0 rows / error)
//   - service_role (SUPABASE_SERVICE_ROLE_KEY) -> bypasses RLS (sanity control)
//
// Operator/admin assertions require live authenticated sessions, which need
// real auth users; they are deferred (documented in apply-progress) until an
// auth flow exists. Preferring what is actually testable here: anon blocks.
//
// Env-gated so the suite stays green when credentials are absent (mirrors the
// connectivity smoke test pattern).

function loadServiceRoleKey(): string | undefined {
  try {
    process.loadEnvFile()
  } catch {
    // No .env present; fall through to an already-populated process.env.
  }
  return process.env.SUPABASE_SERVICE_ROLE_KEY
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const serviceRoleKey = loadServiceRoleKey()

const hasEnv = Boolean(url && anonKey && serviceRoleKey)

const anon = hasEnv
  ? createClient(url as string, anonKey as string)
  : (null as unknown as SupabaseClient)
const service = hasEnv
  ? createClient(url as string, serviceRoleKey as string, {
      auth: { persistSession: false },
    })
  : (null as unknown as SupabaseClient)

// Seeds a customer + order (and optionally a transaction) via service_role,
// which bypasses RLS. Returns ids so the caller can assert and clean up.
async function seedOrder() {
  const { data: customer, error: customerError } = await service
    .from('customers')
    .insert({ name: 'rls-test-customer' })
    .select('id')
    .single()
  if (customerError || !customer)
    throw new Error(`seed customer failed: ${customerError?.message}`)

  const { data: order, error: orderError } = await service
    .from('orders')
    .insert({
      customer_id: customer.id,
      product_type: 'other',
      due_date: '2099-01-01',
    })
    .select('id')
    .single()
  if (orderError || !order)
    throw new Error(`seed order failed: ${orderError?.message}`)

  return { customerId: customer.id, orderId: order.id }
}

async function cleanupOrder(customerId: string, transactionId?: string) {
  if (transactionId) {
    await service.from('transactions').delete().eq('id', transactionId)
  }
  // Deleting the customer cascades to its orders.
  await service.from('customers').delete().eq('id', customerId)
}

describe.skipIf(!hasEnv)('RLS boundary (cloud integration)', () => {
  it('blocks anon read of orders even when rows exist (0 rows)', async () => {
    const { customerId, orderId } = await seedOrder()
    try {
      const { data, error } = await anon.from('orders').select('id').limit(5)

      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
      expect(data).toEqual([])

      // Sanity control: service_role can see the same row, proving RLS — not
      // an empty table — is what blocks anon.
      const { data: svcData } = await service
        .from('orders')
        .select('id')
        .eq('id', orderId)
      expect(svcData).toHaveLength(1)
    } finally {
      await cleanupOrder(customerId)
    }
  })

  it('blocks anon read of transactions (0 rows)', async () => {
    const { customerId } = await seedOrder()
    const { data: transaction, error: txError } = await service
      .from('transactions')
      .insert({ type: 'supplies_sale', amount: 1 })
      .select('id')
      .single()
    if (txError || !transaction)
      throw new Error(`seed transaction failed: ${txError?.message}`)

    try {
      const { data, error } = await anon
        .from('transactions')
        .select('id')
        .limit(5)

      expect(error).toBeNull()
      expect(data).toEqual([])
    } finally {
      await cleanupOrder(customerId, transaction.id)
    }
  })

  it('blocks anon write (insert) to orders', async () => {
    const { data, error } = await anon
      .from('orders')
      .insert({
        customer_id: '00000000-0000-0000-0000-000000000000',
        product_type: 'other',
        due_date: '2099-01-01',
      })
      .select('id')

    // RLS rejects the write; an empty result set is not an acceptable outcome
    // here, so we assert the error is surfaced.
    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })
})
