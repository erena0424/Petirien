/**
 * Contract for the `recommend` server action, shared by worker and client.
 * Change this only through tech-lead: both sides depend on it.
 */

import type { Goal } from './catalog'

export interface CheckinInput {
  /** 1 (low) to 5 (good). */
  mood: number
  /** 1 (very low) to 5 (high). */
  energy: number
  minutes: number
  goal?: Goal
  /** Optional free text. Never logged. */
  note?: string
  /** Activity ids rejected earlier in this session ("none of these fit"). */
  excludeActivityIds?: string[]
  /** Existing check-in to extend when re-running after "none fit". */
  checkinId?: string
}

/** A real video, only ever built from retrieval results. */
export interface VideoRef {
  videoId: string
  title: string
  channel: string
  thumbnail: string
  durationSec: number
  watchUrl: string
}

export interface Pick {
  activityId: string
  activityTitle: string
  video: VideoRef
  /** One or two sentences, written from supplied metadata only. */
  reason: string
  rank: number
}

/** Which parts of the pipeline fell back to the deterministic path. */
export type Degraded = 'interpret' | 'rank' | 'video'

export type RecommendResponse =
  | {
      status: 'ok'
      checkinId: string
      /** Short, warm companion reply. */
      reply: string
      picks: Pick[]
      degraded: Degraded[]
    }
  /** Activities found but video retrieval failed or was empty. */
  | {
      status: 'no_video'
      checkinId: string
      reply: string
      activities: { activityId: string; title: string; blurb: string }[]
    }
  /** Crisis language detected: static support card, no recommendations. */
  | { status: 'support'; checkinId: string }
  /** Nothing in the catalog fits the constraints. */
  | { status: 'nothing_fits'; checkinId: string; reply: string }
  /** Per-user daily limit reached. */
  | { status: 'capped'; resetsAt: string }
  | { status: 'error'; message: string }
