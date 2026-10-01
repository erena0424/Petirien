import { describe, expect, it } from 'vitest'
import { CATALOG, type Activity } from '../catalog'
import { describeSources } from './sources'
import { pickShortlist } from '../recommend/pipeline'

const byId = (id: string) => CATALOG.find((a) => a.id === id)!
const plainFirst: Activity[] = ['grounding-54321', 'box-breathing', 'silent-sit', 'mindful-pause', 'desk-stretch', 'chair-yoga'].map(byId)
const videoFirst: Activity[] = ['desk-stretch', 'chair-yoga', 'body-scan', 'grounding-54321', 'journaling-prompts'].map(byId)

describe('pickShortlist in "Not sure" mode (the default)', () => {
  it('always includes a video activity and a plain idea when both exist, even if the best-ranked three are all plain', () => {
    for (const screen of [undefined, 'auto' as const]) {
      const out = pickShortlist(plainFirst, screen)
      expect(out).toHaveLength(3)
      expect(out.some((a) => a.video), `${screen}`).toBe(true)
      expect(out.some((a) => !a.video), `${screen}`).toBe(true)
    }
  })
  it('does the same when the best-ranked three are all videos', () => {
    const out = pickShortlist(videoFirst.slice(0, 3).concat(byId('grounding-54321')), 'auto')
    expect(out.some((a) => !a.video)).toBe(true)
    expect(out.some((a) => a.video)).toBe(true)
  })
  it('keeps the model\'s order and top choices where it can', () => {
    const out = pickShortlist(plainFirst, 'auto')
    expect(out.map((a) => a.id)).toEqual(['grounding-54321', 'box-breathing', 'desk-stretch']) // first video joins at its place, order preserved
  })
  it('does not invent a mix that is not there', () => {
    const onlyPlain = plainFirst.filter((a) => !a.video)
    expect(pickShortlist(onlyPlain, 'auto').every((a) => !a.video)).toBe(true)
    const onlyVideo = videoFirst.filter((a) => a.video)
    expect(pickShortlist(onlyVideo, 'auto').every((a) => a.video)).toBe(true)
    expect(pickShortlist([], 'auto')).toEqual([])
  })
  it('never returns duplicates or more than three', () => {
    const out = pickShortlist([...plainFirst, ...videoFirst], 'auto')
    expect(new Set(out).size).toBe(out.length)
    expect(out.length).toBeLessThanOrEqual(3)
  })
})

describe('pickShortlist in the other two modes is just the best three', () => {
  it('video and none take the first candidates unchanged', () => {
    expect(pickShortlist(plainFirst, 'video').map((a) => a.id)).toEqual(plainFirst.slice(0, 3).map((a) => a.id))
    expect(pickShortlist(plainFirst, 'none').map((a) => a.id)).toEqual(plainFirst.slice(0, 3).map((a) => a.id))
  })
})

describe('describeSources', () => {
  it('says nothing without information', () => {
    expect(describeSources(undefined)).toBeNull()
    expect(describeSources([])).toBeNull()
  })
  it('names the integration, the key, the cache, and combinations', () => {
    expect(describeSources(['integration'])).toBe("Videos came from DeepSpace's YouTube integration.")
    expect(describeSources(['google'])).toContain('your own Google key')
    expect(describeSources(['google'])).toContain('did not answer')
    expect(describeSources(['cache'])).toContain('no new YouTube call')
    expect(describeSources(['integration', 'google'])).toContain('checking which videos can be embedded')
    expect(describeSources(['integration', 'cache'])).toContain('and saved results from earlier')
  })
})
