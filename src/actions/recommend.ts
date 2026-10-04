/**
 * `recommend` server action: thin adapters from the pipeline's `Deps` to
 * DeepSpace tools and integrations.
 *
 * Trust model: server actions run with record RBAC OFF, so every query here is
 * scoped by the verified `userId` explicitly, and ids taken from params are
 * ownership-checked. Nothing here logs user text or the caller token.
 */

import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { RecommendResponse, VideoRef, VideoSourceUsed } from '../contract'
import { recommend as runPipeline, parseCheckinInput, type Deps, type UserContext } from '../recommend/pipeline'
import { homeIdeas } from '../recommend/home'
import { extractText } from '../recommend/parse'
import { integrationSource } from '../server/youtube-source'

const LLM_MODEL = 'claude-haiku-4-5'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
/** Stale results may be reused when YouTube is down, but never past YouTube's 30-day limit. */
const CACHE_STALE_MAX_MS = 25 * 24 * 60 * 60 * 1000

type Row = Record<string, unknown>

/** Short stable id so the cache can upsert by query. */
function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(16)
}

async function queryOne(tools: ActionTools, collection: string, where: Row) {
  const r = await tools.query<Row>(collection, { where, limit: 1 })
  return r.success ? (r.data.records[0] ?? null) : null
}

export function createDeps(
  userId: string,
  tools: ActionTools,
  env?: { OWNER_USER_ID?: string },
): Deps {
  // DeepSpace's YouTube integration is the only video source (billed to the app owner, with an app-wide daily limit).
  const used: VideoSourceUsed[] = []
  const note = (s: VideoSourceUsed) => void used.push(s)
  const youtube = integrationSource(tools, note)
  return {
    now: () => new Date(),
    sources: () => used,

    async llm({ system, user, maxTokens }) {
      const r = await tools.integration<unknown>('anthropic/chat-completion', {
        model: LLM_MODEL,
        max_tokens: maxTokens,
        temperature: 0.3,
        system,
        messages: [{ role: 'user', content: user }],
      })
      return r.success ? extractText(r.data) : null
    },

    searchVideos: (q) => youtube.search(q),

    videoDetails: (ids) => youtube.details(ids),

    async cacheGet(query, opts) {
      const rec = await queryOne(tools, 'searchCache', { query })
      const data = rec?.data as Row | undefined
      if (!data || typeof data.fetchedAt !== 'number') return null
      if (Date.now() - data.fetchedAt > (opts?.allowStale ? CACHE_STALE_MAX_MS : CACHE_TTL_MS)) return null
      if (!Array.isArray(data.results)) return null
      used.push('cache')
      return data.results as VideoRef[]
    },

    async cachePut(query, videos) {
      await tools.create('searchCache', { query, results: videos, fetchedAt: Date.now() }, `q_${hash(query)}`)
    },

    async loadContext(): Promise<UserContext> {
      const day = new Date().toISOString().slice(0, 10)
      const [prefs, usage, feedback] = await Promise.all([
        queryOne(tools, 'preferences', { userId }),
        queryOne(tools, 'usage', { userId, day }),
        tools.query<Row>('suggestions', { where: { userId }, orderBy: 'createdAt', orderDir: 'desc', limit: 30 }),
      ])
      const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
      const p = (prefs?.data ?? {}) as Row
      const rows = feedback.success ? feedback.data.records : []
      const withHelpful = (h: string) =>
        rows
          .filter((r) => (r.data as Row).helpful === h)
          .map((r) => (r.data as Row).activityId)
          .filter((x): x is string => typeof x === 'string')
      const count = (usage?.data as Row | undefined)?.count
      return {
        prefs: { likedTags: strings(p.likedTags), dislikedTags: strings(p.dislikedTags), avoid: strings(p.avoid) },
        liked: [...new Set(withHelpful('yes'))],
        disliked: [...new Set(withHelpful('no'))],
        // What the last few check-ins showed (about three per check-in), newest first, so the same ones do not keep coming up.
        recent: [...new Set(rows.slice(0, 9).map((r) => (r.data as Row).activityId).filter((x): x is string => typeof x === 'string'))],
        usageToday: typeof count === 'number' ? count : 0,
        exempt: !!env?.OWNER_USER_ID && userId === env.OWNER_USER_ID,
      }
    },

    async bumpUsage(day) {
      const rec = await queryOne(tools, 'usage', { userId, day })
      const current = typeof (rec?.data as Row | undefined)?.count === 'number' ? ((rec!.data as Row).count as number) : 0
      if (rec) await tools.update('usage', rec.recordId as string, { count: current + 1 })
      else await tools.create('usage', { userId, day, count: 1 })
    },

    async ownsCheckin(id) {
      const r = await tools.get<Row>('checkins', id)
      return r.success && (r.data.record.data as Row).userId === userId
    },

    async saveCheckin(row) {
      const r = await tools.create('checkins', { userId, ...row })
      if (!r.success) throw new Error('checkin_not_saved')
      return r.data.recordId
    },

    async saveSuggestions(checkinId, rows) {
      const ids: string[] = []
      for (const row of rows) {
        const r = await tools.create('suggestions', { userId, checkinId, status: 'shown', ...row })
        if (!r.success) throw new Error('suggestion_not_saved')
        ids.push(r.data.recordId)
      }
      return ids
    },
  }
}

export const recommend: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const parsed = parseCheckinInput(params)
  const respond = (data: RecommendResponse) => ({ success: true as const, data })
  if (!parsed.ok) return respond({ status: 'error', message: parsed.message })

  try {
    return respond(await runPipeline(createDeps(userId, tools, env), parsed.value))
  } catch (err) {
    // Log the error type only: messages could echo user content.
    console.error('[recommend] failed', err instanceof Error ? err.name : 'unknown')
    return respond({ status: 'error', message: 'Something went wrong on our side. Please try again in a moment.' })
  }
}

/** `homeIdeas`: two videos for right now, for anyone signed in, with no history needed. */
export const homeIdeasAction: ActionHandler<Env> = async ({ userId, tools, env }) => {
  try {
    return { success: true, data: await homeIdeas(createDeps(userId, tools, env)) }
  } catch (err) {
    console.error('[homeIdeas] failed', err instanceof Error ? err.name : 'unknown')
    return { success: true, data: { status: 'error', message: 'Something went wrong on our side.' } }
  }
}
