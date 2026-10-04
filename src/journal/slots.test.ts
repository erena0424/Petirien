import { describe, expect, it } from 'vitest'
import { CLICK_MIN, clickSlot, clockLabel, dragSlot, hhmm, minuteAt } from './slots'

describe('where a pointer is, in minutes', () => {
  it('turns a height in the column into a time, kept inside the day', () => {
    expect(minuteAt(0, 48)).toBe(0)
    expect(minuteAt(48 * 9, 48)).toBe(9 * 60)
    expect(minuteAt(48 * 9 + 24, 48)).toBe(9 * 60 + 30)
    expect(minuteAt(-20, 48)).toBe(0)
    expect(minuteAt(48 * 30, 48)).toBe(24 * 60)
  })
})

describe('a click makes an hour at the half hour it landed in', () => {
  it('rounds down to the half hour', () => {
    expect(clickSlot(9 * 60 + 10)).toEqual({ start: 9 * 60, end: 10 * 60 })
    expect(clickSlot(9 * 60 + 40)).toEqual({ start: 9 * 60 + 30, end: 10 * 60 + 30 })
    expect(CLICK_MIN).toBe(60)
  })
  it('never runs past midnight', () => {
    const s = clickSlot(23 * 60 + 50)
    expect(s.start).toBe(23 * 60 + 30)
    expect(s.end).toBe(24 * 60)
  })
})

describe('a drag makes the range it covered', () => {
  it('snaps to a quarter hour, whichever way it was dragged', () => {
    expect(dragSlot(9 * 60 + 2, 10 * 60 + 28)).toEqual({ start: 9 * 60, end: 10 * 60 + 30 })
    expect(dragSlot(10 * 60 + 28, 9 * 60 + 2)).toEqual({ start: 9 * 60, end: 10 * 60 + 30 })
  })
  it('is not a drag when it barely moved (that is a click)', () => {
    expect(dragSlot(9 * 60 + 3, 9 * 60 + 8)).toBeNull()
    expect(dragSlot(9 * 60, 9 * 60)).toBeNull()
  })
  it('stays inside the day', () => {
    expect(dragSlot(23 * 60, 24 * 60 + 90)).toEqual({ start: 23 * 60, end: 24 * 60 })
  })
})

describe('writing times', () => {
  it('formats for the time field and for people', () => {
    expect(hhmm(570)).toBe('09:30')
    expect(hhmm(0)).toBe('00:00')
    expect(hhmm(24 * 60)).toBe('23:59')
    expect(clockLabel(570)).toBe('9:30 AM')
    expect(clockLabel(13 * 60)).toBe('1 PM')
    expect(clockLabel(0)).toBe('12 AM')
  })
})
