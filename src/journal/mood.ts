/**
 * Mood and energy over time, for the Journal's chart. Pure: no React, no storage. Check-ins carry a 1 to 5 mood and
 * a 1 to 5 energy; this turns them into points, daily averages, a plain sentence, and the shapes the chart draws.
 * Nothing here judges: low is not "bad", and the words come from the same scales as the check-in form.
 */

import { ENERGY, MOOD } from '../lib/labels'
import { addDays, dayKey, startOfDay, weekDays, type View } from './calendar'

export interface CheckinPoint {
  /** Milliseconds. */
  at: number
  mood: number
  energy: number
}

const rating = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 1 && v <= 5

/** Check-in rows to points, oldest first. A row without a usable date, mood or energy is skipped. */
export function toPoints(rows: { createdAt: string; data: { mood?: unknown; energy?: unknown } }[]): CheckinPoint[] {
  const out: CheckinPoint[] = []
  for (const r of rows) {
    const at = Date.parse(r.createdAt)
    if (!Number.isFinite(at) || !rating(r.data.mood) || !rating(r.data.energy)) continue
    out.push({ at, mood: r.data.mood, energy: r.data.energy })
  }
  return out.sort((a, b) => a.at - b.at)
}

export function inRange(points: CheckinPoint[], from: Date, to: Date): CheckinPoint[] {
  return points.filter((p) => p.at >= from.getTime() && p.at < to.getTime())
}

export interface DayAverage {
  day: string
  /** Noon of that day, so a daily point sits in the middle of its day on the chart. */
  at: number
  mood: number
  energy: number
  count: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** One point per day: the average of that day's check-ins, so a busy day does not crowd the chart. */
export function dailyAverages(points: CheckinPoint[]): DayAverage[] {
  const days = new Map<string, CheckinPoint[]>()
  for (const p of points) {
    const k = dayKey(new Date(p.at))
    days.set(k, [...(days.get(k) ?? []), p])
  }
  return [...days.entries()]
    .map(([day, list]) => {
      const d = startOfDay(new Date(list[0]!.at))
      return {
        day,
        at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime(),
        mood: round1(list.reduce((n, p) => n + p.mood, 0) / list.length),
        energy: round1(list.reduce((n, p) => n + p.energy, 0) / list.length),
        count: list.length,
      }
    })
    .sort((a, b) => a.at - b.at)
}

/** The stretch of time the chart covers for a view: the month, the week, the day, or the last 30 days for the list. */
export function chartRange(view: View, anchor: Date, now: Date): { from: Date; to: Date } {
  if (view === 'month') {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    return { from: first, to: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1) }
  }
  if (view === 'week') {
    const days = weekDays(anchor)
    return { from: days[0]!, to: addDays(days[6]!, 1) }
  }
  if (view === 'day') return { from: startOfDay(anchor), to: addDays(startOfDay(anchor), 1) }
  return { from: addDays(startOfDay(now), -29), to: addDays(startOfDay(now), 1) }
}

const nearest = (scale: { value: number; label: string }[], avg: number) => scale.reduce((best, s) => (Math.abs(s.value - avg) < Math.abs(best.value - avg) ? s : best), scale[0]!).label

export interface Summary {
  count: number
  avgMood: number
  avgEnergy: number
  text: string
}

/** A calm sentence about the range, in the words of the scales. No verdicts. */
export function summarize(points: CheckinPoint[]): Summary | null {
  if (points.length === 0) return null
  const avgMood = round1(points.reduce((n, p) => n + p.mood, 0) / points.length)
  const avgEnergy = round1(points.reduce((n, p) => n + p.energy, 0) / points.length)
  const mood = nearest(MOOD, avgMood).toLowerCase()
  const energy = nearest(ENERGY, avgEnergy).toLowerCase()
  const text =
    points.length === 1
      ? `One check-in: feeling ${mood}, ${energy} energy.`
      : `Across ${points.length} check-ins, you mostly felt ${mood}, with ${energy} energy.`
  return { count: points.length, avgMood, avgEnergy, text }
}

export interface Dims {
  width: number
  height: number
  padLeft: number
  padRight: number
  padTop: number
  padBottom: number
}

export interface XY {
  x: number
  y: number
}

/** Where a time and a 1 to 5 value go on the chart. 5 is at the top. */
export function toXY(at: number, value: number, from: Date, to: Date, d: Dims): XY {
  const span = Math.max(1, to.getTime() - from.getTime())
  const t = Math.min(1, Math.max(0, (at - from.getTime()) / span))
  const v = Math.min(5, Math.max(1, value))
  return {
    x: d.padLeft + t * (d.width - d.padLeft - d.padRight),
    y: d.padTop + ((5 - v) / 4) * (d.height - d.padTop - d.padBottom),
  }
}

/** An SVG path through the points in order; empty for none, a single move for one. */
export function linePath(points: XY[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${round1(p.x)} ${round1(p.y)}`).join(' ')
}

