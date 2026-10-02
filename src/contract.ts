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
  /**
   * `auto` (default, "not sure"): a mix. A video where one helps, plain ideas otherwise.
   * `video`: only ideas that come with a video.
   * `none`: no screen at all; ideas only, no video search.
   */
  screen?: 'auto' | 'video' | 'none'
  /**
   * `in`: nothing outdoors. `out`: the idea is a walk to a place nearby (when time and energy allow it).
   * `auto` or omitted: a walk can be the idea in the mix when it fits.
   */
  place?: 'auto' | 'in' | 'out'
}

/** A real video, only ever built from retrieval results. */
export interface VideoRef {
  videoId: string
  title: string
  channel: string
  thumbnail: string
  durationSec: number
  watchUrl: string
  /** From YouTube's status when known. `false` means the owner blocked embedding. */
  embeddable?: boolean
}

export interface Pick {
  /** Id of the stored `suggestions` row, so the client can record feedback on it. */
  suggestionId: string
  activityId: string
  activityTitle: string
  /** `null` for screen-free ideas, which have no video. */
  video: VideoRef | null
  /** One or two sentences, written from supplied metadata only. */
  reason: string
  rank: number
}

/** Which parts of the pipeline fell back to the deterministic path. */
export type Degraded = 'interpret' | 'rank' | 'video'

export type VideoSourceUsed = 'integration' | 'google' | 'cache'

export type RecommendResponse =
  | {
      status: 'ok'
      checkinId: string
      /** Short, warm companion reply. */
      reply: string
      picks: Pick[]
      degraded: Degraded[]
      /** Where the videos came from this time. Shown only to the app owner. */
      sources?: VideoSourceUsed[]
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

/** One of the ideas on Home for right now: a video where one helps and was found, otherwise the idea alone. */
export interface HomeIdea {
  activityId: string
  activityTitle: string
  video: VideoRef | null
  reason: string
}

export type HomeIdeasResponse =
  | { status: 'ok'; ideas: HomeIdea[] }
  | { status: 'error'; message: string }
