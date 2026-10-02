import { describe, expect, it } from 'vitest'
import type { Plan } from '../plans/plan'
import { HOUR_PX, MIN_BLOCK_MINUTES, allDayOn, blockBox, covering, eventsOn, fetchRange, layoutDay, reflectedIds, timeRange } from './layout'
import { dayKey } from './calendar'

const fri = new Date(2026, 9, 2)
const t = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).toISOString()
const ev = (id: string, from: string, to: string, extra: Partial<Plan> = {}): Plan => ({ id, title: id, start: from, end: to, allDay: false, manual: false, ...extra })

describe('layoutDay', () => {
  it('puts an event at its start and end minute', () => {
    const [b] = layoutDay([ev('a', t(2, 9), t(2, 10, 30))], fri)
    expect(b).toMatchObject({ startMin: 540, endMin: 630, lane: 0, lanes: 1 })
    expect(blockBox(b!).top).toBe(9 * HOUR_PX)
    expect(blockBox(b!).height).toBe(1.5 * HOUR_PX - 2)
  })
  it('puts overlapping events side by side and shares the width, so none is hidden', () => {
    const blocks = layoutDay([ev('a', t(2, 9), t(2, 11)), ev('b', t(2, 10), t(2, 12)), ev('c', t(2, 10, 30), t(2, 11, 30))], fri)
    expect(blocks.map((b) => [b.plan.id, b.lane, b.lanes])).toEqual([['a', 0, 3], ['b', 1, 3], ['c', 2, 3]])
    const box = blockBox(blocks[1]!)
    expect(parseFloat(box.left)).toBeCloseTo(33.33, 1)
    expect(parseFloat(box.width)).toBeCloseTo(33.33, 1)
  })
  it('reuses a free lane and keeps separate clusters independent', () => {
    const blocks = layoutDay([ev('a', t(2, 9), t(2, 10)), ev('b', t(2, 9, 30), t(2, 11)), ev('c', t(2, 10), t(2, 10, 45)), ev('d', t(2, 14), t(2, 15))], fri)
    const by = Object.fromEntries(blocks.map((b) => [b.plan.id, b]))
    expect(by.a).toMatchObject({ lane: 0, lanes: 2 })
    expect(by.b).toMatchObject({ lane: 1, lanes: 2 })
    expect(by.c).toMatchObject({ lane: 0, lanes: 2 }) // a ended, so c takes its lane
    expect(by.d).toMatchObject({ lane: 0, lanes: 1 }) // a later event is not squeezed by the morning
  })
  it('back-to-back events do not overlap', () => {
    const blocks = layoutDay([ev('a', t(2, 9), t(2, 10)), ev('b', t(2, 10), t(2, 11))], fri)
    expect(blocks.every((b) => b.lanes === 1)).toBe(true)
  })
  it('gives a very short event a block you can press', () => {
    const [b] = layoutDay([ev('a', t(2, 9), t(2, 9, 5))], fri)
    expect(b!.endMin - b!.startMin).toBe(MIN_BLOCK_MINUTES)
  })
  it('clips an event that runs past midnight to each day it touches', () => {
    const late = ev('late', t(2, 22), t(3, 1))
    expect(layoutDay([late], fri)[0]).toMatchObject({ startMin: 22 * 60, endMin: 24 * 60 })
    expect(layoutDay([late], new Date(2026, 9, 3))[0]).toMatchObject({ startMin: 0, endMin: 60 })
    expect(layoutDay([late], new Date(2026, 9, 4))).toEqual([])
  })
  it('leaves out all-day events and events on other days', () => {
    const plans = [ev('ad', t(2, 0), t(3, 0), { allDay: true }), ev('other', t(5, 9), t(5, 10))]
    expect(layoutDay(plans, fri)).toEqual([])
  })
})

describe('all-day and agenda helpers', () => {
  it('finds all-day events covering a day, including multi-day ones', () => {
    const trip = ev('trip', t(1, 0), t(4, 0), { allDay: true })
    expect(allDayOn([trip], fri).map((p) => p.id)).toEqual(['trip'])
    expect(allDayOn([trip], new Date(2026, 9, 4))).toEqual([])
    expect(allDayOn([trip], new Date(2026, 9, 3)).map((p) => p.id)).toEqual(['trip'])
  })
  it('lists everything on a day, all-day first then by time', () => {
    const plans = [ev('late', t(2, 15), t(2, 16)), ev('early', t(2, 8), t(2, 9)), ev('ad', t(2, 0), t(3, 0), { allDay: true }), ev('tomorrow', t(3, 8), t(3, 9))]
    expect(eventsOn(plans, fri).map((p) => p.id)).toEqual(['ad', 'early', 'late'])
  })
})

describe('fetchRange and covering', () => {
  it('asks for the whole visible grid: a month with its padding days, a week, a day', () => {
    const m = fetchRange('month', fri)
    expect(dayKey(m.from)).toBe('2026-09-27')
    expect(dayKey(m.to)).toBe('2026-11-01') // exclusive: the day after the last visible Saturday
    const w = fetchRange('week', fri)
    expect(dayKey(w.from)).toBe('2026-09-27')
    expect(dayKey(w.to)).toBe('2026-10-04')
    const d = fetchRange('day', fri)
    expect(dayKey(d.from)).toBe('2026-10-02')
    expect(dayKey(d.to)).toBe('2026-10-03')
  })
  it('reuses a loaded range that covers the one wanted, so moving around does not ask (or pay) again', () => {
    const month = fetchRange('month', fri)
    const loaded = [{ from: month.from.getTime(), to: month.to.getTime(), plans: [] }]
    const week = fetchRange('week', fri)
    const day = fetchRange('day', new Date(2026, 9, 14))
    expect(covering(loaded, week.from, week.to)).toBe(loaded[0])
    expect(covering(loaded, day.from, day.to)).toBe(loaded[0])
    const nextMonth = fetchRange('month', new Date(2026, 10, 15))
    expect(covering(loaded, nextMonth.from, nextMonth.to)).toBeUndefined()
    expect(covering([], day.from, day.to)).toBeUndefined()
  })
})

describe('small helpers', () => {
  it('marks events that already have a journal entry', () => {
    expect([...reflectedIds([{ eventId: 'a' }, { eventId: '' }, {}, { eventId: 'b' }, { eventId: 'a' }])].sort()).toEqual(['a', 'b'])
  })
  it('writes the time range, or All day', () => {
    expect(timeRange(ev('a', t(2, 9), t(2, 10, 30)))).toMatch(/9:00.*to.*10:30/)
    expect(timeRange(ev('a', t(2, 0), t(3, 0), { allDay: true }))).toBe('All day')
  })
})
