import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env'

// Placeholder Database schema. `supabase gen types` (data-model-core) replaces
// this with the real generated types.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Database {}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
)
