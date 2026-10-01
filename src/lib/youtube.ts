/**
 * YouTube IFrame Player API helpers.
 *
 * Facts this file relies on (Google docs, checked 2026-09-30):
 *  - onError 100 = video not found / removed / private
 *  - onError 101 and 150 = embedding disabled by the owner
 *  - onError 2 = bad id, 5 = HTML5 player error, 153 = missing referer
 *  - Related videos cannot be turned off; `rel=0` only limits them to the same
 *    channel. We never claim distraction-free playback. When the video ends we
 *    remove the player (see YouTubePlayer) and show our own next step.
 *  - The player must be at least 200x200, with nothing overlaid on it.
 */

export type PlayerErrorKind = 'unavailable' | 'embed_blocked' | 'other'

export function playerErrorKind(code: number): PlayerErrorKind {
  if (code === 100) return 'unavailable'
  if (code === 101 || code === 150) return 'embed_blocked'
  return 'other'
}

export const PLAYER_STATE_ENDED = 0

export function errorMessage(kind: PlayerErrorKind): string {
  switch (kind) {
    case 'unavailable':
      return 'This video is no longer available.'
    case 'embed_blocked':
      return "The creator doesn't allow this video to play here."
    default:
      return "The video couldn't load here."
  }
}

export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
}

/** Minimal shape of the parts of the API we use. */
export interface YTPlayer {
  destroy(): void
}
export interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string
      width?: string | number
      height?: string | number
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: () => void
        onError?: (e: { data: number }) => void
        onStateChange?: (e: { data: number }) => void
      }
    },
  ) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YTNamespace> | null = null

export function loadYouTubeApi(timeoutMs = 10_000): Promise<YTNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      apiPromise = null // allow a later retry
      reject(new Error('youtube api timeout'))
    }, timeoutMs)

    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      window.clearTimeout(timer)
      if (window.YT?.Player) resolve(window.YT)
      else {
        apiPromise = null
        reject(new Error('youtube api missing'))
      }
    }

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => {
      window.clearTimeout(timer)
      apiPromise = null
      reject(new Error('youtube api blocked'))
    }
    document.head.appendChild(script)
  })
  return apiPromise
}
