import { describe, expect, it } from 'vitest'
import { PLACES_CACHE_MS, clearLocation, loadLocation, readPlacesCache, saveLocation, writePlacesCache } from './saved-location'

function fake() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
}

describe('saved location', () => {
  it('keeps only the rounded location, and can forget it', () => {
    const s = fake()
    saveLocation({ lat: 40.753612, lng: -73.983244 }, s)
    expect(JSON.parse(s.m.get('petirien.location')!)).toEqual({ lat: 40.75, lng: -73.98 })
    expect(loadLocation(s)).toEqual({ lat: 40.75, lng: -73.98 })
    clearLocation(s)
    expect(loadLocation(s)).toBeNull()
  })
  it('ignores junk and unreadable storage', () => {
    const s = fake()
    s.setItem('petirien.location', '{"lat":"x"}')
    expect(loadLocation(s)).toBeNull()
    s.setItem('petirien.location', 'not json')
    expect(loadLocation(s)).toBeNull()
    expect(loadLocation({ getItem: () => { throw new Error('blocked') } })).toBeNull()
    expect(() => saveLocation({ lat: 1, lng: 1 }, { setItem: () => { throw new Error('full') } })).not.toThrow()
  })
  it('does not save an invalid location', () => {
    const s = fake()
    saveLocation({ lat: 99, lng: 0 }, s)
    expect(s.m.size).toBe(0)
  })
})

describe('places cache', () => {
  const place = { id: 'a', name: 'Corner Park' } as never
  it('returns what was stored until it is old', () => {
    const s = fake()
    writePlacesCache('park|40.75|-73.98', [place], 1000, s)
    expect(readPlacesCache('park|40.75|-73.98', 1000 + PLACES_CACHE_MS, s)).toHaveLength(1)
    expect(readPlacesCache('park|40.75|-73.98', 1001 + PLACES_CACHE_MS, s)).toBeNull()
    expect(readPlacesCache('cafe|40.75|-73.98', 1000, s)).toBeNull()
  })
})
