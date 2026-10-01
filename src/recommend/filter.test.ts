import { describe, expect, it } from 'vitest'
import { CATALOG } from '../catalog'
import { effortCap, filterCatalog } from './filter'

const base = { minutes: 20, energy: 5 }

describe('effortCap', () => {
  it('maps energy to a cap', () => {
    expect(effortCap(1)).toBe(1)
    expect(effortCap(2)).toBe(1)
    expect(effortCap(3)).toBe(2)
    expect(effortCap(4)).toBe(3)
    expect(effortCap(5)).toBe(3)
  })
})

describe('filterCatalog hard constraints', () => {
  it('never returns an activity that needs more time than available', () => {
    const { activities } = filterCatalog({ ...base, minutes: 4 })
    expect(activities.length).toBeGreaterThan(0)
    for (const a of activities) expect(a.minMinutes).toBeLessThanOrEqual(4)
  })

  it('never exceeds the effort cap for low energy', () => {
    const { activities } = filterCatalog({ ...base, energy: 1 })
    expect(activities.length).toBeGreaterThan(0)
    for (const a of activities) expect(a.effort).toBe(1)
  })

  it('excludes disliked and avoided tags', () => {
    const { activities } = filterCatalog({
      ...base,
      dislikedTags: ['music'],
      avoid: ['guided', 'needs-supplies'],
    })
    expect(activities.length).toBeGreaterThan(0)
    for (const a of activities) {
      expect(a.tags).not.toContain('music')
      expect(a.tags).not.toContain('guided')
      expect(a.tags).not.toContain('needs-supplies')
    }
  })

  it('excludes rejected ids', () => {
    const rejected = CATALOG.slice(0, 5).map((a) => a.id)
    const { activities } = filterCatalog({ ...base, excludeIds: rejected })
    for (const a of activities) expect(rejected).not.toContain(a.id)
  })

  it('returns nothing rather than breaking a constraint', () => {
    const { activities } = filterCatalog({ minutes: 1, energy: 5 })
    expect(activities).toEqual([])
  })
})

describe('filterCatalog goal handling', () => {
  it('filters to the goal when enough match', () => {
    const { activities, relaxedGoal } = filterCatalog({ ...base, goal: 'move' })
    expect(relaxedGoal).toBe(false)
    for (const a of activities) expect(a.goals).toContain('move')
  })

  it('relaxes only the goal, never the hard constraints, when too few match', () => {
    // Low energy + short time + avoiding guided leaves almost nothing for "connect".
    const input = {
      minutes: 6,
      energy: 1,
      goal: 'connect' as const,
      avoid: ['guided'],
    }
    const { activities, relaxedGoal } = filterCatalog(input)
    expect(relaxedGoal).toBe(true)
    expect(activities.length).toBeGreaterThan(0)
    for (const a of activities) {
      expect(a.minMinutes).toBeLessThanOrEqual(6)
      expect(a.effort).toBe(1)
      expect(a.tags).not.toContain('guided')
    }
  })
})

describe('filterCatalog video-only', () => {
  it('keeps only activities that come with a video, and combines with the other rules', () => {
    const { activities } = filterCatalog({ minutes: 30, energy: 5, videoOnly: true })
    expect(activities.length).toBeGreaterThan(0)
    for (const a of activities) expect(a.video).toBe(true)
    const avoided = filterCatalog({ minutes: 30, energy: 5, videoOnly: true, avoid: ['guided'] }).activities
    for (const a of avoided) {
      expect(a.video).toBe(true)
      expect(a.tags).not.toContain('guided')
    }
  })
  it('does not change anything when off', () => {
    expect(filterCatalog({ minutes: 30, energy: 5 }).activities.length).toBeGreaterThan(
      filterCatalog({ minutes: 30, energy: 5, videoOnly: true }).activities.length,
    )
  })
})
