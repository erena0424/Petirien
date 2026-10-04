/**
 * Opening hours for places. Google Maps (through SerpApi) gives each place its weekly hours ("operating_hours":
 * "8 AM–3 PM", "8:30 AM–5 PM", "11 AM–2 PM, 4–8 PM", "10 AM–12 AM", "Closed", ...) as well as a one-line "Open · Closes 3 PM"
 * that is only true at the moment of the search. We keep the weekly hours with the place and work out open or closed
 * from the clock when it is shown, so a place found hours ago is still judged by the time it is now.
 *
 * The clock used is the person's own. A place within walking distance is in their time zone, which is the one case
 * this is built for.
 */

/** Open intervals of one day, in minutes after midnight. An end past 1440 runs into the next morning. */
export type DayHours = Array<[number, number]>
/** Sunday first, like Date#getDay. `null` for a day whose hours could not be read. */
export type WeeklyHours = Array<DayHours | null>

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MIN_DAY = 24 * 60
/** Closing within this long counts as "closes soon". */
export const CLOSING_SOON_MIN = 45

const clean = (v: string) => v.replace(/[   ]/g, ' ').replace(/[–—−]/g, '-').replace(/\s+/g, ' ').trim()

/** "8 AM", "8:30 PM", or "4" (no AM/PM) to minutes. `period` fills in a missing AM/PM. */
function minutes(t: string, period?: 'AM' | 'PM'): { min: number; period?: 'AM' | 'PM' } | null {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(t.trim())
  if (!m) return null
  const h = Number(m[1])
  const mm = m[2] ? Number(m[2]) : 0
  if (h < 1 || h > 12 || mm > 59) return null
  const p = (m[3]?.toUpperCase() as 'AM' | 'PM' | undefined) ?? period
  if (!p) return null
  return { min: ((h % 12) + (p === 'PM' ? 12 : 0)) * 60 + mm, period: p }
}

function parseRange(range: string): [number, number] | null {
  const parts = range.split('-')
  if (parts.length !== 2) return null
  const end = minutes(parts[1]!)
  if (!end) return null
  let start = minutes(parts[0]!, end.period)
  if (!start) return null
  // "11-2 PM" means 11 AM to 2 PM: when borrowing the end's PM makes the start later than the end, the start is the morning.
  if (!/AM|PM/i.test(parts[0]!) && start.min >= end.min && end.period === 'PM') start = { ...start, min: start.min - 12 * 60 }
  let e = end.min
  if (e <= start.min) e += MIN_DAY // "10 AM-12 AM" and "8 AM-12:30 AM" run to or past midnight
  return [start.min, e]
}

function parseDay(value: unknown): DayHours | null {
  if (typeof value !== 'string') return null
  const t = clean(value)
  if (/^closed$/i.test(t)) return []
  if (/^open 24 hours$/i.test(t)) return [[0, MIN_DAY]]
  const out: DayHours = []
  for (const r of t.split(',')) {
    const range = parseRange(r.trim())
    if (!range) return null
    out.push(range)
  }
  return out.length > 0 ? out : null
}

/** The weekly hours from a response's `operating_hours`, or null when there are none to read. */
export function parseHours(v: unknown): WeeklyHours | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const week = DAYS.map((d) => parseDay(o[d]))
  return week.some((d) => d !== null) ? week : null
}

export interface OpenAt {
  status: 'open' | 'closing-soon' | 'closed' | 'unknown'
  /** When open: the minute (after midnight, possibly past 1440) it closes. */
  closesAt?: number
  /** When closed: the next opening today, if any (minutes after midnight). */
  opensAt?: number
}

/** Whether the place is open at this moment, by its weekly hours. */
export function openAt(hours: WeeklyHours, now: Date): OpenAt {
  const day = now.getDay()
  const t = now.getHours() * 60 + now.getMinutes()
  const today = hours[day]
  const yesterday = hours[(day + 6) % 7]
  if (today === null && yesterday === null) return { status: 'unknown' }
  // Hours that ran past midnight from yesterday.
  for (const [, end] of yesterday ?? []) {
    if (end > MIN_DAY && t < end - MIN_DAY) return end - MIN_DAY - t <= CLOSING_SOON_MIN ? { status: 'closing-soon', closesAt: end - MIN_DAY } : { status: 'open', closesAt: end - MIN_DAY }
  }
  if (today === null) return { status: 'unknown' }
  for (const [start, end] of today) {
    if (t >= start && t < end) return end - t <= CLOSING_SOON_MIN ? { status: 'closing-soon', closesAt: end } : { status: 'open', closesAt: end }
  }
  const later = today.map(([s]) => s).filter((s) => s > t).sort((a, b) => a - b)[0]
  return later !== undefined ? { status: 'closed', opensAt: later } : { status: 'closed' }
}

/** 900 -> "3 PM", 930 -> "3:30 PM", 1500 (past midnight) -> "1 AM". */
export function clockText(min: number): string {
  const m = ((min % MIN_DAY) + MIN_DAY) % MIN_DAY
  const h = Math.floor(m / 60)
  const mm = m % 60
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}${mm ? `:${String(mm).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`
}
