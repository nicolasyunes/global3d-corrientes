import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { listProducts, type ProductRow } from '@/features/products/products.api'
import { filterProducts } from '@/features/products/list'

// Direct product sale = a `product_sale` transaction. Same thin-helper shape
// as sales.api.ts (supplies sale). A catalog sale carries `product_id` +
// `quantity` and the DB trigger decrements stock; a free-text sale leaves
// those null and just records the amount, with the product name in `note`.

type TransactionRow = Database['public']['Tables']['transactions']['Row']
type TransactionInsert = Database['public']['Tables']['transactions']['Insert']
type CustomerRow = Database['public']['Tables']['customers']['Row']

export type ProductSaleRow = TransactionRow & {
  customers: Pick<CustomerRow, 'name'> | null
  products: Pick<ProductRow, 'name'> | null
}

// Active catalog products for the sale form's picker. Reads through the
// products.api list + the shared client-side filter so "active" means the
// same thing here as on /admin/productos.
export async function listSellableProducts(): Promise<ProductRow[]> {
  const products = await listProducts()
  return filterProducts(products, { query: '', activeOnly: true })
}

export interface ProductSaleInput {
  productId: string | null
  productName: string | null // free-text name -> transactions.note
  quantity: number | null
  amount: number
  method: string | null
  customerId: string | null
}

// Inserts a `product_sale` transaction. When `productId` + `quantity` are set,
// `trg_transactions_consume_product_stock` decrements the catalog row and the
// whole insert rolls back if it would drive stock negative — the Postgres
// error surfaces through `error` for the caller to translate.
export async function createProductSale(
  input: ProductSaleInput,
): Promise<TransactionRow> {
  const insert: TransactionInsert = {
    type: 'product_sale',
    product_id: input.productId,
    quantity: input.quantity,
    customer_id: input.customerId,
    amount: input.amount,
    method: input.method,
    note: input.productName,
  }
  const { data, error } = await supabase
    .from('transactions')
    .insert(insert)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function listProductSales(): Promise<ProductSaleRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, customers(name), products(name)')
    .eq('type', 'product_sale')
    .order('transacted_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ProductSaleRow[]
}

// Undo for a just-created free-text sale (the 5-second "Deshacer" toast). Only
// wired for sales with no `product_id`: deleting the transaction does not
// re-run the stock trigger, and restocking from the client is blocked by
// products_write (admin-only), so a catalog sale can't be cleanly reverted
// here — the toast omits the button in that case.
export async function deleteProductSale(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}
