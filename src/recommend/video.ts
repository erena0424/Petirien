/**
 * Turn raw YouTube integration results into our own `VideoRef`.
 *
 * UNVERIFIED: the real field names of `youtube/search-videos` and
 * `youtube/get-video-details` items have not been observed (the endpoint was
 * failing upstream when checked). The output schema only promises `links`
 * (watch/embed/thumbnail), `embedHtml`, `markdownLink` and `formatted`, plus
 * open extra fields. So each value is read from several plausible places.
 * Once a real response is captured, tighten this and add it as a fixture.
 *
 * Invariant: a `videoId` only ever comes from these results, never from model
 * text.
 */

import type { VideoRef } from '../contract'

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)

function dig(root: unknown, path: string): unknown {
  let cur: unknown = root
  for (const key of path.split('.')) {
    if (!isObj(cur)) return undefined
    cur = cur[key]
  }
  return cur
}

function firstString(root: unknown, paths: string[]): string | undefined {
  for (const p of paths) {
    const v = dig(root, p)
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

/** Accepts seconds, "PT1H2M3S", or "H:MM:SS" / "M:SS". */
export function parseDuration(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.round(v)
  if (typeof v !== 'string') return null
  const s = v.trim()
  const iso = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(s)
  if (iso && s.length > 2) {
    const [, d, h, m, sec] = iso
    return Math.round(
      Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(sec ?? 0),
    )
  }
  if (/^\d+(:\d{1,2}){1,2}$/.test(s)) {
    return s.split(':').reduce((acc, part) => acc * 60 + Number(part), 0)
  }
  if (/^\d+$/.test(s)) return Number(s)
  return null
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

function idFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  const m = /[?&]v=([A-Za-z0-9_-]{11})|youtu\.be\/([A-Za-z0-9_-]{11})|\/embed\/([A-Za-z0-9_-]{11})/.exec(url)
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined
}

/** Returns null unless there is a well-formed video id. `durationSec` is 0 when unknown. */
export function normalizeVideo(raw: unknown): VideoRef | null {
  if (!isObj(raw)) return null

  const idCandidate =
    firstString(raw, ['id', 'videoId', 'id.videoId', 'formatted.id', 'formatted.videoId']) ??
    idFromUrl(firstString(raw, ['links.watch', 'links.embed']))
  if (!idCandidate || !VIDEO_ID.test(idCandidate)) return null

  const title = firstString(raw, ['title', 'snippet.title', 'formatted.title'])
  if (!title) return null

  const duration =
    parseDuration(dig(raw, 'durationSec')) ??
    parseDuration(dig(raw, 'duration')) ??
    parseDuration(dig(raw, 'contentDetails.duration')) ??
    parseDuration(dig(raw, 'formatted.duration')) ??
    0

  const embeddable = dig(raw, 'status.embeddable') ?? dig(raw, 'embeddable')

  return {
    videoId: idCandidate,
    title,
    channel:
      firstString(raw, ['channelTitle', 'channel', 'snippet.channelTitle', 'formatted.channel']) ?? '',
    thumbnail:
      firstString(raw, [
        'links.thumbnail',
        'thumbnail',
        'snippet.thumbnails.medium.url',
        'snippet.thumbnails.default.url',
      ]) ?? `https://i.ytimg.com/vi/${idCandidate}/mqdefault.jpg`,
    durationSec: duration,
    watchUrl: firstString(raw, ['links.watch']) ?? `https://www.youtube.com/watch?v=${idCandidate}`,
    ...(typeof embeddable === 'boolean' ? { embeddable } : {}),
  }
}

/** Details win over search results when both have a value. */
export function mergeVideos(base: VideoRef[], details: VideoRef[]): VideoRef[] {
  const byId = new Map(details.map((d) => [d.videoId, d]))
  return base.map((b) => {
    const d = byId.get(b.videoId)
    if (!d) return b
    return {
      ...b,
      title: d.title || b.title,
      channel: d.channel || b.channel,
      thumbnail: d.thumbnail || b.thumbnail,
      durationSec: d.durationSec || b.durationSec,
      ...(d.embeddable !== undefined ? { embeddable: d.embeddable } : b.embeddable !== undefined ? { embeddable: b.embeddable } : {}),
    }
  })
}

export const MIN_VIDEO_SEC = 60
export const MAX_VIDEO_SEC = 30 * 60

/** Keep videos whose length is known and fits the time the person has (+2 min slack). */
export function fitsTime(v: VideoRef, minutes: number): boolean {
  const maxSec = Math.min((minutes + 2) * 60, MAX_VIDEO_SEC)
  return v.durationSec >= MIN_VIDEO_SEC && v.durationSec <= maxSec
}
