import { describe, expect, it } from 'vitest'
import { NIGHT_FALLBACK, PLACE_KINDS, SNAPSHOT_FRESH_MS, applyPlaceFeedback, closedCount, homeKind, isLateNight, kindsFor, openLine, openStatus, parsePlaces, pickPlace, placeStatus, suggestedKinds } from './places'
import { EMPTY_FORM, optionsSummary, toInput } from '../components/checkin/CheckinForm'

const origin = { lat: 40.7536, lng: -73.9832 }
const raw = (title: string, open_state: string, lat = 40.754) => ({ title, place_id: `id-${title}`, gps_coordinates: { latitude: lat, longitude: -73.983 }, rating: 4.5, type: 'Cafe', address: '1 Main St', open_state })

describe('openStatus', () => {
  it('reads the hours line Google Maps gives', () => {
    expect(openStatus('Open ⋅ Closes 9 PM')).toBe('open')
    expect(openStatus('Open 24 hours')).toBe('open')
    expect(openStatus('Closes soon ⋅ 5 PM')).toBe('closing-soon')
    expect(openStatus('Closed ⋅ Opens 8 AM Mon')).toBe('closed')
    expect(openStatus('Opens soon ⋅ 9 AM')).toBe('closed')
    expect(openStatus('Temporarily closed')).toBe('closed')
    expect(openStatus('Permanently closed')).toBe('closed')
  })
  it('does not guess when there is no line (many parks have none)', () => {
    expect(openStatus('')).toBe('unknown')
    expect(openStatus('   ')).toBe('unknown')
    expect(openStatus('Something unexpected')).toBe('unknown')
  })
})

describe('closed places are never offered', () => {
  const places = parsePlaces({ local_results: [raw('Shut Cafe', 'Closed ⋅ Opens 8 AM', 40.7537), raw('Open Cafe', 'Open ⋅ Closes 9 PM', 40.7545), raw('No Hours Park', '', 40.756)] }, origin)
  it('drops closed places from the list and keeps open and unknown ones', () => {
    const shown = applyPlaceFeedback(places, new Map())
    expect(shown.map((p) => p.name)).toEqual(['Open Cafe', 'No Hours Park'])
    expect(closedCount(places)).toBe(1)
  })
  it('never picks a closed place, whatever the day', () => {
    for (let seed = 0; seed < 12; seed++) expect(pickPlace(places, new Map(), seed)?.name).not.toBe('Shut Cafe')
  })
  it('offers nothing when everything is closed', () => {
    const allClosed = parsePlaces({ local_results: [raw('A', 'Closed ⋅ Opens 8 AM'), raw('B', 'Temporarily closed')] }, origin)
    expect(pickPlace(allClosed, new Map(), 0)).toBeUndefined()
    expect(applyPlaceFeedback(allClosed, new Map())).toEqual([])
  })
})

describe('no outdoors at night', () => {
  const at = (h: number, m = 0) => new Date(2026, 0, 4, h, m)
  it('counts 9 PM to 6 AM as late night, by the person\'s own clock', () => {
    expect(isLateNight(at(20, 59))).toBe(false)
    expect(isLateNight(at(21))).toBe(true)
    expect(isLateNight(at(0, 30))).toBe(true)
    expect(isLateNight(at(5, 59))).toBe(true)
    expect(isLateNight(at(6))).toBe(false)
    expect(isLateNight(at(12))).toBe(false)
  })
  it('suggests only indoor kinds at night, for every day of the year', () => {
    for (let day = 0; day < 366; day++) {
      for (const k of [...suggestedKinds(day, true), homeKind(day, true)]) expect(['cafe', 'library'], `day ${day}`).toContain(k)
    }
    expect(suggestedKinds(10, true)[0]).not.toBe(suggestedKinds(10, true)[1]) // two different places, not the same twice
  })
  it('does not change the daytime mix', () => {
    expect(suggestedKinds(4)).toEqual(suggestedKinds(4, false))
    expect(homeKind(4)).toBe(homeKind(4, false))
    expect(kindsFor(false)).toHaveLength(PLACE_KINDS.length)
  })
  it('offers no park or garden under "Other places to visit" at night', () => {
    expect(kindsFor(true).map((k) => k.id)).toEqual(['cafe', 'library'])
  })
  it('says something quiet and indoors instead of "take a walk"', () => {
    expect(NIGHT_FALLBACK).toMatch(/indoors/)
    expect(NIGHT_FALLBACK).not.toMatch(/walk|outside/i)
  })
})

