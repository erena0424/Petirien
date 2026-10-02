import { useCallback, useState } from 'react'
import { integration } from 'deepspace'
import { LOOK_AHEAD_MINUTES, choiceFor, describe, freeTime } from './free-time'

export type CalendarState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  /** The person has not connected Google Calendar yet. `authUrl` is where to do it. */
  | { kind: 'connect'; authUrl: string }
  | { kind: 'result'; text: string }
  | { kind: 'error'; message: string }

const GOOGLE_AUTH = 'https://accounts.google.com/'

/** Only ever link to Google's own sign-in page, whatever a response says. */
export function safeAuthUrl(v: unknown): string | null {
  return typeof v === 'string' && v.startsWith(GOOGLE_AUTH) ? v : null
}

/**
 * Reads the next few hours of the signed-in person's own calendar and works out
 * how much time is free. Billed to the person (not the app owner). Only the free
 * minutes leave this function; the events themselves are dropped right here.
 */
export function useCalendarFit(onMinutes: (minutes: number) => void) {
  const [state, setState] = useState<CalendarState>({ kind: 'idle' })

  const check = useCallback(async () => {
    setState({ kind: 'loading' })
    const now = new Date()
    const res = await integration.post<Record<string, unknown>>('google/calendar-list-events', {
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: new Date(now.getTime() + LOOK_AHEAD_MINUTES * 60000).toISOString(),
      maxResults: 25,
    })
    if (!res.success) {
      if (res.code === 'insufficient_credits' || res.status === 402) {
        return setState({ kind: 'error', message: "Your account is out of credits for this, so I can't look at your calendar right now. You can still pick a time yourself." })
      }
      return setState({ kind: 'error', message: "I couldn't reach your calendar just now. You can pick a time yourself." })
    }
    const data = res.data
    if (data && typeof data === 'object' && data.requiresOAuth === true) {
      const authUrl = safeAuthUrl(data.authUrl)
      if (authUrl) return setState({ kind: 'connect', authUrl })
      return setState({ kind: 'error', message: "I couldn't start connecting your calendar. You can pick a time yourself." })
    }
    const free = freeTime(data, now)
    if (free.minutes !== null) onMinutes(choiceFor(free.minutes))
    setState({ kind: 'result', text: describe(free) })
  }, [onMinutes])

  return { state, check }
}
