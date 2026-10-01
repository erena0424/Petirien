import type { VideoSourceUsed } from '../contract'

/** A plain sentence about where this round of videos came from. Shown only to the app owner. */
export function describeSources(sources: VideoSourceUsed[] | undefined): string | null {
  if (!sources || sources.length === 0) return null
  const s = new Set(sources)
  const integration = s.has('integration')
  const google = s.has('google')
  const cache = s.has('cache')
  const parts: string[] = []
  if (integration && google) parts.push("DeepSpace's YouTube integration, with your Google key checking which videos can be embedded")
  else if (integration) parts.push("DeepSpace's YouTube integration")
  else if (google) parts.push("your own Google key (DeepSpace's integration did not answer)")
  if (cache) parts.push(parts.length ? 'and saved results from earlier' : 'saved results from earlier searches, with no new YouTube call')
  return `Videos came from ${parts.join(' ')}.`
}
