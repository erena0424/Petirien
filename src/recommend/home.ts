/**
 * Home ideas for right now: two videos worth watching and nothing to fill in first. No check-in, no history, no
 * saved items needed, so a brand new person sees real ideas the moment they arrive. Chosen from the catalog by the
 * time of day (no model), then each video comes from the same cached search the check-in uses, so most visits cost
 * nothing.
 */

import { CATALOG, type Activity } from '../catalog'
import type { HomeIdea, HomeIdeasResponse } from '../contract'
import { PREFERRED, dayOfYear, partOfDay } from '../lib/for-now'
import { DAILY_CAP, retrieve, type Deps } from './pipeline'

export const HOME_VIDEOS = 2
/** Short enough to watch right now. */
export const HOME_MINUTES = 15

/**
 * Two video activities that suit the time of day, gentle enough (effort 2 or less) and short enough, avoiding
 * anything the person said they avoid. The pair rotates by day so Home changes without ever being random.
 */
export function chooseHomeActivities(now: Date, avoid: string[] = [], count = HOME_VIDEOS): Activity[] {
  const blocked = new Set(avoid)
  const fits = (a: Activity) => a.video && a.effort <= 2 && a.minMinutes <= HOME_MINUTES && !a.tags.some((t) => blocked.has(t))
  const preferred = PREFERRED[partOfDay(now)]
  const pool = CATALOG.filter((a) => fits(a) && preferred.includes(a.category))
  const rest = CATALOG.filter((a) => fits(a) && !pool.includes(a))
  const day = dayOfYear(now)
  // What suits this time of day comes first (rotating by day); if there are not enough, top up from anything else that fits.
  const rotate = (list: Activity[]) => (list.length ? [...list.slice(day % list.length), ...list.slice(0, day % list.length)] : [])
  return [...rotate(pool), ...rotate(rest)].slice(0, count)
}

export async function homeIdeas(deps: Deps): Promise<HomeIdeasResponse> {
  const now = deps.now()
  const ctx = await deps.loadContext()
  const chosen = chooseHomeActivities(now, [...ctx.prefs.avoid, ...ctx.prefs.dislikedTags])
  const capped = !ctx.exempt && ctx.usageToday >= DAILY_CAP // the same daily limit as the check-in: no paid search past it

  // A paid search happens only for an activity not already cached; that counts once toward the daily limit.
  let paid = false
  const ideas: HomeIdea[] = []
  for (const a of chosen) {
    let video = null
    if (!capped) {
      if ((await deps.cacheGet(a.searchQuery)) === null) paid = true
      const r = await retrieve(deps, a, HOME_MINUTES)
      video = r.ok ? (r.videos[0] ?? null) : null
    }
    ideas.push({ activityId: a.id, activityTitle: a.title, video, reason: a.blurb })
  }
  if (paid) await deps.bumpUsage(now.toISOString().slice(0, 10))
  return { status: 'ok', ideas }
}
