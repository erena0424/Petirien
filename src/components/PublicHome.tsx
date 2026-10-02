import { useRef, useState } from 'react'
import { AuthOverlay } from 'deepspace'
import { Button } from '@/components/ui'
import { GREETING, partOfDay } from '@/lib/for-now'
import { dayOfYear } from '@/lib/for-now'
import { homeKind } from '../places/places'
import { Bunny } from './Bunny'
import { Blob, Cloud, Sparkle, Star } from './Sparkle'
import { PlaceSuggestions } from './PlaceSuggestions'
import { PreviewSection } from './PreviewSection'

/**
 * Home for someone who has not signed in (the landing page explains the benefit; this invites one easy action).
 * The bunny, a question as the heading, and one clear invitation. Nothing
 * empty and nothing that needs an account: sample suggestions are ready to view, a place to go asks for location only when pressed (or already allowed), a short preview asks only for energy and
 * time, and signing in is always one press away (and can be skipped past). Calendar, saved and history wait until
 * after sign-in, when they mean something.
 */
export function PublicHome() {
  // The landing page sends people here with ?try=1 (open the questions) or ?signin=1 (open sign-in).
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const [asking, setAsking] = useState(params.get('try') === '1')
  const [signIn, setSignIn] = useState(params.get('signin') === '1')
  const previewRef = useRef<HTMLDivElement>(null)
  const greeting = GREETING[partOfDay(new Date())]

  function start() {
    setAsking(true)
    // Bring the questions into view once they have rendered.
    setTimeout(() => previewRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 0)
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <section aria-label="Welcome" data-testid="home-hero" className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
        <div className="relative flex shrink-0 items-center justify-center">
          <Blob className="absolute h-60 w-60 sm:h-72 sm:w-72" />
          <Bunny className="relative w-48 sm:w-60" />
          <Cloud className="absolute -top-1 right-0 w-16 sm:w-20" />
          <Star className="absolute bottom-4 left-0 w-8 sm:w-9" />
          <Sparkle className="absolute left-5 top-3 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p data-testid="home-greeting" className="text-base text-muted-foreground">
            {greeting}
          </p>
          <h1 data-testid="home-pitch" className="mt-1 font-display text-4xl font-semibold leading-tight tracking-tight text-[color:var(--color-ink)] sm:text-5xl">
            What feels{' '}
            <span className="bg-[linear-gradient(transparent_58%,var(--color-blush)_58%)] px-1 [box-decoration-break:clone]">manageable</span> today?
          </h1>
          <p data-testid="home-explain" className="mt-3 text-lg leading-relaxed text-muted-foreground">
            Start with your mood, energy and time. I&apos;ll help you find something that fits.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
            <Button className="min-h-12 rounded-full px-7 text-base font-semibold shadow-[0_4px_0_0_rgba(48,36,80,0.35)] active:translate-y-px active:shadow-none" onClick={start} data-testid="home-find">
              Find something to do
            </Button>
            <Button variant="outline" className="min-h-12 rounded-full border-2 px-7 text-base font-semibold" onClick={() => setSignIn(true)} data-testid="home-signin">
              Sign in
            </Button>
          </div>
        </div>
      </section>
      <div ref={previewRef}>
        <PreviewSection asking={asking} onClose={() => setAsking(false)} />
      </div>
      <section aria-labelledby="place-heading" data-testid="home-place" className="mt-10">
        <h2 id="place-heading" className="font-display text-2xl font-semibold text-foreground">
          A change of scenery
        </h2>
        <div className="mt-3 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <PlaceSuggestions kinds={[homeKind(dayOfYear(new Date()))]} autoEveryMs={30 * 60_000} showOthers={false} fallback="Even a few minutes outside can help. Pick any direction you like." />
        </div>
      </section>
      {signIn && <AuthOverlay onClose={() => setSignIn(false)} />}
    </div>
  )
}
