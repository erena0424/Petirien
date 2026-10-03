/**
 * The person's location, remembered on this device only so "A change of scenery" can show places every time.
 * It is the rounded one (about a kilometre), never the precise fix, and it never goes to our servers: it lives in this
 * browser's storage until they update or forget it. The places found from it are kept for the browser tab only, briefly.
 */

import { roundOrigin, validOrigin, type Origin, type Place } from './places'

const KEY = 'petirien.location'
const CACHE_KEY = 'petirien.placesCache'
/** Searches for the same place and kind are reused this long, within the tab. */
export const PLACES_CACHE_MS = 6 * 60 * 60 * 1000

export function loadLocation(storage: Pick<Storage, 'getItem'> | undefined = safe(() => localStorage)): Origin | null {
  try {
    const raw = storage?.getItem(KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as unknown
    return validOrigin(o) ? roundOrigin(o) : null
  } catch {
    return null
  }
}

export function saveLocation(origin: Origin, storage: Pick<Storage, 'setItem'> | undefined = safe(() => localStorage)): void {
  try {
    if (validOrigin(origin)) storage?.setItem(KEY, JSON.stringify(roundOrigin(origin)))
  } catch {
    /* storage unavailable: the person is simply asked again next time */
  }
}

export function clearLocation(storage: Pick<Storage, 'removeItem'> | undefined = safe(() => localStorage)): void {
  try {
    storage?.removeItem(KEY)
    safe(() => sessionStorage)?.removeItem(CACHE_KEY)
  } catch {
    /* nothing to clear */
  }
}

type CacheShape = Record<string, { at: number; places: Place[] }>

export function readPlacesCache(key: string, now = Date.now(), storage: Pick<Storage, 'getItem'> | undefined = safe(() => sessionStorage)): Place[] | null {
  try {
    const all = JSON.parse(storage?.getItem(CACHE_KEY) ?? '{}') as CacheShape
    const hit = all[key]
    return hit && Array.isArray(hit.places) && now - hit.at <= PLACES_CACHE_MS ? hit.places : null
  } catch {
    return null
  }
}

export function writePlacesCache(key: string, places: Place[], now = Date.now(), storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = safe(() => sessionStorage)): void {
  try {
    const all = JSON.parse(storage?.getItem(CACHE_KEY) ?? '{}') as CacheShape
    all[key] = { at: now, places }
    storage?.setItem(CACHE_KEY, JSON.stringify(all))
  } catch {
    /* the in-memory cache still works */
  }
}

function safe<T>(get: () => T): T | undefined {
  try {
    return get()
  } catch {
    return undefined
  }
}
