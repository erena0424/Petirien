/**
 * Saved-video rules.
 *
 * YouTube's developer policy lets us keep API metadata (title, channel,
 * thumbnail, length) for at most 30 days unless it is refreshed; the video id
 * and the person's own note have no such limit. So:
 *  - after REFRESH_AFTER_DAYS we try to refresh it (see actions/saved.ts);
 *  - after MAX_METADATA_DAYS without a refresh we stop showing it and show a
 *    plain "Saved video" with the person's note and a link, until it refreshes.
 */

import { CATALOG, getActivity, type Category } from '../catalog'
import type { VideoRef } from '../contract'

export const REFRESH_AFTER_DAYS = 25
export const MAX_METADATA_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

export type Availability = 'ok' | 'no_embed' | 'gone'

export interface SavedData {
  videoId: string
  title?: string
  channel?: string
  thumbnail?: string
  durationSec?: number
  activityId?: string
  userNote?: string
  /** ms since epoch of the last time metadata was fetched from YouTube. */
  metaRefreshedAt?: number
  availability?: Availability
}

function ageDays(d: SavedData, now: number): number {
  if (typeof d.metaRefreshedAt !== 'number') return Infinity
  return (now - d.metaRefreshedAt) / DAY_MS
}

/** Time to try a refresh. Gone videos have no metadata left to refresh. */
export function needsRefresh(d: SavedData, now: number = Date.now()): boolean {
  return d.availability !== 'gone' && ageDays(d, now) >= REFRESH_AFTER_DAYS
}

/** Past the 30-day limit with no refresh: do not display the stored metadata. */
export function metaExpired(d: SavedData, now: number = Date.now()): boolean {
  return d.availability !== 'gone' && ageDays(d, now) > MAX_METADATA_DAYS
}

export interface DisplayMeta {
  title: string
  channel: string
  thumbnail: string | null
  durationSec: number
  /** True when the stored details are being withheld. */
  withheld: boolean
}

export function displayMeta(d: SavedData, now: number = Date.now()): DisplayMeta {
  if (d.availability === 'gone') {
    return { title: 'No longer available', channel: '', thumbnail: null, durationSec: 0, withheld: false }
  }
  if (metaExpired(d, now) || !d.title) {
    return { title: 'Saved video', channel: '', thumbnail: null, durationSec: 0, withheld: metaExpired(d, now) }
  }
  return {
    title: d.title,
    channel: d.channel ?? '',
    thumbnail: d.thumbnail || null,
    durationSec: d.durationSec ?? 0,
    withheld: false,
  }
}

export function toSavedData(video: VideoRef, activityId: string, now: number = Date.now()): SavedData {
  return {
    videoId: video.videoId,
    title: video.title,
    channel: video.channel,
    thumbnail: video.thumbnail,
    durationSec: video.durationSec,
    activityId,
    metaRefreshedAt: now,
    availability: 'ok',
  }
}

export function categoryOf(activityId: string | undefined): Category | undefined {
  return activityId ? getActivity(activityId)?.category : undefined
}

export const CATEGORY_LABELS: Record<Category, string> = {
  meditation: 'Meditation',
  movement: 'Movement',
  creative: 'Creative',
}

/** Categories that actually appear in the catalog, in a stable order. */
export const CATEGORY_ORDER: Category[] = (['meditation', 'movement', 'creative'] as Category[]).filter((c) =>
  CATALOG.some((a) => a.category === c),
)
