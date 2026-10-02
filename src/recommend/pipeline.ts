/**
 * The recommend pipeline, written against injected dependencies so every step
 * and every fallback can be tested with fakes. Nothing in here logs user text.
 *
 *   validate → cap → crisis gate → hard filter → interpret (LLM | fallback)
 *   → retrieve + enrich videos → rank & explain (LLM | fallback) → persist
 */

import { z } from 'zod'
import { GOALS, type Activity } from '../catalog'
import type { CheckinInput, Degraded, Pick, RecommendResponse, VideoRef, VideoSourceUsed } from '../contract'
import { sanitizeCopy } from './copy'
import { TEMPLATE_REPLY, deterministicPicks, nextUtcMidnight, templateReason } from './fallback'
import { filterCatalog } from './filter'
import { interpretSchema, rankSchema, type InterpretOut, type RankOut } from './llm-output'
import { extractText, parseJsonObject } from './parse'
import { buildInterpretPrompt, buildRankPrompt, type RankGroup } from './prompts'
import { detectCrisis } from './safety'
import { dayOfYear } from '../lib/for-now'
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
  /** Activity ids shown in the last few check-ins, newest first. */
  recent?: string[]
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
  /** Which video sources answered during this request (for the owner's eyes only). */
  sources?(): VideoSourceUsed[]
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
  place: z.enum(['auto', 'in', 'out']).optional(),
})

export function parseCheckinInput(
  params: unknown,
): { ok: true; value: CheckinInput } | { ok: false; message: string } {
  const r = inputSchema.safeParse(params)
  if (!r.success) return { ok: false, message: 'Please check the values and try again.' }
  return { ok: true, value: r.data }
}

// ── shortlist ────────────────────────────────────────────────────────────

/**
 * The activities to show, best first. In "Not sure" mode (the default) the person
 * asked for a mix, so when both kinds are available the list always has at least
 * one with a video and at least one plain idea, however the model ordered them.
 */
export const WALK_ID = 'walk-nearby'

/** The list started `by` places along, wrapping round. */
export function rotate<T>(list: T[], by: number): T[] {
  if (list.length === 0) return []
  const n = ((by % list.length) + list.length) % list.length
  return [...list.slice(n), ...list.slice(0, n)]
}

/**
 * Shape the candidates with what the person has told us, without ever leaving them with nothing: what they marked
 * "not for me" is dropped (while at least three other choices remain), and what the last few check-ins already
 * showed moves to the back unless they liked it, so the same few do not come up every time.
 */
export function tailor(candidates: Activity[], ctx: { liked: string[]; disliked: string[]; recent?: string[] }): Activity[] {
  const kept = candidates.filter((a) => !ctx.disliked.includes(a.id))
  const base = kept.length >= 3 ? kept : candidates
  const recent = new Set(ctx.recent ?? [])
  const fresh = base.filter((a) => !recent.has(a.id) || ctx.liked.includes(a.id))
  const seen = base.filter((a) => recent.has(a.id) && !ctx.liked.includes(a.id))
  return [...fresh, ...seen]
}

/**
 * Which activities make the short list. The default ("Not sure") is one place to visit, one video, and one other
 * idea. It is a preference, not a rule: when a piece is not available (no time for a walk, no video that fits) the
 * rest fills in from whatever is there, always leaning on videos.
 *  - Go outside: the place, and two videos.
 *  - Stay in: two videos and one idea, nothing outdoors.
 *  - Videos are fine: videos only. No screen: ideas only, with the place first when it fits.
 */
export function pickShortlist(candidates: Activity[], screen: CheckinInput['screen'], count = MAX_PICKS, place: CheckinInput['place'] = 'auto'): Activity[] {
  const pool = place === 'in' ? candidates.filter((a) => !a.tags.includes('outdoors')) : candidates
  if (screen === 'video') return pool.slice(0, count)
  const walk = pool.find((a) => a.id === WALK_ID)
  if (screen === 'none') {
    const first = pool.slice(0, count)
    return !walk || first.includes(walk) ? first : [...first.slice(0, count - 1), walk]
  }
  const videos = pool.filter((a) => a.video)
  const plainIdeas = pool.filter((a) => !a.video && a.id !== WALK_ID)
  // The idea should be a different kind of thing from the video, so the mix really is a mix.
  const differs = plainIdeas.find((a) => a.category !== videos[0]?.category)
  const ideas = differs ? [differs, ...plainIdeas.filter((a) => a !== differs)] : plainIdeas
  let chosen: Activity[]
  if (walk && place === 'out') chosen = [walk, ...videos.slice(0, 2)]
  else if (walk) chosen = [walk, ...videos.slice(0, 1), ...ideas.slice(0, 1)] // place, video, idea
  else chosen = [...videos.slice(0, 2), ...ideas.slice(0, 1)] // no place available: two videos and an idea
  const set = new Set(chosen)
  for (const a of videos) {
    if (set.size >= count) break
    set.add(a)
  }
  for (const a of pool) {
    if (set.size >= count) break
    set.add(a)
  }
  // Keep the order the candidates came in.
  return pool.filter((a) => set.has(a)).slice(0, count)
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

export type Retrieval = { ok: true; videos: VideoRef[] } | { ok: false }

export async function retrieve(deps: Deps, activity: Activity, minutes: number): Promise<Retrieval> {
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
    avoid: input.place === 'in' ? [...ctx.prefs.avoid, 'outdoors'] : ctx.prefs.avoid,
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
    recent: ctx.recent,
  }
  const fromModel = (interp?.ids ?? [])
    .map((id) => fits.find((a) => a.id === id))
    .filter((a): a is Activity => !!a)
  // Variety: start the catalog in a different place each day, so the same few never lead.
  const spun = rotate(fits, dayOfYear(now))
  const fill = deterministicPicks(spun, signals, MAX_PICKS)
  const tailored = tailor([...new Set([...fromModel, ...fill, ...spun])], ctx)
  const candidates = tailored
  const shortlist = pickShortlist(candidates, input.screen, MAX_PICKS, input.place)
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
  // Shown in this order: videos first, then the place to visit, then other ideas.
  const kind = (a: Activity) => (videoFor.has(a.id) ? 0 : a.id === WALK_ID ? 1 : 2)
  const ordered = shortlist
    .slice(0, MAX_PICKS)
    .map((a, i) => ({ a, i }))
    .sort((x, y) => kind(x.a) - kind(y.a) || x.i - y.i)
    .map(({ a }, i) => {
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
  const sources = deps.sources?.()
  return {
    status: 'ok',
    checkinId,
    reply,
    picks,
    degraded: [...new Set(degraded)],
    ...(sources && sources.length ? { sources: [...new Set(sources)] } : {}),
  }
}
