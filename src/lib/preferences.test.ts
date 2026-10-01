import { describe, expect, it } from 'vitest'
import { CATALOG } from '../catalog'
import { deterministicPicks } from '../recommend/fallback'
import { filterCatalog } from '../recommend/filter'
import { AVOID_OPTIONS, LIKE_OPTIONS, avoidsTooMuch, normalizePreferences } from './preferences'

const allTags = new Set(CATALOG.flatMap((a) => a.tags))

describe('preference options', () => {
  it('only use tags that exist in the catalog, each with a label', () => {
    for (const o of [...AVOID_OPTIONS, ...LIKE_OPTIONS]) {
      expect(allTags.has(o.tag), o.tag).toBe(true)
      expect(o.label.length).toBeGreaterThan(3)
    }
  })
})

describe('normalizePreferences', () => {
  it('drops unknown tags and duplicates, and accepts only known default minutes', () => {
    expect(
      normalizePreferences({ avoid: ['guided', 'guided', 'made-up', 3 as unknown as string], likedTags: ['music', 'nope'], defaultMinutes: 15 }),
    ).toEqual({ avoid: ['guided'], likedTags: ['music'], defaultMinutes: 15, screen: 'auto' })
    expect(normalizePreferences({ defaultMinutes: 7 }).defaultMinutes).toBeNull()
    expect(normalizePreferences(null)).toEqual({ avoid: [], likedTags: [], defaultMinutes: null, screen: 'auto' })
    expect(normalizePreferences({ screen: 'none' }).screen).toBe('none')
    expect(normalizePreferences({ screen: 'video' }).screen).toBe('video')
    expect(normalizePreferences({ screen: 'sometimes' as unknown as 'auto' }).screen).toBe('auto')
    expect(normalizePreferences({ avoid: 'guided' as unknown as string[] }).avoid).toEqual([])
  })
  it('lets avoiding win when a tag is in both lists', () => {
    const p = normalizePreferences({ avoid: ['music'], likedTags: ['music', 'no-voice'] })
    expect(p.avoid).toEqual(['music'])
    expect(p.likedTags).toEqual(['no-voice'])
  })
  it('warns when the avoid list leaves too little to offer', () => {
    expect(avoidsTooMuch([])).toBe(false)
    expect(avoidsTooMuch(['guided'])).toBe(false)
    expect(avoidsTooMuch(['guided', 'needs-supplies', 'follow-along', 'music', 'eyes-closed'])).toBe(true)
  })
})

describe('preferences change what is offered', () => {
  const base = { minutes: 30, energy: 5 }
  it('avoid is a hard rule: avoided tags never appear', () => {
    for (const o of AVOID_OPTIONS) {
      const { activities } = filterCatalog({ ...base, avoid: [o.tag] })
      expect(activities.length, o.tag).toBeGreaterThan(0)
      for (const a of activities) expect(a.tags, `${o.tag} / ${a.id}`).not.toContain(o.tag)
    }
  })
  it('liked tags nudge ranking without removing anything', () => {
    const options = filterCatalog({ ...base }).activities
    const without = deterministicPicks(options, { energy: 5, liked: [], disliked: [] }, 3).map((a) => a.id)
    const withLikes = deterministicPicks(options, { energy: 5, liked: [], disliked: [], likedTags: ['no-voice'] }, 3)
    expect(withLikes.some((a) => a.tags.includes('no-voice'))).toBe(true)
    expect(withLikes.map((a) => a.id)).not.toEqual(without)
    expect(withLikes).toHaveLength(3)
  })
  it('a liked tag cannot override an avoid', () => {
    const { activities } = filterCatalog({ ...base, avoid: ['music'] })
    const picks = deterministicPicks(activities, { energy: 5, liked: [], disliked: [], likedTags: ['music'] }, 3)
    for (const a of picks) expect(a.tags).not.toContain('music')
  })
})
