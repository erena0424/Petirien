import { describe, expect, it } from 'vitest'
import { LOOK_AHEAD_MINUTES, choiceFor, describe as say, eventsOf, freeTime } from './free-time'

const now = new Date('2026-10-02T14:00:00Z')
const at = (min: number) => new Date(now.getTime() + min * 60000).toISOString()
const ev = (from: number, to: number, extra: object = {}) => ({ start: { dateTime: at(from) }, end: { dateTime: at(to) }, ...extra })

describe('freeTime', () => {
  it('counts the minutes until the next event', () => {
    const f = freeTime({ items: [ev(42, 80)] }, now)
    expect(f.minutes).toBe(42)
    expect(f.busyNow).toBe(false)
    expect(f.at?.toISOString()).toBe(at(42))
  })
  it('reads either response shape', () => {
    expect(freeTime({ events: [ev(20, 30)] }, now).minutes).toBe(20)
    expect(eventsOf({ items: [ev(1, 2)] })).toHaveLength(1)
    expect(eventsOf(null)).toEqual([])
    expect(eventsOf('x')).toEqual([])
    expect(eventsOf({ items: 'nope' })).toEqual([])
  })
  it('says plenty of time when nothing is coming up, including for an empty or odd response', () => {
    for (const data of [{ items: [] }, {}, null, undefined, 5]) {
      const f = freeTime(data, now)
      expect(f.minutes).toBe(LOOK_AHEAD_MINUTES)
      expect(f.at).toBeNull()
    }
  })
  it('knows when you are in an event and when it ends, joining back-to-back events', () => {
    const f = freeTime({ items: [ev(-10, 20), ev(20, 50), ev(120, 150)] }, now)
    expect(f.busyNow).toBe(true)
    expect(f.minutes).toBeNull()
    expect(f.at?.toISOString()).toBe(at(50))
  })
  it('skips all-day, cancelled, free-marked and declined events, and bad data', () => {
    const f = freeTime(
      {
        items: [
          { start: { date: '2026-10-02' }, end: { date: '2026-10-03' } },
          ev(5, 15, { status: 'cancelled' }),
          ev(6, 16, { transparency: 'transparent' }),
          ev(7, 17, { attendees: [{ self: true, responseStatus: 'declined' }] }),
          { start: { dateTime: 'not a time' }, end: { dateTime: at(30) } },
          ev(40, 40), // zero length
          null,
          ev(60, 90),
        ],
      },
      now,
    )
    expect(f.minutes).toBe(60)
  })
  it('keeps events you have not declined, even when someone else declined', () => {
    expect(freeTime({ items: [ev(25, 40, { attendees: [{ self: false, responseStatus: 'declined' }, { self: true, responseStatus: 'accepted' }] })] }, now).minutes).toBe(25)
  })
  it('never reads anything but times: titles and people do not appear in the result or the sentence', () => {
    const f = freeTime({ items: [ev(30, 60, { summary: 'SECRET-TITLE', description: 'SECRET-DESC', location: 'SECRET-PLACE', attendees: [{ email: 'secret@example.com' }] })] }, now)
    const out = JSON.stringify(f) + say(f)
    for (const s of ['SECRET', 'secret@']) expect(out).not.toContain(s)
  })
  it('an event that starts exactly now counts as busy, and one that just ended does not', () => {
    expect(freeTime({ items: [ev(0, 30)] }, now).busyNow).toBe(true)
    expect(freeTime({ items: [ev(-30, 0)] }, now).busyNow).toBe(false)
  })
})

describe('choiceFor', () => {
  it('picks the biggest option that fits, and the smallest when little time is free', () => {
    expect(choiceFor(42)).toBe(30)
    expect(choiceFor(30)).toBe(30)
    expect(choiceFor(29)).toBe(20)
    expect(choiceFor(15)).toBe(15)
    expect(choiceFor(9)).toBe(5)
    expect(choiceFor(2)).toBe(5)
    expect(choiceFor(0)).toBe(5)
    expect(choiceFor(LOOK_AHEAD_MINUTES)).toBe(30)
  })
})

describe('describe', () => {
  it('uses calm, specific sentences with no forbidden words', () => {
    const lines = [
      say(freeTime({ items: [ev(42, 80)] }, now)),
      say(freeTime({ items: [ev(-5, 50)] }, now)),
      say(freeTime({ items: [] }, now)),
      say(freeTime({ items: [ev(2, 20)] }, now)),
    ]
    expect(lines[0]).toMatch(/about 42 minutes before .*I picked 30 minutes/)
    expect(lines[1]).toMatch(/busy until/)
    expect(lines[2]).toMatch(/Nothing coming up/)
    expect(lines[3]).toMatch(/very little time.*5 minutes/)
    for (const l of lines) expect(l).not.toMatch(/diagnos|treat|cure|prescri|therap|clinical|!/i)
  })
})
