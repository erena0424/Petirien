import { useMutations, useQuery } from 'deepspace'
import type { JournalDraft } from '../reflect/contract'

export interface JournalRow {
  title: string
  notes?: string[]
  feelings?: string[]
  bunnyNote?: string
}

/** The signed-in person's saved journal entries (the bunny's notes), newest first. */
export function useJournal() {
  const query = useQuery<JournalRow>('journalEntries', { orderBy: 'createdAt', orderDir: 'desc' })
  const { createConfirmed, removeConfirmed, ready } = useMutations<JournalRow>('journalEntries')

  /** Resolves true when the server confirmed the save. */
  async function save(draft: JournalDraft): Promise<boolean> {
    if (!ready) return false
    try {
      await createConfirmed({ title: draft.title, notes: draft.notes, feelings: draft.feelings, bunnyNote: draft.bunnyNote })
      return true
    } catch {
      return false // a rejected write is shown as a toast by the data layer
    }
  }

  async function remove(recordId: string): Promise<boolean> {
    if (!ready) return false
    try {
      await removeConfirmed(recordId)
      return true
    } catch {
      return false
    }
  }

  return { status: query.status, records: query.records, ready, save, remove }
}
