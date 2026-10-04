import { describe, expect, it } from 'vitest'
import { safeThumbnail, FAVORITE_EVERY, ROTATE_AMONG, SNOOZE_DAYS, homeKind, suggestedKinds, applyPlaceFeedback, daysUntilBack, isHidden, pickPlace, suggestionLine, type Place, type Rating, type Ratings, MAX_PLACES, PLACE_KINDS, distanceKm, formatDistance, isKind, llParam, mapsUrl, parsePlaces, prefersMiles, roundCoord, roundOrigin, validOrigin } from './places'

const origin = { lat: 40.7536, lng: -73.9832 }
const item = (title: string, lat: number, lng: number, extra: Record<string, unknown> = {}) => ({
  title,
  place_id: `id-${title}`,
  gps_coordinates: { latitude: lat, longitude: lng },
  rating: 4.5,
  type: 'Park',
  address: '1 Main St',
  open_state: 'Open',
  ...extra,
})

describe('location privacy', () => {
  it('rounds to about a kilometre before anything is sent', () => {
    expect(roundCoord(40.753612)).toBe(40.75)
    expect(roundCoord(-73.98324)).toBe(-73.98)
    expect(roundOrigin({ lat: 40.7536, lng: -73.9832 })).toEqual({ lat: 40.75, lng: -73.98 })
    expect(llParam({ lat: 40.753612, lng: -73.98324 })).toBe('@40.75,-73.98,15z')
  })
  it('never lets the precise location into the request value', () => {
    expect(llParam({ lat: 51.50735, lng: -0.127758 })).not.toMatch(/51\.507|0\.1277/)
  })
  it('only accepts a real location', () => {
    expect(validOrigin(origin)).toBe(true)
    for (const bad of [null, undefined, {}, { lat: 'a', lng: 1 }, { lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: NaN, lng: 0 }]) expect(validOrigin(bad)).toBe(false)
  })
})

describe('fixed search kinds', () => {
  it('are a short fixed list, never free text', () => {
    expect(PLACE_KINDS.map((k) => k.id)).toEqual(['park', 'cafe', 'library', 'garden'])
    expect(isKind('park')).toBe(true)
    expect(isKind('anything you type')).toBe(false)
  })
})

describe('distanceKm', () => {
  it('is zero for the same place and about right for a known pair', () => {
    expect(distanceKm(origin, origin)).toBe(0)
    // Bryant Park to Central Park (south edge) is about 1.9 km.
    expect(distanceKm(origin, { lat: 40.7678, lng: -73.9718 })).toBeGreaterThan(1.5)
    expect(distanceKm(origin, { lat: 40.7678, lng: -73.9718 })).toBeLessThan(2.3)
  })
})

