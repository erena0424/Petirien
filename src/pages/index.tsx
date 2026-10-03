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
  { n: '1', title: 'Just talk', text: "Say what's on your mind, big or small. The bunny listens and talks back, so there's no blank page." },
  { n: '2', title: 'It becomes a journal', text: 'After you chat, I write it up in your own words, as a short entry you can read and keep.' },
  { n: '3', title: 'Find a small next step', text: 'Whenever you want one, I can suggest a guided video, somewhere nearby to go, or a simple idea.' },
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="flex min-h-screen flex-col items-center px-6 pb-10 pt-8 text-center">
        <p className="font-display text-2xl font-semibold text-primary">{DISPLAY_NAME}</p>

        <div className="relative mt-6 flex w-full max-w-6xl flex-col items-center gap-8 md:mt-10 md:flex-row md:justify-between md:text-left">
          <div className="max-w-2xl">
            <h1 className="text-5xl font-semibold leading-[1.08] tracking-tight text-[color:var(--color-ink)] sm:text-6xl">
              Journaling that feels like talking.
            </h1>
            <p className="mt-6 text-xl leading-relaxed text-muted-foreground">
              Some people find it easier to talk things through than to write them down. Tell the bunny about your day and it talks back. Then I turn the conversation into a journal entry in your own words, so you keep a journal without having to write one.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
              <Link
                to="/home?try=1"
                data-testid="landing-try"
                className="inline-flex min-h-14 items-center rounded-full bg-primary px-9 text-lg font-semibold text-primary-foreground hover:bg-primary/90"
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
            <Blob className="absolute h-64 w-64 sm:h-[24rem] sm:w-[24rem]" />
            <Bunny className="relative w-48 sm:w-80" />
            <Cloud className="absolute -top-2 right-0 w-20 sm:right-2 sm:w-24" />
            <Star className="absolute bottom-6 left-0 w-9 sm:left-4 sm:w-11" />
            <Sparkle className="absolute left-6 top-4 w-6 sm:left-10 sm:top-6" />
          </div>
        </div>

        <section aria-label="An example" data-testid="landing-example" className="mt-14 w-full max-w-6xl text-left">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">An example</p>
          <div className="mt-3 grid gap-5 md:grid-cols-2">
            <div className="rounded-3xl bg-secondary p-6">
              <p className="text-sm font-semibold text-muted-foreground">You talk with the bunny</p>
              <p className="ml-auto mt-3 w-fit max-w-[85%] rounded-2xl rounded-br-md bg-card px-4 py-3 text-lg text-foreground">Work was a lot today and I feel wiped out.</p>
              <p className="mt-3 w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-primary px-4 py-3 text-lg text-primary-foreground">That sounds draining. What felt like the heaviest part?</p>
              <p className="ml-auto mt-3 w-fit max-w-[85%] rounded-2xl rounded-br-md bg-card px-4 py-3 text-lg text-foreground">The meeting that ran long. I just wanted to go home.</p>
            </div>
            <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <p className="text-sm font-semibold text-muted-foreground">And it becomes your journal entry</p>
              <h2 className="mt-2 text-xl font-bold text-foreground">A long day at work</h2>
              <p className="font-hand mt-2 text-lg leading-relaxed text-foreground">
                Work was a lot today and I feel wiped out. The meeting that ran long was the heaviest part. I just wanted to go home.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">An invented example. Entries are written from what you said, and you can read and delete them any time.</p>
            </div>
          </div>
        </section>

        <ol className="mt-16 grid w-full max-w-6xl gap-4 text-left sm:grid-cols-3" aria-label="How it works">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-3xl border border-border bg-card p-7 shadow-[var(--shadow-card)]">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-backdrop)] text-xl font-semibold text-[color:var(--color-ink)]">{s.n}</span>
              <h2 className="mt-4 text-2xl font-semibold text-foreground">{s.title}</h2>
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
