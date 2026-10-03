/** Shared by the worker and the client. */

export type ChatRole = 'user' | 'bunny'

export interface ChatMessage {
  role: ChatRole
  text: string
}

/** What the bunny writes after a chat. Stored as a journal entry only if the person saves it. */
export interface JournalDraft {
  title: string
  /** The person's own journal sentences, in first person and as close to their own words as makes sense. Shown together as one passage. */
  notes: string[]
  /** Up to three plain feeling words the person said or clearly implied. */
  feelings: string[]
  /** One kind closing sentence. */
  bunnyNote: string
}

export type ReplyResponse =
  /** `offer` is true when a small activity would plainly help; the app then shows an optional link, never forces one. */
  | { status: 'ok'; reply: string; offer?: true }
  /** Crisis language: the app shows the support card and the bunny stops replying. */
  | { status: 'support' }
  | { status: 'capped'; resetsAt: string }
  | { status: 'error'; message: string }

export type SummaryResponse =
  | { status: 'ok'; draft: JournalDraft }
  | { status: 'support' }
  | { status: 'capped'; resetsAt: string }
  | { status: 'error'; message: string }

export const MAX_MESSAGES = 30
export const MAX_MESSAGE_CHARS = 1500
export const MAX_TOTAL_CHARS = 12_000
