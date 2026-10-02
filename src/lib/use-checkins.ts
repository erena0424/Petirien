import { useEffect } from 'react'
import { useMutations, useQuery } from 'deepspace'

export interface CheckinRow {
  mood: number
  energy: number
  minutes?: number
  goal?: string
  note?: string
}

/** The signed-in person's check-ins (mood and energy, 1 to 5), newest first. Read-only here; History can delete them. */
export function useCheckins() {
  const query = useQuery<CheckinRow>('checkins', { orderBy: 'createdAt', orderDir: 'desc' })
  const { createConfirmed, removeConfirmed } = useMutations<CheckinRow>('checkins')

  // Development only: lets browser tests put check-ins in the real local database (a test cannot go through the
  // check-in flow without paid calls). Dead code in a production build, where import.meta.env.DEV is false.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __petirien?: Record<string, unknown> }
    w.__petirien = {
      ...w.__petirien,
      seedCheckin: (row: CheckinRow) => createConfirmed({ minutes: 10, ...row }),
      removeCheckin: (id: string) => removeConfirmed(id),
      clearCheckins: async () => {
        for (const r of query.records) await removeConfirmed(r.recordId)
      },
    }
  }, [createConfirmed, removeConfirmed, query.records])

  return { status: query.status, records: query.records }
}
