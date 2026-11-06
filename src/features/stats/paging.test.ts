import { describe, expect, it, vi } from 'vitest'
import { pageAll } from './paging'

const rows = (n: number, start = 0) => Array.from({ length: n }, (_, i) => start + i)

describe('pageAll', () => {
  it('una página vacía devuelve []', async () => {
    const build = vi.fn().mockResolvedValue({ data: [], error: null })
    expect(await pageAll<number>(build)).toEqual([])
    expect(build).toHaveBeenCalledTimes(1)
    expect(build).toHaveBeenCalledWith(0, 999)
  })

  it('data null se trata como vacío', async () => {
    const build = vi.fn().mockResolvedValue({ data: null, error: null })
    expect(await pageAll<number>(build)).toEqual([])
  })

  it('exactamente 1000 filas pide una segunda página vacía', async () => {
    const build = vi
      .fn()
      .mockResolvedValueOnce({ data: rows(1000), error: null })
      .mockResolvedValueOnce({ data: [], error: null })
    const out = await pageAll<number>(build)
    expect(out).toHaveLength(1000)
    expect(build).toHaveBeenCalledTimes(2)
    expect(build).toHaveBeenNthCalledWith(2, 1000, 1999)
  })

  it('1001 filas llegan completas en dos páginas', async () => {
    const build = vi
      .fn()
      .mockResolvedValueOnce({ data: rows(1000), error: null })
      .mockResolvedValueOnce({ data: rows(1, 1000), error: null })
    const out = await pageAll<number>(build)
    expect(out).toEqual(rows(1001))
    expect(build).toHaveBeenCalledTimes(2)
  })

  it('un error corta y lanza su mensaje', async () => {
    const build = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(pageAll<number>(build)).rejects.toThrow('boom')
  })
})
