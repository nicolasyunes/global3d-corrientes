import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export type Operator = Database['public']['Tables']['operators']['Row']

export interface NewOperator {
  name: string
  initials: string
  color: string
  role: 'admin' | 'operator'
  pin: string
}

export async function listOperators(): Promise<Operator[]> {
  const { data, error } = await supabase
    .from('operators')
    .select(
      'id, name, initials, color, role, active, can_manage_products, created_at',
    )
    .eq('active', true)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function verifyOperatorPin(
  id: string,
  pin: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('verify_operator_pin', {
    p_operator: id,
    p_pin: pin,
  })
  if (error) throw error
  return data === true
}

export async function createOperator(
  input: NewOperator,
  admin?: { id: string; pin: string },
): Promise<string> {
  const { data, error } = await supabase.rpc('create_operator', {
    p_name: input.name,
    p_initials: input.initials,
    p_color: input.color,
    p_role: input.role,
    p_pin: input.pin,
    p_admin: admin?.id ?? null,
    p_admin_pin: admin?.pin ?? null,
  })
  if (error) throw error
  return data
}

export async function setOperatorPin(
  operatorId: string,
  newPin: string,
  admin: { id: string; pin: string },
): Promise<void> {
  const { error } = await supabase.rpc('set_operator_pin', {
    p_operator: operatorId,
    p_new_pin: newPin,
    p_admin: admin.id,
    p_admin_pin: admin.pin,
  })
  if (error) throw error
}

export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Habilita o quita a una persona la carga de productos (los admin siempre
// pueden). Lo confirma un administrador con su PIN.
export async function setOperatorProducts(
  operatorId: string,
  value: boolean,
  admin: { id: string; pin: string },
): Promise<void> {
  const { error } = await supabase.rpc('set_operator_products', {
    p_operator: operatorId,
    p_value: value,
    p_admin: admin.id,
    p_admin_pin: admin.pin,
  })
  if (error) throw error
}

export function canManageProducts(op: Operator | null | undefined): boolean {
  return !!op && (op.role === 'admin' || op.can_manage_products === true)
}
