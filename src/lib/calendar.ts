/**
 * Calendar and streak helpers for "days you checked in".
 *
 * Days are the viewer's LOCAL days (a check-in at 11:50 PM counts for that
 * evening). Streak wording is deliberately gentle: it only ever celebrates, and
 * a missed day never produces a message about losing anything.
 */

export interface DayCell {
  key: string
  day: number
  inMonth: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Local YYYY-MM-DD. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Check-in counts per local day, from ISO timestamps. Bad dates are ignored. */
export function checkinDays(isoDates: string[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const iso of isoDates) {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) continue
    const k = dayKey(d)
    out.set(k, (out.get(k) ?? 0) + 1)
  }
  return out
}

/** Weeks (Sunday first) covering the month, padded with neighbouring days. `month` is 0-11. */
export function monthGrid(year: number, month: number): DayCell[][] {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  const weeks: DayCell[][] = []
  const cursor = new Date(start)
  do {
    const week: DayCell[] = []
    for (let i = 0; i < 7; i++) {
      week.push({ key: dayKey(cursor), day: cursor.getDate(), inMonth: cursor.getMonth() === month })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  } while (cursor.getMonth() === month)
  return weeks
}

/**
 * Consecutive days with a check-in, counting back from today. If today has none
 * yet, counting starts from yesterday, so the day is not "lost" before it ends.
 */
export function currentStreak(days: Set<string>, today: Date): number {
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let n = 0
  while (days.has(dayKey(cursor))) {
    n++
    cursor.setDate(cursor.getDate() - 1)
  }
  return n
}

export function daysInMonthWithCheckin(days: Set<string>, year: number, month: number): number {
  const prefix = `${year}-${pad(month + 1)}-`
  let n = 0
  for (const k of days) if (k.startsWith(prefix)) n++
  return n
}

/** Short, kind, and only ever positive. Returns null when there is nothing to celebrate yet. */
export function encouragement(streak: number, monthCount: number): string | null {
  if (streak >= 2) return `${streak} days in a row. That counts.`
  if (monthCount >= 2) return `${monthCount} days this month you showed up for yourself.`
  if (monthCount === 1) return 'You checked in this month. That counts.'
  return null
}