describe('parsePlaces', () => {
  it('sorts by distance (the service orders by relevance) and keeps the nearest few', () => {
    const data = {
      local_results: [item('Far', 40.79, -73.95), item('Near', 40.755, -73.98), item('Middle', 40.77, -73.97), item('Also near', 40.7545, -73.982), item('Farther', 40.78, -73.96)],
    }
    const out = parsePlaces(data, origin)
    expect(out).toHaveLength(MAX_PLACES)
    expect(out.map((p) => p.name)).toEqual(['Also near', 'Near', 'Middle'])
    expect(out[0]!.distanceKm).toBeLessThan(out[1]!.distanceKm)
  })
  it('skips places beyond walking range, without a name, or without a location', () => {
    const data = {
      local_results: [item('Too far', 41.5, -73.98), item('', 40.755, -73.98), { title: 'No location' }, item('Fine', 40.755, -73.98), null, 'text', 7],
    }
    expect(parsePlaces(data, origin).map((p) => p.name)).toEqual(['Fine'])
  })
  it('drops duplicates, and copes with empty and strange responses', () => {
    expect(parsePlaces({ local_results: [item('Same', 40.755, -73.98), item('Same', 40.755, -73.98)] }, origin)).toHaveLength(1)
    for (const d of [null, undefined, {}, { local_results: 'x' }, { local_results: [] }, 5, 'x']) expect(parsePlaces(d, origin)).toEqual([])
  })
  it('keeps only what it shows, cleaned, and builds its own Maps link', () => {
    const [p] = parsePlaces(
      { local_results: [item('  Bryant   Park ', 40.7536, -73.9832, { website: 'https://evil.example', link: 'https://evil.example/x', thumbnail: 'https://x', rating: 9, address: 'x'.repeat(500) })] },
      origin,
    )
    expect(p!.name).toBe('Bryant Park')
    expect(p!.rating).toBeNull() // out of range
    expect(p!.address.length).toBeLessThanOrEqual(120)
    expect(p!.mapsUrl).toBe('https://www.google.com/maps/search/?api=1&query=Bryant%20Park&query_place_id=id-%20Bryant%20Park')
    expect(JSON.stringify(p)).not.toContain('evil.example')
    expect(p!.mapsUrl.startsWith('https://www.google.com/maps/')).toBe(true)
  })
  it('builds a Maps link from the name alone when there is no id, and escapes the name', () => {
    expect(mapsUrl('Joe & Sons', '')).toBe('https://www.google.com/maps/search/?api=1&query=Joe%20%26%20Sons')
    expect(mapsUrl('A', 'ab/c')).toContain('query_place_id=ab%2Fc')
  })
})

describe('formatDistance', () => {
  it('is friendly in metres, kilometres and miles', () => {
    expect(formatDistance(0.05)).toBe('right nearby')
    expect(formatDistance(0.43)).toBe('about 400 m')
    expect(formatDistance(1.234)).toBe('1.2 km')
    expect(formatDistance(12.6)).toBe('13 km')
    expect(formatDistance(1.6, true)).toBe('1.0 mi')
    expect(formatDistance(0.05, true)).toBe('right nearby')
    expect(prefersMiles('en-US')).toBe(true)
    expect(prefersMiles('en-GB')).toBe(false)
    expect(prefersMiles('ja-JP')).toBe(false)
  })
})

describe('suggestionLine', () => {
  it('says what to do and where, concretely', () => {
    expect(suggestionLine('park', 'Bryant Park')).toBe('Take a walk to Bryant Park')
    expect(suggestionLine('cafe', 'Blue Door Cafe')).toBe('Spend quality time at Blue Door Cafe')
    for (const k of ['library', 'garden'] as const) expect(suggestionLine(k, 'X')).toContain('X')
  })
})

const NOW = Date.parse('2026-10-02T12:00:00Z')
const DAY = 86_400_000
const rate = (entries: [string, Rating, number?][]): Ratings => new Map(entries.map(([id, rating, at]) => [id, { rating, at: at ?? NOW }]))
const mkPlace = (id: string): Place => ({ id, name: id, type: 'Park', address: '', rating: 4, openState: '', hours: null, fetchedAt: 0, thumbnail: null, distanceKm: 1, mapsUrl: 'https://www.google.com/maps/search/?api=1&query=x' })

describe('"not right now" is not forever', () => {
  it('sits out for a while, then comes back; "never" stays hidden', () => {
    expect(isHidden({ rating: 'no', at: NOW }, NOW)).toBe(true)
    expect(isHidden({ rating: 'no', at: NOW - (SNOOZE_DAYS - 1) * DAY }, NOW)).toBe(true)
    expect(isHidden({ rating: 'no', at: NOW - SNOOZE_DAYS * DAY }, NOW)).toBe(false) // back in rotation
    expect(isHidden({ rating: 'never', at: NOW - 365 * DAY }, NOW)).toBe(true)
    expect(isHidden({ rating: 'yes', at: NOW }, NOW)).toBe(false)
    expect(isHidden(undefined, NOW)).toBe(false)
  })
  it('says how many days until a place may come back', () => {
    expect(daysUntilBack({ rating: 'no', at: NOW }, NOW)).toBe(SNOOZE_DAYS)
    expect(daysUntilBack({ rating: 'no', at: NOW - (SNOOZE_DAYS - 1) * DAY - 1000 }, NOW)).toBe(1)
    expect(daysUntilBack({ rating: 'no', at: NOW - SNOOZE_DAYS * DAY }, NOW)).toBe(0)
    expect(daysUntilBack({ rating: 'never', at: NOW }, NOW)).toBe(0)
    expect(daysUntilBack({ rating: 'yes', at: NOW }, NOW)).toBe(0)
  })
})

