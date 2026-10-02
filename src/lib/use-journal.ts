import { useEffect } from 'react'
import { useMutations, useQuery } from 'deepspace'
import type { JournalDraft } from '../reflect/contract'
import { cleanReflection, isReflection, type ReflectionInput } from '../plans/reflection'

export interface JournalRow {
  title: string
  notes?: string[]
  feelings?: string[]
  bunnyNote?: string
  /** 'reflection' for something the person wrote about a plan. */
  kind?: string
  eventId?: string
  eventTitle?: string
  eventStart?: string
}

/** The signed-in person's saved journal entries (the bunny's notes), newest first. */
export function useJournal() {
  const query = useQuery<JournalRow>('journalEntries', { orderBy: 'createdAt', orderDir: 'desc' })
  const { createConfirmed, putConfirmed, removeConfirmed, ready } = useMutations<JournalRow>('journalEntries')

  // Development only: lets browser tests put entries in the real local database, because a test cannot (and must not)
  // call the model that writes them. Dead code in a production build, where import.meta.env.DEV is false.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __petirien?: Record<string, unknown> }
    w.__petirien = { ...w.__petirien, seedJournal: (row: JournalRow) => createConfirmed(row) }
  }, [createConfirmed])

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

  /** The saved reflection for a plan, if there is one. */
  const reflectionFor = (eventId: string) => query.records.find((r) => isReflection(r.data) && r.data.eventId === eventId)

  /** Saves a reflection for a plan: writes again over the existing one, so there is one per plan. Resolves true when confirmed. */
  async function saveReflection(plan: { id: string; title: string; start: string }, input: ReflectionInput): Promise<boolean> {
    const clean = cleanReflection(input)
    if (!ready || !clean) return false
    try {
      const existing = reflectionFor(plan.id)
      if (existing) await putConfirmed(existing.recordId, { notes: clean.notes, feelings: clean.feelings })
      else await createConfirmed({ title: plan.title, notes: clean.notes, feelings: clean.feelings, kind: 'reflection', eventId: plan.id, eventTitle: plan.title, eventStart: plan.start })
      return true
    } catch {
      return false
    }
  }

  return { status: query.status, records: query.records, ready, save, remove, reflectionFor, saveReflection }
}
