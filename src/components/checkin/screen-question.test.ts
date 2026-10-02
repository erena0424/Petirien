import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shouldAskScreen } from './ScreenQuestion'

function fakeStorage() {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, String(v)), removeItem: (k: string) => void data.delete(k) }
}

describe('shouldAskScreen: asked once, and only when it matters', () => {
  beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()))
  it('asks someone who has not chosen yet', () => {
    expect(shouldAskScreen('auto')).toBe(true)
  })
  it('does not ask someone who already chose, either way', () => {
    expect(shouldAskScreen('none')).toBe(false)
    expect(shouldAskScreen('video')).toBe(false)
  })
  it('does not ask again once asked', () => {
    localStorage.setItem('petirien.askedScreen', '1')
    expect(shouldAskScreen('auto')).toBe(false)
  })
  it('does not ask when it cannot remember having asked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
    })
    expect(shouldAskScreen('auto')).toBe(false)
  })
})
