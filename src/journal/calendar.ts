/**
 * Date logic for the Journal's Month, Week and Day views. Pure: no React, no storage.
 * Everything uses the person's own local calendar day, so an entry written at 11 PM
 * stays on that evening's date. Weeks start on Sunday, like the home calendar.
 */

import { dayKey } from '../lib/calendar'

export { dayKey }

export type View = 'month' | 'week' | 'day' | 'list'
export const VIEWS: View[] = ['month', 'week', 'day', 'list']
export const isView = (v: unknown): v is View => typeof v === 'string' && (VIEWS as string[]).includes(v)

export interface DayEntry {
  /** ISO time the entry was written. */
  createdAt: string
  /** An entry about a plan (a reflection, or notes from a chat about it) is dated by the plan; everything else by when it was written. */
  kind?: string
  eventStart?: string
}


export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b)

const valid = (s: unknown): s is string => typeof s === 'string' && !Number.isNaN(Date.parse(s))

/** The day an entry belongs on, or null if it has no usable date. */
export function entryDay(e: DayEntry): Date | null {
  const iso = valid(e.eventStart) ? e.eventStart : e.createdAt
  return valid(iso) ? startOfDay(new Date(iso)) : null
}

/** Entries grouped by local day, newest first within each day by the time they were written. */
export function groupByDay<T extends DayEntry>(entries: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const e of entries) {
    const d = entryDay(e)
    if (!d) continue
    const key = dayKey(d)
    map.set(key, [...(map.get(key) ?? []), e])
  }
  for (const [key, list] of map) map.set(key, [...list].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)))
  return map
}

export function weekStart(d: Date): Date {
  return addDays(startOfDay(d), -startOfDay(d).getDay())
}

/** Seven days, Sunday to Saturday, containing `anchor`. */
export function weekDays(anchor: Date): Date[] {
  const s = weekStart(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(s, i))
}

/** The month as whole weeks (Sunday to Saturday), padded with the neighbouring months' days. */
export function monthGrid(anchor: Date): Date[][] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  const days: Date[] = []
  for (let d = weekStart(first); d <= addDays(weekStart(last), 6); d = addDays(d, 1)) days.push(d)
  return Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7))
}

/** Move the anchor by one step of the current view: a month, a week or a day (the list does not move). */
export function shift(view: View, anchor: Date, dir: 1 | -1): Date {
  if (view === 'month') {
    // Keep the day of the month where it exists; land on the last day of a shorter month.
    const target = new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1)
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
    return new Date(target.getFullYear(), target.getMonth(), Math.min(anchor.getDate(), lastDay))
  }
  if (view === 'week') return addDays(anchor, 7 * dir)
  if (view === 'day') return addDays(anchor, dir)
  return anchor
}

const monthName = (d: Date) => d.toLocaleDateString([], { month: 'long', year: 'numeric' })
const short = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' })

/** The heading for the range on screen: "October 2026", "Sep 27 to Oct 3, 2026", "Friday, October 2". */
export function rangeLabel(view: View, anchor: Date): string {
  if (view === 'month') return monthName(anchor)
  if (view === 'week') {
    const days = weekDays(anchor)
    const a = days[0]!
    const b = days[6]!
    return `${short(a)} to ${short(b)}, ${b.getFullYear()}`
  }
  if (view === 'day') return anchor.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  return 'All entries'
}

/** Long form for screen readers and the day heading: "Friday, October 2, 2026". */
export const fullDate = (d: Date) => d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
