import { useEffect, useRef, useState } from 'react'
import { MapPin, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useAuthStatus } from 'deepspace'
import { Button } from '@/components/ui'
import { MapSketch } from './Sparkle'
import { loadLocation } from '../places/saved-location'
import { usePlaceFeedback } from '@/lib/use-place-feedback'
import { usePlaces } from '@/lib/use-places'
import { cn } from '@/lib/utils'
import { dayOfYear } from '@/lib/for-now'
import { NIGHT_FALLBACK, openLine, applyPlaceFeedback, closedCount, isLateNight, kindsFor, formatDistance, pickPlace, prefersMiles, suggestedKinds, suggestionLine, type Place, type PlaceKindId } from '../places/places'

const AUTO_KEY = 'petirien.placesAutoAt'

function autoDue(windowMs: number): boolean {
  try {
    const at = Number(localStorage.getItem(AUTO_KEY))
    return !at || Date.now() - at >= windowMs
  } catch {
    return true
  }
}
function markAuto() {
  try {
    localStorage.setItem(AUTO_KEY, String(Date.now()))
  } catch {
    /* storage unavailable: the person just presses the button */
  }
}

interface Props {
  /** The concrete suggestions to show, in order. */
  kinds?: PlaceKindId[]
  /** On its own, search at most this often (a flag with the time only, never any place). Unset: whenever location is already allowed. */
  autoEveryMs?: number
  /** Offer the other kinds of place under a quiet "Other places to visit". */
  showOthers?: boolean
  /** Said when the person declines location. */
  fallback?: string
}

