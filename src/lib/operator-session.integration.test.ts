import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { seedOperatorSession } from '@/features/admin/dev-session'

// Cloud RLS integration test: proves an authenticated operator can create an
// order (RLS `to authenticated`) while anon remains blocked. Env-gated so the
// suite stays green without credentials (mirrors rls.integration.test.ts).

function loadServiceRoleKey(): string | undefined {
  try {
    process.loadEnvFile()
  } catch {
    // no .env; fall through
  }
  return process.env.SUPABASE_SERVICE_ROLE_KEY
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const hasEnv = Boolean(url && anonKey && loadServiceRoleKey())

const anon = hasEnv
  ? createClient(url as string, anonKey as string)
  : (null as unknown as SupabaseClient)

describe.skipIf(!hasEnv)('operator session (cloud integration)', () => {
  it('an authenticated operator can create an order; anon remains blocked', async () => {
    const seeded = await seedOperatorSession()
    let customerId: string | undefined

    try {
      // Operator: create a customer, then an order (RLS `to authenticated`).
      const { data: customer, error: customerError } = await seeded.client
        .from('customers')
        .insert({ name: 'operator-test-customer' })
        .select('id')
        .single()
      expect(customerError).toBeNull()
      expect(customer).not.toBeNull()
      customerId = customer?.id

      const { data: order, error: orderError } = await seeded.client
        .from('orders')
        .insert({
          customer_id: customerId as string,
          product_type: 'other',
          due_date: '2099-01-01',
        })
        .select('*')
        .single()
      expect(orderError).toBeNull()
      expect(order).not.toBeNull()
      expect(order?.status).toBe('new') // DB default applies

      // Sanity: the same authenticated client reads the row back.
      const { data: readBack } = await seeded.client
        .from('orders')
        .select('id')
        .eq('id', order?.id as string)
      expect(readBack).toHaveLength(1)

      // Anon is still blocked from writing — RLS, not the operator's session,
      // is what the authenticated insert just crossed.
      const { data: anonData, error: anonError } = await anon
        .from('orders')
        .insert({
          customer_id: customerId as string,
          product_type: 'other',
          due_date: '2099-01-01',
        })
        .select('id')
      expect(anonError).not.toBeNull()
      expect(anonData).toBeNull()
    } finally {
      if (customerId) {
        // Deleting the customer cascades to its orders.
        await seeded.service.from('customers').delete().eq('id', customerId)
      }
      await seeded.service.auth.admin.deleteUser(seeded.userId)
    }
  })
})
