import { useEffect, useState } from 'react'
import { useAuthStatus } from 'deepspace'
import { callAction } from './actions-client'
import type { HomeIdea, HomeIdeasResponse } from '../contract'

export type HomeIdeasState = { kind: 'loading' } | { kind: 'ready'; ideas: HomeIdea[] } | { kind: 'error' } | { kind: 'signedOut' }

// Kept in memory for this tab only (nothing is stored), for one person, for a while: moving between pages does not ask again.
let cache: { userId: string; ideas: HomeIdea[]; at: number } | null = null
let inFlight: Promise<HomeIdea[] | null> | null = null
const FRESH_MS = 30 * 60_000

/**
 * Two videos for right now, from the server, for anyone signed in. No history or saved items are needed. The
 * server answers from a shared daily cache, so this usually costs nothing.
 */
export function useHomeIdeas(): HomeIdeasState {
  const { userId, isSignedIn, isLoaded } = useAuthStatus()
  const fresh = cache && userId && cache.userId === userId && Date.now() - cache.at < FRESH_MS ? cache : null
  const [state, setState] = useState<HomeIdeasState>(fresh ? { kind: 'ready', ideas: fresh.ideas } : { kind: 'loading' })

  useEffect(() => {
    if (isLoaded && !isSignedIn) return setState({ kind: 'signedOut' }) // nothing to wait for: these ideas are for signed-in people
    if (!isSignedIn || !userId) return
    if (cache && cache.userId === userId && Date.now() - cache.at < FRESH_MS) return setState({ kind: 'ready', ideas: cache.ideas })
    let cancelled = false
    if (!inFlight) {
      inFlight = callAction<HomeIdeasResponse>('homeIdeas')
        .then((r) => (r && r.status === 'ok' ? r.ideas : null))
        .finally(() => (inFlight = null))
    }
    void inFlight.then((ideas) => {
      if (cancelled) return
      if (!ideas) return setState({ kind: 'error' })
      cache = { userId, ideas, at: Date.now() }
      setState({ kind: 'ready', ideas })
    })
    return () => {
      cancelled = true
    }
  }, [isSignedIn, isLoaded, userId])

  return state
}
