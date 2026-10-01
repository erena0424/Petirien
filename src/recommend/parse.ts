/**
 * Tolerant parsing of LLM integration responses.
 *
 * UNVERIFIED: the exact response shape of `anthropic/chat-completion` has not
 * been confirmed with a real call. `extractText` accepts the Anthropic
 * Messages shape, a plain `text`, and the OpenAI chat shape. Confirm with one
 * real call and tighten.
 */

export function extractText(data: unknown): string | null {
  if (typeof data === 'string') return data
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>

  if (Array.isArray(d.content)) {
    const parts = d.content
      .map((c) => (c && typeof c === 'object' ? (c as Record<string, unknown>).text : undefined))
      .filter((t): t is string => typeof t === 'string')
    if (parts.length) return parts.join('')
  }
  if (typeof d.text === 'string') return d.text
  if (typeof d.content === 'string') return d.content

  const choices = d.choices
  if (Array.isArray(choices)) {
    const msg = (choices[0] as Record<string, unknown> | undefined)?.message as
      | Record<string, unknown>
      | undefined
    if (typeof msg?.content === 'string') return msg.content
  }
  return null
}

/** Pull the first JSON object out of model text (handles code fences and chatter). */
export function parseJsonObject(text: string | null): unknown | null {
  if (!text) return null
  const stripped = text.replace(/```(?:json)?/gi, '')
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(stripped.slice(start, end + 1))
  } catch {
    return null
  }
}
