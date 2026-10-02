import { describe, expect, it } from 'vitest'
import { NO_CHANGE_ACK, REASONS, THANKS_ACK, applyFeedback, type FeedbackReason } from './feedback'
import { normalizeStyle } from './style'

describe('the four reasons', () => {
  it('there are exactly six, each with a short label and a fixed reply', () => {
    expect(REASONS.map((r) => r.id)).toEqual(['too_long', 'too_many_questions', 'too_cheery', 'too_serious', 'too_formal', 'too_informal'])
    for (const r of REASONS) {
      expect(r.label.length).toBeLessThanOrEqual(20)
      expect(r.ack).toMatch(/^Got it\./)
    }
  })
  it('each maps to exactly one change inside the fixed style vocabulary', () => {
    for (const r of REASONS) {
      expect(Object.keys(r.change)).toHaveLength(1)
      expect(normalizeStyle(r.change)).toEqual(r.change) // survives the vocabulary filter unchanged
    }
  })
  it('keeps the replies free of claims about memory, health, or anything beyond the change', () => {
    for (const text of [...REASONS.map((r) => r.ack), THANKS_ACK, NO_CHANGE_ACK]) expect(text).not.toMatch(/diagnos|treat|therap|medical|forever|always/i)
    expect(THANKS_ACK).not.toMatch(/remember|learn|note/i) // a thumbs-up does not teach the bunny anything, so it does not claim to
  })
})

describe('applyFeedback', () => {
  const cases: [FeedbackReason, object][] = [
    ['too_long', { length: 'short' }],
    ['too_many_questions', { questions: 'fewer' }],
    ['too_cheery', { tone: 'gentle' }],
    ['too_serious', { tone: 'upbeat' }],
    ['too_formal', { formality: 'casual' }],
    ['too_informal', { formality: 'formal' }],
  ]
  it.each(cases)('%s changes the style and remembers how to undo it', (reason, change) => {
    const r = applyFeedback(reason, { tone: 'playful', suggestions: 'more' })
    expect(r.next).toMatchObject(change)
    expect(r.next).toMatchObject({ suggestions: 'more' }) // everything else is kept
    expect(r.previous).toEqual({ tone: 'playful', suggestions: 'more' })
  })
  it('writes nothing, and says so, when the style is already that way', () => {
    const r = applyFeedback('too_long', { length: 'short' })
    expect(r.next).toBeNull()
    expect(r.ack).toBe(NO_CHANGE_ACK)
  })
  it('starts from an empty style', () => {
    expect(applyFeedback('too_many_questions', {}).next).toEqual({ questions: 'fewer' })
  })
  it('ignores junk in the current style and an unknown reason', () => {
    const r = applyFeedback('too_long', { length: 'huge', mood: 'sad' } as never)
    expect(r.next).toEqual({ length: 'short' })
    expect(r.previous).toEqual({})
    expect(applyFeedback('nonsense' as FeedbackReason, { tone: 'gentle' }).next).toBeNull()
  })
  it('undoing returns exactly to the earlier style', () => {
    const before = { tone: 'upbeat' as const }
    const r = applyFeedback('too_cheery', before)
    expect(r.next).toEqual({ tone: 'gentle' })
    expect(r.previous).toEqual(before)
  })
})
