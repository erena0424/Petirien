import { describe, expect, it } from 'vitest'
import { addDays, dayKey, entryDay, groupByDay, monthGrid, rangeLabel, sameDay, shift, weekDays, weekStart, isView } from './calendar'

// Friday, 2 October 2026 (local time).
const fri = new Date(2026, 9, 2, 15, 30)
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString()

describe('dayKey and entryDay', () => {
  it('uses the local calendar day, so a late-evening entry stays on that day', () => {
    expect(dayKey(new Date(2026, 9, 2, 23, 59))).toBe('2026-10-02')
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(dayKey(entryDay({ createdAt: new Date(2026, 9, 2, 23, 59).toISOString() })!)).toBe('2026-10-02')
  })
  it('puts anything about a plan on the day of that plan, and everything else on the day it was written', () => {
    expect(dayKey(entryDay({ createdAt: at(2026, 10, 5), kind: 'reflection', eventStart: at(2026, 10, 2) })!)).toBe('2026-10-02')
    expect(dayKey(entryDay({ createdAt: at(2026, 10, 5), eventStart: at(2026, 10, 2) })!)).toBe('2026-10-02') // notes from a chat about a plan sit on the plan's day too
    expect(dayKey(entryDay({ createdAt: at(2026, 10, 5), eventStart: 'garbage' })!)).toBe('2026-10-05')
    expect(dayKey(entryDay({ createdAt: at(2026, 10, 5), kind: 'reflection', eventStart: 'garbage' })!)).toBe('2026-10-05')
    expect(entryDay({ createdAt: 'garbage' })).toBeNull()
    expect(entryDay({ createdAt: '' })).toBeNull()
  })
})

describe('groupByDay', () => {
  it('groups by day, newest first, skipping entries with no date', () => {
    const a = { id: 'a', createdAt: at(2026, 10, 2, 9) }
    const b = { id: 'b', createdAt: at(2026, 10, 2, 18) }
    const c = { id: 'c', createdAt: at(2026, 10, 3, 8) }
    const bad = { id: 'x', createdAt: 'nope' }
    const g = groupByDay([a, c, bad, b])
    expect([...g.keys()].sort()).toEqual(['2026-10-02', '2026-10-03'])
    expect(g.get('2026-10-02')!.map((e) => e.id)).toEqual(['b', 'a'])
    expect(groupByDay([]).size).toBe(0)
  })
  it('shows entries that were not part of any calendar event on their own date', () => {
    const g = groupByDay([{ id: 'note', createdAt: at(2026, 9, 14) }])
    expect(g.get('2026-09-14')).toHaveLength(1)
  })
})

describe('weeks', () => {
  it('start on Sunday and have seven days', () => {
    expect(dayKey(weekStart(fri))).toBe('2026-09-27')
    expect(weekDays(fri).map(dayKey)).toEqual(['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'])
    expect(dayKey(weekStart(new Date(2026, 9, 4)))).toBe('2026-10-04') // a Sunday is its own week start
  })
  it('cross a year boundary', () => {
    expect(weekDays(new Date(2026, 0, 1)).map(dayKey)).toEqual(['2025-12-28', '2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03'])
  })
})

describe('monthGrid', () => {
  it('is whole weeks that cover the month, padded with neighbouring days', () => {
    const grid = monthGrid(fri) // October 2026 starts on a Thursday and has 31 days
    expect(grid.every((w) => w.length === 7)).toBe(true)
    expect(dayKey(grid[0]![0]!)).toBe('2026-09-27')
    expect(dayKey(grid[grid.length - 1]![6]!)).toBe('2026-10-31')
    expect(grid).toHaveLength(5)
    const inMonth = grid.flat().filter((d) => d.getMonth() === 9)
    expect(inMonth).toHaveLength(31)
  })
  it('handles a month that fits exactly four weeks, and one that needs six', () => {
    expect(monthGrid(new Date(2026, 1, 10))).toHaveLength(4) // February 2026: Sun 1st to Sat 28th
    expect(monthGrid(new Date(2026, 7, 10))).toHaveLength(6) // August 2026: Sat 1st to Mon 31st
  })
})

describe('shift', () => {
  it('moves by a month, clamping to a shorter month', () => {
    expect(dayKey(shift('month', new Date(2026, 0, 31), 1))).toBe('2026-02-28')
    expect(dayKey(shift('month', new Date(2026, 2, 31), -1))).toBe('2026-02-28')
    expect(dayKey(shift('month', new Date(2026, 11, 15), 1))).toBe('2027-01-15')
    expect(dayKey(shift('month', new Date(2026, 0, 15), -1))).toBe('2025-12-15')
  })
  it('moves by a week or a day, and the list stays put', () => {
    expect(dayKey(shift('week', fri, 1))).toBe('2026-10-09')
    expect(dayKey(shift('week', fri, -1))).toBe('2026-09-25')
    expect(dayKey(shift('day', fri, 1))).toBe('2026-10-03')
    expect(dayKey(shift('day', new Date(2026, 9, 1), -1))).toBe('2026-09-30')
    expect(shift('list', fri, 1)).toBe(fri)
  })
})

describe('labels and helpers', () => {
  it('names the range on screen', () => {
    expect(rangeLabel('month', fri)).toMatch(/October 2026/)
    expect(rangeLabel('week', fri)).toMatch(/Sep 27 to Oct 3, 2026/)
    expect(rangeLabel('day', fri)).toMatch(/Friday, October 2, 2026/)
    expect(rangeLabel('list', fri)).toBe('All entries')
  })
  it('compares days and validates a view name', () => {
    expect(sameDay(fri, new Date(2026, 9, 2, 1))).toBe(true)
    expect(sameDay(fri, addDays(fri, 1))).toBe(false)
    expect(isView('week')).toBe(true)
    expect(isView('year')).toBe(false)
    expect(isView(undefined)).toBe(false)
  })
})
