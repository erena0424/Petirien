/**
 * Places for someone who has not signed in. Pure rules only (no network), so they can be tested.
 *
 * This is the one paid call that is not billed to the person: it is billed to the app owner, so it is boxed in.
 * The request is a fixed kind of place and a location rounded to about a kilometre (nothing free-form),
 * results are shared and kept for a few hours, and a daily limit for all anonymous visitors together stops the spend.
 */

import { PLACE_KINDS, isKind, roundOrigin, validOrigin, type Origin, type PlaceKindId } from '../places/places'

/** Fresh Maps searches per day for all signed-out visitors together (about $0.03 each). */
export const PUBLIC_DAILY_CAP = 60
/** Short, because each place's hours line (open or closed) is a snapshot from when it was looked up. */
export const PUBLIC_CACHE_TTL_MS = 3 * 60 * 60 * 1000
/** The usage row the anonymous searches are counted on. Not a real user id. */
export const PUBLIC_USAGE_ID = 'public-places'

export interface PublicPlacesRequest {
  kind: PlaceKindId
  origin: Origin
}

/** The request if it is well formed, with the location rounded again here (the client is not trusted). */
export function parsePublicRequest(body: unknown): PublicPlacesRequest | null {
  if (!body || typeof body !== 'object') return null
  const { kind, lat, lng } = body as Record<string, unknown>
  if (!isKind(kind)) return null
  const origin = { lat, lng }
  if (typeof lat !== 'number' || typeof lng !== 'number' || !validOrigin(origin)) return null
  return { kind, origin: roundOrigin(origin) }
}

export const publicCacheKey = (r: PublicPlacesRequest) => `public-places|${r.kind}|${r.origin.lat}|${r.origin.lng}`

export const publicQuery = (kind: PlaceKindId) => PLACE_KINDS.find((k) => k.id === kind)!.q

export const publicDay = (now: Date) => now.toISOString().slice(0, 10)

export const underCap = (count: number) => count < PUBLIC_DAILY_CAP

export const isFresh = (fetchedAt: unknown, now: number) => typeof fetchedAt === 'number' && now - fetchedAt <= PUBLIC_CACHE_TTL_MS
