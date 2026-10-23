import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        getPublicUrl: (p: string) => ({
          data: { publicUrl: `https://cdn.test/design-files/${p}` },
        }),
      }),
    },
  },
}))

const { designFileUrl, designFiles, designUrl } = await import('./designs.api')

describe('designUrl', () => {
  it('reopens the design in its generator under /herramientas', () => {
    expect(designUrl({ id: 'abc', kind: 'letra_caja' })).toBe(
      '/herramientas/letra-caja.html?diseno=abc',
    )
    expect(designUrl({ id: 'x', kind: 'vaso' })).toBe(
      '/herramientas/vaso.html?diseno=x',
    )
  })

  it('falls back to the tools index for an unknown kind', () => {
    expect(designUrl({ id: 'x', kind: 'otro' })).toBe(
      '/herramientas/index.html?diseno=x',
    )
  })
})

describe('designFiles', () => {
  it('reads the stored file list', () => {
    const files = [{ path: 'abc/letra.3mf', name: 'letra.3mf', kind: '3mf' }]
    expect(designFiles({ files })).toEqual(files)
  })

  it('treats anything that is not a list as no files', () => {
    expect(designFiles({ files: null })).toEqual([])
    expect(designFiles({ files: {} })).toEqual([])
  })
})

describe('designFileUrl', () => {
  it('uses the public URL of the design-files bucket', () => {
    expect(designFileUrl('abc/miniatura.png')).toBe(
      'https://cdn.test/design-files/abc/miniatura.png',
    )
  })
})
