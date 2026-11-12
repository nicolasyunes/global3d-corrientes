import { describe, expect, it } from 'vitest'
import {
  fileSize,
  quoteFileError,
  quoteFilePath,
  quoteFileType,
} from './quoteFiles'

describe('quoteFiles', () => {
  it('acepta PNG, JPG, SVG y PDF, también sin tipo informado', () => {
    expect(quoteFileType({ name: 'logo.png', type: 'image/png' })).toBe(
      'image/png',
    )
    expect(quoteFileType({ name: 'logo.SVG', type: '' })).toBe('image/svg+xml')
    expect(quoteFileType({ name: 'plano.pdf', type: '' })).toBe(
      'application/pdf',
    )
    expect(quoteFileType({ name: 'foto.jpeg', type: '' })).toBe('image/jpeg')
    expect(quoteFileType({ name: 'foto.heic', type: 'image/heic' })).toBeNull()
  })

  it('rechaza tipos no permitidos, más de 10 MB y vacíos', () => {
    expect(
      quoteFileError({ name: 'a.gif', type: 'image/gif', size: 10 }),
    ).toMatch(/PNG, JPG, SVG o PDF/)
    expect(
      quoteFileError({
        name: 'a.pdf',
        type: 'application/pdf',
        size: 11 * 1024 * 1024,
      }),
    ).toMatch(/10 MB/)
    expect(
      quoteFileError({ name: 'a.png', type: 'image/png', size: 0 }),
    ).toMatch(/vacío/)
    expect(
      quoteFileError({ name: 'a.png', type: 'image/png', size: 2048 }),
    ).toBeNull()
  })

  it('arma la ruta en a-medida/AAAA-MM con la extensión del tipo', () => {
    expect(quoteFilePath('image/svg+xml', new Date(2026, 10, 4), 'abc')).toBe(
      'a-medida/2026-11/abc.svg',
    )
  })

  it('muestra el tamaño legible', () => {
    expect(fileSize(500)).toBe('1 KB')
    expect(fileSize(2.5 * 1024 * 1024)).toBe('2,5 MB')
  })
})
