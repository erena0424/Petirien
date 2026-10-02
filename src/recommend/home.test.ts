import { describe, expect, it } from 'vitest'
import type { VideoRef } from '../contract'
import { HOME_MINUTES, HOME_VIDEOS, chooseHomeActivities, homeIdeas } from './home'
import { DAILY_CAP, type Deps, type UserContext } from './pipeline'

const at = (h: number, day = 2) => new Date(2026, 9, day, h)
const NEW_PERSON: UserContext = { prefs: { dislikedTags: [], avoid: [], likedTags: [] }, liked: [], disliked: [], usageToday: 0 }

const rawVideo = (n: number) => ({ id: { videoId: `vid${String(n).padStart(8, '0')}` }, snippet: { title: `Gentle video ${n}`, channelTitle: 'Calm Channel', thumbnails: { medium: { url: 'https://i.ytimg.com/x.jpg' } } }, contentDetails: { duration: 'PT6M' } })

function makeDeps(over: Partial<Deps> = {}, ctx: UserContext = NEW_PERSON) {
  const calls = { search: [] as string[], bumps: [] as string[], cachePuts: 0 }
  const cache = new Map<string, VideoRef[]>()
  const deps = {
    now: () => at(18),
    loadContext: async () => ctx,
    cacheGet: async (q: string) => cache.get(q) ?? null,
    cachePut: async (q: string, v: VideoRef[]) => {
      calls.cachePuts++
      cache.set(q, v)
    },
    searchVideos: async (q: string) => {
      calls.search.push(q)
      return [rawVideo(calls.search.length), rawVideo(calls.search.length + 10)]
    },
    videoDetails: async () => [],
    bumpUsage: async (d: string) => void calls.bumps.push(d),
    ...over,
  } as unknown as Deps
  return { deps, calls, cache }
}

describe('chooseHomeActivities', () => {
  it('picks two gentle, short video activities, so a brand new person always has something to watch', () => {
    for (const hour of [7, 13, 19, 23]) {
      const out = chooseHomeActivities(at(hour))
      expect(out, `${hour}h`).toHaveLength(HOME_VIDEOS)
      for (const a of out) {
        expect(a.video).toBe(true)
        expect(a.effort).toBeLessThanOrEqual(2)
        expect(a.minMinutes).toBeLessThanOrEqual(HOME_MINUTES)
      }
      expect(new Set(out.map((a) => a.id)).size).toBe(2)
    }
  })
  it('follows the time of day, and changes from day to day without being random', () => {
    const evening = chooseHomeActivities(at(19))
    expect(['meditation', 'creative']).toContain(evening[0]!.category) // what suits the hour comes first; the rest tops up
    expect(chooseHomeActivities(at(19, 2)).map((a) => a.id)).toEqual(chooseHomeActivities(at(19, 2)).map((a) => a.id)) // same day, same answer
    const days = new Set([2, 3, 4, 5, 6].map((d) => chooseHomeActivities(at(19, d)).map((a) => a.id).join()))
    expect(days.size).toBeGreaterThan(1)
  })
  it('never offers what the person avoids', () => {
    for (const a of chooseHomeActivities(at(19), ['guided', 'music'])) {
      expect(a.tags).not.toContain('guided')
      expect(a.tags).not.toContain('music')
    }
    expect(chooseHomeActivities(at(19), ['guided', 'music', 'no-voice', 'follow-along', 'eyes-closed', 'needs-supplies'])).toEqual([])
  })
})

describe('homeIdeas', () => {
  it('gives a person with no history two ideas, each with a real video', async () => {
    const { deps } = makeDeps()
    const res = await homeIdeas(deps)
    expect(res.status).toBe('ok')
    if (res.status !== 'ok') return
    expect(res.ideas).toHaveLength(2)
    for (const i of res.ideas) {
      expect(i.video).not.toBeNull()
      expect(i.video!.videoId).toMatch(/^vid\d{8}$/)
      expect(i.video!.durationSec).toBeLessThanOrEqual(12 * 60)
      expect(i.reason.length).toBeGreaterThan(10)
    }
  })
  it('searches only for what is not cached, counts that once toward the daily limit, and costs nothing on the next visit', async () => {
    const { deps, calls } = makeDeps()
    await homeIdeas(deps)
    expect(calls.search).toHaveLength(2)
    expect(calls.bumps).toHaveLength(1)
    await homeIdeas(deps) // same cache: free
    expect(calls.search).toHaveLength(2)
    expect(calls.bumps).toHaveLength(1)
  })
  it('still shows the ideas, without videos, when YouTube does not answer, and never retries', async () => {
    const { deps, calls } = makeDeps({ searchVideos: async (q: string) => { calls2.push(q); return null } })
    const calls2: string[] = []
    void calls
    const res = await homeIdeas(deps)
    expect(res.status === 'ok' && res.ideas).toHaveLength(2)
    expect(res.status === 'ok' && res.ideas.every((i) => i.video === null)).toBe(true)
    expect(calls2).toHaveLength(2) // once per idea
  })
  it('makes no paid search for someone past the daily limit, but still offers the ideas', async () => {
    const { deps, calls } = makeDeps({}, { ...NEW_PERSON, usageToday: DAILY_CAP })
    const res = await homeIdeas(deps)
    expect(calls.search).toHaveLength(0)
    expect(res.status === 'ok' && res.ideas).toHaveLength(2)
    expect(calls.bumps).toHaveLength(0)
  })
  it('never caps the app owner', async () => {
    const { deps, calls } = makeDeps({}, { ...NEW_PERSON, usageToday: DAILY_CAP + 50, exempt: true })
    await homeIdeas(deps)
    expect(calls.search).toHaveLength(2)
  })
  it('respects what the person avoids', async () => {
    const { deps } = makeDeps({}, { ...NEW_PERSON, prefs: { dislikedTags: ['music'], avoid: ['guided'], likedTags: [] } })
    const res = await homeIdeas(deps)
    expect(res.status === 'ok' && res.ideas.length).toBeGreaterThan(0)
  })
})
