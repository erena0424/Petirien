import { useCallback, useEffect, useMemo, useState } from 'react'
import { integration, useAuthStatus } from 'deepspace'
import type { View } from '../journal/calendar'
import { covering, fetchRange, type Loaded } from '../journal/layout'
import { parseEvents, type Plan } from '../plans/plan'
import { safeAuthUrl } from './use-calendar'

export type RangeState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'connect'; authUrl: string }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }

const USED_KEY = 'petirien.calendarUsed'

// Loaded ranges stay in memory for this tab only (never written to storage) and belong to one person.
// Moving between weeks and months inside a range already loaded costs nothing.
let cache: { userId: string; loaded: Loaded[] } | null = null
const inFlight = new Map<string, Promise<void>>()

const wasUsed = () => {
  try {
    return localStorage.getItem(USED_KEY) === '1'
  } catch {
    return false
  }
}
const markUsed = () => {
  try {
    localStorage.setItem(USED_KEY, '1')
  } catch {
    /* storage unavailable: the person just presses the button next time */
  }
}

/**
 * The calendar events behind the visible Month, Week or Day, from the signed-in person's own Google Calendar.
 * Reading is billed to the person, so it happens when they ask, or on its own only for someone who has used it
 * before. A range already loaded is reused, and two loads of the same range at once become one.
 */
export function useCalendarRange(view: View, anchor: Date) {
  const { userId, isSignedIn } = useAuthStatus()
  const [loaded, setLoaded] = useState<Loaded[]>(cache && cache.userId === userId ? cache.loaded : [])
  const [state, setState] = useState<RangeState>(cache && cache.userId === userId && cache.loaded.length ? { kind: 'ready' } : { kind: 'idle' })
  const anchorKey = anchor.getTime()
  const { from, to } = useMemo(() => fetchRange(view, new Date(anchorKey)), [view, anchorKey])
  const hit = view === 'list' ? undefined : covering(loaded, from, to)

  const load = useCallback((): Promise<void> => {
    if (!userId) return Promise.resolve()
    const key = `${userId}|${from.getTime()}|${to.getTime()}`
    const running = inFlight.get(key)
    if (running) return running
    const run = (async () => {
      setState({ kind: 'loading' })
      const res = await integration.post<Record<string, unknown>>('google/calendar-list-events', {
        calendarId: 'primary',
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        maxResults: 250,
      })
      if (!res.success) {
        const credits = res.code === 'insufficient_credits' || res.status === 402
        return setState({
          kind: 'error',
          message: credits
            ? "Your account is out of credits for this, so I can't read your calendar right now."
            : "I couldn't reach your calendar just now.",
        })
      }
      const data = res.data
      if (data && typeof data === 'object' && data.requiresOAuth === true) {
        const authUrl = safeAuthUrl(data.authUrl)
        return setState(authUrl ? { kind: 'connect', authUrl } : { kind: 'error', message: "I couldn't start connecting your calendar." })
      }
      const entry: Loaded = { from: from.getTime(), to: to.getTime(), plans: parseEvents(data) }
      const next = [...(cache && cache.userId === userId ? cache.loaded : []), entry]
      cache = { userId, loaded: next }
      markUsed()
      setLoaded(next)
      setState({ kind: 'ready' })
    })().finally(() => inFlight.delete(key))
    inFlight.set(key, run)
    return run
  }, [userId, from, to])

  // Someone who has used it before sees their events without pressing anything, including after moving to a new range.
  useEffect(() => {
    if (view === 'list' || !isSignedIn || !userId || hit) return
    if (state.kind === 'loading' || state.kind === 'connect' || state.kind === 'error') return
    if (state.kind === 'ready' || wasUsed()) void load()
  }, [view, isSignedIn, userId, hit, state.kind, load])

  const events: Plan[] = hit?.plans ?? []
  return { state: hit && state.kind !== 'loading' ? ({ kind: 'ready' } as RangeState) : state, events, load }
}

/** For tests and sign-out. */
export function clearCalendarRangeCache() {
  cache = null
  inFlight.clear()
}
