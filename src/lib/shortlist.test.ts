import { describe, expect, it } from 'vitest'
import { CATALOG, type Activity } from '../catalog'
import { describeSources } from './sources'
import { pickShortlist } from '../recommend/pipeline'

const byId = (id: string) => CATALOG.find((a) => a.id === id)!
const plainFirst: Activity[] = ['grounding-54321', 'box-breathing', 'silent-sit', 'mindful-pause', 'desk-stretch', 'chair-yoga'].map(byId)
const videoFirst: Activity[] = ['desk-stretch', 'chair-yoga', 'body-scan', 'grounding-54321', 'journaling-prompts'].map(byId)

describe('pickShortlist in "Not sure" mode (the default): two videos and one idea without a video', () => {
  it('takes the first two videos and the first plain idea, even if the best-ranked three are all plain', () => {
    for (const screen of [undefined, 'auto' as const]) {
      const out = pickShortlist(plainFirst, screen)
      expect(out.map((a) => a.id), `${screen}`).toEqual(['grounding-54321', 'desk-stretch', 'chair-yoga'])
      expect(out.filter((a) => a.video)).toHaveLength(2)
      expect(out.filter((a) => !a.video)).toHaveLength(1)
    }
  })
  it('leans on videos when the best three are all videos: still two videos and one idea', () => {
    const out = pickShortlist(videoFirst.slice(0, 3).concat(byId('grounding-54321')), 'auto')
    expect(out.filter((a) => a.video)).toHaveLength(2)
    expect(out.filter((a) => !a.video)).toHaveLength(1)
    expect(out.slice(0, 2).every((a) => a.video)).toBe(true)
  })
  it('keeps the model\'s order among what it picks', () => {
    const out = pickShortlist(plainFirst, 'auto')
    expect(out.map((a) => a.id)).toEqual(['grounding-54321', 'desk-stretch', 'chair-yoga'])
    const reordered = pickShortlist([byId('chair-yoga'), byId('grounding-54321'), byId('desk-stretch'), byId('box-breathing')], 'auto')
    expect(reordered.map((a) => a.id)).toEqual(['chair-yoga', 'grounding-54321', 'desk-stretch'])
  })
  it('fills with what exists when the mix is not there, preferring videos', () => {
    const onlyPlain = plainFirst.filter((a) => !a.video)
    expect(pickShortlist(onlyPlain, 'auto').every((a) => !a.video)).toBe(true)
    expect(pickShortlist(onlyPlain, 'auto')).toHaveLength(3)
    const onlyVideo = videoFirst.filter((a) => a.video)
    expect(pickShortlist(onlyVideo, 'auto').every((a) => a.video)).toBe(true)
    expect(pickShortlist([], 'auto')).toEqual([])
    // one video and several plain ideas: the video, the first plain idea, then another plain one
    const out = pickShortlist([byId('grounding-54321'), byId('box-breathing'), byId('desk-stretch'), byId('silent-sit')], 'auto')
    expect(out.filter((a) => a.video)).toHaveLength(1)
    expect(out).toHaveLength(3)
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
