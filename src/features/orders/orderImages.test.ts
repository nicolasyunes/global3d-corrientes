import { describe, expect, it } from 'vitest'
import { isPdf, safeFileName, validateAttachment } from './orderImages.api'

function fakeFile(type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], 'test', { type })
}

describe('validateAttachment', () => {
  it('accepts images and PDFs', () => {
    expect(validateAttachment(fakeFile('image/png', 1024))).toBeNull()
    expect(validateAttachment(fakeFile('application/pdf', 1024))).toBeNull()
  })

  it('rejects other file types', () => {
    expect(validateAttachment(fakeFile('application/zip', 1024))).toBe(
      'Solo imágenes (JPG, PNG, WEBP…) o PDF.',
    )
  })

  it('rejects files over 10 MB and accepts exactly 10 MB', () => {
    const tenMB = 10 * 1024 * 1024
    expect(validateAttachment(fakeFile('image/png', tenMB))).toBeNull()
    expect(validateAttachment(fakeFile('image/png', tenMB + 1))).toBe(
      'El archivo no puede superar los 10 MB.',
    )
  })
})

describe('safeFileName', () => {
  it('turns any name into a storage-safe slug', () => {
    expect(safeFileName('Comprobante Seña Nº 2.PDF')).toBe(
      'comprobante-sena-n-2.pdf',
    )
    expect(safeFileName('WhatsApp Image 2026-09-30 at 10.12.33.jpeg')).toBe(
      'whatsapp-image-2026-09-30-at-10-12-33.jpeg',
    )
    expect(safeFileName('###.png')).toBe('archivo.png')
  })
})

describe('isPdf', () => {
  it('detects PDFs by extension', () => {
    expect(isPdf('o1/abc-recibo.pdf')).toBe(true)
    expect(isPdf('o1/abc-foto.jpg')).toBe(false)
  })
})
