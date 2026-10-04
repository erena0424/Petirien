/**
 * Nearby places for the "walk to a place" idea. Pure: turns a location and a Google Maps (SerpApi) response into a
 * short, sorted list. The person's location is rounded before it leaves the browser (about 1 km), and nothing
 * here stores it. Search words come from a fixed list, never from the person or a model.
 */

export const PLACE_KINDS = [
  { id: 'park', label: 'Park', q: 'park' },
  { id: 'cafe', label: 'Café', q: 'cafe' },
  { id: 'library', label: 'Library', q: 'library' },
  { id: 'garden', label: 'Garden', q: 'garden' },
] as const
export type PlaceKindId = (typeof PLACE_KINDS)[number]['id']

export const isKind = (v: unknown): v is PlaceKindId => PLACE_KINDS.some((k) => k.id === v)

export interface Origin {
  lat: number
  lng: number
}

export interface Place {
  id: string
  name: string
  type: string
  address: string
  rating: number | null
  openState: string
  /** A small photo of the place from Google, or null. Only ever a link on a known Google or SerpApi image host. */
  thumbnail: string | null
  /** Straight-line kilometres from the rounded origin. */
  distanceKm: number
  mapsUrl: string
}

export const MAX_PLACES = 3
/** Further than this is not a walk. */
export const MAX_WALK_KM = 5

/** About 1 km precision: enough to find places nearby, not enough to find a door. */
export function roundCoord(n: number): number {
  return Math.round(n * 100) / 100
}

export function roundOrigin(o: Origin): Origin {
  return { lat: roundCoord(o.lat), lng: roundCoord(o.lng) }
}

/** The `ll` value the Maps search wants: "@lat,lng,zoom". */
export function llParam(o: Origin): string {
  const r = roundOrigin(o)
  return `@${r.lat},${r.lng},15z`
}

export const validOrigin = (o: unknown): o is Origin =>
  !!o && typeof o === 'object' && Number.isFinite((o as Origin).lat) && Number.isFinite((o as Origin).lng) && Math.abs((o as Origin).lat) <= 90 && Math.abs((o as Origin).lng) <= 180

/** Great-circle distance in kilometres. */
export function distanceKm(a: Origin, b: Origin): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

const IMAGE_HOSTS = [/(^|\.)googleusercontent\.com$/, /(^|\.)ggpht\.com$/, /(^|\.)gstatic\.com$/, /(^|\.)serpapi\.com$/]

