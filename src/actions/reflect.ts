/**
 * `reflectReply` and `reflectSummary` server actions: thin adapters from the
 * reflect pipeline to DeepSpace. They store nothing about what a person says.
 * The only thing written is a per-person daily counter, scoped to the caller.
 */

import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { extractText } from '../recommend/parse'
import { z } from 'zod'
import { writeAutoNote, type AutoNoteDeps } from '../reflect/auto-notes'
import type { ChatMessage } from '../reflect/contract'
import { backgroundRows } from '../plans/reflection'
import { CreditsError, parseMessages, reflectReply, type ReflectDeps } from '../reflect/pipeline'
import { normalizeStyle } from '../reflect/style'

const LLM_MODEL = 'claude-haiku-4-5'

type Row = Record<string, unknown>

/** The counter row for reflection lives beside the check-in counter, under its own day key. */
const dayKey = (now: Date) => `${now.toISOString().slice(0, 10)}:reflect`

export function createReflectDeps(userId: string, tools: ActionTools, env?: { OWNER_USER_ID?: string }): ReflectDeps {
  const day = () => dayKey(new Date())
  const find = async () => {
    const r = await tools.query<Row>('usage', { where: { userId, day: day() }, limit: 1 })
    return r.success ? (r.data.records[0] ?? null) : null
  }
  return {
    now: () => new Date(),
    exempt: !!env?.OWNER_USER_ID && userId === env.OWNER_USER_ID,

    async llm({ system, user, maxTokens }) {
      const r = await tools.integration<unknown>('anthropic/chat-completion', {
        model: LLM_MODEL,
        max_tokens: maxTokens,
        temperature: 0.6,
        system,
        messages: [{ role: 'user', content: user }],
      })
      if (!r.success && (r.code === 'insufficient_credits' || r.status === 402)) throw new CreditsError()
      return r.success ? extractText(r.data) : null
    },

    async recentNotes() {
      // Server actions run with RBAC off: scope to the caller explicitly.
      const r = await tools.query<Row>('journalEntries', { where: { userId }, orderBy: 'createdAt', orderDir: 'desc', limit: 15 })
      if (!r.success) return []
      // Reflections are the person's own writing about a plan: they stay in the Journal and are never sent to the model as background.
      return backgroundRows(r.data.records.map((rec) => rec.data as Row)).map((d) => {
        return {
          title: typeof d.title === 'string' ? d.title : '',
          notes: Array.isArray(d.notes) ? (d.notes as unknown[]).filter((x): x is string => typeof x === 'string') : [],
        }
      })
    },

    async loadStyle() {
      const r = await tools.query<Row>('preferences', { where: { userId }, limit: 1 })
      const row = r.success ? (r.data.records[0]?.data as Row | undefined) : undefined
      return normalizeStyle(row?.bunnyStyle)
    },

    async saveStyle(next) {
      // Only the fixed vocabulary can reach this point; normalize again so nothing else can be written.
      const clean = normalizeStyle(next)
      const r = await tools.query<Row>('preferences', { where: { userId }, limit: 1 })
      const rec = r.success ? r.data.records[0] : undefined
      if (rec) await tools.update('preferences', rec.recordId as string, { bunnyStyle: clean })
      else await tools.create('preferences', { userId, bunnyStyle: clean })
    },

    async usageToday() {
      const rec = await find()
      const count = (rec?.data as Row | undefined)?.count
      return typeof count === 'number' ? count : 0
    },

    async bumpUsage() {
      const rec = await find()
      const current = typeof (rec?.data as Row | undefined)?.count === 'number' ? ((rec!.data as Row).count as number) : 0
      if (rec) await tools.update('usage', rec.recordId as string, { count: current + 1 })
      else await tools.create('usage', { userId, day: day(), count: 1 })
    },
  }
}

const GENERIC_FAILURE = { status: 'error', message: 'Something went wrong on our side. Please try again in a moment.' }

function handler(run: (deps: ReflectDeps, messages: ChatMessage[]) => Promise<unknown>): ActionHandler<Env> {
  return async ({ userId, params, tools, env }) => {
    const parsed = parseMessages(params)
    if (!parsed.ok) return { success: true, data: { status: 'error', message: 'That message could not be sent. Please try again.' } }
    try {
      return { success: true, data: await run(createReflectDeps(userId, tools, env), parsed.messages) }
    } catch (err) {
      // Error type only: messages could echo what the person wrote.
      console.error('[reflect] failed', err instanceof Error ? err.name : 'unknown')
      return { success: true, data: GENERIC_FAILURE }
    }
  }
}

export const reflectReplyAction = handler((deps, messages) => reflectReply(deps, messages))

// ── automatic notes ──────────────────────────────────────────────────────

const idSchema = z.object({ conversationId: z.string().min(1).max(120), force: z.boolean().optional() })

function createNoteDeps(userId: string, tools: ActionTools, env?: { OWNER_USER_ID?: string }): AutoNoteDeps {
  const base = createReflectDeps(userId, tools, env)
  return {
    ...base,

    async loadConversation(id) {
      const r = await tools.get<Row>('conversations', id)
      // Ownership: the row must belong to the caller. Never trust an id from the browser.
      if (!r.success || (r.data.record.data as Row).userId !== userId) return null
      const d = r.data.record.data as Row
      const plan =
        typeof d.planId === 'string' && d.planId && typeof d.planTitle === 'string' && typeof d.planStart === 'string'
          ? { id: d.planId, title: d.planTitle, start: d.planStart }
          : undefined
      return {
        lastMessageAt: typeof d.lastMessageAt === 'number' ? d.lastMessageAt : 0,
        notedUpTo: typeof d.notedUpTo === 'number' ? d.notedUpTo : 0,
        ...(plan ? { plan } : {}),
      }
    },

    async loadMessages(id) {
      const r = await tools.query<Row>('messages', { where: { userId, conversationId: id }, orderBy: 'seq', orderDir: 'asc', limit: 500 })
      if (!r.success) return []
      return r.data.records
        .map((rec) => rec.data as Row)
        .filter((d) => (d.role === 'user' || d.role === 'bunny') && typeof d.text === 'string')
        .map((d) => ({ role: d.role as 'user' | 'bunny', text: d.text as string }))
    },

    async writeNote(id, draft, notedUpTo, plan) {
      const made = await tools.create('journalEntries', {
        userId,
        title: draft.title,
        notes: draft.notes,
        feelings: draft.feelings,
        ...(plan ? { eventId: plan.id, eventTitle: plan.title, eventStart: plan.start } : {}),
        bunnyNote: draft.bunnyNote,
        conversationId: id,
        auto: 1,
      })
      if (!made.success) throw new Error('note_not_saved')
      await tools.update('conversations', id, { notedUpTo })
    },

    async skipTo(id, notedUpTo) {
      await tools.update('conversations', id, { notedUpTo })
    },
  }
}

export const summarizeConversationAction: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const parsed = idSchema.safeParse(params)
  if (!parsed.success) return { success: true, data: { status: 'error' } }
  try {
    return { success: true, data: await writeAutoNote(createNoteDeps(userId, tools, env), parsed.data.conversationId, { force: parsed.data.force }) }
  } catch (err) {
    console.error('[autoNote] failed', err instanceof Error ? err.name : 'unknown')
    return { success: true, data: { status: 'error' } }
  }
}
