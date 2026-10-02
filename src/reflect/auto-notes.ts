/**
 * Automatic notes: the bunny writes a short note about a saved conversation
 * so context is not lost even if the person never asks. The server reads the
 * stored messages itself (never text sent by the browser), covers only what
 * earlier notes did not, and does nothing unless the chat has gone quiet or
 * the person has moved on.
 */

import type { ChatMessage, JournalDraft } from './contract'
import { reflectSummary, type ReflectDeps } from './pipeline'

/** A chat is "done" for a while after this long with no new message. */
export const QUIET_MS = 30 * 60 * 1000

/** The plan a chat was started about, so its notes can sit on that plan's date. */
export interface PlanLink {
  id: string
  title: string
  start: string
}

export interface ConversationState {
  lastMessageAt: number
  /** How many messages earlier notes already cover. */
  notedUpTo: number
  plan?: PlanLink
}

/** Whether notes are due. Pure, so the browser and the server apply the same rule. */
export function notesDue(c: ConversationState, messageCount: number, now: number, force = false): 'due' | 'nothing_new' | 'too_soon' {
  if (messageCount <= c.notedUpTo) return 'nothing_new'
  if (!force && now - c.lastMessageAt < QUIET_MS) return 'too_soon'
  return 'due'
}

export interface AutoNoteDeps extends ReflectDeps {
  /** The conversation if it exists AND belongs to the caller; otherwise null. */
  loadConversation(id: string): Promise<ConversationState | null>
  /** All stored messages of that conversation, in order. */
  loadMessages(id: string): Promise<ChatMessage[]>
  /** Stores the note and moves `notedUpTo` forward in one step. */
  writeNote(id: string, draft: JournalDraft, notedUpTo: number, plan?: PlanLink): Promise<void>
  /** Marks messages as covered without writing a note (used when a note must not be written). */
  skipTo(id: string, notedUpTo: number): Promise<void>
}

export type AutoNoteResult =
  | { status: 'ok' }
  | { status: 'nothing_new' | 'too_soon' | 'not_found' | 'capped' | 'error' }
  /** Crisis words in the new messages: no note is written, and the person is not asked again. */
  | { status: 'support' }

export async function writeAutoNote(deps: AutoNoteDeps, conversationId: string, opts: { force?: boolean } = {}): Promise<AutoNoteResult> {
  const conv = await deps.loadConversation(conversationId)
  if (!conv) return { status: 'not_found' }
  const all = await deps.loadMessages(conversationId)
  const due = notesDue(conv, all.length, deps.now().getTime(), opts.force)
  if (due !== 'due') return { status: due }

  // Only what the earlier notes did not cover.
  const fresh = all.slice(conv.notedUpTo)
  const res = await reflectSummary(deps, fresh)
  if (res.status === 'ok') {
    await deps.writeNote(conversationId, res.draft, all.length, conv.plan)
    return { status: 'ok' }
  }
  if (res.status === 'support') {
    // Do not write notes about a crisis conversation, and do not retry it forever.
    await deps.skipTo(conversationId, all.length)
    return { status: 'support' }
  }
  if (res.status === 'capped') return { status: 'capped' }
  return { status: 'error' }
}

/** A short conversation title from the first thing the person said. */
export function titleFromFirstMessage(text: string, max = 40): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return 'New conversation'
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 15 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}
