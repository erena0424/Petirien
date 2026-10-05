import { describe, expect, it } from 'vitest'
import { CATALOG, GOALS, SETTINGS, CATEGORIES } from './catalog'

const FORBIDDEN = /diagnos|treat|cure|therap|clinical|prescrib|medical device/i

describe('catalog integrity', () => {
  it('gives every activity that is usually done by following a guide steps of its own, not "follow the tutorial"', () => {
    for (const a of CATALOG) {
      expect(a.steps.join(' '), a.id).not.toMatch(/\btutorial\b|follow along one step|copy them/i)
      if (a.tags.includes('follow-along')) {
        expect(a.steps.length, a.id).toBeGreaterThanOrEqual(3)
        expect(a.steps.some((st) => st.length >= 45), `${a.id} has at least one concrete step`).toBe(true)
      }
    }
  })

  it('writes steps and tips that read correctly with no video (the preview and "no screen" show them alone)', () => {
    for (const a of CATALOG) {
      for (const line of [...a.steps, a.tip ?? '']) expect(line, a.id).not.toMatch(/\bthe video\b|\bpress play\b|\bthis video\b/i)
    }
  })

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

describe('catalog instructions', () => {
  it('has hand-written needs, 3 to 5 steps, and a tip for every activity', () => {
    for (const a of CATALOG) {
      expect(a.needs.trim().length, a.id).toBeGreaterThan(0)
      expect(a.steps.length, a.id).toBeGreaterThanOrEqual(3)
      expect(a.steps.length, a.id).toBeLessThanOrEqual(5)
      for (const step of a.steps) expect(step.trim().length, a.id).toBeGreaterThan(0)
      expect(a.tip.trim().length, a.id).toBeGreaterThan(0)
    }
  })

  it('keeps instructions free of forbidden words and links', () => {
    for (const a of CATALOG) {
      const text = [a.needs, ...a.steps, a.tip].join(' ')
      expect(text, a.id).not.toMatch(FORBIDDEN)
      expect(text, a.id).not.toMatch(/https?:\/\/|www\./i)
    }
  })

  it('gives a stop-if-it-hurts line to every activity that asks for physical movement', () => {
    for (const a of CATALOG.filter((x) => x.category === 'movement' && x.id !== 'legs-up-rest')) {
      expect(a.tip, a.id).toMatch(/stop if|skip/i)
    }
  })
})

describe('video flag', () => {
  it('is set on every activity, with both kinds present', () => {
    for (const a of CATALOG) expect(typeof a.video, a.id).toBe('boolean')
    expect(CATALOG.some((a) => a.video)).toBe(true)
    expect(CATALOG.some((a) => !a.video)).toBe(true)
  })
  it('keeps videos for guided meditations, stretching, yoga and follow-along crafts, and not for plain written exercises', () => {
    const byId = (id: string) => CATALOG.find((a) => a.id === id)!
    for (const id of ['body-scan', 'loving-kindness', 'desk-stretch', 'chair-yoga', 'gentle-yoga', 'doodle-along']) expect(byId(id).video, id).toBe(true)
    for (const id of ['grounding-54321', 'mindful-pause', 'journaling-prompts', 'gratitude-note']) expect(byId(id).video, id).toBe(false)
  })
})
