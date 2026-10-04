import { describe, expect, it } from 'vitest'
import { MY_PLAN_PREFIX, newMyPlan, planFromRow, planIdFor, recordIdOf } from './my-plans'
import { shortList, type Plan } from './plan'

const now = new Date(2026, 9, 4, 12, 0) // Sunday 4 October 2026, noon

describe('an event typed by hand', () => {
  it('with a time lasts an hour, on the day chosen', () => {
    const row = newMyPlan('  Team presentation ', '2026-10-09', '14:30', now)!
    expect(row.title).toBe('Team presentation')
    expect(new Date(row.start)).toEqual(new Date(2026, 9, 9, 14, 30))
    expect(new Date(row.end)).toEqual(new Date(2026, 9, 9, 15, 30))
    expect(row.allDay).toBe(0)
  })
  it('with an end time lasts until then, and an end before the start is refused', () => {
    const row = newMyPlan('Workshop', '2026-10-09', '09:00', now, '11:30')!
    expect(new Date(row.end)).toEqual(new Date(2026, 9, 9, 11, 30))
    expect(newMyPlan('x', '2026-10-09', '09:00', now, '08:00')).toBeNull()
    expect(newMyPlan('x', '2026-10-09', '09:00', now, '09:00')).toBeNull()
    expect(newMyPlan('x', '2026-10-09', '09:00', now, 'later')).toBeNull()
  })
  it('with no time is all day; with no date it is today', () => {
    const row = newMyPlan('Dentist', '', '', now)!
    expect(new Date(row.start)).toEqual(new Date(2026, 9, 4))
    expect(new Date(row.end)).toEqual(new Date(2026, 9, 5))
    expect(row.allDay).toBe(1)
  })
  it('refuses an empty title, a bad date or time, and dates that are surely typos', () => {
    expect(newMyPlan('   ', '2026-10-09', '', now)).toBeNull()
    expect(newMyPlan('x', '2026-02-31', '', now)).toBeNull() // not a real day
    expect(newMyPlan('x', 'tomorrow', '', now)).toBeNull()
    expect(newMyPlan('x', '2026-10-09', '25:00', now)).toBeNull()
    expect(newMyPlan('x', '2026-10-09', '9am', now)).toBeNull()
    expect(newMyPlan('x', '2020-01-01', '', now)).toBeNull() // years ago
    expect(newMyPlan('x', '2031-01-01', '', now)).toBeNull() // years ahead
    expect(newMyPlan('x', '2026-09-20', '', now)).not.toBeNull() // a couple of weeks ago is fine
  })
  it('keeps a long title short and never lets control characters in', () => {
    const row = newMyPlan(`A${'b'.repeat(200)}\u0007`, '', '', now)!
    expect(row.title.length).toBeLessThanOrEqual(80)
    expect(row.title).not.toMatch(/\u0007/)
  })
})

describe('a stored event as a plan', () => {
  const row = newMyPlan('Call a friend', '2026-10-05', '18:00', now)!
  it('is a manual plan with an id that leads back to its record', () => {
    const p = planFromRow('abc123', row)!
    expect(p.manual).toBe(true)
    expect(p.id).toBe(planIdFor('abc123'))
    expect(recordIdOf(p.id)).toBe('abc123')
    expect(recordIdOf('some-google-event-id')).toBeNull()
    expect(p.id.startsWith(MY_PLAN_PREFIX)).toBe(true)
  })
  it('skips anything that cannot be read, without throwing', () => {
    expect(planFromRow('x', { title: 'a' })).toBeNull()
    expect(planFromRow('x', { title: 'a', start: 'nonsense', end: 'nonsense' })).toBeNull()
    expect(planFromRow('x', { title: 'a', start: row.end, end: row.start })).toBeNull() // ends before it starts
  })
})

describe('what Home shows of them', () => {
  const plan = (title: string, d: number, h: number): Plan => planFromRow(`${title}`, newMyPlan(title, `2026-10-${String(d).padStart(2, '0')}`, `${h}:00`, now)!)!
  it('only today and tomorrow, not the rest of the month', () => {
    const shown = shortList([plan('Later', 20, 9), plan('Today', 4, 15), plan('Tomorrow', 5, 9), plan('Last week', 1, 9)], now)
    expect(shown.map((p) => p.title)).toEqual(['Today', 'Tomorrow'])
  })
  it('keeps something that just finished today so there is something to talk about', () => {
    const shown = shortList([plan('Morning thing', 4, 9), plan('Evening thing', 4, 19)], now)
    expect(shown.map((p) => p.title)).toEqual(['Morning thing', 'Evening thing'])
  })
})
