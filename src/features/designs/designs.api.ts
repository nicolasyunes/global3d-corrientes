import { supabase } from '@/lib/supabase'
import type { Database, Json } from '@/lib/database.types'

// Diseños de los generadores 3D (/herramientas): parámetros para volver a
// abrirlos, pedido al que pertenecen y archivos generados en `design-files`.
// Lo usan las páginas de herramientas (guardar / abrir) y el pedido del admin.
export type DesignRow = Database['public']['Tables']['designs']['Row']
export type DesignKind = 'letra_caja' | 'llavero' | 'vaso'

export interface DesignFile {
  path: string
  name: string
  kind: string
}

const BUCKET = 'design-files'

const PAGINAS: Record<DesignKind, string> = {
  letra_caja: 'letra-caja.html',
  llavero: 'llavero.html',
  vaso: 'vaso.html',
}

export const KIND_LABEL: Record<DesignKind, string> = {
  letra_caja: 'Letra caja',
  llavero: 'Llavero',
  vaso: 'Vaso',
}

// Link para reabrir el diseño en su generador (mismo dominio que el admin)
export function designUrl(d: Pick<DesignRow, 'id' | 'kind'>): string {
  const pagina = PAGINAS[d.kind as DesignKind] ?? 'index.html'
  return `/herramientas/${pagina}?diseno=${d.id}`
}

export function designFileUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export function designFiles(d: Pick<DesignRow, 'files'>): DesignFile[] {
  return Array.isArray(d.files) ? (d.files as unknown as DesignFile[]) : []
}

export async function getDesign(id: string): Promise<DesignRow | null> {
  const { data, error } = await supabase
    .from('designs')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function listRecentDesigns(
  kind: DesignKind,
  limit = 30,
): Promise<DesignRow[]> {
  const { data, error } = await supabase
    .from('designs')
    .select('*')
    .eq('kind', kind)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function listOrderDesigns(orderId: string): Promise<DesignRow[]> {
  const { data, error } = await supabase
    .from('designs')
    .select('*')
    .eq('order_id', orderId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export interface SaveDesignInput {
  id?: string | null
  kind: DesignKind
  name: string
  params: Json
  orderId: string | null
  createdBy: string | null
}

// Crea o actualiza. Al actualizar no se toca quién lo creó.
export async function saveDesign(input: SaveDesignInput): Promise<DesignRow> {
  const fields = {
    kind: input.kind,
    name: input.name.trim(),
    params: input.params,
    order_id: input.orderId,
  }
  const query = input.id
    ? supabase.from('designs').update(fields).eq('id', input.id)
    : supabase
        .from('designs')
        .insert({ ...fields, created_by: input.createdBy })
  const { data, error } = await query.select('*').single()
  if (error) throw error
  return data
}

// Sube (o pisa) los archivos del diseño y los registra en la fila
export async function uploadDesignFiles(
  designId: string,
  files: { name: string; kind: string; blob: Blob }[],
  thumbnail?: Blob | null,
): Promise<DesignRow> {
  const registrados: DesignFile[] = []
  for (const f of files) {
    const path = `${designId}/${f.name}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, f.blob, {
      upsert: true,
      contentType: f.blob.type || undefined,
    })
    if (error) throw error
    registrados.push({ path, name: f.name, kind: f.kind })
  }
  let thumbnailPath: string | null = null
  if (thumbnail) {
    thumbnailPath = `${designId}/miniatura.png`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(thumbnailPath, thumbnail, {
        upsert: true,
        contentType: 'image/png',
      })
    if (error) throw error
  }
  const { data, error } = await supabase
    .from('designs')
    .update({
      files: registrados as unknown as Json,
      ...(thumbnailPath ? { thumbnail_path: thumbnailPath } : {}),
    })
    .eq('id', designId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteDesign(d: DesignRow): Promise<void> {
  const paths = designFiles(d).map((f) => f.path)
  if (d.thumbnail_path) paths.push(d.thumbnail_path)
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
  const { error } = await supabase.from('designs').delete().eq('id', d.id)
  if (error) throw error
}

// Pedidos a los que se puede asociar un diseño: los que siguen en curso
export interface OpenOrder {
  id: string
  label: string
  due_date: string
}

export async function listOpenOrders(): Promise<OpenOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id, due_date, personalization, product_type, customers(name)')
    .not('status', 'in', '(delivered,cancelled)')
    .order('due_date', { ascending: true })
    .limit(200)
  if (error) throw error
  return (data ?? []).map((o) => {
    const cliente =
      (o.customers as { name?: string } | null)?.name?.trim() || 'Sin cliente'
    const detalle = o.personalization?.trim()
    return {
      id: o.id,
      due_date: o.due_date,
      label: `${cliente}${detalle ? ` · ${detalle.slice(0, 40)}` : ''} · entrega ${o.due_date}`,
    }
  })
}