describe('applyPlaceFeedback', () => {
  const list = ['a', 'b', 'c', 'd'].map(mkPlace)
  it('leaves out a place marked not right now, or never, and keeps the rest in order', () => {
    expect(applyPlaceFeedback(list, rate([['b', 'no']]), NOW).map((p) => p.id)).toEqual(['a', 'c', 'd'])
    expect(applyPlaceFeedback(list, rate([['b', 'never'], ['c', 'no']]), NOW).map((p) => p.id)).toEqual(['a', 'd'])
    expect(applyPlaceFeedback(list, rate([['a', 'never'], ['b', 'never'], ['c', 'never'], ['d', 'never']]), NOW)).toEqual([])
  })
  it('brings a "not right now" place back after two weeks, but never a "never"', () => {
    const old = NOW - SNOOZE_DAYS * DAY - 1000
    expect(applyPlaceFeedback(list, rate([['b', 'no', old], ['c', 'never', old]]), NOW).map((p) => p.id)).toEqual(['a', 'b', 'd'])
  })
  it('does not push favorites to the front: the order stays nearest first', () => {
    expect(applyPlaceFeedback(list, rate([['c', 'yes']]), NOW).map((p) => p.id)).toEqual(['a', 'b', 'c', 'd'])
  })
  it('changes nothing when nothing was rated, ignores places not in this search, and copes with an empty list', () => {
    expect(applyPlaceFeedback(list, new Map(), NOW)).toEqual(list)
    expect(applyPlaceFeedback(list, rate([['zzz', 'never']]), NOW)).toEqual(list)
    expect(applyPlaceFeedback([], rate([['a', 'no']]), NOW)).toEqual([])
  })
})

describe('pickPlace: balance between favorites and somewhere new, and rotation', () => {
  const list = ['near', 'mid', 'far', 'fav1', 'fav2'].map(mkPlace)
  const favs = rate([['fav1', 'yes'], ['fav2', 'yes']])
  const picks = (ratings: Ratings, days = 30) => Array.from({ length: days }, (_, seed) => pickPlace(list, ratings, seed, NOW)!.id)

  it('with no ratings, rotates among the nearest few places instead of always the same one', () => {
    const out = picks(new Map(), 9)
    expect(new Set(out)).toEqual(new Set(['near', 'mid', 'far'])) // the three nearest take turns; the others are further down the list
    expect(out.slice(0, 3)).toEqual(['near', 'mid', 'far'])
  })
  it('with favorites and new places both available, a favorite is the suggestion one visit in three, and new places the rest, taking turns', () => {
    const out = picks(favs, 30)
    const favorites = out.filter((id) => id.startsWith('fav')).length
    expect(favorites).toBe(30 / FAVORITE_EVERY)
    const fresh = out.filter((id) => !id.startsWith('fav'))
    expect(new Set(fresh)).toEqual(new Set(['near', 'mid', 'far'])) // not stuck on one
    expect(favorites).toBeLessThan(out.length / 2) // never the main thing
    expect(ROTATE_AMONG).toBe(3)
  })
  it('does not repeat the same new place on consecutive new-place visits', () => {
    const fresh = picks(favs, 30).filter((id) => !id.startsWith('fav'))
    for (let i = 1; i < fresh.length; i++) expect(fresh[i]).not.toBe(fresh[i - 1])
  })
  it('rotates through several favorites and is steady for the same visit', () => {
    expect(new Set(picks(favs).filter((id) => id.startsWith('fav')))).toEqual(new Set(['fav1', 'fav2']))
    expect(picks(favs)).toEqual(picks(favs))
  })
  it('with only favorites left, offers those; with everything hidden, nothing', () => {
    const onlyFavs = rate([['near', 'never'], ['mid', 'no'], ['far', 'never'], ['fav1', 'yes'], ['fav2', 'yes']])
    expect(new Set(picks(onlyFavs))).toEqual(new Set(['fav1', 'fav2']))
    expect(pickPlace(list, rate(list.map((p) => [p.id, 'never'] as [string, Rating])), 4, NOW)).toBeUndefined()
    expect(pickPlace([], favs, 1, NOW)).toBeUndefined()
  })
  it('never offers a place marked not right now (until it is time) or never, even if it was a favorite once', () => {
    expect(picks(rate([['fav1', 'no'], ['fav2', 'yes']])).includes('fav1')).toBe(false)
    expect(picks(rate([['fav1', 'never'], ['fav2', 'yes']])).includes('fav1')).toBe(false)
    const old = NOW - SNOOZE_DAYS * DAY - 1000
    expect(pickPlace([mkPlace('only')], rate([['only', 'no', old]]), 1, NOW)?.id).toBe('only') // its time is up: it is welcome again
  })
})

