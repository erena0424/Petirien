import { useCallback, useEffect, useState } from 'react'
import { integration, useAuthStatus } from 'deepspace'
import { manualPlan, planWindow, plansFromCalendar, type Plan } from '../plans/plan'
import { safeAuthUrl } from './use-calendar'

export type PlansState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'connect'; authUrl: string }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }

/** Set once calendar plans have loaded, so later visits can load them without asking again. A flag only, never any event. */
const USED_KEY = 'petirien.calendarUsed'

// Plans stay in memory for this tab only (never written to storage), so moving between pages does not
// re-read the calendar. They are tied to the person who loaded them and gone on reload or sign-out.
let cache: { userId: string; plans: Plan[]; loadedAt: number } | null = null
const FRESH_MS = 10 * 60_000

// A page that mounts twice at once (React's dev double-run, a quick remount) must read the calendar once, not twice: each read costs the person money.
let inFlight: Promise<void> | null = null

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
 * Today's and tomorrow's plans from the signed-in person's own Google Calendar, plus
 * any they typed by hand. Reading the calendar is billed to the person, so it only
 * happens when they ask, or once per tab for someone who has used it before.
 */
export function usePlans() {
  const { userId, isSignedIn } = useAuthStatus()
  const mine = cache && cache.userId === userId ? cache : null
  const [calendarPlans, setCalendarPlans] = useState<Plan[]>(mine?.plans ?? [])
  const [typed, setTyped] = useState<Plan[]>([])
  const [state, setState] = useState<PlansState>(mine ? { kind: 'ready' } : { kind: 'idle' })

  const fetchPlans = useCallback(async (uid: string): Promise<void> => {
    setState({ kind: 'loading' })
    const now = new Date()
    const { from, to } = planWindow(now)
    const res = await integration.post<Record<string, unknown>>('google/calendar-list-events', {
      calendarId: 'primary',
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      maxResults: 50,
    })
    if (!res.success) {
      if (res.code === 'insufficient_credits' || res.status === 402) {
        return setState({ kind: 'error', message: "Your account is out of credits for this, so I can't read your calendar right now. You can still share a plan yourself." })
      }
      return setState({ kind: 'error', message: "I couldn't reach your calendar just now. You can still share a plan yourself." })
    }
    const data = res.data
    if (data && typeof data === 'object' && data.requiresOAuth === true) {
      const authUrl = safeAuthUrl(data.authUrl)
      if (authUrl) return setState({ kind: 'connect', authUrl })
      return setState({ kind: 'error', message: "I couldn't start connecting your calendar. You can still share a plan yourself." })
    }
    const plans = plansFromCalendar(data, now)
    cache = { userId: uid, plans, loadedAt: Date.now() }
    markUsed()
    setCalendarPlans(plans)
    setState({ kind: 'ready' })
  }, [])

  const load = useCallback((): Promise<void> => {
    if (!userId) return Promise.resolve()
    if (!inFlight) inFlight = fetchPlans(userId).finally(() => (inFlight = null))
    return inFlight
  }, [userId, fetchPlans])


  // Someone who has used it before gets their plans without pressing anything, once per tab (or when stale).
  useEffect(() => {
    if (!isSignedIn || !userId || state.kind !== 'idle') return
    if (cache && cache.userId === userId && Date.now() - cache.loadedAt < FRESH_MS) return
    if (wasUsed()) void load()
  }, [isSignedIn, userId, state.kind, load])

  const addTyped = useCallback((title: string, time: string): boolean => {
    const plan = manualPlan(title, time, new Date())
    if (!plan) return false
    setTyped((t) => [...t, plan])
    return true
  }, [])

  const removeTyped = useCallback((id: string) => setTyped((t) => t.filter((p) => p.id !== id)), [])

  return { state, calendarPlans, typed, load, addTyped, removeTyped }
}

/** For tests and sign-out: forget anything held in memory. */
export function clearPlansCache() {
  cache = null
}
