/**
 * Picking a time on the calendar by pointing: where a click or a drag landed becomes a start and an end. Pure, so the
 * arithmetic is tested without a browser. Times are minutes after midnight.
 */

const DAY = 24 * 60
/** Drags snap to this many minutes. */
export const SNAP_MIN = 15
/** A click (no drag) makes an event this long, starting at the half hour it landed in. */
export const CLICK_MIN = 60
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** The minute a vertical position inside a day column stands for. */
export const minuteAt = (y: number, hourPx: number) => clamp((y / hourPx) * 60, 0, DAY)

/** The slot for a plain click: the half hour it landed in, for an hour (never past midnight). */
export function clickSlot(min: number): { start: number; end: number } {
  const start = clamp(Math.floor(min / 30) * 30, 0, DAY - 30)
  return { start, end: Math.min(DAY, start + CLICK_MIN) }
}

/** The slot for a drag from one point to another (either direction), snapped to a quarter hour; null when it barely moved (that is a click). */
export function dragSlot(a: number, b: number): { start: number; end: number } | null {
  if (Math.abs(a - b) < 10) return null // about 8 pixels: a click that wobbled, not a drag
  const lo = clamp(Math.round(Math.min(a, b) / SNAP_MIN) * SNAP_MIN, 0, DAY)
  const hi = clamp(Math.round(Math.max(a, b) / SNAP_MIN) * SNAP_MIN, 0, DAY)
  return hi - lo >= SNAP_MIN ? { start: lo, end: hi } : null
}

/** 570 -> "09:30". Midnight at the end of the day is "23:59", the latest time a day can hold. */
export function hhmm(min: number): string {
  const m = min >= DAY ? DAY - 1 : Math.max(0, Math.round(min))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** 570 -> "9:30 AM" for showing a range being dragged. */
export function clockLabel(min: number): string {
  const m = ((Math.round(min) % DAY) + DAY) % DAY
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h % 12 === 0 ? 12 : h % 12}${mm ? `:${String(mm).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`
}
