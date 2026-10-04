import { describe, expect, it, vi } from 'vitest'
import { normalizeVideo } from '../recommend/video'
import { REAL_DETAILS, REAL_SEARCH_ITEM } from './youtube-fixtures'
import { integrationSource } from './youtube-source'

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

describe('integrationSource', () => {
  const ok = (videos: unknown) => ({ success: true as const, data: { videos } })
  const fail = { success: false as const }
  it('calls the integration with a search and a comma-joined details request', async () => {
    const integration = vi.fn(async (endpoint: string) => ok([{ endpoint }]))
    const s = integrationSource({ integration } as never)
    await s.search('easy origami tutorial')
    await s.details(['a', 'b'])
    expect(integration).toHaveBeenNthCalledWith(1, 'youtube/search-videos', { q: 'easy origami tutorial', maxResults: 6, regionCode: 'US' })
    expect(integration).toHaveBeenNthCalledWith(2, 'youtube/get-video-details', { id: 'a,b' })
  })
  it('returns null on failure, and [] when it answered with nothing', async () => {
    expect(await integrationSource({ integration: async () => fail } as never).search('q')).toBeNull()
    expect(await integrationSource({ integration: async () => ok([]) } as never).search('q')).toEqual([])
  })
  it('reports itself only on a successful answer, and never calls anything else', async () => {
    const used: string[] = []
    const calls: string[] = []
    const good = integrationSource({ integration: async (e: string) => (calls.push(e), ok([{}])) } as never, (u) => used.push(u))
    await good.search('q')
    const bad = integrationSource({ integration: async (e: string) => (calls.push(e), fail) } as never, (u) => used.push(u))
    await bad.search('q')
    expect(used).toEqual(['integration'])
    expect(calls.every((c) => c.startsWith('youtube/'))).toBe(true)
  })
})
