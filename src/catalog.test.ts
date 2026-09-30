import { describe, expect, it } from 'vitest'
import { CATALOG, GOALS, SETTINGS, CATEGORIES } from './catalog'

const FORBIDDEN = /diagnos|treat|cure|therap|clinical|prescrib|medical device/i

describe('catalog integrity', () => {
  it('has unique ids', () => {
    const ids = CATALOG.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has sane ranges and vocabulary', () => {
    for (const a of CATALOG) {
      expect(a.minMinutes, a.id).toBeGreaterThan(0)
      expect(a.maxMinutes, a.id).toBeGreaterThanOrEqual(a.minMinutes)
      expect(a.maxMinutes, a.id).toBeLessThanOrEqual(30)
      expect([1, 2, 3], a.id).toContain(a.effort)
      expect(SETTINGS, a.id).toContain(a.setting)
      expect(CATEGORIES, a.id).toContain(a.category)
      expect(a.goals.length, a.id).toBeGreaterThan(0)
      for (const g of a.goals) expect(GOALS, a.id).toContain(g)
      expect(a.searchQuery.trim().length, a.id).toBeGreaterThan(0)
    }
  })

  it('offers at least two activities for every goal', () => {
    for (const g of GOALS) {
      expect(CATALOG.filter((a) => a.goals.includes(g)).length, g).toBeGreaterThanOrEqual(2)
    }
  })

  it('has activities in every category', () => {
    for (const c of CATEGORIES) {
      expect(CATALOG.some((a) => a.category === c), c).toBe(true)
    }
  })

  it('keeps user-facing copy free of forbidden words', () => {
    for (const a of CATALOG) {
      expect(`${a.title} ${a.blurb}`, a.id).not.toMatch(FORBIDDEN)
    }
  })
})
