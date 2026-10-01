import { describe, expect, it, vi } from 'vitest'
import { normalizeVideo } from '../recommend/video'
import { REAL_DETAILS, REAL_SEARCH_ITEM } from './youtube-fixtures'
import { integrationSource, withHelper, type VideoSource } from './youtube-source'

const ok = (videos: unknown) => ({ success: true as const, data: { videos } })
const fail = { success: false as const }

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
  it('calls the integration with a search and a comma-joined details request', async () => {
    const integration = vi.fn(async (endpoint: string) => ok([endpoint]))
    const src = integrationSource({ integration } as never)
    expect(await src.search('box breathing')).toEqual(['youtube/search-videos'])
    expect(await src.details(['aaaaaaaaaaa', 'bbbbbbbbbbb'])).toEqual(['youtube/get-video-details'])
    expect(integration).toHaveBeenNthCalledWith(1, 'youtube/search-videos', { q: 'box breathing', maxResults: 6, regionCode: 'US' })
    expect(integration).toHaveBeenNthCalledWith(2, 'youtube/get-video-details', { id: 'aaaaaaaaaaa,bbbbbbbbbbb' })
  })
  it('returns null on failure, and [] when it answered with nothing', async () => {
    expect(await integrationSource({ integration: async () => fail } as never).search('q')).toBeNull()
    expect(await integrationSource({ integration: async () => ({ success: true, data: {} }) } as never).search('q')).toBeNull()
    expect(await integrationSource({ integration: async () => ok([]) } as never).search('q')).toEqual([])
  })
})

describe('withHelper', () => {
  const main = (over: Partial<VideoSource> = {}): VideoSource => ({
    search: async () => [{ id: { videoId: 'aaaaaaaaaaa' }, snippet: { title: 'T' } }],
    details: async () => [{ id: 'aaaaaaaaaaa', snippet: { title: 'T' }, contentDetails: { duration: 'PT5M' } }],
    ...over,
  })
  const helper = (over: Partial<VideoSource> = {}): VideoSource => ({
    search: async () => [{ id: { videoId: 'hhhhhhhhhhh' }, snippet: { title: 'From helper' } }],
    details: async () => [{ id: 'aaaaaaaaaaa', status: { embeddable: false } }],
    ...over,
  })

  it('is just the main source when there is no helper', async () => {
    const m = main()
    expect(withHelper(m)).toBe(m)
  })

  it('uses the main source for search and never calls the helper when it works', async () => {
    const h = helper({ search: vi.fn(async () => []) })
    const res = await withHelper(main(), h).search('q')
    expect(res).toEqual([{ id: { videoId: 'aaaaaaaaaaa' }, snippet: { title: 'T' } }])
    expect(h.search).not.toHaveBeenCalled()
  })

  it('falls back to the helper only when the main source fails (null), not when it returns an empty list', async () => {
    expect(await withHelper(main({ search: async () => null }), helper()).search('q')).toEqual([{ id: { videoId: 'hhhhhhhhhhh' }, snippet: { title: 'From helper' } }])
    const h = helper({ search: vi.fn(async () => [{ id: { videoId: 'x' } }]) })
    expect(await withHelper(main({ search: async () => [] }), h).search('q')).toEqual([])
    expect(h.search).not.toHaveBeenCalled()
  })

  it('does not retry the main source after it fails', async () => {
    const search = vi.fn(async () => null)
    await withHelper(main({ search }), helper()).search('q')
    expect(search).toHaveBeenCalledTimes(1)
  })

  it('adds the helper\'s embeddable status to the main source\'s details without changing anything else', async () => {
    const res = (await withHelper(main(), helper()).details(['aaaaaaaaaaa']))!
    expect(res[0]).toEqual({ id: 'aaaaaaaaaaa', snippet: { title: 'T' }, contentDetails: { duration: 'PT5M' }, status: { embeddable: false } })
    expect(normalizeVideo(res[0])).toMatchObject({ durationSec: 300, embeddable: false })
  })

  it('keeps the main details when the helper fails or knows nothing, and never overwrites an existing status', async () => {
    const plain = [{ id: 'aaaaaaaaaaa', contentDetails: { duration: 'PT5M' } }]
    expect(await withHelper(main({ details: async () => plain }), helper({ details: async () => null })).details(['aaaaaaaaaaa'])).toEqual(plain)
    expect(await withHelper(main({ details: async () => plain }), helper({ details: async () => Promise.reject(new Error('x')) })).details(['aaaaaaaaaaa'])).toEqual(plain)
    const withStatus = [{ id: 'aaaaaaaaaaa', status: { embeddable: true } }]
    const out = (await withHelper(main({ details: async () => withStatus }), helper()).details(['aaaaaaaaaaa']))!
    expect(out[0]).toEqual(withStatus[0])
  })

  it('uses the helper\'s full details when the main source fails', async () => {
    const res = await withHelper(main({ details: async () => null }), helper()).details(['aaaaaaaaaaa'])
    expect(res).toEqual([{ id: 'aaaaaaaaaaa', status: { embeddable: false } }])
  })

  it('treats an empty main answer as "gone" and does not ask the helper to contradict it', async () => {
    const h = helper({ details: vi.fn(async () => [{ id: 'aaaaaaaaaaa', status: { embeddable: true } }]) })
    expect(await withHelper(main({ details: async () => [] }), h).details(['aaaaaaaaaaa'])).toEqual([])
    expect(h.details).not.toHaveBeenCalled()
  })
})
