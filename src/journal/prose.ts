/**
 * Journal notes are stored as separate sentences (so each can be checked against what the person said), but they are
 * shown as one passage, the way someone would write in a journal. Older entries stored short fragments, so a missing
 * full stop is added.
 */
export function proseOf(notes: string[] | undefined): string {
  return (notes ?? [])
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n) => (/[.!?…]$/.test(n) ? n : `${n}.`))
    .join(' ')
}
