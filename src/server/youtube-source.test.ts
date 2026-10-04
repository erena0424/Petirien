import { describe, expect, it, vi } from 'vitest'
import { normalizeVideo } from '../recommend/video'
import { REAL_DETAILS, REAL_SEARCH_ITEM } from './youtube-fixtures'
import { ownKeySource } from './youtube-source'

describe('the real DeepSpace responses normalize correctly', () => {
  it('a search item has an id object and no length', () => {
    const v = normalizeVideo(REAL_SEARCH_ITEM)!
    expect(v.videoId).toBe(REAL_SEARCH_ITEM.id.videoId)
    expect(v.title).toBe(REAL_SEARCH_ITEM.snippet.title)
    expect(v.durationSec).toBe(0)
    expect(v.watchUrl).toBe(REAL_SEARCH_ITEM.links.watch)
    expect(v).not.toHaveProperty('embeddable')
  })
  it('detail items carry a length, for several ids at once', () => {
    const vs = REAL_DETAILS.map((d) => normalizeVideo(d)!)
    expect(vs).toHaveLength(2)
    for (const v of vs) expect(v.durationSec).toBeGreaterThan(60)
    expect(vs[0]!.durationSec).toBe(730) // PT12M10S
  })
})

describe('the app\'s own Google key is the only video source', () => {
  const api = {
    search: vi.fn(async (_key: string, _q: string) => [{ id: { videoId: 'abc' } }] as unknown[] | null),
    details: vi.fn(async (_key: string, _ids: string[]) => [{ id: 'abc' }] as unknown[] | null),
  }
  it('uses the key for search and details, and reports itself', async () => {
    const used: string[] = []
    const s = ownKeySource('KEY', api, (u) => used.push(u))
    expect(await s.search('q')).toHaveLength(1)
    expect(await s.details(['abc'])).toHaveLength(1)
    expect(api.search).toHaveBeenCalledWith('KEY', 'q')
    expect(used).toEqual(['google', 'google'])
  })
  it('with no key, asks nobody and answers null (like any failure), so the app falls back to ideas', async () => {
    api.search.mockClear()
    const s = ownKeySource(undefined, api)
    expect(await s.search('q')).toBeNull()
    expect(await s.details(['abc'])).toBeNull()
    expect(api.search).not.toHaveBeenCalled()
  })
  it('passes a failure through as null, and an empty answer as empty', async () => {
    const failing = ownKeySource('KEY', { search: async () => null, details: async () => [] })
    expect(await failing.search('q')).toBeNull()
    expect(await failing.details(['x'])).toEqual([])
  })
})
