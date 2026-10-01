/**
 * Where video search and details come from.
 *
 * Main source: DeepSpace's YouTube integration (verified working 2026-10-01).
 * It returns real results and accepts several ids at once, but has no
 * embeddable flag, no safe-search switch, and search results carry no length.
 *
 * Optional helper: the app's own Google key (`YOUTUBE_API_KEY`). When present it
 *  - is a BACKUP if the integration fails (a failed integration call is still
 *    charged, so we try it once and never retry), and
 *  - ENRICHES integration results with `status.embeddable` (1 quota unit), so
 *    videos the owner blocked from embedding are dropped before anyone taps them.
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

const idOf = (item: unknown): string | undefined => {
  if (!isRaw(item)) return undefined
  if (typeof item.id === 'string') return item.id
  return isRaw(item.id) && typeof item.id.videoId === 'string' ? item.id.videoId : undefined
}

/**
 * Main source first; the helper only fills gaps. Falls back to the helper when the
 * main source fails, and adds `status` (embeddable) to the main source's details.
 */
export function withHelper(main: VideoSource, helper?: VideoSource, onUse?: (s: SourceUsed) => void): VideoSource {
  if (!helper) return main
  const viaGoogle = async (run: () => Promise<unknown[] | null>) => {
    const out = await run()
    if (out) onUse?.('google')
    return out
  }
  return {
    async search(q) {
      return (await main.search(q)) ?? viaGoogle(() => helper.search(q))
    },
    async details(ids) {
      const items = await main.details(ids)
      if (items === null) return viaGoogle(() => helper.details(ids)) // main failed: use the helper's full answer
      if (items.length === 0) return items // answered: nothing there. Do not spend a call to second-guess it.
      const extra = await helper.details(ids).catch(() => null)
      if (!extra) return items // enrichment is best effort
      onUse?.('google') // only used to check embeddability
      const statusById = new Map<string, unknown>()
      for (const e of extra) if (isRaw(e) && idOf(e) && e.status !== undefined) statusById.set(idOf(e)!, e.status)
      return items.map((it) => {
        const id = idOf(it)
        return isRaw(it) && id && statusById.has(id) && it.status === undefined ? { ...it, status: statusById.get(id) } : it
      })
    },
  }
}
