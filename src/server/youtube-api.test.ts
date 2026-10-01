import { describe, expect, it, vi } from 'vitest'
import { normalizeVideo } from '../recommend/video'
import { searchVideos, videoDetails } from './youtube-api'

const KEY = 'test-key-not-real-123'
const ok = (items: unknown) => new Response(JSON.stringify({ items }), { status: 200 })

// Items shaped like Google's documented search.list and videos.list responses.
const searchItem = {
  id: { kind: 'youtube#video', videoId: 'abcdefghijk' },
  snippet: {
    title: 'Five Minute Box Breathing',
    channelTitle: 'Calm Channel',
    thumbnails: { default: { url: 'https://i.ytimg.com/vi/abcdefghijk/default.jpg' }, medium: { url: 'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg' } },
  },
}
const videoItem = {
  id: 'abcdefghijk',
  snippet: { title: 'Five Minute Box Breathing', channelTitle: 'Calm Channel', thumbnails: { medium: { url: 'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg' } } },
  contentDetails: { duration: 'PT5M12S' },
  status: { embeddable: true, privacyStatus: 'public' },
}

describe('searchVideos', () => {
  it('asks only for embeddable, safe, English videos and sends the key in a header, not the URL', async () => {
    const f = vi.fn(async () => ok([searchItem]))
    await searchVideos(KEY, 'box breathing', f as unknown as typeof fetch)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    const u = new URL(url)
    expect(u.pathname).toBe('/youtube/v3/search')
    expect(u.searchParams.get('videoEmbeddable')).toBe('true')
    expect(u.searchParams.get('type')).toBe('video')
    expect(u.searchParams.get('safeSearch')).toBe('strict')
    expect(u.searchParams.get('q')).toBe('box breathing')
    expect(url).not.toContain(KEY)
    expect(url).not.toMatch(/[?&]key=/)
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY)
  })

  it('returns the items, and [] for a successful empty answer', async () => {
    expect(await searchVideos(KEY, 'q', (async () => ok([searchItem])) as unknown as typeof fetch)).toHaveLength(1)
    expect(await searchVideos(KEY, 'q', (async () => ok([])) as unknown as typeof fetch)).toEqual([])
  })

  it('returns null (not []) on quota errors, server errors, and network failures, without throwing', async () => {
    const quota = (async () => new Response('{"error":{"errors":[{"reason":"quotaExceeded"}]}}', { status: 403 })) as unknown as typeof fetch
    const down = (async () => new Response('', { status: 503 })) as unknown as typeof fetch
    const boom = (async () => {
      throw new TypeError('network')
    }) as unknown as typeof fetch
    expect(await searchVideos(KEY, 'q', quota)).toBeNull()
    expect(await searchVideos(KEY, 'q', down)).toBeNull()
    expect(await searchVideos(KEY, 'q', boom)).toBeNull()
  })

  it('does not retry a failed call', async () => {
    const f = vi.fn(async () => new Response('', { status: 403 }))
    await searchVideos(KEY, 'q', f as unknown as typeof fetch)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('never logs the key', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await searchVideos(KEY, 'q', (async () => new Response('', { status: 403 })) as unknown as typeof fetch)
    await videoDetails(KEY, ['abcdefghijk'], (async () => {
      throw new Error(`failed with ${KEY}`)
    }) as unknown as typeof fetch)
    expect(spy.mock.calls.flat().join(' ')).not.toContain(KEY)
    spy.mockRestore()
  })
})

describe('videoDetails', () => {
  it('looks up several ids in one call and asks for status and contentDetails', async () => {
    const f = vi.fn(async () => ok([videoItem]))
    await videoDetails(KEY, ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'], f as unknown as typeof fetch)
    expect(f).toHaveBeenCalledTimes(1)
    const u = new URL((f.mock.calls[0] as unknown as [string])[0])
    expect(u.pathname).toBe('/youtube/v3/videos')
    expect(u.searchParams.get('id')).toBe('aaaaaaaaaaa,bbbbbbbbbbb,ccccccccccc')
    expect(u.searchParams.get('part')).toBe('snippet,contentDetails,status')
  })
  it('makes no call for no ids and caps at 50', async () => {
    const f = vi.fn(async () => ok([]))
    expect(await videoDetails(KEY, [], f as unknown as typeof fetch)).toEqual([])
    expect(f).not.toHaveBeenCalled()
    await videoDetails(KEY, Array.from({ length: 80 }, (_, i) => String(i).padStart(11, 'x')), f as unknown as typeof fetch)
    expect(new URL((f.mock.calls[0] as unknown as [string])[0]).searchParams.get('id')!.split(',')).toHaveLength(50)
  })
})

describe('real-shaped YouTube items go through normalizeVideo', () => {
  it('reads a search.list item (no length yet)', () => {
    expect(normalizeVideo(searchItem)).toMatchObject({
      videoId: 'abcdefghijk',
      title: 'Five Minute Box Breathing',
      channel: 'Calm Channel',
      durationSec: 0,
      thumbnail: 'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg',
    })
    expect(normalizeVideo(searchItem)).not.toHaveProperty('embeddable')
  })
  it('reads a videos.list item with length and embeddability', () => {
    expect(normalizeVideo(videoItem)).toMatchObject({ videoId: 'abcdefghijk', durationSec: 312, embeddable: true })
    expect(normalizeVideo({ ...videoItem, status: { embeddable: false } })).toMatchObject({ embeddable: false })
  })
})
