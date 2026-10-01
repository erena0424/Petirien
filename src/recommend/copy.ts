/**
 * Guard for any model-written text that reaches the user.
 * Returns null when the text must be replaced by template copy.
 */

const FORBIDDEN = /\b(diagnos\w*|treat\w*|cure\w*|therap\w*|clinical\w*|prescrib\w*)\b/i
const STOCK = /\b(perfect(ly)?|ideal(ly)?|journey|embark\w*|delve\w*|unlock\w*|dive into|game[- ]changer|elevate\w*|tapestry|seamless\w*)\b/i
const LINK = /https?:\/\/|www\.|\b[\w-]+\.(com|org|net|io|be|tv)\b/i

export function sanitizeCopy(text: unknown, maxChars: number): string | null {
  if (typeof text !== 'string') return null
  // Em and en dashes read as machine-written; turn them into plain punctuation.
  const t = text.replace(/\s*[\u2014\u2013]\s*/g, ', ').replace(/\s+/g, ' ').trim()
  if (!t || t.length > maxChars) return null
  if (LINK.test(t) || FORBIDDEN.test(t) || STOCK.test(t) || /!/.test(t)) return null
  return t
}
