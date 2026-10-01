import { describe, expect, it } from 'vitest'
import { toInput, EMPTY_FORM } from '../components/checkin/CheckinForm'
import { formatDuration, formatResetTime } from './format'
import { toResponse } from './recommend-client'
import { SUPPORT_RESOURCES } from './support'
import { errorMessage, playerErrorKind, watchUrl } from './youtube'

describe('playerErrorKind', () => {
  it('maps YouTube error codes', () => {
    expect(playerErrorKind(100)).toBe('unavailable')
    expect(playerErrorKind(101)).toBe('embed_blocked')
    expect(playerErrorKind(150)).toBe('embed_blocked')
    for (const c of [2, 5, 153, 999]) expect(playerErrorKind(c)).toBe('other')
  })
  it('has a distinct plain message per kind', () => {
    const msgs = (['unavailable', 'embed_blocked', 'other'] as const).map(errorMessage)
    expect(new Set(msgs).size).toBe(3)
  })
  it('builds a safe watch url', () => {
    expect(watchUrl('abc_DEF-123')).toBe('https://www.youtube.com/watch?v=abc_DEF-123')
    expect(watchUrl('a&b=c')).toBe('https://www.youtube.com/watch?v=a%26b%3Dc')
  })
})

describe('support resources', () => {
  it('lists 988, Crisis Text Line, emergency, and an international directory', () => {
    const ids = SUPPORT_RESOURCES.map((r) => r.id)
    expect(ids).toEqual(['988', 'crisis-text-line', 'emergency', 'international'])
  })
  it('only uses tel:, sms:, and https links', () => {
    for (const r of SUPPORT_RESOURCES) {
      expect(r.actions.length).toBeGreaterThan(0)
      for (const a of r.actions) expect(a.href).toMatch(/^(tel:\d+|sms:\d+|https:\/\/)/)
    }
  })
  it('has the numbers right', () => {
    const hrefs = SUPPORT_RESOURCES.flatMap((r) => r.actions.map((a) => a.href))
    expect(hrefs).toContain('tel:988')
    expect(hrefs).toContain('sms:988')
    expect(hrefs).toContain('sms:741741')
    expect(hrefs).toContain('tel:911')
    expect(SUPPORT_RESOURCES.find((r) => r.id === 'crisis-text-line')?.detail).toContain('HOME to 741741')
  })
})

describe('toResponse', () => {
  it('passes through a valid response', () => {
    const data = { status: 'capped', resetsAt: '2026-10-02T00:00:00.000Z' }
    expect(toResponse(200, { success: true, data })).toEqual(data)
  })
  it('turns 401, malformed bodies, unknown statuses, and failures into errors', () => {
    expect(toResponse(401, null).status).toBe('error')
    expect(toResponse(200, null).status).toBe('error')
    expect(toResponse(200, { success: true, data: { status: 'mystery' } }).status).toBe('error')
    expect(toResponse(500, { success: true, data: { status: 'ok' } }).status).toBe('error')
    expect(toResponse(200, { success: false, error: 'x' }).status).toBe('error')
  })
})

describe('toInput', () => {
  it('requires mood, energy, and minutes', () => {
    expect(toInput(EMPTY_FORM)).toBeNull()
    expect(toInput({ ...EMPTY_FORM, mood: 3 })).toBeNull()
    expect(toInput({ ...EMPTY_FORM, mood: 3, energy: 2 })).toEqual({ mood: 3, energy: 2, minutes: 10 })
  })
  it('omits an empty goal and a blank note, and trims the note', () => {
    expect(toInput({ mood: 3, energy: 2, minutes: 5, goal: '', note: '   ' })).toEqual({ mood: 3, energy: 2, minutes: 5 })
    expect(toInput({ mood: 3, energy: 2, minutes: 5, goal: 'calm', note: ' hi ' })).toEqual({
      mood: 3,
      energy: 2,
      minutes: 5,
      goal: 'calm',
      note: 'hi',
    })
  })
})

describe('format', () => {
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('')
    expect(formatDuration(45)).toBe('under 1 min')
    expect(formatDuration(360)).toBe('6 min')
    expect(formatDuration(Number.NaN)).toBe('')
  })
  it('falls back for a bad reset time', () => {
    expect(formatResetTime('nope')).toBe('tomorrow')
  })
})