/** One place, said as something to do, with how far, a link to Google Maps, and a good / not for me pair. */
function PlaceRow({ kind, place, miles, onRate, rating }: { kind: PlaceKindId; place: Place; miles: boolean; onRate?: (r: 'yes' | 'no') => void; rating?: 'yes' }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const btn = (active: boolean) =>
    cn(
      'inline-flex h-10 w-10 items-center justify-center rounded-lg border text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
      active ? 'border-primary bg-accent' : 'border-input bg-card',
    )
  return (
    <li data-testid="place" className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        {place.thumbnail && !photoFailed && (
          // A decorative photo (the name next to it says what it is). If it cannot load, it simply is not there.
          <img
            src={place.thumbnail}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            data-testid="place-photo"
            onError={() => setPhotoFailed(true)}
            className="h-16 w-16 shrink-0 rounded-lg bg-muted object-cover sm:h-20 sm:w-20"
          />
        )}
        <div className="min-w-0 flex-1">
          <p data-testid="place-line" className="text-base font-semibold leading-snug text-foreground">
            {suggestionLine(kind, place.name)}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {[place.type, formatDistance(place.distanceKm, miles), place.rating !== null ? `${place.rating.toFixed(1)} stars` : '', openLine(place, new Date())].filter(Boolean).join(' · ')}
          </p>
          {place.address && <p className="text-sm text-muted-foreground">{place.address}</p>}
          <a
            href={place.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex min-h-10 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open in Google Maps
          </a>
        </div>
        {onRate && (
        <div className="flex shrink-0 gap-1" role="group" aria-label={`Rate ${place.name}`}>
          <button type="button" className={btn(rating === 'yes')} aria-pressed={rating === 'yes'} aria-label={`Good place: ${place.name}`} onClick={() => onRate('yes')}>
            <ThumbsUp aria-hidden className="h-4 w-4" />
          </button>
          <button type="button" className={btn(false)} aria-label={`Not right now: ${place.name}`} onClick={() => onRate('no')}>
            <ThumbsDown aria-hidden className="h-4 w-4" />
          </button>
        </div>
        )}
      </div>
    </li>
  )
}

/**
 * Concrete places near the person, with nothing to choose between: "Take a walk to X", "Spend quality time at Y".
 * Location is asked for up front (specific places need it); without it the idea is just taking a walk. Each place
 * has its own good / not right now, remembered: a favorite shows up now and then (not every time), and "not right now" sits out for a couple of weeks.
 */
export function PlaceSuggestions({ kinds: kindsProp, autoEveryMs, showOthers = true, fallback }: Props) {
  // Today's pair (something outside, somewhere to sit) unless told otherwise; it changes from day to day.
  const night = isLateNight(new Date())
  const kinds = kindsProp ?? suggestedKinds(dayOfYear(new Date()), night)
  const { isSignedIn } = useAuthStatus()
  const { state, find, findSuggested, forget } = usePlaces(isSignedIn)
  const { ratings, rate, ready } = usePlaceFeedback()
  const [permission, setPermission] = useState<'granted' | 'other'>('other')
  const [othersOpen, setOthersOpen] = useState(false)
  const [lastNo, setLastNo] = useState<Place | null>(null)
  const asked = useRef(false)
  const busy = state.kind === 'locating' || state.kind === 'searching'
  const miles = typeof navigator !== 'undefined' && prefersMiles(navigator.language)

  // Someone who already allowed location for this site sees places with no extra step (on Home, at most every so often).
  useEffect(() => {
    if (asked.current) return
    asked.current = true
    // A remembered location means places show every time, with no prompt and no button to press.
    if (loadLocation()) {
      void findSuggested(kinds)
      return
    }
    const perms = typeof navigator !== 'undefined' ? navigator.permissions : undefined
    void perms
      ?.query({ name: 'geolocation' as PermissionName })
      .then((r) => {
        if (r.state !== 'granted') return
        setPermission('granted')
        if (autoEveryMs === undefined || autoDue(autoEveryMs)) {
          if (autoEveryMs !== undefined) markAuto()
          void findSuggested(kinds)
        }
      })
      .catch(() => undefined)
  }, [])

  const rateIt = (p: Place, r: 'yes' | 'no') => {
    setLastNo(r === 'no' ? p : null)
    void rate(p, r)
  }

  return (
    <div data-testid="place-suggestions">
      {state.kind === 'idle' && (
        <div data-testid="places-ask">
          <div className="flex items-start gap-3">
            <MapSketch className="hidden h-24 w-36 shrink-0 sm:block" />
            <span aria-hidden className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary sm:hidden">
              <MapPin className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-semibold text-foreground">Find a nearby park, café, or other place for a little time away.</p>
              <p className="mt-1 text-sm text-foreground">Share your location and I&apos;ll suggest real places close by.</p>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Your browser will ask first. Your location is rounded to about a kilometre and remembered on this device only, so places can show every time. You can update or forget it any time.
          </p>
          <Button type="button" className="mt-3 min-h-11 rounded-full px-6" onClick={() => void findSuggested(kinds)}>
            {permission === 'granted' ? 'Show places near me' : 'Share my location'}
          </Button>
        </div>
      )}

      <div aria-live="polite">
        {state.kind === 'locating' && <p className="text-sm text-foreground">Waiting for your location…</p>}
        {state.kind === 'searching' && <p className="text-sm text-foreground">Looking for places…</p>}
        {(state.kind === 'denied' || state.kind === 'unavailable') && (
          <p data-testid={state.kind === 'denied' ? 'places-denied' : 'places-unavailable'} className="text-sm text-foreground">
            {state.kind === 'denied' ? "No problem, I won't use your location. " : "I couldn't get your location just now. "}
            {night ? NIGHT_FALLBACK : (fallback ?? 'How about just taking a walk? Pick any direction you like, and head back whenever you are ready.')}
          </p>
        )}
        {(state.kind === 'denied' || state.kind === 'unavailable' || state.kind === 'error') && (
          <Button type="button" variant="outline" className="mt-2 min-h-10" onClick={() => void findSuggested(kinds)}>
            Try again
          </Button>
        )}
        {state.kind === 'error' && (
          <p data-testid="places-error" className="text-sm text-foreground">
            {state.message} {night ? NIGHT_FALLBACK : (fallback ?? 'How about just taking a walk?')}
          </p>
        )}
      </div>

      {night && (state.kind === 'suggested' || state.kind === 'results') && (
        <p data-testid="night-note" className="mb-2 text-sm text-muted-foreground">
          It&apos;s late, so I&apos;m only suggesting places that are indoors and open.
        </p>
      )}
      {state.kind === 'suggested' && (
        <>
          {(() => {
            const rows = kinds
              // A favorite now and then, somewhere new otherwise; steady within a day, different from day to day.
              .map((k, i) => ({ kind: k, place: pickPlace(state.byKind[k] ?? [], ratings, dayOfYear(new Date()) + i) }))
              .filter((r): r is { kind: PlaceKindId; place: Place } => !!r.place)
            return rows.length === 0 ? (
              <p data-testid="places-empty" className="text-sm text-foreground">
                {Object.values(state.byKind).some((l) => closedCount(l ?? []) > 0)
                  ? night
                    ? `The places near you look closed right now. ${NIGHT_FALLBACK}`
                    : 'The places near you look closed right now. Try again a little later, or pick another kind below.'
                  : "I didn't find anything new within an easy walk. Try another kind below, or just walk anywhere you like."}
              </p>
            ) : (
              <div>
                <ul className="space-y-2" data-testid="places-list">
                  {rows.map(({ kind, place }) => (
                    <PlaceRow key={`${kind}-${place.id}`} kind={kind} place={place} miles={miles} rating={ratings.get(place.id)?.rating === 'yes' ? 'yes' : undefined} onRate={isSignedIn ? (r) => rateIt(place, r) : undefined} />
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">Places and photos from Google Maps.</p>
              </div>
            )
          })()}
        </>
      )}

      {state.kind === 'results' && (
        <div>
          {(() => {
            const places = applyPlaceFeedback(state.places, ratings)
            return places.length === 0 ? (
              <p data-testid="places-empty" className="text-sm text-foreground">
                I didn&apos;t find any of those within an easy walk. Another kind might, or just walk anywhere you like.
              </p>
            ) : (
              <ul className="space-y-2" data-testid="other-places-list">
                {places.map((p) => (
                  <PlaceRow key={p.id} kind={state.type} place={p} miles={miles} rating={ratings.get(p.id)?.rating === 'yes' ? 'yes' : undefined} onRate={isSignedIn ? (r) => rateIt(p, r) : undefined} />
                ))}
              </ul>
            )
          })()}
        </div>
      )}

      {(state.kind === 'suggested' || state.kind === 'results') && (
        <p className="mt-3 flex flex-wrap items-center gap-x-4 text-sm text-muted-foreground" data-testid="location-controls">
          <span>Using the location saved on this device (rounded to about a kilometre).</span>
          <button type="button" disabled={busy} data-testid="update-location" className="min-h-10 font-medium text-primary underline-offset-4 hover:underline" onClick={() => void findSuggested(kinds, { fresh: true })}>
            Update my location
          </button>
          <button type="button" data-testid="forget-location" className="min-h-10 font-medium text-primary underline-offset-4 hover:underline" onClick={forget}>
            Forget it
          </button>
        </p>
      )}

      {lastNo && (
        <p data-testid="place-no-notice" role="status" className="mt-2 text-sm text-muted-foreground">
          Okay, not right now. I&apos;ll leave {lastNo.name} out for a while.{' '}
          <button
            type="button"
            disabled={!ready}
            className="font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => {
              void rate(lastNo, 'no') // pressing the same choice again takes it back
              setLastNo(null)
            }}
          >
            Undo
          </button>{' '}
          <button
            type="button"
            disabled={!ready}
            className="font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => {
              void rate(lastNo, 'never')
              setLastNo(null)
            }}
          >
            Never suggest it
          </button>
        </p>
      )}

      {showOthers && state.kind !== 'idle' && state.kind !== 'denied' && state.kind !== 'unavailable' && (
        <div className="mt-3">
          <button
            type="button"
            aria-expanded={othersOpen}
            onClick={() => setOthersOpen((o) => !o)}
            className="min-h-10 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Other places to visit
          </button>
          {othersOpen && (
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Kind of place">
              {kindsFor(night).map((k) => (
                <Button
                  key={k.id}
                  type="button"
                  variant={state.kind === 'results' && state.type === k.id ? 'default' : 'outline'}
                  className="min-h-10"
                  disabled={busy}
                  onClick={() => void find(k.id)}
                >
                  {k.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
