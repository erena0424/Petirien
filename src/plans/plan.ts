/**
 * A "plan" is something the person has coming up (or just had): an event from
 * their Google Calendar, or one they typed by hand. This file is pure: it turns
 * a calendar response into a short, tidy list and writes the fixed lines the
 * app shows. It keeps only id, title, start and end. Nothing else about an
 * event (people, places, notes, links) is ever read.
 */

import { eventsOf } from '../lib/free-time'

export interface Plan {
  id: string
  title: string
  /** ISO time. For all-day plans, local midnight of the first day. */
  start: string
  /** ISO time, or null for a hand-typed plan with no end. */
  end: string | null
  allDay: boolean
  manual: boolean
}

export type PlanStatus = 'upcoming' | 'now' | 'done'

const HOUR = 3_600_000

export const MAX_TITLE = 80
export const MAX_UPCOMING = 4
export const MAX_RECENT = 2
const FALLBACK_TITLE = 'a plan'

/** One short line, no control characters, no runs of spaces. Never empty. */
const UNSEEN = new RegExp('[\\u0000-\\u001f\\u007f\\u200b-\\u200f\\u2028\\u2029]', 'g')

export function cleanTitle(v: unknown): string {
  if (typeof v !== 'string') return FALLBACK_TITLE
  const t = v.replace(UNSEEN, ' ').replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, MAX_TITLE) : FALLBACK_TITLE
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** From "today 00:00" to the end of tomorrow, in the person's own time zone. */
export function planWindow(now: Date): { from: Date; to: Date } {
  return { from: startOfDay(now), to: addDays(startOfDay(now), 2) }
}

const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/
const parseDay = (s: string): Date | null => {
  const m = dateOnly.exec(s)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}
const ok = (n: number) => !Number.isNaN(n)

export function statusOf(p: Plan, now: Date): PlanStatus {
  const t = now.getTime()
  const start = Date.parse(p.start)
  const end = p.end ? Date.parse(p.end) : null
  if (start > t) return 'upcoming'
  if (end === null) return 'now'
  return end > t ? 'now' : 'done'
}

/** Every usable event in a calendar response as a plan, oldest first. No window, no cap: callers choose what to show. */
export function parseEvents(data: unknown): Plan[] {
  const plans: Plan[] = []
  for (const raw of eventsOf(data) as {
    id?: unknown
    summary?: unknown
    status?: unknown
    attendees?: { self?: unknown; responseStatus?: unknown }[]
    start?: { dateTime?: unknown; date?: unknown }
    end?: { dateTime?: unknown; date?: unknown }
  }[]) {
    if (raw.status === 'cancelled') continue
    if (raw.attendees?.some((a) => a.self === true && a.responseStatus === 'declined')) continue
    let start: Date | null = null
    let end: Date | null = null
    let allDay = false
    if (typeof raw.start?.dateTime === 'string' && typeof raw.end?.dateTime === 'string') {
      start = new Date(raw.start.dateTime)
      end = new Date(raw.end.dateTime)
    } else if (typeof raw.start?.date === 'string' && typeof raw.end?.date === 'string') {
      start = parseDay(raw.start.date)
      end = parseDay(raw.end.date) // Google's all-day end is the day after the last day
      allDay = true
    }
    if (!start || !end || !ok(start.getTime()) || !ok(end.getTime()) || end <= start) continue
    const id = typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 200) : `${start.toISOString()}|${cleanTitle(raw.summary)}`
    plans.push({ id, title: cleanTitle(raw.summary), start: start.toISOString(), end: end.toISOString(), allDay, manual: false })
  }
  return plans.sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
}

/**
 * The few plans worth showing on Home: what is on now or coming up (up to 4), plus up to
 * 2 that just finished today so there is something to talk about. Today and tomorrow only. Oldest first.
 */
export function plansFromCalendar(data: unknown, now: Date): Plan[] {
  return shortList(parseEvents(data), now)
}

