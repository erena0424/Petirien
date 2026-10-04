import { describe, expect, it } from 'vitest'
import { OWNER_DAILY_CAPS, ownerCap, ownerDay, ownerUsageId, underOwnerCap } from './owner-cap'

describe('the app-wide limits on what the owner pays for', () => {
  it('stops at the cap and no sooner, for each integration', () => {
    for (const name of Object.keys(OWNER_DAILY_CAPS)) {
      expect(underOwnerCap(name, 0), name).toBe(true)
      expect(underOwnerCap(name, ownerCap(name) - 1), name).toBe(true)
      expect(underOwnerCap(name, ownerCap(name)), name).toBe(false)
    }
  })
  it('allows nothing for an integration that is not listed', () => {
    expect(ownerCap('serpapi')).toBe(0)
    expect(underOwnerCap('google', 0)).toBe(false)
  })
  it('keeps the worst case a day small: about $0.60 for the model and $1.50 for video search', () => {
    expect(OWNER_DAILY_CAPS.anthropic! * 0.001).toBeLessThanOrEqual(1)
    expect(OWNER_DAILY_CAPS.youtube! * 0.013).toBeLessThanOrEqual(2)
  })
  it('counts each integration on its own row, by UTC day', () => {
    expect(ownerUsageId('youtube')).not.toBe(ownerUsageId('anthropic'))
    expect(ownerDay(new Date('2026-10-04T23:59:00Z'))).toBe('2026-10-04')
  })
})
