/**
 * Where video search and details come from: DeepSpace's YouTube integration (`youtube/search-videos`,
 * `youtube/get-video-details`), and only that. It is billed to the app owner (src/integrations.ts), never to a visitor,
 * and bounded by an app-wide daily limit (src/server/owner-cap.ts). It returns real results and accepts several ids at
 * once, but has no embeddable flag and no safe-search switch, and search results carry no length (details do).
 * A video that turns out not to play is handled in the page ("Open on YouTube"). When the integration fails or the
 * daily limit is reached, the app still shows plain ideas and any cached videos.
 */

import type { ActionTools } from 'deepspace/worker'

export interface VideoSource {
  /** Raw search items, or null when the source failed. `[]` means it answered with no results. */
  search(q: string): Promise<unknown[] | null>
  /** Raw detail items for the ids, or null when the source failed. */
  details(ids: string[]): Promise<unknown[] | null>
}

type Raw = Record<string, unknown>

const isRaw = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v)

export type SourceUsed = 'integration' | 'google'

/** The DeepSpace integration as a VideoSource. Billing follows src/integrations.ts. */
export function integrationSource(tools: Pick<ActionTools, 'integration'>, onUse?: (s: SourceUsed) => void): VideoSource {
  const videos = (r: { success: boolean; data?: unknown }): unknown[] | null => {
    const out = r.success && isRaw(r.data) && Array.isArray(r.data.videos) ? (r.data.videos as unknown[]) : null
    if (out) onUse?.('integration')
    return out
  }
  return {
    async search(q) {
      return videos(await tools.integration<unknown>('youtube/search-videos', { q, maxResults: 6, regionCode: 'US' }))
    },
    async details(ids) {
      // Several ids in one call is supported (verified 2026-10-01).
      return videos(await tools.integration<unknown>('youtube/get-video-details', { id: ids.join(',') }))
    },
  }
}
