import { describe, expect, it } from 'vitest'
import { daysBetween, dueInfo, weekBucket } from './due'

const TODAY = '2026-09-29' // martes

describe('weekBucket', () => {
  it('separa atrasado, esta semana (hasta el domingo), la próxima y después', () => {
    expect(weekBucket('2026-09-28', TODAY)).toBe('late')
    expect(weekBucket(TODAY, TODAY)).toBe('this')
    expect(weekBucket('2026-10-04', TODAY)).toBe('this')
    expect(weekBucket('2026-10-05', TODAY)).toBe('next')
    expect(weekBucket('2026-10-11', TODAY)).toBe('next')
    expect(weekBucket('2026-10-12', TODAY)).toBe('later')
  })

  it('un domingo, el lunes siguiente ya es la próxima semana', () => {
    expect(weekBucket('2026-10-04', '2026-10-04')).toBe('this')
    expect(weekBucket('2026-10-05', '2026-10-04')).toBe('next')
  })
})

describe('daysBetween', () => {
  it('cuenta días calendario', () => {
    expect(daysBetween(TODAY, '2026-10-02')).toBe(3)
    expect(daysBetween(TODAY, '2026-09-28')).toBe(-1)
  })
})

describe('dueInfo', () => {
  it('atrasado en singular y plural', () => {
    expect(dueInfo('2026-09-28', TODAY)).toEqual({
      label: 'Atrasado 1 día',
      tone: 'late',
    })
    expect(dueInfo('2026-09-26', TODAY).label).toBe('Atrasado 3 días')
  })
  it('hoy y mañana son urgentes', () => {
    expect(dueInfo(TODAY, TODAY)).toEqual({ label: 'Hoy', tone: 'soon' })
    expect(dueInfo('2026-09-30', TODAY)).toEqual({
      label: 'Mañana',
      tone: 'soon',
    })
  })
  it('dentro de la semana usa el día', () => {
    expect(dueInfo('2026-10-02', TODAY)).toEqual({
      label: 'Viernes',
      tone: 'ok',
    })
  })
})
