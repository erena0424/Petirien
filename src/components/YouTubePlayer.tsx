import { useEffect, useRef, useState } from 'react'
import {
  PLAYER_STATE_ENDED,
  errorMessage,
  loadYouTubeApi,
  playerErrorKind,
  watchUrl,
  type PlayerErrorKind,
  type YTPlayer,
} from '@/lib/youtube'

interface Props {
  videoId: string
  /** The video played to the end. The parent should replace this component. */
  onEnded: () => void
  /** The video cannot be played here (removed, embedding blocked, or the player failed). */
  onUnavailable?: (kind: PlayerErrorKind) => void
}

/**
 * Embedded YouTube player. No autoplay, no overlays, at least 200x200.
 * Related videos cannot be disabled; we remove the player when playback ends
 * (the parent swaps in its own next step) rather than promising otherwise.
 */
export function YouTubePlayer({ videoId, onEnded, onUnavailable }: Props) {
  const mount = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const [error, setError] = useState<PlayerErrorKind | null>(null)

  // Keep the latest callbacks without re-creating the player.
  const endedRef = useRef(onEnded)
  const unavailableRef = useRef(onUnavailable)
  endedRef.current = onEnded
  unavailableRef.current = onUnavailable

  useEffect(() => {
    let cancelled = false
    setError(null)

    const fail = (kind: PlayerErrorKind) => {
      if (cancelled) return
      setError(kind)
      unavailableRef.current?.(kind)
    }

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !mount.current) return
        // The API replaces its target element, so give it a fresh child.
        const target = document.createElement('div')
        mount.current.replaceChildren(target)
        playerRef.current = new YT.Player(target, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            playsinline: 1,
            rel: 0,
            enablejsapi: 1,
            autoplay: 0,
            origin: window.location.origin,
          },
          events: {
            onError: (e) => fail(playerErrorKind(e.data)),
            onStateChange: (e) => {
              if (e.data === PLAYER_STATE_ENDED && !cancelled) endedRef.current()
            },
          },
        })
      })
      .catch(() => fail('other'))

    return () => {
      cancelled = true
      try {
        playerRef.current?.destroy()
      } catch {
        /* player already gone */
      }
      playerRef.current = null
    }
  }, [videoId])

  if (error) {
    return (
      <div
        role="alert"
        data-testid="player-error"
        className="rounded-xl border border-border bg-secondary p-5 text-sm"
      >
        <p className="font-medium text-foreground">{errorMessage(error)}</p>
        <p className="mt-1 text-muted-foreground">
          {error === 'unavailable'
            ? 'You can still pick another idea.'
            : 'You can try opening it on YouTube instead.'}
        </p>
        {error !== 'unavailable' && (
          <a
            href={watchUrl(videoId)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open on YouTube
          </a>
        )}
      </div>
    )
  }

  return (
    <div
      data-testid="player-frame"
      className="aspect-video min-h-[200px] w-full min-w-[200px] overflow-hidden rounded-xl bg-muted"
    >
      <div ref={mount} className="h-full w-full" />
    </div>
  )
}
