/**
 * "Something for right now": a small, deterministic suggestion that follows the
 * time of day. No model call, no cost, so Home is never empty.
 */

import { CATALOG, getActivity, type Activity, type Category } from '../catalog'

export type Part = 'morning' | 'afternoon' | 'evening' | 'night'

/** Local hour: 5-10 morning, 11-16 afternoon, 17-21 evening, otherwise night. */
export function partOfDay(d: Date): Part {
  const h = d.getHours()
  if (h >= 5 && h < 11) return 'morning'
  if (h >= 11 && h < 17) return 'afternoon'
  if (h >= 17 && h < 22) return 'evening'
  return 'night'
}

export const PREFERRED: Record<Part, Category[]> = {
  morning: ['movement', 'meditation', 'everyday'],
  afternoon: ['movement', 'creative', 'everyday'],
  evening: ['meditation', 'creative', 'everyday'],
  night: ['meditation'],
}

export const PART_LABEL: Record<Part, string> = {
  morning: 'this morning',
  afternoon: 'this afternoon',
  evening: 'this evening',
  night: 'tonight',
}

export const GREETING: Record<Part, string> = {
  morning: 'Good morning.',
  afternoon: 'Good afternoon.',
  evening: 'Good evening.',
  night: 'Hello, night owl.',
}

export function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000)
}

/**
 * One low-effort activity that suits the time of day and respects what the
 * person avoids. Rotates daily so it does not repeat. Null if everything is avoided.
 */
export function pickForNow(opts: { now: Date; avoid?: string[]; skipIds?: string[] }): Activity | null {
  const avoid = new Set(opts.avoid ?? [])
  const ok = (a: Activity) => a.effort === 1 && !a.tags.some((t) => avoid.has(t)) && !(opts.skipIds ?? []).includes(a.id)
  const preferred = PREFERRED[partOfDay(opts.now)]
  // The one written suggestion is an idea without a video (the videos for right now have their own cards). Only when
  // nothing like that fits what the person avoids does it fall back to any gentle activity, so Home is never empty.
  const tiers = [
    CATALOG.filter((a) => ok(a) && !a.video && preferred.includes(a.category)),
    CATALOG.filter((a) => ok(a) && !a.video),
    CATALOG.filter((a) => ok(a) && preferred.includes(a.category)),
    CATALOG.filter(ok),
  ]
  const list = tiers.find((t) => t.length > 0)
  if (!list) return null
  return list[dayOfYear(opts.now) % list.length] ?? null
}

export interface SavedLike {
  activityId?: string
  createdAt: string
}

/** Saved items first when they suit the time of day, then the rest, each group newest first. */
export function orderSavedForNow<T extends SavedLike>(items: T[], now: Date): { item: T; fits: boolean }[] {
  const preferred = PREFERRED[partOfDay(now)]
  const fits = (i: T) => {
    const c = i.activityId ? getActivity(i.activityId)?.category : undefined
    return !!c && preferred.includes(c)
  }
  const newestFirst = [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return [...newestFirst.filter(fits).map((item) => ({ item, fits: true })), ...newestFirst.filter((i) => !fits(i)).map((item) => ({ item, fits: false }))]
}
