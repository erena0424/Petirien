import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CATALOG, getActivity } from '../catalog'
import { TIME_CHOICES } from '../lib/free-time'
import { clearChoice, clearPending, loadChoice, loadPending, saveChoice, savePending } from './pending'
import { DEFAULT_PREVIEW, SAMPLE_VIDEOS, isEnergy, isMinutes, previewPicks, thumbnailFor, watchUrlFor } from './preview'

const at = (day: number, h = 12) => new Date(2026, 9, day, h)

describe('SAMPLE_VIDEOS', () => {
  it('are real video activities, each with a plain 11 character id, and only the id is kept', () => {
    for (const s of SAMPLE_VIDEOS) {
      expect(getActivity(s.activityId)?.video, s.activityId).toBe(true)
      expect(s.videoId).toMatch(/^[A-Za-z0-9_-]{11}$/)
      expect(Object.keys(s).sort()).toEqual(['activityId', 'videoId']) // nothing from YouTube's metadata is stored
    }
    expect(new Set(SAMPLE_VIDEOS.map((s) => s.videoId)).size).toBe(SAMPLE_VIDEOS.length)
    expect(new Set(SAMPLE_VIDEOS.map((s) => s.activityId)).size).toBe(SAMPLE_VIDEOS.length)
  })
  it('build standard YouTube links from the id', () => {
    expect(thumbnailFor('abcdefghijk')).toBe('https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg')
    expect(watchUrlFor('abcdefghijk')).toBe('https://www.youtube.com/watch?v=abcdefghijk')
  })
})

describe('previewPicks', () => {
  it('gives two ideas with steps and one video that fit, for every energy and time', () => {
    for (const energy of [1, 2, 3, 4, 5]) {
      for (const minutes of TIME_CHOICES) {
        const p = previewPicks({ energy, minutes }, at(2))
        expect(p.ideas, `${energy}/${minutes}`).toHaveLength(2)
        expect(p.video, `${energy}/${minutes}`).not.toBeNull()
        for (const a of [...p.ideas, p.video!.activity]) {
          expect(a.minMinutes).toBeLessThanOrEqual(minutes)
          expect(a.effort).toBeLessThanOrEqual(energy <= 2 ? 1 : energy === 3 ? 2 : 3)
          expect(a.steps.length).toBeGreaterThanOrEqual(3)
        }
        expect(p.ideas[0]!.id).not.toBe(p.ideas[1]!.id)
        for (const a of p.ideas) expect(a.id, `${energy}/${minutes}`).not.toBe(p.video!.activity.id) // never the same thing twice
      }
    }
  })
  it('leaves out the walk, which needs a location', () => {
    for (let d = 1; d <= 20; d++) expect(previewPicks({ energy: 5, minutes: 30 }, at(d)).ideas.some((a) => a.id === 'walk-nearby')).toBe(false)
  })
  it('the video fits the time: a five minute choice never gets the twelve minute guided videos', () => {
    const ids = new Set<string | undefined>()
    for (let d = 1; d <= 10; d++) ids.add(previewPicks({ energy: 3, minutes: 5 }, at(d)).video?.activity.id)
    expect([...ids].every((id) => ['desk-stretch', 'rain-sounds', 'indoor-walk'].includes(id!))).toBe(true) // the ones that can be started in five minutes
    // With low energy the quick stretch is the match; with more energy the easy walk is.
    for (let d = 1; d <= 6; d++) expect(['desk-stretch', 'rain-sounds']).toContain(previewPicks({ energy: 2, minutes: 5 }, at(d)).video?.activity.id)
    for (let d = 1; d <= 6; d++) expect(previewPicks({ energy: 5, minutes: 5 }, at(d)).video?.activity.id).toBe('indoor-walk')
  })
  it('different energy and time give visibly different suggestions, not the same defaults', () => {
    const key = (energy: number, minutes: number) => {
      const p = previewPicks({ energy, minutes }, at(2))
      return `${p.video?.activity.id}|${p.ideas.map((a) => a.id).join(',')}`
    }
    const all = new Set<string>()
    const videos = new Set<string | undefined>()
    for (const energy of [1, 2, 3, 4, 5]) {
      for (const minutes of TIME_CHOICES) {
        all.add(key(energy, minutes))
        videos.add(previewPicks({ energy, minutes }, at(2)).video?.activity.id)
      }
    }
    expect(all.size).toBeGreaterThanOrEqual(8) // 25 choices, many different results
    expect(videos.size).toBeGreaterThanOrEqual(3)
    // The extremes are not the default, and not each other.
    expect(key(1, 5)).not.toBe(key(3, 10))
    expect(key(5, 30)).not.toBe(key(3, 10))
    expect(key(1, 5)).not.toBe(key(5, 30))
  })
  it('a drained person gets the gentlest things, and the more energy, the more active the suggestions', () => {
    const all = (energy: number, minutes: number, d = 2) => {
      const p = previewPicks({ energy, minutes }, at(d))
      return [p.video!.activity, ...p.ideas]
    }
    const avgEffort = (energy: number, minutes: number) => {
      let total = 0
      let n = 0
      for (let d = 1; d <= 14; d++) for (const a of all(energy, minutes, d)) (total += a.effort), n++
      return total / n
    }
    for (const minutes of [10, 15, 20, 30]) {
      const levels = [1, 2, 3, 4, 5].map((e) => avgEffort(e, minutes))
      for (let i = 1; i < levels.length; i++) expect(levels[i]!, `${minutes} min, energy ${i + 1}`).toBeGreaterThanOrEqual(levels[i - 1]! - 1e-9) // never gentler when there is more energy
      expect(levels[4]!, `${minutes} min`).toBeGreaterThan(levels[0]!) // and clearly more active at the top
    }
    for (const minutes of TIME_CHOICES) for (const a of all(1, minutes)) expect(a.effort, `drained ${minutes}`).toBe(1)
    // The top of the scale is not rain sounds and a thank-you note: something active leads.
    for (let d = 1; d <= 14; d++) expect(Math.max(...all(5, 15, d).map((a) => a.effort)), `day ${d}`).toBe(2)
    expect(all(5, 15).some((a) => a.category === 'movement')).toBe(true)
  })
  it('is steady within a day and varies between days, so it is never random', () => {
    const key = (d: number, h = 12) => JSON.stringify(previewPicks(DEFAULT_PREVIEW, at(d, h)).ideas.map((a) => a.id))
    expect(key(3, 8)).toBe(key(3, 20))
    expect(new Set([1, 2, 3, 4, 5, 6, 7].map((d) => key(d))).size).toBeGreaterThan(1)
    const videos = new Set([1, 2, 3, 4, 5, 6, 7].map((d) => previewPicks({ energy: 3, minutes: 15 }, at(d)).video?.videoId))
    expect(videos.size).toBeGreaterThan(1)
  })
  it('falls back to the default for odd input instead of failing', () => {
    for (const bad of [{ energy: 0, minutes: 10 }, { energy: 3, minutes: 7 }, { energy: NaN, minutes: 5 }, { energy: 9, minutes: 99 }]) {
      const p = previewPicks(bad as never, at(2))
      expect(p.ideas).toHaveLength(2)
    }
  })
  it('uses no forbidden words in anything it shows', () => {
    const bad = /\b(diagnos|treat|cure|therap|clinical|prescri)\w*/i
    for (const a of CATALOG) if (SAMPLE_VIDEOS.some((s) => s.activityId === a.id)) expect(`${a.title} ${a.blurb}`).not.toMatch(bad)
  })
})

