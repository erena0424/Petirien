import { describe, expect, it } from 'vitest'
import { sanitizeCopy } from './copy'
import { extractText, parseJsonObject } from './parse'
import { detectCrisis } from './safety'
import { fitsTime, mergeVideos, normalizeVideo, parseDuration } from './video'

describe('detectCrisis', () => {
  it.each([
    'I want to kill myself',
    "I don’t want to be here anymore",
    'thinking about suicide',
    "I can't go on",
    'I keep wanting to hurt myself',
    'everyone would be better off without me',
  ])('flags: %s', (t) => expect(detectCrisis(t)).toBe(true))

  it.each([
    'Long day, feeling drained',
    'I killed it at my presentation',
    'this deadline is killing me softly',
    'I want to go for a walk',
    '',
    undefined,
  ])('does not flag: %s', (t) => expect(detectCrisis(t as string | undefined)).toBe(false))
})

describe('sanitizeCopy', () => {
  it('passes plain kind text and trims whitespace', () => {
    expect(sanitizeCopy('  A   gentle   one. ', 100)).toBe('A gentle one.')
  })
  it('rejects links, forbidden words, empty, non-strings, and overlong text', () => {
    expect(sanitizeCopy('see https://x.com', 100)).toBeNull()
    expect(sanitizeCopy('visit example.com now', 100)).toBeNull()
    expect(sanitizeCopy('This will cure it', 100)).toBeNull()
    expect(sanitizeCopy('a therapy session', 100)).toBeNull()
    expect(sanitizeCopy('', 100)).toBeNull()
    expect(sanitizeCopy(42, 100)).toBeNull()
    expect(sanitizeCopy('x'.repeat(101), 100)).toBeNull()
  })
  it('turns em and en dashes into plain punctuation', () => {
    expect(sanitizeCopy('Try this\u2014pick whatever sounds right.', 100)).toBe('Try this, pick whatever sounds right.')
    expect(sanitizeCopy('Five \u2013 ten minutes', 100)).toBe('Five, ten minutes')
  })
  it('rejects stock marketing phrases and exclamation marks so template copy is used instead', () => {
    expect(sanitizeCopy('This fits perfectly in your day.', 100)).toBeNull()
    expect(sanitizeCopy('A great journey starts here.', 100)).toBeNull()
    expect(sanitizeCopy('Unlock your calm.', 100)).toBeNull()
    expect(sanitizeCopy('You can do it!', 100)).toBeNull()
    expect(sanitizeCopy('Five minutes, nothing to set up.', 100)).toBe('Five minutes, nothing to set up.')
  })
  it('does not reject ordinary words that merely contain a forbidden stem', () => {
    expect(sanitizeCopy('A secure, quiet pace.', 100)).toBe('A secure, quiet pace.')
  })
})

describe('extractText / parseJsonObject', () => {
  it('reads Anthropic, plain, and OpenAI-style shapes', () => {
    expect(extractText({ content: [{ type: 'text', text: 'hi' }] })).toBe('hi')
    expect(extractText({ text: 'yo' })).toBe('yo')
    expect(extractText({ choices: [{ message: { content: 'hey' } }] })).toBe('hey')
    expect(extractText(null)).toBeNull()
    expect(extractText({})).toBeNull()
  })
  it('extracts JSON from fences and chatter, and rejects junk', () => {
    expect(parseJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseJsonObject('Here you go: {"a":1} hope that helps')).toEqual({ a: 1 })
    expect(parseJsonObject('no json')).toBeNull()
    expect(parseJsonObject('{bad json}')).toBeNull()
    expect(parseJsonObject(null)).toBeNull()
  })
})

describe('parseDuration', () => {
  it('parses seconds, ISO 8601, and clock formats', () => {
    expect(parseDuration(90)).toBe(90)
    expect(parseDuration('PT5M30S')).toBe(330)
    expect(parseDuration('PT1H2M3S')).toBe(3723)
    expect(parseDuration('PT45S')).toBe(45)
    expect(parseDuration('5:30')).toBe(330)
    expect(parseDuration('1:02:03')).toBe(3723)
    expect(parseDuration('300')).toBe(300)
    expect(parseDuration('soon')).toBeNull()
    expect(parseDuration(undefined)).toBeNull()
  })
})

describe('normalizeVideo', () => {
  const id = 'abcdefghijk'
  it('reads flat and nested shapes', () => {
    expect(normalizeVideo({ id, title: 'T', channelTitle: 'C', duration: 'PT3M' })).toMatchObject({
      videoId: id,
      title: 'T',
      channel: 'C',
      durationSec: 180,
      watchUrl: `https://www.youtube.com/watch?v=${id}`,
    })
    expect(
      normalizeVideo({ id: { videoId: id }, snippet: { title: 'T2', channelTitle: 'C2' }, contentDetails: { duration: 'PT1M' } }),
    ).toMatchObject({ videoId: id, title: 'T2', durationSec: 60 })
  })
  it('takes the id from the links when no id field exists', () => {
    const v = normalizeVideo({ title: 'T', links: { watch: `https://www.youtube.com/watch?v=${id}`, embed: '', thumbnail: 'thumb' } })
    expect(v?.videoId).toBe(id)
    expect(v?.thumbnail).toBe('thumb')
  })
  it('rejects malformed ids and missing titles, so nothing invented gets through', () => {
    expect(normalizeVideo({ id: 'short', title: 'T' })).toBeNull()
    expect(normalizeVideo({ id: 'has spaces!!', title: 'T' })).toBeNull()
    expect(normalizeVideo({ id, title: '' })).toBeNull()
    expect(normalizeVideo('nope')).toBeNull()
    expect(normalizeVideo(null)).toBeNull()
  })
})

describe('mergeVideos / fitsTime', () => {
  const base = { videoId: 'abcdefghijk', title: 'A', channel: '', thumbnail: 't', durationSec: 0, watchUrl: 'w' }
  it('fills missing fields from details', () => {
    const merged = mergeVideos([base], [{ ...base, channel: 'Chan', durationSec: 240 }])
    expect(merged[0]).toMatchObject({ channel: 'Chan', durationSec: 240 })
  })
  it('fits by length with 2 minutes of slack and a 30 minute ceiling', () => {
    expect(fitsTime({ ...base, durationSec: 12 * 60 }, 10)).toBe(true)
    expect(fitsTime({ ...base, durationSec: 12 * 60 + 1 }, 10)).toBe(false)
    expect(fitsTime({ ...base, durationSec: 59 }, 10)).toBe(false)
    expect(fitsTime({ ...base, durationSec: 0 }, 10)).toBe(false)
    expect(fitsTime({ ...base, durationSec: 31 * 60 }, 120)).toBe(false)
  })
})
