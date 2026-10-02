import { useCallback, useRef, useState } from 'react'
import { integration } from 'deepspace'
import { PLACE_KINDS, isKind, llParam, parsePlaces, roundOrigin, validOrigin, type Origin, type Place, type PlaceKindId } from '../places/places'

export type PlacesState =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'searching' }
  /** The concrete suggestions: the places found for each kind asked for, nearest first. */
  | { kind: 'suggested'; byKind: Partial<Record<PlaceKindId, Place[]>>; origin: Origin }
  /** The person chose another kind of place from the list. */
  | { kind: 'results'; places: Place[]; origin: Origin; type: PlaceKindId }
  /** The person said no to sharing their location (or their browser did). */
  | { kind: 'denied' }
  | { kind: 'unavailable' }
  | { kind: 'error'; message: string }

// Results stay in memory for this tab only, keyed by the rounded location and kind, so asking again costs nothing.
const cache = new Map<string, Place[]>()

/** Asks the browser for the location once. The browser shows its own permission prompt. */
function position(): Promise<Origin> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return reject(Object.assign(new Error('unsupported'), { code: 0 }))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    )
  })
}

class SearchFailed extends Error {
  constructor(
    readonly credits: boolean,
    /** The shared daily allowance for signed-out visitors is used up. */
    readonly limit = false,
  ) {
    super('search_failed')
  }
}

/** The signed-out path: our own capped endpoint (the app pays, a fixed kind and a rounded location only). */
async function searchPublic(kindId: PlaceKindId, rounded: Origin): Promise<unknown> {
  let res: Response
  try {
    res = await fetch('/api/public/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: kindId, lat: rounded.lat, lng: rounded.lng }),
    })
  } catch {
    throw new SearchFailed(false)
  }
  const body = (await res.json().catch(() => null)) as { success?: boolean; data?: unknown } | null
  if (!res.ok || !body?.success) throw new SearchFailed(false, res.status === 429)
  return body.data
}

/** One search for one kind of place, from the cache when we already have it. Billed to the person, or for a signed-out visitor to the capped public endpoint. */
async function search(kindId: PlaceKindId, rounded: Origin, signedIn: boolean): Promise<Place[]> {
  const key = `${kindId}|${rounded.lat}|${rounded.lng}`
  const hit = cache.get(key)
  if (hit) return hit
  let data: unknown
  if (signedIn) {
    const q = PLACE_KINDS.find((k) => k.id === kindId)!.q
    const res = await integration.post<Record<string, unknown>>('serpapi/places-search', { q, type: 'search', ll: llParam(rounded), hl: 'en' })
    if (!res.success) throw new SearchFailed(res.code === 'insufficient_credits' || res.status === 402)
    data = res.data
  } else {
    data = await searchPublic(kindId, rounded)
  }
  const places = parsePlaces(data, rounded)
  cache.set(key, places)
  return places
}

const failure = (e: unknown): PlacesState => ({
  kind: 'error',
  message:
    e instanceof SearchFailed && e.credits
      ? "Your account is out of credits for this, so I can't look for places right now."
      : e instanceof SearchFailed && e.limit
        ? "I've looked up a lot of places today, so I'm resting my map. Sign in and I can still look for you."
        : "I couldn't look for places just now.",
})

/**
 * Finds places near the person: asks the browser for their location, rounds it to about a kilometre, and searches
 * Google Maps through DeepSpace. Billed to the person. Nothing is stored. `findSuggested` looks for the concrete
 * suggestions (a park to walk to, a café to spend time at); `find` looks for one other kind.
 */
export function usePlaces(signedIn = true) {
  const [state, setState] = useState<PlacesState>({ kind: 'idle' })
  // One request at a time: pressing twice, or a page that mounts twice, must not pay twice.
  const busy = useRef(false)
  const signedInRef = useRef(signedIn)
  signedInRef.current = signedIn

  /** Gets the rounded location, or sets the state that explains why not. */
  const locate = useCallback(async (): Promise<Origin | null> => {
    setState({ kind: 'locating' })
    let origin: Origin
    try {
      origin = await position()
    } catch (e) {
      setState({ kind: (e as { code?: number }).code === 1 ? 'denied' : 'unavailable' })
      return null
    }
    if (!validOrigin(origin)) {
      setState({ kind: 'unavailable' })
      return null
    }
    return roundOrigin(origin)
  }, [])

  const exclusive = useCallback(async (work: () => Promise<void>) => {
    if (busy.current) return
    busy.current = true
    try {
      await work()
    } finally {
      busy.current = false
    }
  }, [])

  const findSuggested = useCallback(
    (kinds: PlaceKindId[]) =>
      exclusive(async () => {
        const origin = await locate()
        if (!origin) return
        setState({ kind: 'searching' })
        try {
          const lists = await Promise.all(kinds.map((k) => search(k, origin, signedInRef.current)))
          setState({ kind: 'suggested', byKind: Object.fromEntries(kinds.map((k, i) => [k, lists[i]!])), origin })
        } catch (e) {
          setState(failure(e))
        }
      }),
    [exclusive, locate],
  )

  const find = useCallback(
    (kindId: PlaceKindId) =>
      exclusive(async () => {
        if (!isKind(kindId)) return
        const origin = await locate()
        if (!origin) return
        setState({ kind: 'searching' })
        try {
          setState({ kind: 'results', places: await search(kindId, origin, signedInRef.current), origin, type: kindId })
        } catch (e) {
          setState(failure(e))
        }
      }),
    [exclusive, locate],
  )

  return { state, find, findSuggested }
}
