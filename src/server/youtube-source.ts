/**
 * Where video search and details come from: the app's own Google key (`YOUTUBE_API_KEY`, a DeepSpace secret), and only
 * that. The DeepSpace `youtube/*` integration is no longer used: it was billed to each signed-in person (about 1.3 cents a
 * search), and the app should not need a visitor to hold credits. The cost is Google's daily quota (100 searches a
 * day); results are cached and shared for a day, so the pipeline needs about one search per activity per day, and
 * when the quota or the key is unavailable the app still works with plain ideas and any cached videos.
 */

export interface VideoSource {
  /** Raw search items, or null when the source failed. `[]` means it answered with no results. */
  search(q: string): Promise<unknown[] | null>
  /** Raw detail items for the ids, or null when the source failed. */
  details(ids: string[]): Promise<unknown[] | null>
}

export type SourceUsed = 'integration' | 'google'

/** The app's own Google key as the only source. With no key, nothing can be searched (null, as for any failure). */
export function ownKeySource(
  key: string | undefined,
  api: { search(key: string, q: string): Promise<unknown[] | null>; details(key: string, ids: string[]): Promise<unknown[] | null> },
  onUse?: (s: SourceUsed) => void,
): VideoSource {
  const used = (out: unknown[] | null) => {
    if (out) onUse?.('google')
    return out
  }
  return {
    async search(q) {
      return key ? used(await api.search(key, q)) : null
    },
    async details(ids) {
      return key ? used(await api.details(key, ids)) : null
    },
  }
}
