import { describe, expect, it } from 'vitest'
import { dailyAverages, chartRange, inRange, linePath, summarize, toPoints, toXY, type Dims } from './mood'

const at = (d: number, h = 12, m = 0) => new Date(2026, 9, d, h, m).toISOString()
const row = (createdAt: string, mood: unknown, energy: unknown) => ({ createdAt, data: { mood, energy } })

describe('toPoints', () => {
  it('keeps good check-ins, oldest first, and skips anything unusable', () => {
    const pts = toPoints([row(at(3), 4, 3), row(at(1), 2, 2), row('nope', 3, 3), row(at(2), 0, 3), row(at(2), 3, 6), row(at(2), '3', 3), row(at(2), 3, null), row(at(2), 5, 1)])
    expect(pts.map((p) => [p.mood, p.energy])).toEqual([[2, 2], [5, 1], [4, 3]])
    expect(toPoints([])).toEqual([])
  })
})

describe('dailyAverages', () => {
  it('averages a day, one point per day, sorted, placed at noon', () => {
    const pts = toPoints([row(at(1, 9), 2, 4), row(at(1, 18), 4, 2), row(at(3, 8), 5, 5)])
    const d = dailyAverages(pts)
    expect(d.map((x) => [x.day, x.mood, x.energy, x.count])).toEqual([['2026-10-01', 3, 3, 2], ['2026-10-03', 5, 5, 1]])
    expect(new Date(d[0]!.at).getHours()).toBe(12)
    expect(dailyAverages([])).toEqual([])
  })
  it('rounds to one decimal', () => {
    const d = dailyAverages(toPoints([row(at(1, 8), 1, 1), row(at(1, 9), 2, 2), row(at(1, 10), 2, 3)]))
    expect(d[0]).toMatchObject({ mood: 1.7, energy: 2 })
  })
})

describe('chartRange and inRange', () => {
  const now = new Date(2026, 9, 15, 10)
  it('covers the month, the week, the day, or the last thirty days', () => {
    const m = chartRange('month', new Date(2026, 9, 20), now)
    expect([m.from.getDate(), m.to.getMonth(), m.to.getDate()]).toEqual([1, 10, 1])
    const w = chartRange('week', new Date(2026, 9, 14), now)
    expect(w.to.getTime() - w.from.getTime()).toBe(7 * 86_400_000)
    const d = chartRange('day', new Date(2026, 9, 14, 17), now)
    expect(d.to.getTime() - d.from.getTime()).toBe(86_400_000)
    const l = chartRange('list', new Date(2026, 9, 1), now)
    expect(l.to.getDate()).toBe(16)
    expect(Math.round((l.to.getTime() - l.from.getTime()) / 86_400_000)).toBe(30)
  })
  it('keeps points inside the range, start inclusive and end exclusive', () => {
    const pts = toPoints([row(at(1, 0, 0), 3, 3), row(at(2, 23, 59), 3, 3), row(at(3, 0, 0), 3, 3)])
    expect(inRange(pts, new Date(2026, 9, 1), new Date(2026, 9, 3))).toHaveLength(2)
  })
})

describe('summarize', () => {
  it('says nothing for no check-ins', () => {
    expect(summarize([])).toBeNull()
  })
  it('is calm and uses the scale words, with no verdicts', () => {
    expect(summarize(toPoints([row(at(1), 2, 2)]))!.text).toBe('One check-in: feeling low, low energy.')
    const s = summarize(toPoints([row(at(1), 4, 2), row(at(2), 5, 3), row(at(3), 4, 2)]))!
    expect(s.text).toBe('Across 3 check-ins, you mostly felt good, with low energy.')
    expect(s.avgMood).toBe(4.3)
    for (const p of [[1, 1], [3, 3], [5, 5]]) expect(summarize(toPoints([row(at(1), p[0], p[1])]))!.text).not.toMatch(/bad|worse|poor|problem|concern|!|should/i)
  })
})

describe('chart geometry', () => {
  const dims: Dims = { width: 600, height: 200, padLeft: 40, padRight: 20, padTop: 10, padBottom: 30 }
  const from = new Date(2026, 9, 1)
  const to = new Date(2026, 9, 11)
  it('puts 5 at the top and 1 at the bottom, start at the left and end at the right', () => {
    expect(toXY(from.getTime(), 5, from, to, dims)).toEqual({ x: 40, y: 10 })
    expect(toXY(to.getTime(), 1, from, to, dims)).toEqual({ x: 580, y: 170 })
    const mid = toXY((from.getTime() + to.getTime()) / 2, 3, from, to, dims)
    expect(mid).toEqual({ x: 310, y: 90 })
  })
  it('keeps odd values on the chart', () => {
    const a = toXY(from.getTime() - 1e9, 9, from, to, dims)
    expect(a).toEqual({ x: 40, y: 10 })
    expect(toXY(to.getTime() + 1e9, -3, from, to, dims)).toEqual({ x: 580, y: 170 })
  })
  it('draws a path through points in order', () => {
    expect(linePath([])).toBe('')
    expect(linePath([{ x: 1, y: 2 }])).toBe('M 1 2')
    expect(linePath([{ x: 1, y: 2 }, { x: 3.04, y: 4 }])).toBe('M 1 2 L 3 4')
  })
})
