import { dayOfYear } from '@/lib/for-now'
import { homeKind } from '../places/places'
import { PlaceSuggestions } from './PlaceSuggestions'

/**
 * A real place to go, on Home: a park, a café, a library or a garden near you, changing from day to day. Location is asked for, never assumed; someone who has
 * already allowed it sees the place at once, at most every half hour so a reload never quietly costs money.
 */
export function HomePlace() {
  return (
    <section aria-labelledby="place-heading" data-testid="home-place" className="mt-10">
      <h2 id="place-heading" className="font-display text-2xl font-semibold text-foreground">
        A change of scenery
      </h2>
      <div className="mt-3 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <PlaceSuggestions kinds={[homeKind(dayOfYear(new Date()))]} autoEveryMs={30 * 60_000} showOthers={false} fallback="Even a few minutes outside can help. Pick any direction you like." />
      </div>
    </section>
  )
}
