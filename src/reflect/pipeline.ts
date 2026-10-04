/**
 * The bunny chat and the journal summary, written against injected dependencies
 * so every path can be tested with fakes. Nothing here stores or logs what a
 * person says: replies are computed and returned, and the summary is returned
 * for the person to review before they save it.
 */

import { z } from 'zod'
import { nextUtcMidnight } from '../recommend/fallback'
import { extractText, parseJsonObject } from '../recommend/parse'
import { detectCrisis } from '../recommend/safety'
import {
  MAX_MESSAGES,
  MAX_MESSAGE_CHARS,
  MAX_TOTAL_CHARS,
  type ChatMessage,
  type ReplyResponse,
  type SummaryResponse,
} from './contract'
import {
  buildReplyPrompt,
  buildSummaryPrompt,
  cleanDraft,
  cleanReply,
  replySchema,
  summarySchema,
  TEMPLATE_ACK,
  type EarlierNote,
} from './llm'
import { mergeStyle, type BunnyStyle } from './style'

/** Bunny replies and summaries per person per UTC day. The app owner is exempt. */
export const REFLECT_DAILY_CAP = 80

export interface ReflectDeps {
  now(): Date
  /** Returns model text, or null on any failure. Must not retry. */
  llm(req: { system: string; user: string; maxTokens: number }): Promise<string | null>
  usageToday(): Promise<number>
  bumpUsage(): Promise<void>
  /** The person's most recent visible journal notes, newest first. Optional background. */
  recentNotes?(): Promise<EarlierNote[]>
  /** How the person likes the bunny to talk (fixed vocabulary only). */
  loadStyle?(): Promise<BunnyStyle>
  /** Stores the new style. Called only when something actually changed. */
  saveStyle?(next: BunnyStyle): Promise<void>
  /** The app owner is never capped. */
  exempt: boolean
}

const messagesSchema = z
  .array(
    z.object({
      role: z.enum(['user', 'bunny']),
      text: z.string().transform((t) => t.trim()).pipe(z.string().min(1).max(MAX_MESSAGE_CHARS)),
    }),
  )
  .min(1)
  .max(MAX_MESSAGES)

export function parseMessages(params: unknown): { ok: true; messages: ChatMessage[] } | { ok: false } {
  const r = messagesSchema.safeParse((params as { messages?: unknown } | null)?.messages)
  if (!r.success) return { ok: false }
  if (r.data.reduce((n, m) => n + m.text.length, 0) > MAX_TOTAL_CHARS) return { ok: false }
  return { ok: true, messages: r.data }
}

const userTexts = (messages: ChatMessage[]) => messages.filter((m) => m.role === 'user').map((m) => m.text)

/** Crisis language anywhere in what the person said stops the chat. */
const crisisInChat = (messages: ChatMessage[]) => userTexts(messages).some((t) => detectCrisis(t))

async function overCap(deps: ReflectDeps): Promise<boolean> {
  return !deps.exempt && (await deps.usageToday()) >= REFLECT_DAILY_CAP
}

/** Thrown by the model call when the app cannot use the model right now: its daily limit is reached, or the owner's credits or token are not available. */
export class UnavailableError extends Error {
  constructor() {
    super('model_unavailable')
  }
}

export async function reflectReply(deps: ReflectDeps, messages: ChatMessage[]): Promise<ReplyResponse> {
  if (messages[messages.length - 1]?.role !== 'user') return { status: 'error', message: 'Say something first.' }
  // Layer 1: no paid call at all when the person's words suggest a crisis.
  if (crisisInChat(messages)) return { status: 'support' }
  if (await overCap(deps)) return { status: 'capped', resetsAt: nextUtcMidnight(deps.now()) }
  await deps.bumpUsage()

  const earlier = (await deps.recentNotes?.().catch(() => [] as EarlierNote[])) ?? []
  const style = (await deps.loadStyle?.().catch(() => ({}) as BunnyStyle)) ?? {}
  let text: string | null
  try {
    text = await deps.llm({ ...buildReplyPrompt(messages, earlier, style), maxTokens: 300 })
  } catch (e) {
    if (e instanceof UnavailableError) return { status: 'unavailable' }
    throw e
  }
  const parsed = replySchema.safeParse(parseJsonObject(text))
  if (!parsed.success) {
    // Fail visibly rather than invent a reply: the person's message is still on screen and they can resend.
    return { status: 'error', message: "I couldn't answer just now. Your message is still here, so you can send it again." }
  }
  // Layer 2: the model's own flag.
  if (parsed.data.needsSupportResources) return { status: 'support' }

  // Learn how the person likes to be talked to, only when something changed. A failure here never affects the reply.
  if (deps.saveStyle && parsed.data.styleChange !== undefined) {
    const { next, changed } = mergeStyle(style, parsed.data.styleChange)
    if (changed) await deps.saveStyle(next).catch(() => undefined)
  }
  const reply = cleanReply(parsed.data.reply)
  // An offer only goes with a real reply, never with the stock acknowledgement.
  return reply ? { status: 'ok', reply, ...(parsed.data.offer === true ? { offer: true as const } : {}) } : { status: 'ok', reply: TEMPLATE_ACK }
}

export async function reflectSummary(deps: ReflectDeps, messages: ChatMessage[]): Promise<SummaryResponse> {
  if (userTexts(messages).length === 0) return { status: 'error', message: 'Say something to the bunny first.' }
  if (crisisInChat(messages)) return { status: 'support' }
  if (await overCap(deps)) return { status: 'capped', resetsAt: nextUtcMidnight(deps.now()) }
  await deps.bumpUsage()

  let text: string | null
  try {
    text = await deps.llm({ ...buildSummaryPrompt(messages), maxTokens: 2400 })
  } catch (e) {
    if (e instanceof UnavailableError) return { status: 'unavailable' }
    throw e
  }
  const parsed = summarySchema.safeParse(parseJsonObject(text))
  if (!parsed.success) {
    return { status: 'error', message: "I couldn't write the notes just now. Your chat is still here, so you can try again." }
  }
  if (parsed.data.needsSupportResources) return { status: 'support' }
  const draft = cleanDraft(parsed.data, userTexts(messages))
  if (!draft) {
    return { status: 'error', message: "I couldn't write good notes from that. You can keep chatting and try again." }
  }
  return { status: 'ok', draft }
}

export { extractText }
