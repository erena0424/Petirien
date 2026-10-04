/**
 * `refreshSaved`: keep saved-video metadata inside YouTube's 30-day rule.
 *
 * Refreshes up to MAX_PER_CALL stale rows belonging to the caller. A failed
 * lookup changes nothing (we never mark a video gone because YouTube was
 * unreachable). Only a successful lookup that returns no video marks it gone,
 * and then the stored YouTube metadata is cleared; the person's note stays.
 *
 * UNVERIFIED against real YouTube: the integration was failing upstream when
 * built, so "success with an empty list means removed" is an assumption.
 */

import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { VideoRef } from '../contract'
import { normalizeVideo } from '../recommend/video'
import { videoDetails as ytDetails } from '../server/youtube-api'
import { ownKeySource } from '../server/youtube-source'
import { needsRefresh, type SavedData } from '../lib/saved'

export const MAX_PER_CALL = 5

export interface SavedRow {
  recordId: string
  data: SavedData
}

export type Details = { ok: true; video: VideoRef | null } | { ok: false }

export interface RefreshDeps {
  listSaved(): Promise<SavedRow[]>
  fetchDetails(videoId: string): Promise<Details>
  update(recordId: string, patch: Partial<SavedData>): Promise<void>
}

export interface RefreshResult {
  refreshed: number
  gone: number
  failed: number
}

export async function refreshStale(deps: RefreshDeps, now: number): Promise<RefreshResult> {
  const rows = await deps.listSaved()
  const stale = rows
    .filter((r) => needsRefresh(r.data, now))
    .sort((a, b) => (a.data.metaRefreshedAt ?? 0) - (b.data.metaRefreshedAt ?? 0))
    .slice(0, MAX_PER_CALL)

  const out: RefreshResult = { refreshed: 0, gone: 0, failed: 0 }
  for (const row of stale) {
    const res = await deps.fetchDetails(row.data.videoId)
    if (!res.ok) {
      out.failed++
      continue
    }
    if (res.video === null) {
      await deps.update(row.recordId, {
        availability: 'gone',
        title: '',
        channel: '',
        thumbnail: '',
        durationSec: 0,
        metaRefreshedAt: now,
      })
      out.gone++
      continue
    }
    // YouTube also tells us whether embedding is blocked; keep the mark current.
    const availability =
      res.video.embeddable === false ? 'no_embed' : row.data.availability === 'no_embed' && res.video.embeddable === true ? 'ok' : undefined
    await deps.update(row.recordId, {
      title: res.video.title,
      channel: res.video.channel,
      thumbnail: res.video.thumbnail,
      durationSec: res.video.durationSec || row.data.durationSec || 0,
      metaRefreshedAt: now,
      ...(availability ? { availability } : {}),
    })
    out.refreshed++
  }
  return out
}

export function createRefreshDeps(userId: string, tools: ActionTools, env?: { YOUTUBE_API_KEY?: string }): RefreshDeps {
  const youtube = ownKeySource(env?.YOUTUBE_API_KEY || undefined, { search: async () => null, details: ytDetails })
  return {
    async listSaved() {
      // Server actions run with RBAC off: scope to the caller explicitly.
      const r = await tools.query<SavedData & Record<string, unknown>>('savedVideos', { where: { userId }, limit: 200 })
      return r.success ? r.data.records.map((x) => ({ recordId: x.recordId, data: x.data as SavedData })) : []
    },
    async fetchDetails(videoId) {
      // An empty list means YouTube answered and the video is gone; null means we could not ask.
      const items = await youtube.details([videoId])
      if (items === null) return { ok: false }
      return { ok: true, video: items.map(normalizeVideo).find((v): v is VideoRef => v !== null) ?? null }
    },
    async update(recordId, patch) {
      await tools.update('savedVideos', recordId, patch)
    },
  }
}

export const refreshSaved: ActionHandler<Env> = async ({ userId, tools, env }) => {
  try {
    return { success: true, data: await refreshStale(createRefreshDeps(userId, tools, env), Date.now()) }
  } catch (err) {
    console.error('[refreshSaved] failed', err instanceof Error ? err.name : 'unknown')
    return { success: false, error: 'Could not refresh saved videos right now.' }
  }
}
