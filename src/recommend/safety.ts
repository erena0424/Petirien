/**
 * First-layer crisis check on the optional free-text note.
 *
 * This is deliberately conservative and will miss things. It is one of two
 * layers (the LLM also raises `needsSupportResources`), and neither is a
 * guarantee. When it fires, the app shows a static support card and makes no
 * recommendations. Wording of the phrase list is reviewed by Elena.
 */

const CRISIS_PATTERNS: RegExp[] = [
  /\bkill(ing)? myself\b/i,
  /\bsuicid(e|al)\b/i,
  /\bend (my life|it all)\b/i,
  /\b(want|wanna|wish) (to|i (was|were)) (die|dead)\b/i,
  /\bdon'?t want to (live|be alive|be here|exist|wake up)\b/i,
  /\b(hurt|harm|cut|injure)(ing)? myself\b/i,
  /\bself[- ]?harm\b/i,
  /\bno reason to (live|go on|keep going)\b/i,
  /\bbetter off (dead|without me)\b/i,
  /\bcan'?t (go on|do this anymore|keep going)\b/i,
]

export function detectCrisis(text: string | undefined): boolean {
  if (!text) return false
  const normalized = text.replace(/[‘’]/g, "'")
  return CRISIS_PATTERNS.some((p) => p.test(normalized))
}
