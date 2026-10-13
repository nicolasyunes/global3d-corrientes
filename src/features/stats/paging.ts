export const PAGE_SIZE = 1000

// PostgREST caps a response at 1000 rows: read a query page by page. The query
// must have a stable order or pages can overlap / skip rows.
export async function pageAll<T>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await build(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < PAGE_SIZE) return out
  }
}
