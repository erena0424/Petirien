import { describe, expect, it } from 'vitest'
import { clockText, openAt, parseHours } from './hours'

// The shapes below are copied from a real Google Maps response (the narrow no-break space before AM/PM is real).
const N = ' '
const week = (v: Record<string, string>) =>
  parseHours({ sunday: v.sunday ?? 'Closed', monday: v.monday ?? 'Closed', tuesday: v.tuesday ?? 'Closed', wednesday: v.wednesday ?? 'Closed', thursday: v.thursday ?? 'Closed', friday: v.friday ?? 'Closed', saturday: v.saturday ?? 'Closed' })!
// 4 January 2026 is a Sunday.
const at = (dayOffset: number, h: number, m = 0) => new Date(2026, 0, 4 + dayOffset, h, m)

describe('reading the weekly hours', () => {
  it('reads every shape seen in a real response', () => {
    expect(week({ sunday: `8${N}AM–3${N}PM` })[0]).toEqual([[480, 900]])
    expect(week({ sunday: `8:30${N}AM–5${N}PM` })[0]).toEqual([[510, 1020]])
    expect(week({ monday: `11${N}AM–2${N}PM, 4–8${N}PM` })[1]).toEqual([[660, 840], [960, 1200]]) // "4–8 PM" borrows the PM
    expect(week({ monday: `5–11${N}PM` })[1]).toEqual([[1020, 1380]])
    expect(week({ friday: `10${N}AM–12${N}AM` })[5]).toEqual([[600, 1440]]) // to midnight
    expect(week({ monday: `8${N}AM–12:30${N}AM` })[1]).toEqual([[480, 1470]]) // past midnight
    expect(week({ friday: `9:30${N}AM–1${N}AM` })[5]).toEqual([[570, 1500]])
    expect(week({ sunday: 'Closed' })[0]).toEqual([])
    expect(week({ sunday: 'Open 24 hours' })[0]).toEqual([[0, 1440]])
  })
  it('keeps the morning when "11-2 PM" gives no AM', () => {
    expect(week({ monday: '11–2 PM' })[1]).toEqual([[660, 840]])
  })
  it('gives up cleanly on anything it cannot read', () => {
    expect(parseHours(null)).toBeNull()
    expect(parseHours('Open')).toBeNull()
    expect(parseHours({})).toBeNull()
    expect(parseHours({ sunday: 'Hours might differ' })).toBeNull()
    expect(week({ sunday: `8${N}AM–3${N}PM` })[1]).toEqual([]) // other days are "Closed" here
    const partly = parseHours({ sunday: `8${N}AM–3${N}PM`, monday: 'by appointment' })!
    expect(partly[0]).toEqual([[480, 900]])
    expect(partly[1]).toBeNull()
  })
})

describe('open or closed at this moment', () => {
  const cafe = week({ sunday: `8${N}AM–3${N}PM`, monday: `7${N}AM–3${N}PM`, friday: `10${N}AM–12${N}AM`, saturday: `10${N}AM–1${N}AM` })
  it('is open inside the hours and closed outside them', () => {
    expect(openAt(cafe, at(0, 9)).status).toBe('open')
    expect(openAt(cafe, at(0, 7, 59)).status).toBe('closed')
    expect(openAt(cafe, at(0, 7, 59)).opensAt).toBe(480)
    expect(openAt(cafe, at(0, 15)).status).toBe('closed') // the closing minute is closed
    expect(openAt(cafe, at(0, 22)).status).toBe('closed')
  })
  it('uses the day it is now', () => {
    expect(openAt(cafe, at(1, 7, 30)).status).toBe('open') // Monday opens at 7
    expect(openAt(cafe, at(2, 12)).status).toBe('closed') // Tuesday: closed all day
  })
  it('says closes soon in the last 45 minutes', () => {
    expect(openAt(cafe, at(0, 14, 15)).status).toBe('closing-soon')
    expect(openAt(cafe, at(0, 14, 15)).closesAt).toBe(900)
    expect(openAt(cafe, at(0, 13, 0)).status).toBe('open')
  })
  it('counts hours past midnight as the day before\'s', () => {
    expect(openAt(cafe, at(0, 0, 5)).status).toBe('open') // Saturday 10 AM-1 AM: still open just after midnight on Sunday
    expect(openAt(cafe, at(0, 0, 30)).status).toBe('closing-soon') // and closing within the hour
    expect(openAt(cafe, at(0, 1, 30)).status).toBe('closed') // after 1 AM
    expect(openAt(cafe, at(5, 22, 0)).status).toBe('open') // Friday until midnight
    expect(openAt(cafe, at(5, 23, 59)).status).toBe('closing-soon')
    expect(openAt(cafe, at(6, 0, 0)).status).toBe('closed') // and shut at midnight (Friday ended at 12 AM)
  })
  it('does not guess for a day it could not read', () => {
    const partly = parseHours({ sunday: `8${N}AM–3${N}PM`, monday: 'by appointment' })!
    expect(openAt(partly, at(1, 9)).status).toBe('unknown')
  })
})

describe('clockText', () => {
  it('writes minutes the way people say them', () => {
    expect(clockText(900)).toBe('3 PM')
    expect(clockText(930)).toBe('3:30 PM')
    expect(clockText(0)).toBe('12 AM')
    expect(clockText(720)).toBe('12 PM')
    expect(clockText(1500)).toBe('1 AM')
  })
})
