/**
 * One-tap feedback on the bunny's replies. A thumbs-down offers four reasons;
 * each maps straight onto the fixed style vocabulary, so tapping one changes
 * how the bunny talks right away and nothing outside that vocabulary can be stored.
 */

import { mergeStyle, normalizeStyle, type BunnyStyle } from './style'

export type FeedbackReason = 'too_long' | 'too_many_questions' | 'too_cheery' | 'too_serious'

export interface ReasonChoice {
  id: FeedbackReason
  label: string
  change: BunnyStyle
  /** What the bunny says back. Fixed text, never model-written. */
  ack: string
}

export const REASONS: ReasonChoice[] = [
  { id: 'too_long', label: 'Too long', change: { length: 'short' }, ack: "Got it. I'll keep my replies shorter." },
  { id: 'too_many_questions', label: 'Too many questions', change: { questions: 'fewer' }, ack: "Got it. I'll ask fewer questions." },
  { id: 'too_cheery', label: 'Too cheery', change: { tone: 'gentle' }, ack: "Got it. I'll be calmer." },
  { id: 'too_serious', label: 'Too serious', change: { tone: 'upbeat' }, ack: "Got it. I'll lighten up a bit." },
]

export const NO_CHANGE_ACK = "I'm already doing that. Tell me more about what you'd like and I'll try."
export const THANKS_ACK = 'Glad that helped.'

export interface FeedbackResult {
  /** The style to store, or null when nothing needs writing. */
  next: BunnyStyle | null
  /** What to show the person. */
  ack: string
  /** The style to put back if the person taps Undo. */
  previous: BunnyStyle
}

export function applyFeedback(reason: FeedbackReason, current: BunnyStyle): FeedbackResult {
  const choice = REASONS.find((r) => r.id === reason)
  const previous = normalizeStyle(current)
  if (!choice) return { next: null, ack: NO_CHANGE_ACK, previous }
  const { next, changed } = mergeStyle(previous, choice.change)
  return changed ? { next, ack: choice.ack, previous } : { next: null, ack: NO_CHANGE_ACK, previous }
}
