import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { useBunnyChat } from '@/lib/bunny-chat'
import { GREETING, partOfDay } from '@/lib/for-now'
import type { Suggestion } from '../plans/plan'
import { Bunny } from './Bunny'

/**
 * The top of Home: the big bunny, a greeting, and one simple invitation. It is the focal point of the page.
 * The floating bunny is also on this page; "Talk to the bunny" brings its chat forward rather than
 * adding a second text box here.
 */
export function HomeHero({ suggestions = [] }: { suggestions?: Suggestion[] }) {
  const chat = useBunnyChat()
  const greeting = GREETING[partOfDay(new Date())]

  return (
    <section aria-label="Welcome" data-testid="home-hero" className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
      <Bunny className="w-56 shrink-0 sm:w-72" />
      <div className="min-w-0 flex-1">
        <p data-testid="home-greeting" className="text-base text-muted-foreground">
          {greeting}
        </p>
        <h2 className="mt-1 text-3xl font-bold leading-tight tracking-tight text-foreground">What&apos;s on your mind?</h2>
        {chat.latest && (
          <p data-testid="home-latest" className="mt-4 rounded-2xl bg-accent px-5 py-3 text-left text-lg leading-relaxed text-foreground">
            {chat.latest}
          </p>
        )}
        {suggestions.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start" aria-label="Things we could talk about" data-testid="home-suggestions">
            {suggestions.map((sg) => (
              <button
                key={sg.plan.id}
                type="button"
                data-testid="home-suggestion"
                onClick={() => void chat.startAbout(sg.plan)}
                className="min-h-11 rounded-2xl bg-accent px-4 py-2 text-left text-base text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {sg.label}
              </button>
            ))}
          </div>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-3 sm:justify-start">
          <Button className="min-h-12 rounded-xl px-6 text-base font-semibold" onClick={chat.requestFocus} data-testid="home-talk">
            Talk to the bunny
          </Button>
          <Link
            to="/checkin"
            data-testid="do-something"
            className="inline-flex min-h-12 items-center rounded-xl border border-input bg-card px-6 text-base font-semibold text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Do something little for yourself
          </Link>
        </div>
      </div>
    </section>
  )
}
