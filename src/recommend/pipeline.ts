/**
 * The recommend pipeline, written against injected dependencies so every step
 * and every fallback can be tested with fakes. Nothing in here logs user text.
 *
 *   validate → cap → crisis gate → hard filter → interpret (LLM | fallback)
 *   → retrieve + enrich videos → rank & explain (LLM | fallback) → persist
 */

import { z } from 'zod'
import { GOALS, type Activity } from '../catalog'
import type { CheckinInput, Degraded, Pick, RecommendResponse, VideoRef } from '../contract'
import { sanitizeCopy } from './copy'
import { TEMPLATE_REPLY, deterministicPicks, nextUtcMidnight, templateReason } from './fallback'
import { filterCatalog } from './filter'
import { interpretSchema, rankSchema, type InterpretOut, type RankOut } from './llm-output'
import { extractText, parseJsonObject } from './parse'
import { buildInterpretPrompt, buildRankPrompt, type RankGroup } from './prompts'
import { detectCrisis } from './safety'
import { fitsTime, mergeVideos, normalizeVideo } from './video'

/** Runs per person per UTC day that go on to paid model or video work. The app owner is exempt. */
export const DAILY_CAP = 25
const MAX_PICKS = 3
const SEARCH_TOP = 4
const CANDIDATES_PER_ACTIVITY = 3

export interface UserContext {
  prefs: { dislikedTags: string[]; avoid: string[]; likedTags: string[] }
  /** Activity ids with feedback "yes". */
  liked: string[]
  /** Activity ids with feedback "no". */
  disliked: string[]
  usageToday: number
  /** The app owner is never capped (they pay for their own testing). */
  exempt?: boolean
}

export interface SuggestionRow {
  activityId: string
  videoId: string
  title: string
  reason: string
  rank: number
}

export interface Deps {
  now(): Date
  /** Returns model text, or null on any failure. Must not retry (failed paid calls are still billed). */
  llm(req: { system: string; user: string; maxTokens: number }): Promise<string | null>
  /** Raw search items, or null on failure. */
  searchVideos(query: string): Promise<unknown[] | null>
  /** Raw detail items for the ids, or null on failure. */
  videoDetails(ids: string[]): Promise<unknown[] | null>
  /**
   * Enriched videos cached for this query, or null. Fresh only by default;
   * `allowStale` also accepts older entries (still inside YouTube's 30-day limit).
   */
  cacheGet(query: string, opts?: { allowStale?: boolean }): Promise<VideoRef[] | null>
  cachePut(query: string, videos: VideoRef[]): Promise<void>
  loadContext(): Promise<UserContext>
  bumpUsage(day: string): Promise<void>
  ownsCheckin(id: string): Promise<boolean>
  saveCheckin(row: {
    mood: number
    energy: number
    minutes: number
    goal?: string
    intent?: string
    note?: string
  }): Promise<string>
  /** Returns the new row ids, in the same order as `rows`. */
  saveSuggestions(checkinId: string, rows: SuggestionRow[]): Promise<string[]>
}

const inputSchema = z.object({
  mood: z.number().int().min(1).max(5),
  energy: z.number().int().min(1).max(5),
  minutes: z.number().int().min(1).max(180),
  goal: z.enum(GOALS).optional(),
  note: z.string().max(1000).optional(),
  excludeActivityIds: z.array(z.string().max(80)).max(30).optional(),
  checkinId: z.string().max(120).optional(),
  screen: z.enum(['auto', 'video', 'none']).optional(),
})

export function parseCheckinInput(
  params: unknown,
): { ok: true; value: CheckinInput } | { ok: false; message: string } {
  const r = inputSchema.safeParse(params)
  if (!r.success) return { ok: false, message: 'Please check the values and try again.' }
  return { ok: true, value: r.data }
}

// ── interpret ────────────────────────────────────────────────────────────

interface Interpretation {
  ids: string[]
  reply: string | null
  intent?: string
  support: boolean
  goal?: CheckinInput['goal']
}

async function interpret(
  deps: Deps,
  input: CheckinInput,
  fits: Activity[],
  ctx: UserContext,
): Promise<Interpretation | null> {
  const prompt = buildInterpretPrompt(input, fits, ctx.liked, ctx.disliked, ctx.prefs.likedTags)
  const text = await deps.llm({ ...prompt, maxTokens: 500 })
  const parsed = interpretSchema.safeParse(parseJsonObject(text))
  if (!parsed.success) return null
  const out: InterpretOut = parsed.data
  const allowed = new Set(fits.map((a) => a.id))
  return {
    ids: [...new Set(out.activityIds)].filter((id) => allowed.has(id)),
    reply: sanitizeCopy(out.reply, 280),
    intent: sanitizeCopy(out.intent, 200) ?? undefined,
    support: out.needsSupportResources,
    goal: out.goal ?? undefined,
  }
}

