/**
 * Event reflections: what a person writes after a plan. Stored as a Journal
 * entry (kind 'reflection') in their own private Journal. No model is involved.
 */

export const PROMPTS = ['How did it go?', "Anything you'd like to remember?", 'What felt good or difficult?'] as const

/** Plain feeling words to pick from, all optional. Neutral on purpose: no "right" answer. */
export const FEELINGS = ['Good', 'Okay', 'Mixed', 'Hard', 'Not sure'] as const
export type Feeling = (typeof FEELINGS)[number]

export const MAX_REFLECTION_CHARS = 2000

export const nextPrompt = (i: number) => (i + 1) % PROMPTS.length

export const isFeeling = (v: unknown): v is Feeling => typeof v === 'string' && (FEELINGS as readonly string[]).includes(v)

export interface ReflectionInput {
  text: string
  feeling: Feeling | null
}

/** What gets stored, or null when there is nothing to save. Text is trimmed and capped. */
export function cleanReflection(input: ReflectionInput): { notes: string[]; feelings: string[] } | null {
  const text = input.text.trim().slice(0, MAX_REFLECTION_CHARS)
  const feeling = isFeeling(input.feeling) ? input.feeling : null
  if (!text && !feeling) return null
  return { notes: text ? [text] : [], feelings: feeling ? [feeling] : [] }
}

interface Row {
  kind?: string
  notes?: string[]
  feelings?: string[]
}

export const isReflection = (row: Row) => row.kind === 'reflection'

/** The text and feeling of a stored reflection, tolerant of odd stored data. */
export function readReflection(row: Row): ReflectionInput {
  const text = Array.isArray(row.notes) && typeof row.notes[0] === 'string' ? row.notes[0] : ''
  const f = Array.isArray(row.feelings) ? row.feelings[0] : undefined
  return { text, feeling: isFeeling(f) ? f : null }
}

/** The journal rows the bunny may see as background: its own notes only, never a person's reflections. Newest first, at most `limit`. */
export function backgroundRows<T extends { kind?: unknown }>(rows: T[], limit = 5): T[] {
  return rows.filter((r) => r.kind !== 'reflection').slice(0, limit)
}
