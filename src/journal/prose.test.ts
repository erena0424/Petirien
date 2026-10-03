import { describe, expect, it } from 'vitest'
import { proseOf } from './prose'

describe('proseOf', () => {
  it('joins sentences into one passage and adds a missing full stop', () => {
    expect(proseOf(['I felt tired today.', 'It was a long meeting', 'I want to rest!'])).toBe('I felt tired today. It was a long meeting. I want to rest!')
  })
  it('copes with nothing', () => {
    expect(proseOf(undefined)).toBe('')
    expect(proseOf(['  ', ''])).toBe('')
  })
})
