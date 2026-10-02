/**
 * Layout rules for the floating bunny, kept free of the page so they can be tested.
 *
 * The bunny is anchored by the distance from the right and bottom edges of the
 * window, so when the chat opens it grows up and to the left and stays on screen.
 */

export type FloatSize = 's' | 'm' | 'l'

export const SIZES: Record<FloatSize, { label: string; bunny: number; panel: number }> = {
  s: { label: 'Small', bunny: 120, panel: 260 },
  m: { label: 'Medium', bunny: 200, panel: 320 },
  l: { label: 'Large', bunny: 288, panel: 380 }, // as big as the old Home bunny
}

export const SIZE_ORDER: FloatSize[] = ['s', 'm', 'l']

export interface FloatState {
  /** Distance from the right edge of the window, in pixels. */
  right: number
  /** Distance from the top of the footer, in pixels (never below the footer). */
  bottom: number
  size: FloatSize
  /** On a computer: whether the person has hidden the chat to leave just the bunny. Unset until they choose; then it wins everywhere. */
  collapsed?: boolean
}

export const DEFAULT_FLOAT: FloatState = { right: 16, bottom: 12, size: 'l' }
export const EDGE = 8
/** Below this width the bunny is docked and cannot be dragged, and the chat opens as a bottom sheet. */
export const PHONE_MAX = 640
/** Pixels moved per arrow key press when moving the bunny with the keyboard. */
export const KEY_STEP = 16

export const isPhone = (viewportWidth: number) => viewportWidth < PHONE_MAX

export function nextSize(size: FloatSize, direction: 1 | -1): FloatSize {
  const i = SIZE_ORDER.indexOf(size)
  return SIZE_ORDER[Math.min(SIZE_ORDER.length - 1, Math.max(0, i + direction))]!
}

export interface Box {
  width: number
  height: number
}

/**
 * Keeps the widget fully inside the window and above the footer.
 * `box` is the widget's current size, `viewport` the window, `footer` the footer's height.
 */
export function clampFloat(state: FloatState, box: Box, viewport: Box, footer: number): FloatState {
  const maxRight = Math.max(EDGE, viewport.width - box.width - EDGE)
  const maxBottom = Math.max(EDGE, viewport.height - footer - box.height - EDGE)
  return {
    ...state,
    right: Math.min(maxRight, Math.max(EDGE, Math.round(state.right))),
    bottom: Math.min(maxBottom, Math.max(EDGE, Math.round(state.bottom))),
  }
}

/** Where the widget goes after a drag of (dx, dy) screen pixels from where it started. */
export function dragTo(start: FloatState, dx: number, dy: number): FloatState {
  return { ...start, right: start.right - dx, bottom: start.bottom - dy }
}

/** Where the widget goes after an arrow key. Left and up move it toward that edge. */
export function keyMove(state: FloatState, key: string): FloatState | null {
  switch (key) {
    case 'ArrowLeft':
      return { ...state, right: state.right + KEY_STEP }
    case 'ArrowRight':
      return { ...state, right: state.right - KEY_STEP }
    case 'ArrowUp':
      return { ...state, bottom: state.bottom + KEY_STEP }
    case 'ArrowDown':
      return { ...state, bottom: state.bottom - KEY_STEP }
    default:
      return null
  }
}

const KEY = 'petirien.bunnyFloat'

/** Reads what the person set last time. Anything missing or odd falls back to the defaults. */
export function parseFloatState(raw: unknown): FloatState {
  if (!raw || typeof raw !== 'object') return DEFAULT_FLOAT
  const r = raw as Record<string, unknown>
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
  return {
    right: num(r.right, DEFAULT_FLOAT.right),
    bottom: num(r.bottom, DEFAULT_FLOAT.bottom),
    size: SIZE_ORDER.includes(r.size as FloatSize) ? (r.size as FloatSize) : DEFAULT_FLOAT.size,
    ...(typeof r.collapsed === 'boolean' ? { collapsed: r.collapsed } : {}),
  }
}

export function loadFloat(): FloatState {
  try {
    return parseFloatState(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return DEFAULT_FLOAT
  }
}

export function saveFloat(state: FloatState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* storage unavailable (private window, blocked): the position just will not be remembered */
  }
}

/** Routes where the whole conversation is already on the page, so the floating bunny stays away. */
export const HIDE_ON = ['/messages']

export const shouldShowFloat = (pathname: string) => !HIDE_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))

/** How a message looks by how many messages came after it: the latest two stay full size, then they shrink and fade, and the oldest disappear. */
export const FADE = [
  { size: 1.125, opacity: 1 },
  { size: 1.125, opacity: 1 },
  { size: 0.95, opacity: 0.75 },
  { size: 0.82, opacity: 0.5 },
  { size: 0.7, opacity: 0.28 },
] as const

/** Look for the message `age` places from the end (0 = newest), or null once it has faded away. */
export function fadeFor(age: number): { size: number; opacity: number } | null {
  return FADE[age] ?? null
}

/** The messages still visible, oldest first, each with its age. */
export function visibleMessages<T>(items: T[]): { item: T; age: number }[] {
  return items.slice(-FADE.length).map((item, i, arr) => ({ item, age: arr.length - 1 - i }))
}

/**
 * Whether the chat beside the bunny is folded away. Until the person chooses, it starts folded on Home (which has its
 * own big bunny and a list of plans the floating chat would sit over) and open everywhere else. Their choice wins.
 */
export function isCollapsed(state: FloatState, pathname: string): boolean {
  return state.collapsed ?? pathname === '/home'
}
