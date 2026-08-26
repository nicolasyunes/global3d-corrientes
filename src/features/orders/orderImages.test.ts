import { describe, expect, it } from 'vitest'
import { validateImageFile } from './orderImages.api'

function fakeFile(type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], 'test.png', { type })
}

describe('validateImageFile', () => {
  it('accepts a small image file', () => {
    expect(validateImageFile(fakeFile('image/png', 1024))).toBeNull()
  })

  it('rejects a non-image file', () => {
    expect(validateImageFile(fakeFile('application/pdf', 1024))).toBe(
      'Elegí un archivo de imagen (JPG, PNG, WEBP, GIF).',
    )
  })

  it('rejects a file over 8MB', () => {
    const eightMB = 8 * 1024 * 1024
    expect(validateImageFile(fakeFile('image/png', eightMB + 1))).toBe(
      'La imagen no puede superar los 8MB.',
    )
  })

  it('accepts a file exactly at the 8MB boundary', () => {
    const eightMB = 8 * 1024 * 1024
    expect(validateImageFile(fakeFile('image/png', eightMB))).toBeNull()
  })
})
