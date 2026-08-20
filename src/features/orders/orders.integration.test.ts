import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { seedOperatorSession } from '@/test/seed-operator'

// Cloud integration test for the orders data layer: a seeded operator can CRUD
// an order, the `origin_channel` CHECK rejects unknown values, and anon stays
// RLS-blocked. Env-gated (mirrors rls.integration.test.ts) so the suite remains
// green without credentials.

function loadServiceRoleKey(): string | undefined {
  try {
    process.loadEnvFile()
  } catch {
    // no .env; fall through to an already-populated process.env
  }
  return process.env.SUPABASE_SERVICE_ROLE_KEY
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const hasEnv = Boolean(url && anonKey && loadServiceRoleKey())

const anon = hasEnv
  ? createClient(url as string, anonKey as string)
  : (null as unknown as SupabaseClient)

describe.skipIf(!hasEnv)('orders data layer (cloud integration)', () => {
  it('operator can CRUD an order; origin_channel CHECK rejects unknown values; anon blocked', async () => {
    const seeded = await seedOperatorSession()
    let customerId: string | undefined

    try {
      // CREATE the linked customer via the operator (RLS `to authenticated`).
      const { data: customer, error: customerError } = await seeded.client
        .from('customers')
        .insert({ name: 'orders-crud-customer' })
        .select('id')
        .single()
      expect(customerError).toBeNull()
      expect(customer).not.toBeNull()
      customerId = customer?.id

      // CREATE an order with a valid origin_channel.
      const { data: created, error: createError } = await seeded.client
        .from('orders')
        .insert({
          customer_id: customerId as string,
          product_type: 'cup',
          due_date: '2099-01-02',
          origin_channel: 'facebook',
          total_amount: 100,
          deposit: 30,
          pending_balance: 70,
        })
        .select('*')
        .single()
      expect(createError).toBeNull()
      expect(created).not.toBeNull()
      expect(created?.origin_channel).toBe('facebook')
      expect(created?.status).toBe('new')

      // READ the row back.
      const { data: readBack } = await seeded.client
        .from('orders')
        .select('*')
        .eq('id', created?.id as string)
      expect(readBack).toHaveLength(1)

      // UPDATE: advance status and change the origin channel.
      const { data: updated, error: updateError } = await seeded.client
        .from('orders')
        .update({ status: 'in_queue', origin_channel: 'whatsapp' })
        .eq('id', created?.id as string)
        .select('*')
        .single()
      expect(updateError).toBeNull()
      expect(updated?.status).toBe('in_queue')
      expect(updated?.origin_channel).toBe('whatsapp')

      // The origin_channel CHECK rejects values outside the open list.
      const { error: checkError } = await seeded.client
        .from('orders')
        .update({ origin_channel: 'email' })
        .eq('id', created?.id as string)
      expect(checkError).not.toBeNull()

      // Anon is still RLS-blocked from reading the row.
      const { data: anonData } = await anon
        .from('orders')
        .select('id')
        .eq('id', created?.id as string)
      expect(anonData).toEqual([])

      // DELETE the order directly (RLS `to authenticated`).
      const { error: deleteError } = await seeded.client
        .from('orders')
        .delete()
        .eq('id', created?.id as string)
      expect(deleteError).toBeNull()

      const { data: afterDelete } = await seeded.client
        .from('orders')
        .select('id')
        .eq('id', created?.id as string)
      expect(afterDelete).toEqual([])
    } finally {
      if (customerId) {
        // Deleting the customer cascades to any remaining orders.
        await seeded.service.from('customers').delete().eq('id', customerId)
      }
      await seeded.service.auth.admin.deleteUser(seeded.userId)
    }
  })
})
