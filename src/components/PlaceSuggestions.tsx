import { useEffect, useRef, useState } from 'react'
import { MapPin, ThumbsDown, ThumbsUp } from 'lucide-react'
import { AuthOverlay, useAuthStatus } from 'deepspace'
import { Button } from '@/components/ui'
import { usePlaceFeedback } from '@/lib/use-place-feedback'
import { usePlaces } from '@/lib/use-places'
import { cn } from '@/lib/utils'
import { dayOfYear } from '@/lib/for-now'
import { PLACE_KINDS, applyPlaceFeedback, formatDistance, pickPlace, prefersMiles, suggestedKinds, suggestionLine, type Place, type PlaceKindId } from '../places/places'

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
function PlaceRow({ kind, place, miles, onRate, rating }: { kind: PlaceKindId; place: Place; miles: boolean; onRate: (r: 'yes' | 'no') => void; rating?: 'yes' }) {
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
            {[place.type, formatDistance(place.distanceKm, miles), place.rating !== null ? `${place.rating.toFixed(1)} stars` : '', place.openState].filter(Boolean).join(' · ')}
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
        <div className="flex shrink-0 gap-1" role="group" aria-label={`Rate ${place.name}`}>
          <button type="button" className={btn(rating === 'yes')} aria-pressed={rating === 'yes'} aria-label={`Good place: ${place.name}`} onClick={() => onRate('yes')}>
            <ThumbsUp aria-hidden className="h-4 w-4" />
          </button>
          <button type="button" className={btn(false)} aria-label={`Not right now: ${place.name}`} onClick={() => onRate('no')}>
            <ThumbsDown aria-hidden className="h-4 w-4" />
          </button>
        </div>
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
  const kinds = kindsProp ?? suggestedKinds(dayOfYear(new Date()))
  const { state, find, findSuggested } = usePlaces()
  const { isSignedIn, isLoaded } = useAuthStatus()
  const [signIn, setSignIn] = useState(false)
  const { ratings, rate, ready } = usePlaceFeedback()
  const [permission, setPermission] = useState<'granted' | 'other'>('other')
  const [othersOpen, setOthersOpen] = useState(false)
  const [lastNo, setLastNo] = useState<Place | null>(null)
  const asked = useRef(false)
  const signedInRef = useRef(isSignedIn)
  signedInRef.current = isSignedIn
  const busy = state.kind === 'locating' || state.kind === 'searching'
  const miles = typeof navigator !== 'undefined' && prefersMiles(navigator.language)

  // Someone who already allowed location for this site sees places with no extra step (on Home, at most every so often).
  useEffect(() => {
    if (asked.current) return
    asked.current = true
    const perms = typeof navigator !== 'undefined' ? navigator.permissions : undefined
    void perms
      ?.query({ name: 'geolocation' as PermissionName })
      .then((r) => {
        if (r.state !== 'granted') return
        setPermission('granted')
        if (!signedInRef.current) return // a signed-out visitor is asked to sign in first; nothing is searched
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
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPin aria-hidden className="h-4 w-4" />A place to go near you
          </p>
          <p className="mt-1 text-sm text-foreground">Share your location and I&apos;ll suggest real places close by.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your browser will ask first. Your location is rounded to about a kilometre, used once to look for places, and not saved.
          </p>
          {isLoaded && !isSignedIn ? (
            // Places are a paid search billed to the person, so they need to be signed in first.
            <Button type="button" className="mt-3 min-h-11" onClick={() => setSignIn(true)}>
              Sign in to see places
            </Button>
          ) : (
            <Button type="button" className="mt-3 min-h-11" onClick={() => void findSuggested(kinds)}>
              {permission === 'granted' ? 'Show places near me' : 'Share my location'}
            </Button>
          )}
          {signIn && <AuthOverlay onClose={() => setSignIn(false)} />}
        </div>
      )}

      <div aria-live="polite">
        {state.kind === 'locating' && <p className="text-sm text-foreground">Waiting for your location…</p>}
        {state.kind === 'searching' && <p className="text-sm text-foreground">Looking for places…</p>}
        {(state.kind === 'denied' || state.kind === 'unavailable') && (
          <p data-testid={state.kind === 'denied' ? 'places-denied' : 'places-unavailable'} className="text-sm text-foreground">
            {state.kind === 'denied' ? "No problem, I won't use your location. " : "I couldn't get your location just now. "}
            {fallback ?? 'How about just taking a walk? Pick any direction you like, and head back whenever you are ready.'}
          </p>
        )}
        {(state.kind === 'denied' || state.kind === 'unavailable' || state.kind === 'error') && (
          <Button type="button" variant="outline" className="mt-2 min-h-10" onClick={() => void findSuggested(kinds)}>
            Try again
          </Button>
        )}
        {state.kind === 'error' && (
          <p data-testid="places-error" className="text-sm text-foreground">
            {state.message} {fallback ?? 'How about just taking a walk?'}
          </p>
        )}
      </div>

      {state.kind === 'suggested' && (
        <>
          {(() => {
            const rows = kinds
              // A favorite now and then, somewhere new otherwise; steady within a day, different from day to day.
              .map((k, i) => ({ kind: k, place: pickPlace(state.byKind[k] ?? [], ratings, dayOfYear(new Date()) + i) }))
              .filter((r): r is { kind: PlaceKindId; place: Place } => !!r.place)
            return rows.length === 0 ? (
              <p data-testid="places-empty" className="text-sm text-foreground">
                I didn&apos;t find anything new within an easy walk. Try another kind below, or just walk anywhere you like.
              </p>
            ) : (
              <div>
                <ul className="space-y-2" data-testid="places-list">
                  {rows.map(({ kind, place }) => (
                    <PlaceRow key={`${kind}-${place.id}`} kind={kind} place={place} miles={miles} rating={ratings.get(place.id)?.rating === 'yes' ? 'yes' : undefined} onRate={(r) => rateIt(place, r)} />
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
                  <PlaceRow key={p.id} kind={state.type} place={p} miles={miles} rating={ratings.get(p.id)?.rating === 'yes' ? 'yes' : undefined} onRate={(r) => rateIt(p, r)} />
                ))}
              </ul>
            )
          })()}
        </div>
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
              {PLACE_KINDS.map((k) => (
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