// ── retrieve ─────────────────────────────────────────────────────────────

type Retrieval = { ok: true; videos: VideoRef[] } | { ok: false }

async function retrieve(deps: Deps, activity: Activity, minutes: number): Promise<Retrieval> {
  const q = activity.searchQuery
  let videos = await deps.cacheGet(q)

  if (!videos) {
    const raw = await deps.searchVideos(q)
    if (!raw) {
      // YouTube is unreachable or over quota: reuse an older cached result
      // rather than show nothing. Never retry (a failed call still uses quota).
      const stale = await deps.cacheGet(q, { allowStale: true })
      if (!stale) return { ok: false }
      videos = stale
    } else {
      const seen = new Set<string>()
      let base = raw
        .map(normalizeVideo)
        .filter((v): v is VideoRef => v !== null && !seen.has(v.videoId) && !!seen.add(v.videoId))
        .slice(0, SEARCH_TOP)

      // One lookup for every video whose length (or embeddability) is not yet known.
      const needDetails = base.filter((v) => v.durationSec === 0 || v.embeddable === undefined)
      if (needDetails.length) {
        const rawDetails = await deps.videoDetails(needDetails.map((v) => v.videoId))
        if (rawDetails) {
          const details = rawDetails.map(normalizeVideo).filter((v): v is VideoRef => v !== null)
          base = mergeVideos(base, details)
        }
      }
      videos = base
      if (videos.length) await deps.cachePut(q, videos)
    }
  }
  // Only videos of a known, fitting length that the owner has not blocked from embedding.
  return { ok: true, videos: videos.filter((v) => fitsTime(v, minutes) && v.embeddable !== false) }
}

// ── rank ─────────────────────────────────────────────────────────────────

/** A pick that has a real video. Ideas without a video are assembled separately. */
type RankedPick = Omit<Pick, 'suggestionId' | 'video'> & { video: VideoRef }

async function rank(
  deps: Deps,
  input: CheckinInput,
  groups: RankGroup[],
): Promise<{ picks: RankedPick[]; degraded: boolean }> {
  const byActivity = new Map(groups.map((g) => [g.activity.id, g]))
  const chosen = new Map<string, { video: VideoRef; reason: string | null }>()

  const text = await deps.llm({ ...buildRankPrompt(input, groups), maxTokens: 600 })
  const parsed = rankSchema.safeParse(parseJsonObject(text))
  if (parsed.success) {
    const out: RankOut = parsed.data
    for (const p of out.picks) {
      const g = byActivity.get(p.activityId)
      const video = g?.videos.find((v) => v.videoId === p.videoId)
      if (g && video && !chosen.has(g.activity.id)) {
        chosen.set(g.activity.id, { video, reason: sanitizeCopy(p.reason, 240) })
      }
    }
  }
  const degraded = !parsed.success || chosen.size === 0

  // Fill any activity the model skipped or got wrong with the first real candidate.
  for (const g of groups) {
    if (!chosen.has(g.activity.id) && g.videos[0]) {
      chosen.set(g.activity.id, { video: g.videos[0], reason: null })
    }
  }

  const ordered = groups.filter((g) => chosen.has(g.activity.id)).slice(0, MAX_PICKS)
  const picks = ordered.map((g, i) => {
    const c = chosen.get(g.activity.id)!
    return {
      activityId: g.activity.id,
      activityTitle: g.activity.title,
      video: c.video,
      reason: c.reason ?? templateReason(g.activity, c.video),
      rank: i + 1,
    }
  })
  return { picks, degraded }
}

// ── orchestration ────────────────────────────────────────────────────────

