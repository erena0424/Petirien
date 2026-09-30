/**
 * Deterministic hard filter for the catalog. No LLM, no network.
 *
 * Explicit constraints (time, energy, dislikes, avoid, exclusions) are never
 * relaxed. Only the optional goal is relaxed, and only when fewer than
 * MIN_RESULTS activities match it.
 */

import { CATALOG, type Activity, type Effort, type Goal } from '../catalog'

export const MIN_RESULTS = 2

export interface FilterInput {
  /** Minutes the person has. */
  minutes: number
  /** 1 (very low) to 5 (high). */
  energy: number
  goal?: Goal
  /** Tags the person prefers not to see. */
  dislikedTags?: string[]
  /** Tags that must never appear (e.g. 'guided', 'needs-supplies'). */
  avoid?: string[]
  /** Activity ids already rejected this session. */
  excludeIds?: string[]
}

export interface FilterResult {
  activities: Activity[]
  /** True when the goal was dropped because too few activities matched it. */
  relaxedGoal: boolean
}

/** Highest effort we will offer at a given energy level. */
export function effortCap(energy: number): Effort {
  if (energy <= 2) return 1
  if (energy === 3) return 2
  return 3
}

function passesConstraints(a: Activity, input: FilterInput): boolean {
  const blocked = new Set([...(input.dislikedTags ?? []), ...(input.avoid ?? [])])
  return (
    a.minMinutes <= input.minutes &&
    a.effort <= effortCap(input.energy) &&
    !a.tags.some((t) => blocked.has(t)) &&
    !(input.excludeIds ?? []).includes(a.id)
  )
}

export function filterCatalog(input: FilterInput, catalog: Activity[] = CATALOG): FilterResult {
  const fits = catalog.filter((a) => passesConstraints(a, input))
  if (!input.goal) return { activities: fits, relaxedGoal: false }

  const onGoal = fits.filter((a) => a.goals.includes(input.goal as Goal))
  if (onGoal.length >= MIN_RESULTS) return { activities: onGoal, relaxedGoal: false }
  return { activities: fits, relaxedGoal: fits.length > onGoal.length }
}
