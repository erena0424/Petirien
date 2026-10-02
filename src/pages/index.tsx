/**
 * Landing page: a STATIC, prerendered page (no providers, no auth call).
 * Keep it renderable without a browser. It explains the benefit; Home then invites one easy action.
 */

import { Link } from 'react-router-dom'
import { Bunny } from '../components/Bunny'
import { Blob, Cloud, Sparkle, Star } from '../components/Sparkle'
import { Seo } from '../components/Seo'
import { DISPLAY_NAME } from '../constants'
import { seo } from '../seo'

const STEPS = [
  { n: '1', title: 'Tell me how you feel', text: 'Your mood, your energy, and how much time you have.' },
  { n: '2', title: 'I find a few things', text: 'A guided video, somewhere nearby to go, or a simple idea.' },
  { n: '3', title: 'Pick one, or save it', text: 'No endless scrolling. Save what you like for later.' },
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="flex min-h-screen flex-col items-center px-6 pb-10 pt-8 text-center">
        <p className="font-display text-2xl font-semibold text-primary">{DISPLAY_NAME}</p>

        <div className="relative mt-6 flex w-full max-w-6xl flex-col items-center gap-8 md:mt-10 md:flex-row md:justify-between md:text-left">
          <div className="max-w-2xl">
            <h1 className="font-display text-6xl font-semibold leading-[1.02] tracking-tight text-[color:var(--color-ink)] sm:text-7xl">
              A little support for whatever{' '}
              <span className="bg-[linear-gradient(transparent_58%,var(--color-blush)_58%)] px-1 [box-decoration-break:clone]">today</span> feels like.
            </h1>
            <p className="mt-6 text-xl leading-relaxed text-muted-foreground">
              Tell me how you&apos;re feeling and how much energy you have. I&apos;ll find an activity, a guided video, or somewhere nearby to go, without you searching through endless options.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
              <Link
                to="/home?try=1"
                data-testid="landing-try"
                className="inline-flex min-h-14 items-center rounded-full bg-primary px-9 text-lg font-semibold text-primary-foreground shadow-[0_4px_0_0_rgba(48,36,80,0.35)] transition hover:-translate-y-px hover:bg-primary/90 active:translate-y-px active:shadow-none"
              >
                Try a preview
              </Link>
              <Link
                to="/home?signin=1"
                data-testid="landing-signin"
                className="inline-flex min-h-14 items-center rounded-full border-2 border-input bg-card px-9 text-lg font-semibold text-foreground transition hover:bg-secondary"
              >
                Sign in
              </Link>
            </div>
          </div>

          <div className="relative flex shrink-0 items-center justify-center">
            <Blob className="absolute h-72 w-72 sm:h-[30rem] sm:w-[30rem]" />
            <Bunny className="relative w-56 sm:w-96" />
            <Cloud className="absolute -top-2 right-0 w-20 sm:right-2 sm:w-24" />
            <Star className="absolute bottom-6 left-0 w-9 sm:left-4 sm:w-11" />
            <Sparkle className="absolute left-6 top-4 w-6 sm:left-10 sm:top-6" />
          </div>
        </div>

        <ol className="mt-16 grid w-full max-w-6xl gap-4 text-left sm:grid-cols-3" aria-label="How it works">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-3xl border border-border border-t-4 border-t-[var(--color-apricot)] bg-card p-7 shadow-[var(--shadow-card)]">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-apricot)] font-display text-xl font-semibold text-[color:var(--color-ink)]">{s.n}</span>
              <h2 className="mt-4 font-display text-2xl font-semibold text-foreground">{s.title}</h2>
              <p className="mt-2 text-lg leading-relaxed text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>

        <p className="mt-10 max-w-sm text-xs text-muted-foreground">
          {DISPLAY_NAME} offers everyday emotional support and gentle ideas. It is not therapy or medical advice.{' '}
          <Link to="/privacy" className="underline underline-offset-4">
            Privacy
          </Link>
        </p>
      </div>
    </>
  )
}
