import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FLOAT,
  EDGE,
  KEY_STEP,
  PHONE_MAX,
  SIZES,
  SIZE_ORDER,
  clampFloat,
  dragTo,
  isCollapsed,
  isPhone,
  keyMove,
  FADE,
  fadeFor,
  nextSize,
  visibleMessages,
  parseFloatState,
  shouldShowFloat,
} from './float'

const viewport = { width: 1000, height: 800 }
const box = { width: 120, height: 150 }

describe('sizes', () => {
  it('has three sizes in order, each bigger than the last', () => {
    expect(SIZE_ORDER).toEqual(['s', 'm', 'l'])
    expect(SIZES.s.bunny).toBeLessThan(SIZES.m.bunny)
    expect(SIZES.m.bunny).toBeLessThan(SIZES.l.bunny)
    expect(SIZES.s.panel).toBeLessThan(SIZES.m.panel)
    expect(SIZES.m.panel).toBeLessThan(SIZES.l.panel)
  })
  it('steps between sizes and stops at the ends', () => {
    expect(nextSize('s', 1)).toBe('m')
    expect(nextSize('m', 1)).toBe('l')
    expect(nextSize('l', 1)).toBe('l')
    expect(nextSize('l', -1)).toBe('m')
    expect(nextSize('s', -1)).toBe('s')
  })
})

describe('clampFloat keeps the widget on screen and above the footer', () => {
  it('leaves a position that fits alone', () => {
    expect(clampFloat({ right: 40, bottom: 40, size: 'm' }, box, viewport, 60)).toEqual({ right: 40, bottom: 40, size: 'm' })
  })
  it('never lets it past any edge', () => {
    const c = clampFloat({ right: -50, bottom: -50, size: 'm' }, box, viewport, 60)
    expect(c.right).toBe(EDGE)
    expect(c.bottom).toBe(EDGE)
    const far = clampFloat({ right: 5000, bottom: 5000, size: 'm' }, box, viewport, 60)
    expect(far.right).toBe(viewport.width - box.width - EDGE)
    expect(far.bottom).toBe(viewport.height - 60 - box.height - EDGE) // the top of the widget stays on screen
  })
  it('never lets it sink into the footer: the bottom distance is measured from the footer top', () => {
    expect(clampFloat({ right: 20, bottom: 0, size: 's' }, box, viewport, 80).bottom).toBe(EDGE)
  })
  it('still returns something sane when the window is smaller than the widget', () => {
    const c = clampFloat({ right: 300, bottom: 300, size: 'l' }, { width: 500, height: 500 }, { width: 320, height: 400 }, 60)
    expect(c.right).toBe(EDGE)
    expect(c.bottom).toBe(EDGE)
  })
  it('keeps the size', () => {
    expect(clampFloat({ right: 9999, bottom: 9999, size: 'l' }, box, viewport, 60).size).toBe('l')
  })
})

describe('moving', () => {
  it('a drag to the left and up moves the widget toward the left and top (bigger right and bottom distances)', () => {
    expect(dragTo({ right: 50, bottom: 50, size: 'm' }, -30, -20)).toEqual({ right: 80, bottom: 70, size: 'm' })
    expect(dragTo({ right: 50, bottom: 50, size: 'm' }, 10, 15)).toEqual({ right: 40, bottom: 35, size: 'm' })
  })
  it('arrow keys move it by one step in the matching direction, and other keys do nothing', () => {
    const s = { right: 100, bottom: 100, size: 'm' as const }
    expect(keyMove(s, 'ArrowLeft')).toEqual({ ...s, right: 100 + KEY_STEP })
    expect(keyMove(s, 'ArrowRight')).toEqual({ ...s, right: 100 - KEY_STEP })
    expect(keyMove(s, 'ArrowUp')).toEqual({ ...s, bottom: 100 + KEY_STEP })
    expect(keyMove(s, 'ArrowDown')).toEqual({ ...s, bottom: 100 - KEY_STEP })
    expect(keyMove(s, 'Enter')).toBeNull()
    expect(keyMove(s, 'a')).toBeNull()
  })
})