describe('validators', () => {
  it('accept only the real scales', () => {
    expect(isEnergy(3)).toBe(true)
    for (const v of [0, 6, 2.5, '3', null, undefined, NaN]) expect(isEnergy(v)).toBe(false)
    expect(isMinutes(15)).toBe(true)
    for (const v of [0, 7, 100, '10', null]) expect(isMinutes(v)).toBe(false)
  })
})

/** A stand-in for the browser's storage: the tests run in Node, which has none. */
function fakeStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  }
}

describe('what a visitor chose, kept in the browser', () => {
  beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()))
  it('remembers the energy and time, and forgets them on request', () => {
    expect(loadChoice()).toBeNull()
    saveChoice({ energy: 2, minutes: 15 })
    expect(loadChoice()).toEqual({ energy: 2, minutes: 15 })
    clearChoice()
    expect(loadChoice()).toBeNull()
  })
  it('ignores a stored choice that is not a real one', () => {
    for (const raw of ['{"energy":9,"minutes":10}', '{"energy":3,"minutes":7}', '{"energy":"3","minutes":10}', 'not json', '[]', 'null']) {
      localStorage.setItem('petirien.preview', raw)
      expect(loadChoice(), raw).toBeNull()
    }
  })
  it('remembers the one thing they pressed Save on, an idea or a sample video', () => {
    savePending({ kind: 'idea', activityId: 'tidy-one-thing' })
    expect(loadPending()).toEqual({ kind: 'idea', activityId: 'tidy-one-thing' })
    savePending({ kind: 'video', activityId: 'body-scan', videoId: 'aH72AScs0qk' })
    expect(loadPending()).toEqual({ kind: 'video', activityId: 'body-scan', videoId: 'aH72AScs0qk' })
    clearPending()
    expect(loadPending()).toBeNull()
  })
  it('never trusts stored data: unknown activities, made-up videos and odd kinds are ignored', () => {
    const put = (v: unknown) => localStorage.setItem('petirien.pendingSave', JSON.stringify(v))
    put({ kind: 'idea', activityId: 'no-such-activity' })
    expect(loadPending()).toBeNull()
    put({ kind: 'video', activityId: 'body-scan', videoId: 'ZZZZZZZZZZZ' }) // not one of the samples
    expect(loadPending()).toBeNull()
    put({ kind: 'video', activityId: 'desk-stretch', videoId: 'aH72AScs0qk' }) // a sample, but for another activity
    expect(loadPending()).toBeNull()
    put({ kind: 'other', activityId: 'tidy-one-thing' })
    expect(loadPending()).toBeNull()
    localStorage.setItem('petirien.pendingSave', '{{{')
    expect(loadPending()).toBeNull()
  })
})

describe('storage that is unavailable', () => {
  it('never throws: a visitor just starts fresh', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    expect(() => saveChoice({ energy: 3, minutes: 10 })).not.toThrow()
    expect(loadChoice()).toBeNull()
    expect(() => savePending({ kind: 'idea', activityId: 'tidy-one-thing' })).not.toThrow()
    expect(loadPending()).toBeNull()
    expect(() => clearChoice()).not.toThrow()
    expect(() => clearPending()).not.toThrow()
  })
})
