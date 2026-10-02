/**
 * The sign-in-free preview: a few sample suggestions for someone who has not signed in. They come from the catalog and
 * a short list of videos chosen by hand, with no model and no search, so they cost nothing and are the same kind of
 * thing the app offers after sign-in. They are sample suggestions, not tailored to the person, and are labelled so.
 */

import { CATALOG, getActivity, type Activity } from '../catalog'
import { TIME_CHOICES } from '../lib/free-time'
import { dayOfYear } from '../lib/for-now'
import { filterCatalog } from '../recommend/filter'

/**
 * Videos picked by hand for the preview, one per video activity. Checked on 2 and 3 Oct 2026: each plays embedded (YouTube's
 * oEmbed answers 200) and is about the length of its activity (12:11, 5:29, 10:00, 12:10, 11:18, 13:05). Only the video id is kept here,
 * which is allowed to stay; the title shown is our own activity title and the picture is YouTube's standard thumbnail
 * for the id, so no YouTube metadata is stored. If one ever stops playing, the player says so and links to YouTube.
 */
export const SAMPLE_VIDEOS: { activityId: string; videoId: string }[] = [
  { activityId: 'desk-stretch', videoId: 'xRH1To_xyr8' },
  { activityId: 'body-scan', videoId: 'aH72AScs0qk' },
  { activityId: 'rain-sounds', videoId: 'RmmmY8KpVEs' },
  { activityId: 'chair-yoga', videoId: 'bMZ1mI1g1rM' },
  // The more active end, so that more energy really gets more active suggestions.
  { activityId: 'gentle-yoga', videoId: 'C2RAjUEAoLI' },
  { activityId: 'indoor-walk', videoId: 'bO6NNfX_1ns' },
]

export const thumbnailFor = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
export const watchUrlFor = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`

export interface PreviewInput {
  /** 1 (drained) to 5 (lots). */
  energy: number
  /** One of the check-in time choices. */
  minutes: number
}

export const DEFAULT_PREVIEW: PreviewInput = { energy: 3, minutes: 10 }

export const isEnergy = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5
export const isMinutes = (v: unknown): v is number => typeof v === 'number' && (TIME_CHOICES as readonly number[]).includes(v)

export interface PreviewPicks {
  /** Two ideas with written steps, a mix of kinds where possible. */
  ideas: Activity[]
  /** One playable video, if one of the samples suits the time and energy. */
  video: { activity: Activity; videoId: string } | null
}

const rotate = <T,>(list: T[], by: number): T[] => (list.length ? [...list.slice(by % list.length), ...list.slice(0, by % list.length)] : [])

/** The effort an activity should have for this energy: gentlest when drained, more active when there is plenty. */
const targetEffort = (energy: number) => (energy <= 2 ? 1 : energy === 3 ? 2 : 3)

/**
 * How well an activity matches what was chosen, higher is better. It must fit (the catalog filter has already made sure of
 * that); this chooses among what fits. Effort is the main thing, so a drained person sees the gentlest options and someone
 * with energy sees more active ones; then how close the time is to the middle of the activity's usual range, so five
 * minutes gets the quick things and thirty gets the longer ones.
 */
export function matchScore(a: Activity, input: PreviewInput): number {
  const effort = -Math.abs(a.effort - targetEffort(input.energy)) * 3 // a whole step of effort outweighs any difference in time
  const time = -Math.abs(input.minutes - (a.minMinutes + a.maxMinutes) / 2) / 8
  return effort + time
}

/** Matches this close to the best are all good ones, and they take turns by day so the page does not feel stuck. */
// Matches this close to the best (the same effort, a little different in time) take turns; a different effort never does.
const NEAR_BEST = 2.5

/** Best match first; among the near-best, a different one leads each day. */
function ranked<T extends { a: Activity }>(items: T[], input: PreviewInput, day: number): T[] {
  const scored = items.map((item, i) => ({ item, i, score: matchScore(item.a, input) })).sort((x, y) => y.score - x.score || x.i - y.i)
  if (scored.length === 0) return []
  const best = scored[0]!.score
  const near = scored.filter((x) => x.score >= best - NEAR_BEST).map((x) => x.item)
  const rest = scored.filter((x) => x.score < best - NEAR_BEST).map((x) => x.item)
  return [...rotate(near, day), ...rest]
}

/**
 * Two ideas and one video that fit the time and energy and match them best, steady within a day and different between days.
 * Different energy and time give visibly different suggestions. The walk is left out (it needs a location). Always
 * something, even for odd input, by falling back to the default.
 */
export function previewPicks(input: PreviewInput, now: Date): PreviewPicks {
  const safe = isEnergy(input.energy) && isMinutes(input.minutes) ? input : DEFAULT_PREVIEW
  // The turn depends on the day and on what was chosen, so a different energy or time leads with a different good match
  // (and the same choice is steady all day).
  const day = dayOfYear(now) + safe.energy * 7 + safe.minutes
  const fits = filterCatalog({ minutes: safe.minutes, energy: safe.energy }, CATALOG.filter((a) => !a.places)).activities
  const sample = ranked(
    SAMPLE_VIDEOS.map((s) => ({ s, a: fits.find((f) => f.id === s.activityId) })).filter((x): x is { s: (typeof SAMPLE_VIDEOS)[number]; a: Activity } => !!x.a),
    safe,
    day,
  )[0]
  const chosen = sample?.a
  // Ideas come from everything that fits (not only the written-only ones), so more energy gets more active ideas too; the
  // activity of the video is left out so the two are not the same thing, and an idea is shown with its steps, no video.
  const pool = ranked(
    fits.filter((a) => a.id !== chosen?.id).map((a) => ({ a })),
    safe,
    day,
  ).map((x) => x.a)
  // The best match, then the best match of a different kind, so the two are not twins.
  const first = pool[0]
  const second = pool.find((a) => first && a.id !== first.id && a.category !== first.category) ?? pool.find((a) => a.id !== first?.id)
  const ideas = [first, second].filter((a): a is Activity => !!a)
  return { ideas, video: sample ? { activity: sample.a, videoId: sample.s.videoId } : null }
}
