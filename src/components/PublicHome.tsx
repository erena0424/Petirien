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
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
      <section aria-label="Welcome" data-testid="home-hero" className="flex flex-col items-center gap-8 text-center md:flex-row md:items-center md:gap-14 md:text-left">
        <div className="relative flex shrink-0 items-center justify-center">
          <Blob className="absolute h-64 w-64 sm:h-96 sm:w-96" />
          <Bunny className="relative w-52 sm:w-80" />
          <Cloud className="absolute -top-1 right-0 w-20 sm:right-2 sm:w-28" />
          <Star className="absolute bottom-6 left-0 w-9 sm:left-4 sm:w-12" />
          <Sparkle className="absolute left-6 top-4 w-6 sm:left-10 sm:top-8 sm:w-8" />
        </div>
        <div className="min-w-0 flex-1">
          <p data-testid="home-greeting" className="text-lg font-medium text-muted-foreground">
            {greeting}
          </p>
          <h1 data-testid="home-pitch" className="mt-2 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-[color:var(--color-ink)] sm:text-6xl lg:text-7xl">
            What feels{' '}
            <span className="bg-[linear-gradient(transparent_58%,var(--color-blush)_58%)] px-1 [box-decoration-break:clone]">manageable</span> today?
          </h1>
          <p data-testid="home-explain" className="mt-4 max-w-xl text-xl leading-relaxed text-muted-foreground">
            Start with your mood, energy and time. I&apos;ll help you find something that fits.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
            <Button className="min-h-14 rounded-full px-9 text-lg font-semibold shadow-[0_4px_0_0_rgba(48,36,80,0.35)] active:translate-y-px active:shadow-none" onClick={start} data-testid="home-find">
              Find something to do
            </Button>
            <Button variant="outline" className="min-h-14 rounded-full border-2 px-9 text-lg font-semibold" onClick={() => setSignIn(true)} data-testid="home-signin">
              Sign in
            </Button>
          </div>
        </div>
      </section>
      <div ref={previewRef}>
        <PreviewSection asking={asking} onClose={() => setAsking(false)} />
      </div>
      <section aria-labelledby="place-heading" data-testid="home-place" className="mt-14">
        <h2 id="place-heading" className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
          A change of scenery
        </h2>
        <div className="mt-3 rounded-3xl border border-border border-t-4 border-t-[var(--color-apricot)] bg-card p-6 shadow-[var(--shadow-card)]">
          <PlaceSuggestions kinds={[homeKind(dayOfYear(new Date()))]} autoEveryMs={30 * 60_000} showOthers={false} fallback="Even a few minutes outside can help. Pick any direction you like." />
        </div>
      </section>
      {signIn && <AuthOverlay onClose={() => setSignIn(false)} />}
    </div>
  )
}
