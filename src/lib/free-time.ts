/**
 * Turns a Google Calendar response into one number: how many minutes are free
 * before the next thing on the calendar. Only start and end times are read.
 * Titles, people, places and descriptions are never looked at, kept, or sent
 * anywhere, so they cannot leak by accident.
 */

/** The time options on the check-in form. */
export const TIME_CHOICES = [5, 10, 15, 20, 30] as const

/** Look this far ahead; beyond it the answer is "plenty". */
export const LOOK_AHEAD_MINUTES = 240

export interface FreeTime {
  /** Minutes until the next event starts, or null when you are in an event right now. */
  minutes: number | null
  /** When the next event starts (or the current one ends), as a Date. Null when nothing is coming up. */
  at: Date | null
  /** True when you are in an event right now. */
  busyNow: boolean
}

interface Raw {
  start?: { dateTime?: unknown; date?: unknown }
  end?: { dateTime?: unknown; date?: unknown }
  status?: unknown
  transparency?: unknown
  attendees?: { self?: unknown; responseStatus?: unknown }[]
}

const isTime = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))

/** The events array from either response shape; anything else is "no events". */
export function eventsOf(data: unknown): Raw[] {
  if (!data || typeof data !== 'object') return []
  const d = data as Record<string, unknown>
  const list = Array.isArray(d.items) ? d.items : Array.isArray(d.events) ? d.events : []
  return list.filter((e): e is Raw => !!e && typeof e === 'object')
}

/** Events that really take your time: timed, not cancelled, not marked "free", not declined by you. */
function busyBlocks(events: Raw[]): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []
  for (const e of events) {
    if (e.status === 'cancelled') continue
    if (e.transparency === 'transparent') continue
    if (e.attendees?.some((a) => a.self === true && a.responseStatus === 'declined')) continue
    const s = e.start?.dateTime
    const en = e.end?.dateTime
    if (!isTime(s) || !isTime(en)) continue // all-day events do not block a few free minutes
    const start = Date.parse(s)
    const end = Date.parse(en)
    if (end > start) out.push({ start, end })
  }
  return out.sort((a, b) => a.start - b.start)
}

export function freeTime(data: unknown, now: Date): FreeTime {
  const t = now.getTime()
  const blocks = busyBlocks(eventsOf(data))
  const current = blocks.filter((b) => b.start <= t && b.end > t)
  if (current.length) {
    // Free again once the whole run of back-to-back or overlapping events is over.
    let end = Math.max(...current.map((b) => b.end))
    for (const b of blocks) if (b.start <= end && b.end > end) end = b.end
    return { minutes: null, at: new Date(end), busyNow: true }
  }
  const next = blocks.find((b) => b.start > t)
  if (!next) return { minutes: LOOK_AHEAD_MINUTES, at: null, busyNow: false }
  return { minutes: Math.max(0, Math.floor((next.start - t) / 60000)), at: new Date(next.start), busyNow: false }
}

/** The biggest time option that fits in the free minutes, or the smallest option when less than that is free. */
export function choiceFor(minutes: number): number {
  let pick: number = TIME_CHOICES[0]
  for (const c of TIME_CHOICES) if (c <= minutes) pick = c
  return pick
}

const clock = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

/** One calm sentence for the person. It mentions times only, never what the events are. */
export function describe(f: FreeTime): string {
  if (f.busyNow && f.at) return `You look busy until ${clock(f.at)}. Pick a time below when you're free.`
  if (f.minutes === null) return ''
  if (!f.at) return 'Nothing coming up on your calendar for the next few hours, so any time works.'
  if (f.minutes < TIME_CHOICES[0]) return `Your next event starts at ${clock(f.at)}, so there's very little time right now. I picked ${TIME_CHOICES[0]} minutes.`
  return `You have about ${f.minutes} minutes before ${clock(f.at)}. I picked ${choiceFor(f.minutes)} minutes.`
}
