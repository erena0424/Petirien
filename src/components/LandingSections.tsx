import { Link } from 'react-router-dom'
import { CalendarDays, Lock, MessageCircleHeart, Trash2 } from 'lucide-react'

/** Sections of the static landing page. No providers, no network: plain markup, invented examples, labelled as such. */

const WRAP = 'mx-auto w-full max-w-6xl text-left'
const H2 = 'text-3xl font-bold text-foreground sm:text-4xl'
const LEAD = 'mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground'

/** A small made-up week: mood (solid) and energy (dashed). Decorative. */
function MiniChart() {
  const mood = [3, 2, 3, 4, 3, 4, 5]
  const energy = [2, 2, 3, 3, 2, 4, 4]
  const x = (i: number) => 20 + i * 46
  const y = (v: number) => 100 - v * 16
  const line = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)}`).join(' ')
  return (
    <svg viewBox="0 0 310 120" className="h-auto w-full" aria-hidden focusable="false">
      {[1, 2, 3, 4, 5].map((v) => (
        <line key={v} x1="10" x2="300" y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeWidth="1" />
      ))}
      <path d={line(energy)} fill="none" stroke="var(--color-energy)" strokeWidth="2.5" strokeDasharray="6 5" />
      <path d={line(mood)} fill="none" stroke="var(--color-primary)" strokeWidth="3" />
      {mood.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="4.5" fill="var(--color-primary)" />
      ))}
    </svg>
  )
}

/** A made-up month of days, some filled. Decorative. */
function MiniCalendar() {
  const filled = new Set([1, 2, 4, 5, 8, 9, 10, 12, 15, 16, 17, 18, 20, 23, 24])
  return (
    <div className="grid grid-cols-7 gap-2" aria-hidden>
      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
        <span key={d} className={`flex aspect-square items-center justify-center rounded-lg text-xs ${filled.has(d) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
          {d}
        </span>
      ))}
    </div>
  )
}

export function JournalSection() {
  return (
    <section aria-labelledby="journal-heading" data-testid="landing-journal" className={`${WRAP} mt-20`}>
      <h2 id="journal-heading" className={H2}>
        A journal that fills itself in
      </h2>
      <p className={LEAD}>Every conversation can become an entry, on the day it happened. Over time you can see how you have been, without having kept a diary.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <h3 className="text-xl font-semibold text-foreground">Your days, at a glance</h3>
          <p className="mt-1 text-base text-muted-foreground">A calendar of the days you talked or wrote, and a chart of your mood and energy over time.</p>
          <div className="mt-5">
            <MiniCalendar />
          </div>
          <div className="mt-5">
            <MiniChart />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">An invented example. Solid line: mood. Dashed line: energy.</p>
        </div>
        <div className="flex flex-col gap-5">
          <div className="rounded-3xl bg-secondary p-6">
            <p className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-card text-primary" aria-hidden>
              <MessageCircleHeart className="h-5 w-5" />
            </p>
            <h3 className="mt-3 text-xl font-semibold text-foreground">In your own voice</h3>
            <p className="mt-1 text-base text-muted-foreground">Entries are written as you, from what you actually said. Nothing is added, and you can read, keep or delete any of them.</p>
          </div>
          <div className="rounded-3xl bg-secondary p-6">
            <p className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-card text-primary" aria-hidden>
              <CalendarDays className="h-5 w-5" />
            </p>
            <h3 className="mt-3 text-xl font-semibold text-foreground">Talk about what&apos;s coming up</h3>
            <p className="mt-1 text-base text-muted-foreground">
              Connect your own Google Calendar if you like. Pick a plan, and the bunny asks a plain question about it, before and after, without assuming how you feel.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

const CONTROL = [
  { Icon: Lock, title: 'Private to you', text: 'Your chats, entries and check-ins belong to your account, and nobody else can read them.' },
  { Icon: MessageCircleHeart, title: 'You decide what is kept', text: 'Chats are saved by default, and any conversation can be marked "Don\'t save this chat". The bunny remembers only how you like it to talk.' },
  { Icon: Trash2, title: 'Delete it all in one step', text: 'One button in Preferences removes everything, whenever you want.' },
]

export function ControlSection() {
  return (
    <section aria-labelledby="control-heading" data-testid="landing-control" className={`${WRAP} mt-20`}>
      <h2 id="control-heading" className={H2}>
        Yours to keep, or to delete
      </h2>
      <p className={LEAD}>Petirien is everyday emotional support. The bunny is an AI, it never diagnoses anything, and real support is one tap away on every page.</p>
      <ul className="mt-8 grid gap-5 md:grid-cols-3">
        {CONTROL.map(({ Icon, title, text }) => (
          <li key={title} className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-primary" aria-hidden>
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-3 text-xl font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-base text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

const FAQ = [
  { q: 'Is Petirien therapy?', a: 'No. It is everyday emotional support, not therapy or medical advice, and it never diagnoses anything. If you ever need help right away, "Need support now?" at the bottom of every page has real services.' },
  { q: 'Is the bunny a real person?', a: 'No, it is an AI, and it says so. It is here to listen and talk back.' },
  { q: 'Do I have to sign in?', a: 'You can try a preview without signing in. Chatting, the journal and saving ideas need an account, so they are kept for you.' },
  { q: 'Who can read my journal?', a: 'Only you. Every entry is private to your account.' },
  { q: 'Does the bunny read my calendar?', a: 'Only if you connect your own Google Calendar. It shows you the names and times of a few upcoming plans, and you choose which ones to talk about.' },
  { q: 'Can I delete everything?', a: 'Yes. Preferences has a button that removes your chats, entries, check-ins and saved things in one step.' },
]

export function FaqSection() {
  return (
    <section aria-labelledby="faq-heading" data-testid="landing-faq" className={`${WRAP} mt-20 max-w-3xl`}>
      <h2 id="faq-heading" className={H2}>
        Questions
      </h2>
      <div className="mt-6 divide-y divide-border rounded-3xl border border-border bg-card shadow-[var(--shadow-card)]">
        {FAQ.map((f) => (
          <details key={f.q} className="group px-6 py-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-foreground">
              {f.q}
              <span aria-hidden className="text-2xl text-primary transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="pb-2 pt-1 text-base leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

/** The closing invitation: a deep violet band, the one strong block of colour on the page. */
export function FinalCta() {
  return (
    <section data-testid="landing-cta" className="-mx-6 mt-20 w-[calc(100%+3rem)] bg-primary px-6 py-14 text-center text-primary-foreground">
      <h2 className="mx-auto max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">Ready when you are.</h2>
      <p className="mx-auto mt-3 max-w-xl text-lg opacity-95">Say something to the bunny, or try a preview first. No blank page.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/home?signin=1" className="inline-flex min-h-14 items-center rounded-full bg-card px-9 text-lg font-semibold text-primary hover:bg-secondary">
          Sign in
        </Link>
        <Link to="/home?try=1" className="inline-flex min-h-14 items-center rounded-full border-2 border-primary-foreground/70 px-9 text-lg font-semibold text-primary-foreground hover:bg-primary-foreground/10">
          Try a preview
        </Link>
      </div>
    </section>
  )
}
