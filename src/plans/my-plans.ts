/**
 * Events a person adds by hand. Pure: turns what they typed into a stored event and a stored row into a Plan.
 * Nothing here talks to the database.
 */

import { cleanTitle, type Plan } from './plan'

export interface MyPlanRow {
  title: string
  start: string
  end: string
  allDay?: number
}

const HOUR = 3_600_000
const DAY = 86_400_000
/** Far enough back to add something that just happened, and ahead to plan a trip. Beyond that is a typo. */
const MAX_BACK_DAYS = 60
const MAX_AHEAD_DAYS = 800

export const MY_PLAN_PREFIX = 'my-'
export const planIdFor = (recordId: string) => `${MY_PLAN_PREFIX}${recordId}`
export const recordIdOf = (planId: string) => (planId.startsWith(MY_PLAN_PREFIX) ? planId.slice(MY_PLAN_PREFIX.length) : null)

/** "2026-10-15" to local midnight, or null. */
function day(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null
}

/**
 * What to store for an event typed by hand. `date` is "YYYY-MM-DD" (empty means today) and `time` is "HH:MM" or empty
 * for an all-day event. A timed event lasts an hour unless `endTime` ('HH:MM', later the same day) says otherwise.
 * Null when something is not usable.
 */
export function newMyPlan(title: string, date: string, time: string, now: Date, endTime = ''): MyPlanRow | null {
  if (!title.trim()) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const d = date.trim() ? day(date) : today
  if (!d) return null
  const offset = Math.round((d.getTime() - today.getTime()) / DAY)
  if (offset < -MAX_BACK_DAYS || offset > MAX_AHEAD_DAYS) return null
  const t = time.trim()
  const clean = cleanTitle(title)
  if (!t) return { title: clean, start: d.toISOString(), end: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString(), allDay: 1 }
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, min)
  let end = new Date(start.getTime() + HOUR)
  const e = endTime.trim()
  if (e) {
    const em = /^(\d{1,2}):(\d{2})$/.exec(e)
    if (!em || Number(em[1]) > 23 || Number(em[2]) > 59) return null
    end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(em[1]), Number(em[2]))
    if (end <= start) return null
  }
  return { title: clean, start: start.toISOString(), end: end.toISOString(), allDay: 0 }
}

/** A stored row as a Plan the calendar and Home understand, or null if it is not readable. */
export function planFromRow(recordId: string, row: Partial<MyPlanRow>): Plan | null {
  if (typeof row.title !== 'string' || typeof row.start !== 'string' || typeof row.end !== 'string') return null
  const s = Date.parse(row.start)
  const e = Date.parse(row.end)
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null
  return { id: planIdFor(recordId), title: cleanTitle(row.title), start: new Date(s).toISOString(), end: new Date(e).toISOString(), allDay: row.allDay === 1, manual: true }
}
