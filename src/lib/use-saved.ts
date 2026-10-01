import { useMemo, useRef, useState } from 'react'
import { useMutations, useQuery } from 'deepspace'
import type { VideoRef } from '../contract'
import { toSavedData, type Availability, type SavedData } from './saved'

/** The signed-in person's saved videos, plus save / unsave / edit helpers. */
export function useSavedVideos() {
  const query = useQuery<SavedData>('savedVideos', { orderBy: 'createdAt', orderDir: 'desc' })
  // Confirmed variants wait for the server's acknowledgement, so a quick tap on
  // Remove followed by leaving the page cannot lose the write.
  const { createConfirmed, putConfirmed, removeConfirmed, ready } = useMutations<SavedData>('savedVideos')
  const pending = useRef(new Set<string>())
  // Optimistic UI: the button flips at once; the server's confirmation follows.
  const [saving, setSaving] = useState<string[]>([])
  const [removing, setRemoving] = useState<string[]>([])

  const byVideoId = useMemo(() => new Map(query.records.map((r) => [r.data.videoId, r])), [query.records])

  async function save(video: VideoRef, activityId: string) {
    // One saved row per video (the database enforces it too); ignore double taps.
    if (!ready || byVideoId.has(video.videoId) || pending.current.has(video.videoId)) return
    pending.current.add(video.videoId)
    setSaving((s) => [...s, video.videoId])
    try {
      await createConfirmed(toSavedData(video, activityId))
    } catch {
      /* a rejected write is already shown as a toast by the data layer */
    } finally {
      pending.current.delete(video.videoId)
      setSaving((s) => s.filter((id) => id !== video.videoId))
    }
  }

  async function unsave(videoId: string) {
    const rec = byVideoId.get(videoId)
    if (!ready || !rec) return
    setRemoving((r) => [...r, videoId])
    try {
      await removeConfirmed(rec.recordId)
    } catch {
      /* shown as a toast by the data layer */
    } finally {
      setRemoving((r) => r.filter((id) => id !== videoId))
    }
  }

  /** True for saved videos and ones being saved; false while one is being removed. */
  const isSaved = (videoId: string) =>
    !removing.includes(videoId) && (byVideoId.has(videoId) || saving.includes(videoId))

  return {
    status: query.status,
    isSaved,
    records: query.records,
    byVideoId,
    ready,
    save,
    unsave,
    setNote: (recordId: string, userNote: string) =>
      ready ? putConfirmed(recordId, { userNote }).catch(() => undefined) : Promise.resolve(),
    setAvailability: (recordId: string, availability: Availability) =>
      ready ? putConfirmed(recordId, { availability }).catch(() => undefined) : Promise.resolve(),
  }
}
