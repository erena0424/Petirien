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
            <li>Videos and ideas you save, with any note you add to them.</li>
            <li>
              Your conversations with the bunny, saved as they happen, so you can read them again under Chat. You can
              switch saving off for a chat by choosing &ldquo;Don&apos;t save this chat&rdquo; before you start it. A chat
              you don&apos;t save is never stored.
            </li>
            <li>
              Journal notes: after a conversation (when you ask, when you start a new one, or when it has been quiet for a
              while) the bunny writes a short note about it: a title, a few sentences, and a few feeling words. You can read
              and delete them under Journal.
            </li>
            <li>
              Reflections you write about a plan: the plan&apos;s name and time, an optional feeling word, and your own words. You can
              read, change, and delete them under Journal.
            </li>
            <li>
              Places you mark good, not right now, or never: only the place&apos;s public name, your choice and when you made it, never where you
              were. A favorite comes up now and then, &ldquo;not right now&rdquo; leaves a place out for a couple of weeks, and you can see and undo
              them under Preferences.
            </li>
            <li>Your preferences: what to avoid, what you like, your usual time, and how you like the bunny to talk.</li>
            <li>A simple count of how many times you asked for ideas or chatted today, to keep usage fair.</li>
          </ul>
          <p>
            It has no ads or analytics. You sign in with GitHub or Google through
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
            <strong>When you talk to the bunny,</strong> each message you send, along with the earlier messages in that chat
            and your few most recent journal notes (so it can remember you), goes to Anthropic&apos;s Claude through
            DeepSpace so the bunny can answer. When it writes a note, the saved messages go again to write it. The bunny is
            an AI, not a person and not a therapist. It does not keep a hidden profile of you: what it remembers is the
            journal notes you can read and delete. The one thing it learns on its own is how you like it to talk (for
            example short replies or a cheerful tone), chosen only from a small fixed list, never from what you say. You
            can see and change it under Preferences.
          </p>
          <p>
            <strong>For ideas to try,</strong> an AI service also sees your answers (feeling, energy, time, what would help)
            and your optional note, to choose and explain ideas. The note goes only in that first step. The second step sees
            only your time, energy and goal, and the titles and lengths of videos. Leave the note blank if you would rather
            not share it.
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
          <p>
            <strong>Places near you (optional).</strong> On the &ldquo;Visit a place nearby&rdquo; idea you are asked to share your
            location, and can then choose a kind of place (park, caf&eacute;, library, garden). Your browser asks first. If you say yes,
            the location is rounded to about a kilometre and sent, with the kind of place, to Google Maps through DeepSpace to find
            a few places close by. The rounded location is remembered in this browser only, never on our servers, so places can show every time; you can update or forget it any time under the places, and clearing your browser data removes it. The places found are kept only for that browser tab, for a few hours. They are shown only to you. If you say no, nothing is sent and the idea is
            simply taking a walk. You do not need to be signed in for this; the app looks up a visitor&apos;s places itself,
            with the same rounded location and nothing saved, and may pause it for the day if many people use it.
          </p>
          <p>
            <strong>Google Calendar (optional).</strong> If you connect your own Google account (through DeepSpace), the app
            reads the next day or two of your calendar when you ask. On the check-in screen it uses only when your next event
            starts, to suggest how much time you have, and it does not show, save, or tell the AI what your events are. On
            Home it shows the names and times of a few plans on your screen only, and keeps nothing. Only if you press{' '}
            &ldquo;Reflect on this&rdquo; does that plan&apos;s name and time go into your chat with the bunny, so the AI sees
            it, and it is saved with that chat unless you chose not to save it. Notes the bunny writes from that chat go in your Journal
            on the plan&apos;s date, with the plan&apos;s name. Reflections you wrote yourself earlier are never sent to the AI. Google&apos;s permission screen
            says the app can &ldquo;view and edit&rdquo; events; this app only reads, and never changes your calendar. You can
            remove the connection any time in your Google Account settings.
          </p>
          <p>
            <strong>Events you add yourself.</strong> You can add an event (a name, a date and an optional time) on Home or in the
            Journal. It is saved to your account, shown only to you on your Journal calendar and, if it is today or tomorrow, on Home,
            and you can remove it any time. It is not sent to the AI unless you press the button to talk about it with the bunny.
          </p>
        </Section>

        <Section title="Deleting your data">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              One check-in: open <strong>History</strong> and press Delete.
            </li>
            <li>
              One conversation: open <strong>Chat</strong> and press Delete. The journal notes about it stay until you
              delete them.
            </li>
            <li>
              One journal entry: open <strong>Journal</strong> and press Delete.
            </li>
            <li>
              One saved video or idea: open <strong>Saved</strong> and press Remove.
            </li>
            <li>
              Everything: open <strong>Preferences</strong> and press <strong>Delete everything</strong>. This removes your
              check-ins and notes, conversations, journal entries, suggestions, saved videos and ideas, and preferences.
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
