import { useMemo } from 'react'
import { useMutations, useQuery } from 'deepspace'
import { DEFAULT_PREFERENCES, normalizePreferences, type Preferences, type ScreenMode } from './preferences'

type Row = { likedTags?: string[]; avoid?: string[]; defaultMinutes?: number; screenMode?: string; screenFree?: number }

/** The signed-in person's preferences (one row per person; the database enforces it). */
export function usePreferences() {
  const query = useQuery<Row>('preferences', { limit: 1 })
  const { createConfirmed, putConfirmed, ready } = useMutations<Row>('preferences')
  const record = query.records[0]

  const prefs = useMemo<Preferences>(
    () =>
      record
        ? normalizePreferences({
            likedTags: record.data.likedTags,
            avoid: record.data.avoid,
            defaultMinutes: record.data.defaultMinutes,
            // `screenFree` is the older yes/no column; keep reading it for existing rows.
            screen: (record.data.screenMode ?? (record.data.screenFree === 1 ? 'none' : 'auto')) as ScreenMode,
          })
        : DEFAULT_PREFERENCES,
    [record],
  )

  async function save(next: Preferences): Promise<boolean> {
    if (!ready) return false
    const clean = normalizePreferences(next)
    const row: Row = {
      likedTags: clean.likedTags,
      avoid: clean.avoid,
      screenMode: clean.screen,
      ...(clean.defaultMinutes ? { defaultMinutes: clean.defaultMinutes } : {}),
    }
    try {
      if (record) await putConfirmed(record.recordId, { ...row, defaultMinutes: clean.defaultMinutes ?? 0 })
      else await createConfirmed(row)
      return true
    } catch {
      return false // a rejected write is shown as a toast by the data layer
    }
  }

  return { status: query.status, prefs, hasRecord: !!record, ready, save }
}
