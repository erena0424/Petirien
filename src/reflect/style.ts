/**
 * How the person likes the bunny to talk: a tiny, fixed vocabulary.
 *
 * This is what lets the bunny learn automatically without keeping a profile of
 * the person. Every field is an enum, so there is nowhere to put anything the
 * person said or any detail of their life. Anything outside the vocabulary is
 * dropped. The values are visible and editable under Preferences.
 */

export const TONES = ['gentle', 'upbeat', 'direct', 'playful'] as const
export const LENGTHS = ['short', 'longer'] as const
export const QUESTIONS = ['fewer', 'more'] as const
export const SUGGESTIONS = ['fewer', 'more'] as const

export interface BunnyStyle {
  tone?: (typeof TONES)[number]
  length?: (typeof LENGTHS)[number]
  questions?: (typeof QUESTIONS)[number]
  suggestions?: (typeof SUGGESTIONS)[number]
}

export type StyleKey = keyof BunnyStyle

const ALLOWED: { [K in StyleKey]-?: readonly string[] } = {
  tone: TONES,
  length: LENGTHS,
  questions: QUESTIONS,
  suggestions: SUGGESTIONS,
}

export const STYLE_KEYS = Object.keys(ALLOWED) as StyleKey[]

/** Keeps only known keys with known values. Anything else, including free text, is dropped. */
export function normalizeStyle(raw: unknown): BunnyStyle {
  const out: Record<string, string> = {}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const k of STYLE_KEYS) {
      const v = (raw as Record<string, unknown>)[k]
      if (typeof v === 'string' && ALLOWED[k].includes(v)) out[k] = v
    }
  }
  return out as BunnyStyle
}

/** Applies an update to the current style. `changed` is false when it would not change anything. */
export function mergeStyle(current: BunnyStyle, update: unknown): { next: BunnyStyle; changed: boolean } {
  const clean = normalizeStyle(update)
  const next: BunnyStyle = { ...normalizeStyle(current), ...clean }
  const changed = STYLE_KEYS.some((k) => next[k] !== normalizeStyle(current)[k])
  return { next, changed }
}

export const STYLE_LABELS: { [K in StyleKey]: { question: string; options: Record<string, string> } } = {
  tone: {
    question: 'How should the bunny sound?',
    options: { gentle: 'Gentle and calm', upbeat: 'Upbeat and cheerful', direct: 'Plain and direct', playful: 'Playful' },
  },
  length: { question: 'How long should replies be?', options: { short: 'Short', longer: 'A bit longer' } },
  questions: { question: 'How many questions?', options: { fewer: 'Fewer questions', more: 'More questions' } },
  suggestions: { question: 'Ideas and suggestions?', options: { fewer: 'Fewer suggestions', more: 'More suggestions' } },
}

/** The learned choices as plain phrases, for the Preferences page. */
export function describeStyle(style: BunnyStyle): string[] {
  const s = normalizeStyle(style)
  return STYLE_KEYS.filter((k) => s[k]).map((k) => STYLE_LABELS[k].options[s[k] as string]!)
}

/** One line for the bunny's instructions, or null when there is nothing to say. */
export function styleLine(style: BunnyStyle): string | null {
  const s = normalizeStyle(style)
  const parts: string[] = []
  if (s.tone) parts.push({ gentle: 'a gentle, calm tone', upbeat: 'an upbeat, cheerful tone', direct: 'a plain, direct tone', playful: 'a playful tone' }[s.tone])
  if (s.length) parts.push(s.length === 'short' ? 'very short replies (one or two sentences)' : 'somewhat longer replies (three or four sentences)')
  if (s.questions) parts.push(s.questions === 'fewer' ? 'few or no questions' : 'a gentle question most of the time')
  if (s.suggestions) parts.push(s.suggestions === 'fewer' ? 'no suggestions unless asked' : 'a small suggestion or perspective when it fits')
  return parts.length ? `This person has said they like: ${parts.join('; ')}. Follow this style unless it would be unkind or unsafe.` : null
}