export async function recommend(deps: Deps, input: CheckinInput): Promise<RecommendResponse> {
  const now = deps.now()
  const ctx = await deps.loadContext()
  if (!ctx.exempt && ctx.usageToday >= DAILY_CAP) return { status: 'capped', resetsAt: nextUtcMidnight(now) }

  const base = { mood: input.mood, energy: input.energy, minutes: input.minutes, goal: input.goal }

  /** Reuse the caller's own check-in on re-runs; never trust a foreign id. */
  const persistCheckin = async (opts: { note: boolean; intent?: string }): Promise<string> => {
    if (input.checkinId && (await deps.ownsCheckin(input.checkinId))) return input.checkinId
    return deps.saveCheckin({
      ...base,
      ...(opts.intent ? { intent: opts.intent } : {}),
      ...(opts.note && input.note ? { note: input.note } : {}),
    })
  }

  // Layer 1 crisis gate. The note is not stored on this path.
  if (detectCrisis(input.note)) {
    return { status: 'support', checkinId: await persistCheckin({ note: false }) }
  }

  const { activities: fits } = filterCatalog({
    minutes: input.minutes,
    energy: input.energy,
    goal: input.goal,
    dislikedTags: ctx.prefs.dislikedTags,
    avoid: ctx.prefs.avoid,
    excludeIds: input.excludeActivityIds,
    videoOnly: input.screen === 'video',
  })
  if (fits.length === 0) {
    return {
      status: 'nothing_fits',
      checkinId: await persistCheckin({ note: true }),
      reply:
        'Nothing in my small list fits that amount of time and energy right now. Resting counts too, and your saved videos are still here.',
    }
  }

  // The cap protects spend, so only runs that go on to model and video calls count.
  // Crisis and "nothing fits" exits above cost nothing and are not counted.
  await deps.bumpUsage(now.toISOString().slice(0, 10))

  const degraded: Degraded[] = []

  // Interpret (LLM) with deterministic fallback.
  const interp = await interpret(deps, input, fits, ctx)
  if (interp?.support) {
    // Layer 2 crisis gate. Do not keep the note.
    return { status: 'support', checkinId: await persistCheckin({ note: false }) }
  }
  if (!interp) degraded.push('interpret')

  const signals = {
    goal: input.goal ?? interp?.goal,
    energy: input.energy,
    liked: ctx.liked,
    disliked: ctx.disliked,
    likedTags: ctx.prefs.likedTags,
  }
  const fromModel = (interp?.ids ?? [])
    .map((id) => fits.find((a) => a.id === id))
    .filter((a): a is Activity => !!a)
  const fill = deterministicPicks(fits, signals, MAX_PICKS)
  const shortlist = [...fromModel, ...fill.filter((a) => !fromModel.includes(a))].slice(0, MAX_PICKS)
  const reply = interp?.reply ?? TEMPLATE_REPLY

  // Videos only where one helps (and never in screen-free mode). Everything else is
  // offered as a plain idea with written steps, which also saves search quota and a model call.
  const wantsVideo = (a: Activity) => input.screen !== 'none' && a.video
  const videoActivities = shortlist.filter(wantsVideo)

  // Retrieve (independent per activity; one failure does not sink the rest).
  const retrieved = await Promise.all(
    videoActivities.map(async (activity) => ({ activity, r: await retrieve(deps, activity, input.minutes) })),
  )
  if (retrieved.some((x) => !x.r.ok)) degraded.push('video')
  const groups: RankGroup[] = retrieved
    .filter((x): x is { activity: Activity; r: { ok: true; videos: VideoRef[] } } => x.r.ok && x.r.videos.length > 0)
    .map((x) => ({ activity: x.activity, videos: x.r.videos.slice(0, CANDIDATES_PER_ACTIVITY) }))

  const videoFor = new Map<string, RankedPick>()
  if (groups.length > 0) {
    const ranked = await rank(deps, input, groups)
    if (ranked.degraded) degraded.push('rank')
    for (const p of ranked.picks) videoFor.set(p.activityId, p)
  }

  // Assemble in the chosen order: the video where we have one, otherwise the plain idea.
  const ordered = shortlist.slice(0, MAX_PICKS).map((a, i) => {
    const v = videoFor.get(a.id)
    return v
      ? { activityId: a.id, activityTitle: a.title, video: v.video as VideoRef | null, reason: v.reason, rank: i + 1 }
      : { activityId: a.id, activityTitle: a.title, video: null as VideoRef | null, reason: a.blurb, rank: i + 1 }
  })

  const checkinId = await persistCheckin({ note: true, intent: interp?.intent })
  const suggestionIds = await deps.saveSuggestions(
    checkinId,
    ordered.map((p) => ({
      activityId: p.activityId,
      videoId: p.video?.videoId ?? '',
      title: p.video?.title ?? p.activityTitle,
      reason: p.reason,
      rank: p.rank,
    })),
  )
  const picks: Pick[] = ordered.map((p, i) => ({ ...p, suggestionId: suggestionIds[i] ?? '' }))
  return { status: 'ok', checkinId, reply, picks, degraded: [...new Set(degraded)] }
}
