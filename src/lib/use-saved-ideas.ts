import { useMemo, useRef, useState } from 'react'
import { useMutations, useQuery } from 'deepspace'

export interface SavedIdea {
  activityId: string
  userNote?: string
}

/** The signed-in person's saved ideas (activities saved without a video). */
export function useSavedIdeas() {
  const query = useQuery<SavedIdea>('savedIdeas', { orderBy: 'createdAt', orderDir: 'desc' })
  const { createConfirmed, putConfirmed, removeConfirmed, ready } = useMutations<SavedIdea>('savedIdeas')
  const pending = useRef(new Set<string>())
  const [saving, setSaving] = useState<string[]>([])
  const [removing, setRemoving] = useState<string[]>([])

  const byActivity = useMemo(() => new Map(query.records.map((r) => [r.data.activityId, r])), [query.records])

  async function save(activityId: string) {
    if (!ready || byActivity.has(activityId) || pending.current.has(activityId)) return
    pending.current.add(activityId)
    setSaving((s) => [...s, activityId])
    try {
      await createConfirmed({ activityId })
    } catch {
      /* a rejected write is shown as a toast by the data layer */
    } finally {
      pending.current.delete(activityId)
      setSaving((s) => s.filter((id) => id !== activityId))
    }
  }

  async function unsave(activityId: string) {
    const rec = byActivity.get(activityId)
    if (!ready || !rec) return
    setRemoving((r) => [...r, activityId])
    try {
      await removeConfirmed(rec.recordId)
    } catch {
      /* shown as a toast by the data layer */
    } finally {
      setRemoving((r) => r.filter((id) => id !== activityId))
    }
  }

  return {
    status: query.status,
    ready,
    records: query.records,
    isSaved: (activityId: string) => !removing.includes(activityId) && (byActivity.has(activityId) || saving.includes(activityId)),
    save,
    unsave,
    setNote: (recordId: string, userNote: string) =>
      ready ? putConfirmed(recordId, { userNote }).catch(() => undefined) : Promise.resolve(),
  }
}
