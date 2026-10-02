import { describe, expect, it } from 'vitest'
import { PUBLIC_CACHE_TTL_MS, PUBLIC_DAILY_CAP, isFresh, parsePublicRequest, publicCacheKey, publicDay, publicQuery, underCap } from './public-places'

describe('parsePublicRequest', () => {
  it('accepts a fixed kind and rounds the location again, whatever the client sent', () => {
    expect(parsePublicRequest({ kind: 'park', lat: 40.753612, lng: -73.983244 })).toEqual({ kind: 'park', origin: { lat: 40.75, lng: -73.98 } })
  })
  it('rejects anything free-form or malformed', () => {
    for (const bad of [null, 'x', {}, { kind: 'bar', lat: 1, lng: 1 }, { kind: 'park', lat: '1', lng: 1 }, { kind: 'park', lat: 91, lng: 0 }, { kind: 'park', lat: 0, lng: 181 }, { kind: 'park', lat: NaN, lng: 0 }, { kind: 'park', lat: 1 }]) {
      expect(parsePublicRequest(bad)).toBeNull()
    }
  })
  it('maps a kind to our own search phrase, never the visitor’s', () => {
    expect(publicQuery('cafe')).toBe('cafe')
  })
})

describe('shared cache and cap', () => {
  it('nearby visitors share one cache key per kind', () => {
    const a = parsePublicRequest({ kind: 'park', lat: 40.7531, lng: -73.9832 })!
    const b = parsePublicRequest({ kind: 'park', lat: 40.7549, lng: -73.9849 })!
    expect(publicCacheKey(a)).toBe(publicCacheKey(b))
    expect(publicCacheKey(a)).not.toBe(publicCacheKey({ ...a, kind: 'cafe' }))
  })
  it('keeps results for a day', () => {
    expect(isFresh(1000, 1000 + PUBLIC_CACHE_TTL_MS)).toBe(true)
    expect(isFresh(1000, 1001 + PUBLIC_CACHE_TTL_MS)).toBe(false)
    expect(isFresh(undefined, 5)).toBe(false)
  })
  it('stops at the daily cap', () => {
    expect(underCap(PUBLIC_DAILY_CAP - 1)).toBe(true)
    expect(underCap(PUBLIC_DAILY_CAP)).toBe(false)
  })
  it('counts days in UTC', () => {
    expect(publicDay(new Date('2026-10-02T23:59:00Z'))).toBe('2026-10-02')
  })
})