describe('which kinds of place, day by day', () => {
  it('check-in: one outside and one inside each day, and they change', () => {
    const days = Array.from({ length: 8 }, (_, d) => suggestedKinds(d))
    for (const [outdoor, indoor] of days) {
      expect(['park', 'garden']).toContain(outdoor)
      expect(['cafe', 'library']).toContain(indoor)
    }
    expect(new Set(days.map((d) => d[0]))).toEqual(new Set(['park', 'garden']))
    expect(new Set(days.map((d) => d[1]))).toEqual(new Set(['cafe', 'library']))
    expect(suggestedKinds(5)).toEqual(suggestedKinds(5))
  })
  it('Home: cycles through every kind of place', () => {
    expect(new Set(Array.from({ length: 8 }, (_, d) => homeKind(d)))).toEqual(new Set(['park', 'cafe', 'library', 'garden']))
    expect(homeKind(3)).toBe(homeKind(7))
  })
})

describe('place photos', () => {
  it('only shows photos hosted by Google or SerpApi over https', () => {
    expect(safeThumbnail('https://lh3.googleusercontent.com/grass-cs/abc=w1000')).toBe('https://lh3.googleusercontent.com/grass-cs/abc=w1000')
    expect(safeThumbnail('https://serpapi.com/searches/x/images/y.jpeg')).toContain('serpapi.com')
    expect(safeThumbnail('https://encrypted-tbn0.gstatic.com/images?q=1')).toContain('gstatic.com')
    for (const bad of ['http://lh3.googleusercontent.com/a', 'https://evil.example/a.png', 'https://googleusercontent.com.evil.example/a', 'javascript:alert(1)', 'data:image/png;base64,AAAA', '', null, undefined, 42, 'https://' + 'a'.repeat(2000) + '.googleusercontent.com/x']) {
      expect(safeThumbnail(bad), String(bad)).toBeNull()
    }
  })
  it('a place carries its photo, preferring the original and falling back to the SerpApi copy', () => {
    const origin = { lat: 40.7536, lng: -73.9832 }
    const base = { title: 'P', place_id: 'p', gps_coordinates: { latitude: 40.7545, longitude: -73.982 } }
    expect(parsePlaces({ local_results: [{ ...base, thumbnail: 'https://lh3.googleusercontent.com/a', serpapi_thumbnail: 'https://serpapi.com/b' }] }, origin)[0]!.thumbnail).toBe('https://lh3.googleusercontent.com/a')
    expect(parsePlaces({ local_results: [{ ...base, thumbnail: 'https://evil.example/a', serpapi_thumbnail: 'https://serpapi.com/b' }] }, origin)[0]!.thumbnail).toBe('https://serpapi.com/b')
    expect(parsePlaces({ local_results: [{ ...base }] }, origin)[0]!.thumbnail).toBeNull()
  })
})
