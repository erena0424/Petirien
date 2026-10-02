import { describe, expect, it } from 'vitest'
import { backgroundRows, FEELINGS, MAX_REFLECTION_CHARS, PROMPTS, cleanReflection, isReflection, nextPrompt, readReflection } from './reflection'

describe('prompts', () => {
  it('has three gentle prompts that cycle, with nothing forbidden in them', () => {
    expect(PROMPTS).toHaveLength(3)
    expect(nextPrompt(0)).toBe(1)
    expect(nextPrompt(2)).toBe(0)
    for (const p of PROMPTS) expect(p).not.toMatch(/diagnos|treat|cure|therap|clinical|!/i)
  })
  it('offers neutral feeling words, including "Not sure"', () => {
    expect(FEELINGS).toContain('Not sure')
    expect(FEELINGS).toContain('Good')
    expect(FEELINGS).toContain('Hard')
  })
})

describe('cleanReflection', () => {
  it('needs some text or a feeling', () => {
    expect(cleanReflection({ text: '   ', feeling: null })).toBeNull()
    expect(cleanReflection({ text: '', feeling: 'Okay' })).toEqual({ notes: [], feelings: ['Okay'] })
    expect(cleanReflection({ text: ' It went fine ', feeling: null })).toEqual({ notes: ['It went fine'], feelings: [] })
    expect(cleanReflection({ text: 'x', feeling: 'Mixed' })).toEqual({ notes: ['x'], feelings: ['Mixed'] })
  })
  it('caps the length and drops a feeling that is not on the list', () => {
    expect(cleanReflection({ text: 'a'.repeat(5000), feeling: null })!.notes[0]).toHaveLength(MAX_REFLECTION_CHARS)
    expect(cleanReflection({ text: 'hi', feeling: 'Ecstatic' as never })).toEqual({ notes: ['hi'], feelings: [] })
  })
})

describe('readReflection', () => {
  it('reads what was stored and survives odd data', () => {
    expect(readReflection({ notes: ['Went well'], feelings: ['Good'] })).toEqual({ text: 'Went well', feeling: 'Good' })
    expect(readReflection({})).toEqual({ text: '', feeling: null })
    expect(readReflection({ notes: [5 as never], feelings: ['Zany'] })).toEqual({ text: '', feeling: null })
    expect(isReflection({ kind: 'reflection' })).toBe(true)
    expect(isReflection({})).toBe(false)
    expect(isReflection({ kind: 'note' })).toBe(false)
  })
})

describe('backgroundRows', () => {
  it('never lets a reflection through, and keeps the newest five of the rest', () => {
    const rows: { id: number; kind?: string }[] = [{ id: 1, kind: 'reflection' }, ...[2, 3, 4, 5, 6, 7, 8].map((id) => ({ id })), { id: 9, kind: 'reflection' }]
    expect(backgroundRows(rows).map((r) => r.id)).toEqual([2, 3, 4, 5, 6])
    expect(backgroundRows([{ kind: 'reflection' }])).toEqual([])
    expect(backgroundRows([])).toEqual([])
  })
})
