import { describe, expect, it } from 'vitest'
import { checkinDays, currentStreak, dayKey, daysInMonthWithCheckin, encouragement, monthGrid } from './calendar'

// Local-time dates throughout: the app counts the viewer's own days.
const d = (y: number, m: number, day: number, h = 12) => new Date(y, m - 1, day, h)

describe('dayKey / checkinDays', () => {
  it('uses local calendar days with zero padding', () => {
    expect(dayKey(d(2026, 1, 5))).toBe('2026-01-05')
    expect(dayKey(d(2026, 12, 31, 23))).toBe('2026-12-31')
  })
  it('counts check-ins per local day and ignores bad dates', () => {
    const iso = [d(2026, 10, 1, 8).toISOString(), d(2026, 10, 1, 22).toISOString(), d(2026, 10, 2, 9).toISOString(), 'nope']
    const m = checkinDays(iso)
    expect(m.get('2026-10-01')).toBe(2)
    expect(m.get('2026-10-02')).toBe(1)
    expect(m.size).toBe(2)
  })
})

describe('monthGrid', () => {
  it('starts on Sunday, covers whole weeks, and marks only this month\'s days', () => {
    // October 2026 starts on a Thursday and has 31 days.
    const grid = monthGrid(2026, 9)
    expect(grid.every((w) => w.length === 7)).toBe(true)
    expect(grid[0]![0]!.inMonth).toBe(false) // Sunday before the 1st
    expect(grid[0]![4]).toMatchObject({ key: '2026-10-01', day: 1, inMonth: true }) // Thursday
    const inMonth = grid.flat().filter((c) => c.inMonth)
    expect(inMonth).toHaveLength(31)
    expect(inMonth[30]!.key).toBe('2026-10-31')
    expect(grid.length).toBe(5)
  })
  it('handles a month that needs six rows and a February', () => {
    expect(monthGrid(2026, 7).length).toBe(6) // August 2026: Saturday start, 31 days
    expect(monthGrid(2026, 1).flat().filter((c) => c.inMonth)).toHaveLength(28)
    expect(monthGrid(2028, 1).flat().filter((c) => c.inMonth)).toHaveLength(29) // leap year
  })
  it('has no duplicate day keys', () => {
    const keys = monthGrid(2026, 9).flat().map((c) => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('currentStreak', () => {
  const set = (...keys: string[]) => new Set(keys)
  it('counts back from today across consecutive days', () => {
    expect(currentStreak(set('2026-10-03', '2026-10-02', '2026-10-01'), d(2026, 10, 3))).toBe(3)
  })
  it('does not lose the streak before today is over: it counts from yesterday when today is empty', () => {
    expect(currentStreak(set('2026-10-02', '2026-10-01'), d(2026, 10, 3))).toBe(2)
  })
  it('is zero after a missed day, never negative, and zero with no data', () => {
    expect(currentStreak(set('2026-10-01'), d(2026, 10, 3))).toBe(0)
    expect(currentStreak(set(), d(2026, 10, 3))).toBe(0)
  })
  it('stops at the first gap', () => {
    expect(currentStreak(set('2026-10-05', '2026-10-04', '2026-10-02'), d(2026, 10, 5))).toBe(2)
  })
  it('crosses month and year boundaries', () => {
    expect(currentStreak(set('2027-01-01', '2026-12-31', '2026-12-30'), d(2027, 1, 1))).toBe(3)
  })
  it('counts a day once however many check-ins it has', () => {
    const days = new Set(checkinDays([d(2026, 10, 1, 8).toISOString(), d(2026, 10, 1, 9).toISOString()]).keys())
    expect(currentStreak(days, d(2026, 10, 1))).toBe(1)
  })
})

describe('daysInMonthWithCheckin / encouragement', () => {
  it('counts days in the given month only', () => {
    const s = new Set(['2026-09-30', '2026-10-01', '2026-10-04'])
    expect(daysInMonthWithCheckin(s, 2026, 9)).toBe(2)
    expect(daysInMonthWithCheckin(s, 2026, 8)).toBe(1)
  })
  it('only ever celebrates: nothing to say for no data, and never mentions losing or missing', () => {
    expect(encouragement(0, 0)).toBeNull()
    for (const [streak, month] of [[0, 1], [0, 5], [1, 1], [2, 2], [7, 12]] as const) {
      const msg = encouragement(streak, month)!
      expect(msg, `${streak}/${month}`).toBeTruthy()
      expect(msg).not.toMatch(/miss|lost|lose|break|broke|behind|fail|only|\!/i)
    }
    expect(encouragement(3, 3)).toBe('3 days in a row. That counts.')
    expect(encouragement(0, 4)).toBe('4 days this month you showed up for yourself.')
    expect(encouragement(1, 1)).toBe('You checked in this month. That counts.')
  })
})
