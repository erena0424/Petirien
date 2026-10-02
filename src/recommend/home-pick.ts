/**
 * Picking the Home ideas for right now: two gentle, short video activities by time of day. Kept apart from the
 * server code that fetches the videos, so the browser can use it too (signed-out visitors see these as plain ideas).
 */

import { CATALOG, type Activity } from '../catalog'
import { PREFERRED, dayOfYear, partOfDay } from '../lib/for-now'

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
