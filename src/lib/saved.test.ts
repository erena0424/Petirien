import { describe, expect, it } from 'vitest'
import {
  CATEGORY_ORDER,
  MAX_METADATA_DAYS,
  REFRESH_AFTER_DAYS,
  categoryOf,
  displayMeta,
  metaExpired,
  needsRefresh,
  toSavedData,
  type SavedData,
} from './saved'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 1)
const base: SavedData = {
  videoId: 'abcdefghijk',
  title: 'Box breathing',
  channel: 'Calm',
  thumbnail: 'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg',
  durationSec: 300,
  activityId: 'box-breathing',
  metaRefreshedAt: NOW,
  availability: 'ok',
}
const aged = (days: number): SavedData => ({ ...base, metaRefreshedAt: NOW - days * DAY })

describe('refresh and expiry windows', () => {
  it('uses 25 days to refresh and 30 days as the hard limit', () => {
    expect(REFRESH_AFTER_DAYS).toBe(25)
    expect(MAX_METADATA_DAYS).toBe(30)
  })
  it('does not refresh fresh rows and refreshes from day 25', () => {
    expect(needsRefresh(aged(0), NOW)).toBe(false)
    expect(needsRefresh(aged(24.9), NOW)).toBe(false)
    expect(needsRefresh(aged(25), NOW)).toBe(true)
  })
  it('treats missing refresh time as stale and expired (conservative)', () => {
    const d = { ...base, metaRefreshedAt: undefined }
    expect(needsRefresh(d, NOW)).toBe(true)
    expect(metaExpired(d, NOW)).toBe(true)
  })
  it('expires metadata only after day 30', () => {
    expect(metaExpired(aged(30), NOW)).toBe(false)
    expect(metaExpired(aged(30.1), NOW)).toBe(true)
  })
  it('never tries to refresh a gone video', () => {
    expect(needsRefresh({ ...aged(60), availability: 'gone' }, NOW)).toBe(false)
  })
})

describe('displayMeta', () => {
  it('shows stored details while they are fresh', () => {
    expect(displayMeta(aged(3), NOW)).toMatchObject({ title: 'Box breathing', channel: 'Calm', durationSec: 300, withheld: false })
    expect(displayMeta(aged(3), NOW).thumbnail).toContain('ytimg')
  })
  it('withholds stored YouTube details past 30 days and flags it', () => {
    const m = displayMeta(aged(45), NOW)
    expect(m).toEqual({ title: 'Saved video', channel: '', thumbnail: null, durationSec: 0, withheld: true })
  })
  it('describes a removed video without any stored details', () => {
    expect(displayMeta({ ...base, availability: 'gone' }, NOW).title).toBe('No longer available')
  })
  it('falls back gracefully when there is no title', () => {
    expect(displayMeta({ ...base, title: undefined }, NOW).title).toBe('Saved video')
  })
})

describe('toSavedData / categories', () => {
  it('builds a row stamped with the save time and ok availability', () => {
    const v = { videoId: 'abcdefghijk', title: 'T', channel: 'C', thumbnail: 't', durationSec: 120, watchUrl: 'w' }
    expect(toSavedData(v, 'desk-stretch', NOW)).toEqual({
      videoId: 'abcdefghijk', title: 'T', channel: 'C', thumbnail: 't', durationSec: 120,
      activityId: 'desk-stretch', metaRefreshedAt: NOW, availability: 'ok',
    })
  })
  it('maps activities to categories and lists every category in the catalog', () => {
    expect(categoryOf('box-breathing')).toBe('meditation')
    expect(categoryOf('chair-yoga')).toBe('movement')
    expect(categoryOf('doodle-along')).toBe('creative')
    expect(categoryOf('nope')).toBeUndefined()
    expect(categoryOf(undefined)).toBeUndefined()
    expect(CATEGORY_ORDER).toEqual(['meditation', 'movement', 'creative'])
  })
})
