/**
 * Home. Two doors: check in (needs sign-in, handled by the protected route)
 * or, later, straight to saved videos.
 */

import { Link } from 'react-router-dom'
import { DISPLAY_NAME } from '../../constants'

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-4 py-16">
      <p className="text-sm font-medium text-primary">{DISPLAY_NAME}</p>
      <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
        When you don&apos;t know what would help, start here.
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
        Tell me how you are, how much energy you have, and how much time. I&apos;ll offer two or three gentle ideas, with a
        video for each. No endless scrolling.
      </p>
      <div className="mt-8">
        <Link
          to="/checkin"
          className="inline-flex min-h-12 items-center rounded-xl bg-primary px-6 text-base font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Check in
        </Link>
      </div>
    </div>
  )
}
