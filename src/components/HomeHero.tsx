import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { useBunnyChat } from '@/lib/bunny-chat'
import { GREETING, partOfDay } from '@/lib/for-now'
import type { Suggestion } from '../plans/plan'
import { Bunny } from './Bunny'
import { Blob, Cloud, Sparkle, Star } from './Sparkle'

/**
 * The top of Home: the big bunny, a greeting, and one simple invitation. It is the focal point of the page.
 * The floating bunny is also on this page; "Talk to the bunny" brings its chat forward rather than
 * adding a second text box here.
 */
export function HomeHero({ suggestions = [] }: { suggestions?: Suggestion[] }) {
  const chat = useBunnyChat()
  const greeting = GREETING[partOfDay(new Date())]

  return (
    <section aria-label="Welcome" data-testid="home-hero" className="flex flex-col items-center gap-8 text-center md:flex-row md:items-center md:gap-14 md:text-left">
      <div className="relative flex shrink-0 items-center justify-center">
        <Blob className="absolute h-60 w-60 sm:h-80 sm:w-80" />
        <Bunny className="relative w-48 sm:w-64" />
        <Cloud className="absolute -top-2 right-0 w-20 sm:-right-4 sm:w-28" />
        <Star className="absolute bottom-6 left-0 w-9 sm:-left-2 sm:w-12" />
        <Sparkle className="absolute left-6 top-4 w-6 sm:left-8 sm:top-6 sm:w-8" />
      </div>
      <div className="min-w-0 flex-1">
        <p data-testid="home-greeting" className="text-lg font-medium text-muted-foreground">
          {greeting}
        </p>
        <h2 className="mt-2 text-4xl font-bold leading-[1.1] tracking-tight text-[color:var(--color-ink)] sm:text-5xl lg:text-6xl">What&apos;s on your mind?</h2>
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
        <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
          <Button className="min-h-14 rounded-full px-9 text-lg font-semibold" onClick={chat.requestFocus} data-testid="home-talk">
            Talk to the bunny
          </Button>
          <Link
            to="/checkin"
            data-testid="do-something"
            className="inline-flex min-h-14 items-center rounded-full border-2 border-input bg-card px-9 text-lg font-semibold text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Do something little for yourself
          </Link>
        </div>
      </div>
    </section>
  )
}