describe('check-in at night', () => {
  const v = { ...EMPTY_FORM, mood: 2, energy: 3 }
  it('sends "inside" when inside or outside was left on Not sure', () => {
    expect(toInput(v, true)).toMatchObject({ place: 'in' })
    expect(optionsSummary(v, true)).toContain('staying in')
  })
  it('keeps a choice the person made, and sends nothing extra by day', () => {
    expect(toInput({ ...v, place: 'out' }, true)).toMatchObject({ place: 'out' })
    expect(toInput(v, false)).not.toHaveProperty('place')
    expect(toInput(v)).not.toHaveProperty('place')
  })
})

describe('open or closed is worked out from the weekly hours, at the time it is shown', () => {
  const N = '\u202f'
  const everyDay = (h: string) => Object.fromEntries(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map((d) => [d, h]))
  // The one-line snapshot says "Open", as it did when the search ran at noon; the hours say it closes at 3 PM.
  const found = parsePlaces({ local_results: [{ ...raw('Lunch Cafe', 'Open · Closes 3\u202fPM'), operating_hours: everyDay(`8${N}AM–3${N}PM`) }] }, origin, 3, new Date(2026, 0, 4, 12, 0).getTime())[0]!
  it('keeps the weekly hours with the place', () => {
    expect(found.hours).not.toBeNull()
    expect(found.hours![0]).toEqual([[480, 900]])
  })
  it('is open at noon, and the same place found earlier is closed in the evening (the hours win over the old snapshot)', () => {
    expect(placeStatus(found, new Date(2026, 0, 4, 12, 0))).toBe('open')
    expect(placeStatus(found, new Date(2026, 0, 4, 19, 0))).toBe('closed')
    expect(applyPlaceFeedback([found], new Map(), new Date(2026, 0, 4, 19, 0).getTime())).toEqual([])
    expect(applyPlaceFeedback([found], new Map(), new Date(2026, 0, 4, 12, 0).getTime())).toHaveLength(1)
  })
  it('says when it closes', () => {
    expect(openLine(found, new Date(2026, 0, 4, 12, 0))).toBe('Open until 3 PM')
    expect(openLine(found, new Date(2026, 0, 4, 14, 30))).toBe('Closes soon · 3 PM')
    expect(openLine(found, new Date(2026, 0, 4, 19, 0))).toBe('')
  })
  it('without weekly hours, trusts the one-line snapshot only while it is fresh', () => {
    const plain = parsePlaces({ local_results: [raw('Snap Cafe', 'Closed ⋅ Opens 8 AM')] }, origin, 3, 1_000_000)[0]!
    expect(plain.hours).toBeNull()
    expect(placeStatus(plain, new Date(1_000_000 + 60_000))).toBe('closed')
    expect(placeStatus(plain, new Date(1_000_000 + SNAPSHOT_FRESH_MS + 1))).toBe('unknown') // too old to say
    expect(openLine(plain, new Date(1_000_000 + SNAPSHOT_FRESH_MS + 1))).toBe('')
  })
  it('does not break on places stored by an older version of the app (no hours, no time)', () => {
    const old = { ...found, hours: undefined, fetchedAt: undefined } as never
    expect(placeStatus(old, new Date(2026, 0, 4, 12, 0))).toBe('unknown')
  })
})
