import { describe, expect, it } from 'vitest'
import { MODEL_DAILY_CAP, isOwnerPaidModelCall, modelDay, underModelCap } from './model-cap'

describe('the app-wide model limit', () => {
  it('stops at the cap and no sooner', () => {
    expect(underModelCap(0)).toBe(true)
    expect(underModelCap(MODEL_DAILY_CAP - 1)).toBe(true)
    expect(underModelCap(MODEL_DAILY_CAP)).toBe(false)
  })
  it('is small enough to be a bounded cost (about $0.60 a day at $0.001 a call)', () => {
    expect(MODEL_DAILY_CAP * 0.001).toBeLessThanOrEqual(1)
  })
  it('counts days in UTC', () => {
    expect(modelDay(new Date('2026-10-04T23:59:00Z'))).toBe('2026-10-04')
  })
  it('applies to the model and to nothing else', () => {
    expect(isOwnerPaidModelCall('anthropic/chat-completion')).toBe(true)
    for (const e of ['youtube/search-videos', 'google/calendar-list-events', 'serpapi/places-search']) expect(isOwnerPaidModelCall(e)).toBe(false)
  })
})
