/**
 * Home ideas for right now: two videos worth watching and nothing to fill in first. No check-in, no history, no
 * saved items needed, so a brand new person sees real ideas the moment they arrive. Chosen from the catalog by the
 * time of day (no model), then each video comes from the same cached search the check-in uses, so most visits cost
 * nothing.
 */

import type { HomeIdea, HomeIdeasResponse } from '../contract'
import { DAILY_CAP, retrieve, type Deps } from './pipeline'
import { HOME_MINUTES, chooseHomeActivities } from './home-pick'

export { HOME_MINUTES, HOME_VIDEOS, chooseHomeActivities } from './home-pick'

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
