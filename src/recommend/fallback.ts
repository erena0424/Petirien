/**
 * Deterministic stand-ins used when a model call fails or returns something
 * invalid. No network, no randomness.
 */

import type { Activity, Goal } from '../catalog'
import type { VideoRef } from '../contract'

export interface Signals {
  goal?: Goal
  energy: number
  /** Activity ids the person found helpful before. */
  liked: string[]
  /** Activity ids the person said were not helpful. */
  disliked: string[]
  /** Tags the person said they enjoy (a nudge, not a rule). */
  likedTags?: string[]
}

function score(a: Activity, s: Signals): number {
  let n = 0
  if (s.goal && a.goals.includes(s.goal)) n += 2
  if (s.liked.includes(a.id)) n += 1
  n += 0.5 * a.tags.filter((t) => s.likedTags?.includes(t)).length
  if (s.disliked.includes(a.id)) n -= 2
  if (s.energy <= 2) n -= a.effort * 0.1 // nudge gentler options first
  return n
}

/** Best-first, then variety: prefer a different category for each next pick. */
export function deterministicPicks(options: Activity[], s: Signals, count = 3): Activity[] {
  const ranked = options
    .map((a, i) => ({ a, i, n: score(a, s) }))
    .sort((x, y) => y.n - x.n || x.i - y.i)
    .map((x) => x.a)

  const chosen: Activity[] = []
  const categories = new Set<string>()
  for (const a of ranked) {
    if (chosen.length >= count) break
    if (!categories.has(a.category)) {
      chosen.push(a)
      categories.add(a.category)
    }
  }
  for (const a of ranked) {
    if (chosen.length >= count) break
    if (!chosen.includes(a)) chosen.push(a)
  }
  return chosen
}

export const TEMPLATE_REPLY =
  'Here are a few things that fit your time and energy. Pick whatever feels easiest, or none of them.'

export function templateReason(a: Activity, v: VideoRef): string {
  const mins = Math.max(1, Math.round(v.durationSec / 60))
  return `${a.blurb} It runs about ${mins} minute${mins === 1 ? '' : 's'}.`
}

export function nextUtcMidnight(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return d.toISOString()
}
