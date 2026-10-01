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

export const DAILY_CAP = 12
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
  /** Enriched videos cached for this query (fresh only), or null. */
  cacheGet(query: string): Promise<VideoRef[] | null>
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
  const prompt = buildInterpretPrompt(input, fits, ctx.liked, ctx.disliked)
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
    if (!raw) return { ok: false }

    const seen = new Set<string>()
    let base = raw
      .map(normalizeVideo)
      .filter((v): v is VideoRef => v !== null && !seen.has(v.videoId) && !!seen.add(v.videoId))
      .slice(0, SEARCH_TOP)

    const unknownLength = base.filter((v) => v.durationSec === 0)
    if (unknownLength.length) {
      const rawDetails = await deps.videoDetails(unknownLength.map((v) => v.videoId))
      if (rawDetails) {
        const details = rawDetails.map(normalizeVideo).filter((v): v is VideoRef => v !== null)
        base = mergeVideos(base, details)
      }
    }
    videos = base
    if (videos.length) await deps.cachePut(q, videos)
  }
  return { ok: true, videos: videos.filter((v) => fitsTime(v, minutes)) }
}

// ── rank ─────────────────────────────────────────────────────────────────

async function rank(
  deps: Deps,
  input: CheckinInput,
  groups: RankGroup[],
): Promise<{ picks: Omit<Pick, 'suggestionId'>[]; degraded: boolean }> {
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
  if (ctx.usageToday >= DAILY_CAP) return { status: 'capped', resetsAt: nextUtcMidnight(now) }

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

  await deps.bumpUsage(now.toISOString().slice(0, 10))

  const { activities: fits } = filterCatalog({
    minutes: input.minutes,
    energy: input.energy,
    goal: input.goal,
    dislikedTags: ctx.prefs.dislikedTags,
    avoid: ctx.prefs.avoid,
    excludeIds: input.excludeActivityIds,
  })
  if (fits.length === 0) {
    return {
      status: 'nothing_fits',
      checkinId: await persistCheckin({ note: true }),
      reply:
        'Nothing in my small list fits that amount of time and energy right now. Resting counts too, and your saved videos are still here.',
    }
  }

  const degraded: Degraded[] = []

  // Interpret (LLM) with deterministic fallback.
  const interp = await interpret(deps, input, fits, ctx)
  if (interp?.support) {
    // Layer 2 crisis gate. Do not keep the note.
    return { status: 'support', checkinId: await persistCheckin({ note: false }) }
  }
  if (!interp) degraded.push('interpret')

  const signals = { goal: input.goal ?? interp?.goal, energy: input.energy, liked: ctx.liked, disliked: ctx.disliked }
  const fromModel = (interp?.ids ?? [])
    .map((id) => fits.find((a) => a.id === id))
    .filter((a): a is Activity => !!a)
  const fill = deterministicPicks(fits, signals, MAX_PICKS)
  const shortlist = [...fromModel, ...fill.filter((a) => !fromModel.includes(a))].slice(0, MAX_PICKS)
  const reply = interp?.reply ?? TEMPLATE_REPLY

  // Retrieve (independent per activity; one failure does not sink the rest).
  const retrieved = await Promise.all(
    shortlist.map(async (activity) => ({ activity, r: await retrieve(deps, activity, input.minutes) })),
  )
  if (retrieved.some((x) => !x.r.ok)) degraded.push('video')
  const groups: RankGroup[] = retrieved
    .filter((x): x is { activity: Activity; r: { ok: true; videos: VideoRef[] } } => x.r.ok && x.r.videos.length > 0)
    .map((x) => ({ activity: x.activity, videos: x.r.videos.slice(0, CANDIDATES_PER_ACTIVITY) }))

  if (groups.length === 0) {
    return {
      status: 'no_video',
      checkinId: await persistCheckin({ note: true, intent: interp?.intent }),
      reply,
      activities: shortlist.map((a) => ({ activityId: a.id, title: a.title, blurb: a.blurb })),
    }
  }

  const ranked = await rank(deps, input, groups)
  if (ranked.degraded) degraded.push('rank')

  const checkinId = await persistCheckin({ note: true, intent: interp?.intent })
  const suggestionIds = await deps.saveSuggestions(
    checkinId,
    ranked.picks.map((p) => ({
      activityId: p.activityId,
      videoId: p.video.videoId,
      title: p.video.title,
      reason: p.reason,
      rank: p.rank,
    })),
  )
  const picks: Pick[] = ranked.picks.map((p, i) => ({ ...p, suggestionId: suggestionIds[i] ?? '' }))
  return { status: 'ok', checkinId, reply, picks, degraded: [...new Set(degraded)] }
}

