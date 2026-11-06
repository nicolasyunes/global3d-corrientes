import { describe, expect, it } from 'vitest'
import {
  allReviewsUrl,
  cleanReviews,
  firstName,
  formatRating,
  writeReviewUrl,
} from './reviews'

const Q = 'Global3D Corrientes'

describe('writeReviewUrl', () => {
  it('con Place ID abre el formulario de reseña de Google', () => {
    expect(writeReviewUrl({ placeId: ' ChIJ123 ' }, Q)).toBe(
      'https://search.google.com/local/writereview?placeid=ChIJ123',
    )
  })

  it('sin Place ID cae en la ficha de Maps', () => {
    expect(writeReviewUrl(undefined, Q)).toBe(
      'https://www.google.com/maps/search/?api=1&query=Global3D%20Corrientes',
    )
    expect(writeReviewUrl({ placeId: '' }, Q)).toContain('google.com/maps')
  })
})

describe('allReviewsUrl', () => {
  it('con Place ID lleva a la lista de reseñas', () => {
    expect(allReviewsUrl({ placeId: 'ChIJ123' }, Q)).toBe(
      'https://search.google.com/local/reviews?placeid=ChIJ123',
    )
  })
})

describe('cleanReviews', () => {
  it('saca las que no tienen nombre o texto y acota las estrellas', () => {
    expect(
      cleanReviews([
        { nombre: ' Ana ', texto: ' Excelente ', estrellas: 5 },
        { nombre: '', texto: 'Sin nombre', estrellas: 5 },
        { nombre: 'Sin texto', texto: '  ', estrellas: 4 },
        { nombre: 'Juan', texto: 'Bien', estrellas: 9 },
        { nombre: 'Leo', texto: 'Ok', estrellas: 0, fecha: 'hace un mes' },
      ]),
    ).toEqual([
      { nombre: 'Ana', texto: 'Excelente', estrellas: 5 },
      { nombre: 'Juan', texto: 'Bien', estrellas: 5 },
      { nombre: 'Leo', texto: 'Ok', estrellas: 1, fecha: 'hace un mes' },
    ])
  })

  it('corta en el máximo y tolera undefined', () => {
    expect(cleanReviews(undefined)).toEqual([])
    const many = Array.from({ length: 9 }, (_, i) => ({
      nombre: `P${i}`,
      texto: 't',
      estrellas: 5,
    }))
    expect(cleanReviews(many)).toHaveLength(6)
  })
})

describe('firstName', () => {
  it('deja solo el primer nombre con mayúscula', () => {
    expect(firstName('andres sosa')).toBe('Andres')
    expect(firstName(' Federico Revidatti Turpin ')).toBe('Federico')
    expect(firstName('kubic3d')).toBe('Kubic3d')
  })
})

describe('formatRating', () => {
  it('usa coma decimal y descarta notas fuera de rango', () => {
    expect(formatRating(4.86)).toBe('4,9')
    expect(formatRating(5)).toBe('5,0')
    expect(formatRating(0)).toBeNull()
    expect(formatRating(undefined)).toBeNull()
  })
})