describe('remembered state', () => {
  it('reads valid saved values', () => {
    expect(parseFloatState({ right: 40, bottom: 90, size: 'l' })).toEqual({ right: 40, bottom: 90, size: 'l' })
  })
  it('remembers an explicit choice to hide or show the chat, and nothing when there was none', () => {
    expect(parseFloatState({ size: 'm', collapsed: true }).collapsed).toBe(true)
    expect(parseFloatState({ size: 'm', collapsed: false }).collapsed).toBe(false)
    expect(parseFloatState({ size: 'm' }).collapsed).toBeUndefined()
    expect(parseFloatState({ size: 'm', collapsed: 'yes' }).collapsed).toBeUndefined()
  })
  it('falls back to defaults for anything missing, wrong, or hostile', () => {
    expect(parseFloatState(null)).toEqual(DEFAULT_FLOAT)
    expect(parseFloatState('big')).toEqual(DEFAULT_FLOAT)
    expect(parseFloatState({ right: 'a', bottom: NaN, size: 'huge' })).toEqual(DEFAULT_FLOAT)
    expect(parseFloatState({ right: Infinity })).toEqual({ ...DEFAULT_FLOAT })
    expect(parseFloatState({ size: 'm' }).size).toBe('m')
  })
})

describe('where it shows', () => {
  it('stays away from the page that already has the whole conversation', () => {
    expect(shouldShowFloat('/messages')).toBe(false)
    expect(shouldShowFloat('/messages/anything')).toBe(false)
  })
  it('is on every other page', () => {
    for (const p of ['/home', '/saved', '/journal', '/preferences', '/checkin', '/history']) expect(shouldShowFloat(p), p).toBe(true)
    expect(shouldShowFloat('/homework')).toBe(true) // only the exact route or its children, not a similar prefix
  })
  it('treats widths under the phone limit as phones', () => {
    expect(isPhone(PHONE_MAX - 1)).toBe(true)
    expect(isPhone(PHONE_MAX)).toBe(false)
  })
})

describe('fading messages', () => {
  it('keeps the latest two full size, then shrinks and fades each older one', () => {
    expect(fadeFor(0)).toEqual(fadeFor(1))
    expect(fadeFor(0)!.size).toBe(1.125)
    for (let a = 2; a < FADE.length; a++) {
      expect(fadeFor(a)!.size).toBeLessThan(fadeFor(a - 1)!.size)
      expect(fadeFor(a)!.opacity).toBeLessThan(fadeFor(a - 1)!.opacity)
    }
    expect(fadeFor(FADE.length - 1)!.opacity).toBeGreaterThan(0)
  })
  it('lets the oldest disappear', () => {
    expect(fadeFor(FADE.length)).toBeNull()
    expect(fadeFor(50)).toBeNull()
  })
  it('shows at most the newest few, oldest first, with their ages', () => {
    const seen = visibleMessages([1, 2, 3, 4, 5, 6, 7, 8])
    expect(seen).toHaveLength(FADE.length)
    expect(seen.map((s) => s.item)).toEqual([4, 5, 6, 7, 8])
    expect(seen.map((s) => s.age)).toEqual([4, 3, 2, 1, 0])
    expect(visibleMessages([1])).toEqual([{ item: 1, age: 0 }])
    expect(visibleMessages([])).toEqual([])
  })
})

describe('isCollapsed', () => {
  it('starts folded everywhere until the person chooses', () => {
    expect(isCollapsed({ right: 1, bottom: 1, size: 'l' }, '/home')).toBe(true)
    expect(isCollapsed({ right: 1, bottom: 1, size: 'l' }, '/saved')).toBe(true)
  })
  it('lets the person decide, anywhere', () => {
    expect(isCollapsed({ right: 1, bottom: 1, size: 'l', collapsed: false }, '/home')).toBe(false)
    expect(isCollapsed({ right: 1, bottom: 1, size: 'l', collapsed: true }, '/saved')).toBe(true)
  })
})
