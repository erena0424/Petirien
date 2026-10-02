/**
 * Layout for the iCal-style calendar: where each event sits in a day column, which events share a row of
 * columns, which all-day events go in the strip on top, and which range of the calendar to ask Google for.
 * Pure, so it is tested without a browser.
 */

import type { Plan } from '../plans/plan'
import { addDays, dayKey, monthGrid, startOfDay, weekDays, type View } from './calendar'

export const MINUTES_PER_DAY = 24 * 60
/** Pixels per hour in the time grid. */
export const HOUR_PX = 48
/** Even a five minute event gets a block you can see and press. */
export const MIN_BLOCK_MINUTES = 30

export interface Block {
  plan: Plan
  /** Minutes since midnight, clipped to this day. */
  startMin: number
  endMin: number
  /** Which side-by-side column, and how many columns this event's cluster has. */
  lane: number
  lanes: number
}

const ts = (iso: string) => Date.parse(iso)

/** Timed events that touch this day, clipped to it. All-day events are not here. */
function timedOn(plans: Plan[], day: Date): { plan: Plan; startMin: number; endMin: number }[] {
  const d0 = startOfDay(day).getTime()
  const d1 = addDays(startOfDay(day), 1).getTime()
  const out: { plan: Plan; startMin: number; endMin: number }[] = []
  for (const plan of plans) {
    if (plan.allDay || !plan.end) continue
    const s = ts(plan.start)
    const e = ts(plan.end)
    if (!(e > d0 && s < d1)) continue
    const startMin = Math.max(0, Math.round((Math.max(s, d0) - d0) / 60000))
    const rawEnd = Math.round((Math.min(e, d1) - d0) / 60000)
    out.push({ plan, startMin, endMin: Math.min(MINUTES_PER_DAY, Math.max(rawEnd, startMin + MIN_BLOCK_MINUTES)) })
  }
  return out.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)
}

/**
 * Blocks for one day. Events that overlap in time are split into side-by-side lanes, so nothing is hidden
 * behind anything else: each cluster of overlapping events shares the width equally.
 */
export function layoutDay(plans: Plan[], day: Date): Block[] {
  const items = timedOn(plans, day)
  const blocks: Block[] = []
  let cluster: typeof items = []
  let clusterEnd = -1
  const flush = () => {
    const laneEnds: number[] = []
    const placed = cluster.map((it) => {
      let lane = laneEnds.findIndex((end) => end <= it.startMin)
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push(it.endMin)
      } else laneEnds[lane] = it.endMin
      return { it, lane }
    })
    for (const { it, lane } of placed) blocks.push({ ...it, lane, lanes: laneEnds.length })
    cluster = []
    clusterEnd = -1
  }
  for (const it of items) {
    if (cluster.length > 0 && it.startMin >= clusterEnd) flush()
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.endMin)
  }
  if (cluster.length > 0) flush()
  return blocks
}

/** All-day events (and ones that run past midnight into whole days) that cover this day. */
export function allDayOn(plans: Plan[], day: Date): Plan[] {
  const d0 = startOfDay(day).getTime()
  const d1 = addDays(startOfDay(day), 1).getTime()
  return plans.filter((p) => p.allDay && p.end && ts(p.end) > d0 && ts(p.start) < d1)
}

/** Every event (timed or all-day) that touches the day, earliest first: for a month cell or an agenda. */
export function eventsOn(plans: Plan[], day: Date): Plan[] {
  const d0 = startOfDay(day).getTime()
  const d1 = addDays(startOfDay(day), 1).getTime()
  return plans
    .filter((p) => p.end && ts(p.end) > d0 && ts(p.start) < d1)
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || ts(a.start) - ts(b.start))
}

/** Where a block sits in the grid, as CSS percentages and pixels. */
export function blockBox(b: Block): { top: number; height: number; left: string; width: string } {
  const px = HOUR_PX / 60
  return {
    top: b.startMin * px,
    height: Math.max(20, (b.endMin - b.startMin) * px - 2),
    left: `${(b.lane / b.lanes) * 100}%`,
    width: `${100 / b.lanes}%`,
  }
}

/** The part of the calendar to ask Google for to fill a view: the whole visible grid, as ISO times. */
export function fetchRange(view: View, anchor: Date): { from: Date; to: Date } {
  if (view === 'month') {
    const grid = monthGrid(anchor)
    return { from: grid[0]![0]!, to: addDays(grid[grid.length - 1]![6]!, 1) }
  }
  if (view === 'week') {
    const days = weekDays(anchor)
    return { from: days[0]!, to: addDays(days[6]!, 1) }
  }
  const d = startOfDay(anchor)
  return { from: d, to: addDays(d, 1) }
}

export interface Loaded {
  from: number
  to: number
  plans: Plan[]
}

/** A range already loaded that covers the one wanted, so moving around never asks (or pays) twice. */
export function covering(loaded: Loaded[], from: Date, to: Date): Loaded | undefined {
  return loaded.find((l) => l.from <= from.getTime() && l.to >= to.getTime())
}

/** Which event ids have at least one journal entry, so the calendar can mark them. */
export function reflectedIds(entries: { eventId?: string }[]): Set<string> {
  return new Set(entries.map((e) => e.eventId).filter((id): id is string => typeof id === 'string' && id.length > 0))
}

/** "9:00 AM to 10:30 AM", or "All day". */
export function timeRange(p: Plan): string {
  if (p.allDay) return 'All day'
  const t = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return p.end ? `${t(p.start)} to ${t(p.end)}` : t(p.start)
}

export { dayKey }
