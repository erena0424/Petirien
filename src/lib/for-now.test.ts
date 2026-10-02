import { describe, expect, it } from 'vitest'
import { CATALOG } from '../catalog'
import { PART_LABEL, dayOfYear, orderSavedForNow, partOfDay, pickForNow } from './for-now'

const at = (h: number, day = 1) => new Date(2026, 9, day, h, 30)

describe('partOfDay', () => {
  it('splits the day at 5, 11, 17 and 22 (local)', () => {
    expect(partOfDay(at(5))).toBe('morning')
    expect(partOfDay(at(10))).toBe('morning')
    expect(partOfDay(at(11))).toBe('morning') // 11 AM is still morning
    expect(partOfDay(at(12))).toBe('afternoon') // from noon
    expect(partOfDay(at(16))).toBe('afternoon')
    expect(partOfDay(at(17))).toBe('evening')
    expect(partOfDay(at(21))).toBe('evening')
    expect(partOfDay(at(22))).toBe('night')
    expect(partOfDay(at(0))).toBe('night')
    expect(partOfDay(at(4))).toBe('night')
  })
  it('has a label for each part', () => {
    for (const p of ['morning', 'afternoon', 'evening', 'night'] as const) expect(PART_LABEL[p].length).toBeGreaterThan(3)
  })
})

describe('pickForNow', () => {
  it('only ever suggests low-effort activities', () => {
    for (let h = 0; h < 24; h++) for (let day = 1; day <= 20; day++) expect(pickForNow({ now: at(h, day) })!.effort).toBe(1)
  })
  it('suits the time of day: nights get meditation, mornings get movement, meditation or something everyday', () => {
    for (let day = 1; day <= 20; day++) {
      expect(pickForNow({ now: at(23, day) })!.category).toBe('meditation')
      expect(['movement', 'meditation', 'everyday']).toContain(pickForNow({ now: at(8, day) })!.category)
    }
  })
  it('is deterministic for a given day and rotates between days', () => {
    expect(pickForNow({ now: at(20, 3) })!.id).toBe(pickForNow({ now: at(20, 3) })!.id)
    const ids = new Set(Array.from({ length: 14 }, (_, i) => pickForNow({ now: at(20, i + 1) })!.id))
    expect(ids.size).toBeGreaterThan(1)
  })
  it('never suggests anything with a tag the person avoids', () => {
    for (const avoid of [['guided'], ['music'], ['needs-supplies'], ['eyes-closed'], ['guided', 'eyes-closed', 'music']]) {
      for (let h = 0; h < 24; h += 3) for (let day = 1; day <= 10; day++) {
        const a = pickForNow({ now: at(h, day), avoid })
        if (a) for (const t of avoid) expect(a.tags).not.toContain(t)
      }
    }
  })
  it('falls back to any low-effort activity, and returns null only when everything is avoided', () => {
    expect(pickForNow({ now: at(23), avoid: ['eyes-closed', 'guided', 'no-voice'] })).not.toBeNull()
    const allTags = [...new Set(CATALOG.filter((a) => a.effort === 1).flatMap((a) => a.tags))]
    expect(pickForNow({ now: at(9), avoid: allTags })).toBeNull()
  })
  it('can skip activities already shown', () => {
    const first = pickForNow({ now: at(20, 3) })!
    expect(pickForNow({ now: at(20, 3), skipIds: [first.id] })!.id).not.toBe(first.id)
  })
})

describe('dayOfYear', () => {
  it('counts from 1 on January 1', () => {
    expect(dayOfYear(new Date(2026, 0, 1, 12))).toBe(1)
    expect(dayOfYear(new Date(2026, 11, 31, 12))).toBe(365)
  })
})

describe('orderSavedForNow', () => {
  const items = [
    { activityId: 'doodle-along', createdAt: '2026-10-01T10:00:00Z' }, // creative
    { activityId: 'box-breathing', createdAt: '2026-10-01T09:00:00Z' }, // meditation
    { activityId: 'body-scan', createdAt: '2026-10-01T11:00:00Z' }, // meditation (newest)
    { activityId: undefined, createdAt: '2026-10-01T12:00:00Z' }, // unknown
  ]
  it('puts items that suit the time of day first, each group newest first', () => {
    const out = orderSavedForNow(items, at(23)) // night prefers meditation
    expect(out.map((o) => o.item.activityId)).toEqual(['body-scan', 'box-breathing', undefined, 'doodle-along'])
    expect(out.map((o) => o.fits)).toEqual([true, true, false, false])
  })
  it('keeps every item and handles an empty list', () => {
    expect(orderSavedForNow(items, at(14))).toHaveLength(4)
    expect(orderSavedForNow([], at(14))).toEqual([])
  })
})
