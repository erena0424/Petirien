/**
 * What a visitor chose before signing in, kept in this browser (and nowhere else) so signing in does not restart the
 * experience: the energy and time they picked, and the one suggestion they pressed Save on. Nothing here is about
 * how they feel or anything they wrote. Every read is checked, because storage can hold anything.
 */

import { getActivity } from '../catalog'
import { SAMPLE_VIDEOS, isEnergy, isMinutes, type PreviewInput } from './preview'

const CHOICE_KEY = 'petirien.preview'
const PENDING_KEY = 'petirien.pendingSave'

export type PendingSave = { kind: 'idea'; activityId: string } | { kind: 'video'; activityId: string; videoId: string }

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: signing in just starts fresh */
  }
}
function remove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* nothing to do */
  }
}

export const saveChoice = (c: PreviewInput) => write(CHOICE_KEY, { energy: c.energy, minutes: c.minutes })
export const clearChoice = () => remove(CHOICE_KEY)
export function loadChoice(): PreviewInput | null {
  const v = read(CHOICE_KEY) as Partial<PreviewInput> | null
  return v && isEnergy(v.energy) && isMinutes(v.minutes) ? { energy: v.energy, minutes: v.minutes } : null
}

export const savePending = (p: PendingSave) => write(PENDING_KEY, p)
export const clearPending = () => remove(PENDING_KEY)
export function loadPending(): PendingSave | null {
  const v = read(PENDING_KEY) as { kind?: unknown; activityId?: unknown; videoId?: unknown } | null
  if (!v || typeof v.activityId !== 'string' || !getActivity(v.activityId)) return null
  if (v.kind === 'idea') return { kind: 'idea', activityId: v.activityId }
  if (v.kind === 'video' && SAMPLE_VIDEOS.some((s) => s.activityId === v.activityId && s.videoId === v.videoId)) {
    return { kind: 'video', activityId: v.activityId, videoId: v.videoId as string }
  }
  return null
}
