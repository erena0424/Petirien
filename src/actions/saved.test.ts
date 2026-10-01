import { describe, expect, it } from 'vitest'
import type { VideoRef } from '../contract'
import type { SavedData } from '../lib/saved'
import { MAX_PER_CALL, refreshStale, type Details, type RefreshDeps, type SavedRow } from './saved'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 1)
const row = (id: string, daysOld: number, extra: Partial<SavedData> = {}): SavedRow => ({
  recordId: `rec_${id}`,
  data: {
    videoId: id,
    title: `Old ${id}`,
    channel: 'Old channel',
    thumbnail: 'old.jpg',
    durationSec: 100,
    userNote: `my note ${id}`,
    metaRefreshedAt: NOW - daysOld * DAY,
    availability: 'ok',
    ...extra,
  },
})
const video = (id: string): VideoRef => ({ videoId: id, title: `New ${id}`, channel: 'New channel', thumbnail: 'new.jpg', durationSec: 240, watchUrl: 'w' })

function make(rows: SavedRow[], details: (id: string) => Details) {
  const updates: { id: string; patch: Partial<SavedData> }[] = []
  const lookups: string[] = []
  const deps: RefreshDeps = {
    listSaved: async () => rows,
    fetchDetails: async (id) => {
      lookups.push(id)
      return details(id)
    },
    update: async (id, patch) => {
      updates.push({ id, patch })
    },
  }
  return { deps, updates, lookups }
}

describe('refreshStale', () => {
  it('refreshes only stale rows and updates metadata and the refresh time', async () => {
    const { deps, updates, lookups } = make([row('fresh0000001', 2), row('stale0000001', 26)], (id) => ({ ok: true, video: video(id) }))
    const out = await refreshStale(deps, NOW)
    expect(out).toEqual({ refreshed: 1, gone: 0, failed: 0 })
    expect(lookups).toEqual(['stale0000001'])
    expect(updates).toEqual([
      { id: 'rec_stale0000001', patch: { title: 'New stale0000001', channel: 'New channel', thumbnail: 'new.jpg', durationSec: 240, metaRefreshedAt: NOW } },
    ])
  })

  it('never touches the person\'s note', async () => {
    const { deps, updates } = make([row('stale0000001', 40)], (id) => ({ ok: true, video: video(id) }))
    await refreshStale(deps, NOW)
    expect(updates[0]!.patch).not.toHaveProperty('userNote')
  })

  it('leaves a row untouched when YouTube cannot be reached (never marks it gone)', async () => {
    const { deps, updates } = make([row('stale0000001', 40)], () => ({ ok: false }))
    const out = await refreshStale(deps, NOW)
    expect(out).toEqual({ refreshed: 0, gone: 0, failed: 1 })
    expect(updates).toEqual([])
  })

  it('marks a video gone and clears its YouTube metadata, keeping the note', async () => {
    const { deps, updates } = make([row('stale0000001', 40)], () => ({ ok: true, video: null }))
    const out = await refreshStale(deps, NOW)
    expect(out.gone).toBe(1)
    expect(updates[0]!.patch).toEqual({ availability: 'gone', title: '', channel: '', thumbnail: '', durationSec: 0, metaRefreshedAt: NOW })
    expect(updates[0]!.patch).not.toHaveProperty('userNote')
  })

  it('skips videos already gone', async () => {
    const { deps, lookups } = make([row('gone00000001', 90, { availability: 'gone' })], () => ({ ok: true, video: null }))
    await refreshStale(deps, NOW)
    expect(lookups).toEqual([])
  })

  it('caps work per call and does the oldest first', async () => {
    const rows = Array.from({ length: 8 }, (_, i) => row(`stale00000${i}x`.slice(0, 11).padEnd(11, '0'), 26 + i))
    const { deps, lookups } = make(rows, (id) => ({ ok: true, video: video(id) }))
    await refreshStale(deps, NOW)
    expect(lookups.length).toBe(MAX_PER_CALL)
    expect(lookups[0]).toBe(rows[7]!.data.videoId) // oldest (33 days)
  })

  it('does nothing when nothing is stale', async () => {
    const { deps, lookups, updates } = make([row('fresh0000001', 1)], () => ({ ok: false }))
    expect(await refreshStale(deps, NOW)).toEqual({ refreshed: 0, gone: 0, failed: 0 })
    expect(lookups).toEqual([])
    expect(updates).toEqual([])
  })
})

describe('refreshStale: embedding status', () => {
  it('marks a video that can no longer be embedded', async () => {
    const { deps, updates } = make([row('stale0000001', 40)], (id) => ({ ok: true, video: { ...video(id), embeddable: false } }))
    await refreshStale(deps, NOW)
    expect(updates[0]!.patch.availability).toBe('no_embed')
  })
  it('restores a video that can be embedded again, and otherwise leaves availability alone', async () => {
    const a = make([row('stale0000001', 40, { availability: 'no_embed' })], (id) => ({ ok: true, video: { ...video(id), embeddable: true } }))
    await refreshStale(a.deps, NOW)
    expect(a.updates[0]!.patch.availability).toBe('ok')
    const b = make([row('stale0000002', 40)], (id) => ({ ok: true, video: video(id) }))
    await refreshStale(b.deps, NOW)
    expect(b.updates[0]!.patch).not.toHaveProperty('availability')
  })
})
