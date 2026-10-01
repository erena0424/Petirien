/**
 * Direct YouTube Data API v3 client for the worker.
 *
 * Used when the app has its own `YOUTUBE_API_KEY` secret (set with
 * `npx deepspace secrets set YOUTUBE_API_KEY --stdin`). Otherwise the app uses
 * DeepSpace's YouTube integration.
 *
 * Quota (Google, default for a new project): 100 search.list calls per day and
 * 10,000 units per day for everything else (videos.list costs 1 unit per call).
 * Resets at midnight Pacific. The pipeline caches search results, so it needs
 * about one search per distinct activity per day.
 *
 * Rules kept here: the key goes in a header (never in a URL, so it cannot leak
 * into logs), nothing is retried (a failed call still uses quota), and the key
 * is never logged. Both functions return null on any failure, and `[]` only
 * when Google answered successfully with no results.
 */

const BASE = 'https://www.googleapis.com/youtube/v3'
const TIMEOUT_MS = 8000

type FetchLike = typeof fetch

async function get(path: string, params: Record<string, string>, key: string, fetchImpl: FetchLike): Promise<unknown[] | null> {
  try {
    const url = `${BASE}/${path}?${new URLSearchParams(params).toString()}`
    const res = await fetchImpl(url, {
      headers: { 'x-goog-api-key': key, accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      // Status only: the body can echo request details. 403 is usually quota.
      console.error(`[youtube] ${path} failed with status ${res.status}`)
      return null
    }
    const body = (await res.json()) as { items?: unknown }
    return Array.isArray(body.items) ? body.items : []
  } catch (err) {
    console.error(`[youtube] ${path} request error`, err instanceof Error ? err.name : 'unknown')
    return null
  }
}

/** Embeddable, family-safe, English results for one curated query. */
export function searchVideos(key: string, q: string, fetchImpl: FetchLike = fetch): Promise<unknown[] | null> {
  return get(
    'search',
    {
      part: 'snippet',
      type: 'video',
      q,
      maxResults: '6',
      videoEmbeddable: 'true',
      videoSyndicated: 'true',
      safeSearch: 'strict',
      relevanceLanguage: 'en',
      regionCode: 'US',
    },
    key,
    fetchImpl,
  )
}

/** Length, embeddability, and snippet for up to 50 ids in one call. */
export function videoDetails(key: string, ids: string[], fetchImpl: FetchLike = fetch): Promise<unknown[] | null> {
  if (ids.length === 0) return Promise.resolve([])
  return get('videos', { part: 'snippet,contentDetails,status', id: ids.slice(0, 50).join(',') }, key, fetchImpl)
}
