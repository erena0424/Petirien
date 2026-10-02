import { useRef, useState } from 'react'
import { AuthOverlay } from 'deepspace'
import { Button } from '@/components/ui'
import { GREETING, partOfDay } from '@/lib/for-now'
import { Bunny } from './Bunny'
import { PreviewSection } from './PreviewSection'

/**
 * Home for someone who has not signed in. The bunny, one sentence about what this is, and one clear invitation. Nothing
 * empty and nothing that needs an account: sample suggestions are ready to view, a short preview asks only for energy and
 * time, and signing in is always one press away (and can be skipped past). Calendar, places, saved and history wait until
 * after sign-in, when they mean something.
 */
export function PublicHome() {
  const [asking, setAsking] = useState(false)
  const [signIn, setSignIn] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  const greeting = GREETING[partOfDay(new Date())]

  function start() {
    setAsking(true)
    // Bring the questions into view once they have rendered.
    setTimeout(() => previewRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 0)
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="sr-only">Home</h1>
      <section aria-label="Welcome" data-testid="home-hero" className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
        <Bunny className="w-56 shrink-0 sm:w-72" />
        <div className="min-w-0 flex-1">
          <p data-testid="home-greeting" className="text-base text-muted-foreground">
            {greeting}
          </p>
          <p data-testid="home-pitch" className="mt-1 text-2xl font-bold leading-snug tracking-tight text-foreground">
            Petirien is a quiet place to tell a friendly bunny how you feel and find a few small things to do.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
            <Button className="min-h-12 rounded-xl px-6 text-base font-semibold" onClick={start} data-testid="home-find">
              Find something that fits how you feel
            </Button>
            <Button variant="outline" className="min-h-12 rounded-xl px-6 text-base font-semibold" onClick={() => setSignIn(true)} data-testid="home-signin">
              Sign in
            </Button>
          </div>
        </div>
      </section>
      <div ref={previewRef}>
        <PreviewSection asking={asking} onClose={() => setAsking(false)} />
      </div>
      {signIn && <AuthOverlay onClose={() => setSignIn(false)} />}
    </div>
  )
}