/** A place photo link we are willing to show: https, on a Google or SerpApi image host, never anything else a response might hold. */
export function safeThumbnail(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 1500) return null
  try {
    const u = new URL(v)
    return u.protocol === 'https:' && IMAGE_HOSTS.some((h) => h.test(u.hostname)) ? u.toString() : null
  } catch {
    return null
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** A Google Maps link we build ourselves from the place's name and id, so a response can never supply a link. */
export function mapsUrl(name: string, placeId: string): string {
  const base = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`
  return placeId ? `${base}&query_place_id=${encodeURIComponent(placeId)}` : base
}

/**
 * The few places worth showing: the nearest ones within walking range, with a name and a location.
 * The service's own order is a relevance order, not a distance one, so the sort is ours.
 */
export function parsePlaces(data: unknown, origin: Origin, max = MAX_PLACES): Place[] {
  const list = data && typeof data === 'object' && Array.isArray((data as { local_results?: unknown }).local_results) ? ((data as { local_results: unknown[] }).local_results) : []
  const out: Place[] = []
  const seen = new Set<string>()
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const name = str(r.title, 80)
    const gps = r.gps_coordinates as { latitude?: unknown; longitude?: unknown } | undefined
    if (!name || typeof gps?.latitude !== 'number' || typeof gps?.longitude !== 'number') continue
    const km = distanceKm(origin, { lat: gps.latitude, lng: gps.longitude })
    if (!Number.isFinite(km) || km > MAX_WALK_KM) continue
    const placeId = str(r.place_id, 200)
    const key = placeId || name
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: key,
      name,
      type: str(r.type, 40),
      address: str(r.address, 120),
      rating: typeof r.rating === 'number' && r.rating >= 0 && r.rating <= 5 ? r.rating : null,
      openState: str(r.open_state, 60),
      thumbnail: safeThumbnail(r.thumbnail) ?? safeThumbnail(r.serpapi_thumbnail),
      distanceKm: km,
      mapsUrl: mapsUrl(name, placeId),
    })
  }
  return out.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, max)
}

/** "about 400 m", "1.2 km", or in miles. */
export function formatDistance(km: number, miles = false): string {
  if (miles) {
    const mi = km * 0.621371
    return mi < 0.1 ? 'right nearby' : `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`
  }
  if (km < 0.1) return 'right nearby'
  if (km < 1) return `about ${Math.round(km * 10) * 100} m`
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`
}

/** English-speaking people in the US use miles. */
export const prefersMiles = (language: string) => /^en-US/i.test(language)

/** good; not right now (sits out for a while, then may come back); never suggest it again. */
export type Rating = 'yes' | 'no' | 'never'

export interface RatingInfo {
  rating: Rating
  /** When it was rated, in milliseconds. */
  at: number
}
export type Ratings = ReadonlyMap<string, RatingInfo>

/** "Not right now" is not forever: the place can be suggested again after this long. */
export const SNOOZE_DAYS = 14
const DAY_MS = 86_400_000

/** Hidden: marked never, or marked "not right now" recently enough that it is still sitting out. */
export function isHidden(info: RatingInfo | undefined, now: number): boolean {
  if (!info) return false
  if (info.rating === 'never') return true
  return info.rating === 'no' && now - info.at < SNOOZE_DAYS * DAY_MS
}

/** Whole days until a "not right now" place may come back (at least 1), or 0 when it is not sitting out. */
export function daysUntilBack(info: RatingInfo | undefined, now: number): number {
  if (!info || info.rating !== 'no' || !isHidden(info, now)) return 0
  return Math.max(1, Math.ceil((info.at + SNOOZE_DAYS * DAY_MS - now) / DAY_MS))
}

/**
 * Put what the person told us about places to work, without trapping them: "never" is never offered again, "not
 * right now" sits out for a couple of weeks and then counts as unrated, and favorites are not pushed to the front.
 * Everything keeps its order (nearest first). Pure: no search, so a thumbs-down shows the next place straight away.
 */
export function applyPlaceFeedback(places: Place[], ratings: Ratings, now = Date.now()): Place[] {
  return places.filter((p) => !isHidden(ratings.get(p.id), now) && openStatus(p.openState) !== 'closed')
}

/**
 * Whether a place looks open, from the hours line Google Maps gives ("Open ⋅ Closes 9 PM", "Closed ⋅ Opens 8 AM Mon",
 * "Open 24 hours", "Closes soon ⋅ 5 PM", "Temporarily closed"). Many parks have no line at all: that is 'unknown', and
 * unknown places are still offered (a closed one is never offered). The line is a snapshot from when the places were
 * looked up, which is why looked-up places are only kept for a short while.
 */
export type OpenStatus = 'open' | 'closing-soon' | 'closed' | 'unknown'
export function openStatus(openState: string): OpenStatus {
  const t = openState.trim().toLowerCase()
  if (!t) return 'unknown'
  if (t.startsWith('closed') || t.startsWith('opens soon') || t.includes('temporarily closed') || t.includes('permanently closed')) return 'closed'
  if (t.startsWith('closes soon')) return 'closing-soon'
  if (t.startsWith('open')) return 'open'
  return 'unknown'
}

/** How many of these places look closed right now. */
export const closedCount = (places: Place[]) => places.filter((p) => openStatus(p.openState) === 'closed').length

/** Late evening and night, by the person's own clock: 9 PM to 6 AM. No walk to a park is suggested then. */
export function isLateNight(now: Date): boolean {
  const h = now.getHours()
  return h >= 21 || h < 6
}

/** How often a favorite is the suggestion when there is something new to try as well: one visit in this many. */
export const FAVORITE_EVERY = 3
/** New places rotate among this many of the nearest ones the person has not rated, so it is not always the same one. */
export const ROTATE_AMONG = 3

/**
 * The one place to suggest for a kind. Balance matters: a favorite is welcome, but so is somewhere new, and the new
 * place changes too. With both available, a favorite comes up one visit in three (rotating through favorites) and
 * otherwise one of the three nearest places not yet rated, rotating. With only favorites, those; with none, the
 * nearest few rotate. `seed` changes from visit to visit (the day plus the kind): steady within a day, different
 * between days, never random.
 */
export function pickPlace(places: Place[], ratings: Ratings, seed: number, now = Date.now()): Place | undefined {
  const kept = applyPlaceFeedback(places, ratings, now)
  const liked = kept.filter((p) => ratings.get(p.id)?.rating === 'yes')
  const fresh = kept.filter((p) => ratings.get(p.id)?.rating !== 'yes')
  const favoriteVisit = liked.length > 0 && (fresh.length === 0 || seed % FAVORITE_EVERY === 0)
  if (favoriteVisit) return liked[Math.floor(seed / FAVORITE_EVERY) % liked.length]
  if (fresh.length === 0) return undefined
  // Count only the visits that are not favorite visits, so the new places really take turns.
  const turn = liked.length > 0 ? seed - Math.ceil(seed / FAVORITE_EVERY) : seed
  return fresh[turn % Math.min(fresh.length, ROTATE_AMONG)]
}

/** The concrete suggestions: what to do and where, in plain words. */
export function suggestionLine(kind: PlaceKindId, name: string): string {
  switch (kind) {
    case 'park':
      return `Take a walk to ${name}`
    case 'cafe':
      return `Spend quality time at ${name}`
    case 'library':
      return `Browse and sit quietly at ${name}`
    case 'garden':
      return `Wander through ${name}`
  }
}

/** Outdoors and indoors, so a day's pair is a mix: something outside and somewhere to sit. */
const OUTDOOR: PlaceKindId[] = ['park', 'garden']
const INDOOR: PlaceKindId[] = ['cafe', 'library']

/** The two kinds of place to suggest on a given day (the check-in card): one outside and one inside, changing by day. */
export function suggestedKinds(day: number, night = false): PlaceKindId[] {
  // At night, no park or garden: two indoor places (they may well be closed, and then none is offered).
  if (night) return [INDOOR[day % INDOOR.length]!, INDOOR[(day + 1) % INDOOR.length]!]
  return [OUTDOOR[day % OUTDOOR.length]!, INDOOR[Math.floor(day / 2) % INDOOR.length]!]
}

/** The kinds of place offered under "Other places to visit": no parks or gardens late at night. */
export const kindsFor = (night: boolean) => PLACE_KINDS.filter((k) => !(night && OUTDOOR.includes(k.id)))

/** The one kind of place for Home on a given day, cycling through all of them. */
export function homeKind(day: number, night = false): PlaceKindId {
  if (night) return INDOOR[day % INDOOR.length]!
  return PLACE_KINDS[day % PLACE_KINDS.length]!.id
}

/** Said instead of "just take a walk" when it is late. */
export const NIGHT_FALLBACK = "It's late, so something quiet indoors might suit tonight. Maybe a stretch, a warm drink, or a few minutes by a window."
