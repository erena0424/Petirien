/**
 * Privacy page: a STATIC page (no providers, no sign-in needed), so anyone can
 * read it before signing up. It describes only what the app does today; if the
 * app's data handling changes, this page changes with it.
 */

import { Link } from 'react-router-dom'
import { Bunny } from '../components/Bunny'
import { Seo } from '../components/Seo'
import { DISPLAY_NAME } from '../constants'
import { seo } from '../seo'

const UPDATED = 'October 1, 2026'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <div className="mt-2 space-y-3 text-base leading-relaxed text-foreground">{children}</div>
    </section>
  )
}

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const
const link = 'font-medium text-primary underline underline-offset-4'

export default function Privacy() {
  return (
    <>
      <Seo
        {...seo}
        title={`Privacy | ${DISPLAY_NAME}`}
        description={`What ${DISPLAY_NAME} stores, who can see it, and how to delete it.`}
        path="/privacy"
      />
      <main data-testid="privacy-page" className="mx-auto w-full max-w-2xl px-4 py-12">
        <Link to="/" className="text-sm text-muted-foreground underline underline-offset-4">
          Back to {DISPLAY_NAME}
        </Link>
        <div className="mt-6 flex items-center gap-4">
          <Bunny animated={false} className="w-20 shrink-0" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Privacy</h1>
            <p className="mt-1 text-sm text-muted-foreground">Last updated {UPDATED}</p>
          </div>
        </div>

        <p className="mt-6 text-lg leading-relaxed text-foreground">
          {DISPLAY_NAME} is a small prototype for everyday emotional support. It is not therapy or medical advice. This page
          says plainly what it keeps and where your words go.
        </p>

        <Section title="What it saves">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Your check-ins: how you feel, your energy, your time, what would help, and the optional note you write.</li>
            <li>The ideas it suggested, and whether you said they were useful.</li>
            <li>Videos you save, with any note you add to them.</li>
            <li>Your preferences: what to avoid, what you like, and your usual time.</li>
            <li>A simple count of how many times you asked for ideas today, to keep usage fair.</li>
          </ul>
          <p>
            It does not save a chat transcript, and it has no ads or analytics. You sign in with GitHub or Google through
            DeepSpace, the platform this app runs on, which keeps your sign-in session.
          </p>
        </Section>

        <Section title="Who can see it">
          <p>
            Only you. The app is set up so every account can read and change only its own check-ins, saved videos, and
            preferences, and there is no screen for anyone else to look at them. Your data is stored in this app&apos;s
            database on DeepSpace (which runs on Cloudflare). Whoever runs the platform and the app could technically reach
            a database, so please don&apos;t share anything you wouldn&apos;t want a developer to ever see.
          </p>
        </Section>

        <Section title="Where your words go">
          <p>
            <strong>An AI service.</strong> To choose and explain ideas, your answers (feeling, energy, time, what would
            help) and your optional note are sent to Anthropic&apos;s Claude, through DeepSpace. The note goes only in that
            first step. The second step sees only your time, energy and goal, and the titles and lengths of videos. Leave the
            note blank if you would rather not share it.
          </p>
          <p>
            <strong>YouTube.</strong> Video ideas come from YouTube, found with fixed search phrases for each activity,
            never with your words. When you press Watch, the video plays in YouTube&apos;s own player in your browser, and
            YouTube may collect information as described in its policies. This app uses YouTube API Services. By using it
            you also agree to the{' '}
            <a className={link} href="https://www.youtube.com/t/terms" {...ext}>
              YouTube Terms of Service
            </a>
            , and Google&apos;s{' '}
            <a className={link} href="https://policies.google.com/privacy" {...ext}>
              Privacy Policy
            </a>{' '}
            applies.
          </p>
          <p>
            Video details such as titles and thumbnails come from YouTube and are refreshed about every 25 days. If they can&apos;t
            be refreshed, they are hidden after 30 days. Your own notes are not affected.
          </p>
        </Section>

        <Section title="Deleting your data">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              One check-in: open <strong>History</strong> and press Delete.
            </li>
            <li>
              One saved video: open <strong>Saved</strong> and press Remove.
            </li>
            <li>
              Everything: open <strong>Preferences</strong> and press <strong>Delete everything</strong>. This removes your
              check-ins and notes, suggestions, saved videos, and preferences.
            </li>
          </ul>
          <p>
            Your sign-in account itself is kept by DeepSpace and is not deleted by this app. Your daily usage count is
            also kept; it contains only a date and a number.
          </p>
        </Section>

        <Section title="If you are in a hard moment">
          <p>
            This app can&apos;t help in a crisis. In the US you can call or text <strong>988</strong> any time, or text{' '}
            <strong>HOME</strong> to <strong>741741</strong>. Outside the US, find a helpline at{' '}
            <a className={link} href="https://findahelpline.com/" {...ext}>
              findahelpline.com
            </a>
            . The &ldquo;Need support now?&rdquo; link at the bottom of every screen lists these too.
          </p>
        </Section>
      </main>
    </>
  )
}
