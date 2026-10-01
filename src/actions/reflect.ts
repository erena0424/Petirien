/**
 * `reflectReply` and `reflectSummary` server actions: thin adapters from the
 * reflect pipeline to DeepSpace. They store nothing about what a person says.
 * The only thing written is a per-person daily counter, scoped to the caller.
 */

import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { extractText } from '../recommend/parse'
import type { ChatMessage } from '../reflect/contract'
import { parseMessages, reflectReply, reflectSummary, type ReflectDeps } from '../reflect/pipeline'

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
      return r.success ? extractText(r.data) : null
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
export const reflectSummaryAction = handler((deps, messages) => reflectSummary(deps, messages))
