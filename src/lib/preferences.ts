/**
 * Preferences vocabulary and normalization.
 *
 * `avoid` is a hard rule: activities carrying one of those tags are never
 * offered. `likedTags` only nudges ranking. A tag cannot be both.
 */

import { CATALOG } from '../catalog'

export interface TagOption {
  tag: string
  label: string
}

/** Things someone may not want. Phrased from their side. */
export const AVOID_OPTIONS: TagOption[] = [
  { tag: 'guided', label: 'Someone talking me through it' },
  { tag: 'music', label: 'Background music' },
  { tag: 'needs-supplies', label: 'Needing supplies (paper, paint, pens)' },
  { tag: 'eyes-closed', label: 'Closing my eyes' },
  { tag: 'follow-along', label: 'Copying someone’s movements' },
]

/** Things someone may enjoy. */
export const LIKE_OPTIONS: TagOption[] = [
  { tag: 'no-voice', label: 'Quiet, with no talking' },
  { tag: 'music', label: 'Calm music' },
  { tag: 'follow-along', label: 'Following along step by step' },
  { tag: 'guided', label: 'A voice guiding me' },
]

export const MINUTE_CHOICES = [5, 10, 15, 20, 30]

export interface Preferences {
  likedTags: string[]
  avoid: string[]
  defaultMinutes: number | null
}

export const DEFAULT_PREFERENCES: Preferences = { likedTags: [], avoid: [], defaultMinutes: null }

const KNOWN_TAGS = new Set(CATALOG.flatMap((a) => a.tags))

/**
 * Keep only known tags, no duplicates, and no tag in both lists (avoiding wins,
 * because a hard "no" should never be silently overridden by a "like").
 */
export function normalizePreferences(input: Partial<Preferences> | null | undefined): Preferences {
  const clean = (v: unknown): string[] =>
    Array.isArray(v) ? [...new Set(v.filter((t): t is string => typeof t === 'string' && KNOWN_TAGS.has(t)))] : []
  const avoid = clean(input?.avoid)
  const likedTags = clean(input?.likedTags).filter((t) => !avoid.includes(t))
  const m = input?.defaultMinutes
  return {
    likedTags,
    avoid,
    defaultMinutes: typeof m === 'number' && MINUTE_CHOICES.includes(m) ? m : null,
  }
}

/** True when the avoid list would leave too little to offer (a warning, not a block). */
export function avoidsTooMuch(avoid: string[]): boolean {
  const left = CATALOG.filter((a) => !a.tags.some((t) => avoid.includes(t)))
  return left.length < 6
}