/** Of any plans, the few worth showing on Home: today's and tomorrow's, up to 4 coming and 2 just finished. Oldest first. */
export function shortList(all: Plan[], now: Date): Plan[] {
  const { from, to } = planWindow(now)
  const plans = all.filter((p) => (p.end ? Date.parse(p.end) : Date.parse(p.start) + HOUR) > from.getTime() && Date.parse(p.start) < to.getTime())
  const upcoming = plans.filter((p) => statusOf(p, now) !== 'done').slice(0, MAX_UPCOMING)
  const recent = plans.filter((p) => statusOf(p, now) === 'done').slice(-MAX_RECENT)
  return [...recent, ...upcoming]
}

/**
 * A plan typed by hand. `time` is "HH:MM" (24 hour) or empty for "sometime today". With a time it is assumed
 * to last an hour, so it becomes "finished" afterwards; without one it is a today-sized plan.
 */
export function manualPlan(title: string, time: string, now: Date): Plan | null {
  const clean = cleanTitle(title)
  if (!title.trim()) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!m && time.trim()) return null
  const id = `manual-${now.getTime()}`
  if (m) {
    const h = Number(m[1])
    const min = Number(m[2])
    if (h > 23 || min > 59) return null
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min)
    return { id, title: clean, start: start.toISOString(), end: new Date(start.getTime() + HOUR).toISOString(), allDay: false, manual: true }
  }
  const day = startOfDay(now)
  return { id, title: clean, start: day.toISOString(), end: addDays(day, 1).toISOString(), allDay: true, manual: true }
}

const clock = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function dayWord(d: Date, now: Date): 'today' | 'tomorrow' | 'earlier' {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000)
  return diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : 'earlier'
}

/** "today at 3:30 PM", "tomorrow at 9:00 AM", "all day today". */
export function whenText(p: Plan, now: Date): string {
  const start = new Date(p.start)
  const day = dayWord(start, now)
  const word = day === 'earlier' ? start.toLocaleDateString([], { weekday: 'long' }) : day
  if (p.allDay) return p.manual ? word : `all day ${word}` // a typed plan with no time is just "today"
  return `${word} at ${clock(start)}`
}

/**
 * The bunny's first line when someone picks "Talk about this". Fixed text, so there is no model call and
 * nothing is assumed about how the person feels: it only asks, in the right tense for the plan.
 */
export function openerFor(p: Plan, now: Date): string {
  const status = statusOf(p, now)
  if (status === 'done') return `You had "${p.title}" ${whenText(p, now)}. How did it go?`
  if (status === 'now' && !p.allDay) return `"${p.title}" is on right now. How is it going?`
  return `You have "${p.title}" ${whenText(p, now)}. How are you feeling about it?`
}

export interface Suggestion {
  plan: Plan
  label: string
}

const shorten = (t: string, max = 36) => (t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`)
/**
 * Up to two gentle things the bunny could ask about on Home: how something that just finished went, how
 * something happening now is going, or how the person feels about what is next. Nothing is assumed about
 * the answer. Order: most recently finished (within 8 hours), then what is on now, then the next plan
 * within a day.
 */
export function suggestionsFor(plans: Plan[], now: Date, max = 2): Suggestion[] {
  const t = now.getTime()
  const byStart = [...plans].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  const done = byStart.filter((p) => statusOf(p, now) === 'done' && p.end && t - Date.parse(p.end) <= 8 * HOUR).reverse()
  const current = byStart.filter((p) => statusOf(p, now) === 'now' && !p.allDay)
  const next = byStart.filter((p) => statusOf(p, now) === 'upcoming' && Date.parse(p.start) - t <= 24 * HOUR)
  const out: Suggestion[] = []
  for (const p of done.slice(0, 1)) out.push({ plan: p, label: `How was ${shorten(p.title)}?` })
  for (const p of current.slice(0, 1)) out.push({ plan: p, label: `How is ${shorten(p.title)} going?` })
  for (const p of next.slice(0, 1)) out.push({ plan: p, label: `How are you feeling about ${shorten(p.title)}?` })
  return out.slice(0, max)
}

/** Minutes until the plan starts, or null when it has started, is all-day, or has no useful time. */
export function minutesUntil(p: Plan, now: Date): number | null {
  if (p.allDay) return null
  const diff = Date.parse(p.start) - now.getTime()
  return diff > 0 ? Math.floor(diff / 60000) : null
}
