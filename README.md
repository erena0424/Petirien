# Petirien

A small web app for everyday emotional support. You say how you feel, a bunny companion listens, and it offers a few
small things to do: a video, a real place nearby, or a simple idea. It can also help you look back on the plans in your
calendar, and it keeps a journal in your own words.

Petirien is **not therapy, not medical advice, and not crisis care.** It never diagnoses or treats anything. If someone
writes something that suggests they may be in crisis, the app stops, skips recommendations, and shows real support
(988 call, text and chat, Crisis Text Line, 911). The bunny says plainly that it is an AI.

Built on [DeepSpace](https://deep.space) for the AI-native GTM engineer build exercise.

**Try it:** https://petirien.app.space. The signed-out Home has sample suggestions and a place-to-go card with no account.
To use the bunny, the journal and check-ins, sign in with Google or GitHub (an account is created the first time). Nothing
needs DeepSpace credits: the AI and video calls are paid by the app owner, within daily limits (see below).

**Demo account** (invented entries only: conversations written up as journal entries, events across September and October,
check-ins and saved items). In the sign-in window choose **Sign in with email**:

- Email: `petirien-demo@deepspace.test`
- Password: `Pet-omSwl0gwmcZxiV`

It is a shared account, so please keep it to testing. Anything you add is visible to the next visitor.

## What it does

- **Check-in:** mood and energy, then optional time, what would help, screen or no screen, inside or outside, and a note.
  The default mix is one video, one place to visit, and one other idea. Every suggestion has a good / not for me button,
  and what you say shapes the next ones. Variety is built in, so the same few ideas do not come up every time.
- **The bunny:** a floating companion on every page, and a full Chat page. Conversations are saved by default, with a
  "Don't save this chat" option. The bunny remembers only a fixed vocabulary of how you like it to talk (tone, length,
  questions), which you can see and edit in Preferences.
- **Plans and reflection:** connect your own Google Calendar and see today and tomorrow on Home. "Reflect on this" starts a
  conversation with the bunny about any plan, coming or past, without assuming how you feel about it.
- **Your own events:** click or drag on the Journal's Week or Day calendar to add an event right where you point (a drag sets how long it lasts, like Google Calendar), or type one in on Home or in the Journal. It is saved to your account, shown on your Journal calendar (and on Home when it is today or tomorrow), and you can talk about it with the bunny like a Google event, so the calendar works without connecting Google.
- **Journal:** a calendar (Month, Week, Day, List) with your calendar's events at their times, the bunny's notes written in
  your own voice, and a mood and energy chart. Events you have not written about are there too, so you can reflect on any
  of them later.
- **Places near you:** concrete suggestions ("Take a walk to ...", "Spend quality time at ...") from Google Maps, using your
  location only if you allow it (rounded to about a kilometre and remembered in your browser only, with Update and Forget buttons). A place can be marked good, not right now (it sits out for two weeks), or never. A place that is closed is never suggested: each place is kept with its weekly opening hours and open or closed is worked out from the clock when it is shown, and from 9 PM to 6 AM nothing outdoors is: Home looks only for a café or library, "Not sure" on a check-in is sent as inside, and the card says why.
- **Home:** (signed out: sample suggestions and a place to go) two video ideas for right now (no history needed), a place to go, your plans, and what you saved.
- **Saved, History, Preferences, Privacy:** save videos and ideas, review check-ins, set what to avoid, and delete
  everything in one step.

## Design tradeoffs

- **Predictable suggestions over open AI generation.** Activities come from a curated catalog of 28 written ahead of time
  (`src/catalog.ts`, drafted by Claude Code and reviewed by me), not generated on the fly. Plain code first narrows the
  catalog by time, energy and preferences; the model only interprets the check-in and ranks among what is left, and any
  id it returns that is not in that list is dropped. Videos come only from real search results. The cost is less novelty;
  the gains are that nothing inappropriate can be suggested, links are never invented, and nothing is paid to generate
  activities. Rotation and the good / not for me buttons keep it from feeling repetitive.
- **Who pays.** The model and video calls cost a fraction of a cent to about a cent, so the app owner pays and nobody needs
  credits to try it; each account and the whole app have daily limits. Google Calendar cannot work that way: DeepSpace
  reads the calendar of whoever's token the call carries, so it is billed to, and reads from, the signed-in person.
- **Left out on purpose.** Weather, voice and analytics dashboards (they would not make reflection easier), writing to the
  calendar (it only reads), and any extra DeepSpace integration added just to have more of them.
- **What I would do next.** Move and resize events by dragging them; a small hand-checked pool of videos per activity as a
  fallback when search fails; retry other database writes (like place ratings) the way saving an event now does; test on
  real phones; give the bunny a more distinctive voice (a tester found it a little generic).

## How this was built with AI agents

I directed Claude Code and wrote down the rules it worked under, so the process is reviewable, not just the result.

- **Rules:** [`CLAUDE.md`](CLAUDE.md) is the standing instruction set: what the app is and is not, words it may never use, and hard rules (crisis handling is a fixed card, never improvised by the model; the model may only choose among videos we retrieved; secrets only through DeepSpace; no real user text in tests or logs; identity only from the verified token). It also lists what only I do: sign in, deploy, push, spend beyond a cap, send anything to anyone.
- **Plan and roles:** [`docs/PLAN.md`](docs/PLAN.md) is the day-1 plan with each platform fact labelled verified or assumed. [`.claude/agents/`](.claude/agents) defines three roles (tech lead, frontend, backend) with what each owns and when to stop and ask.
- **Workflow:** [`docs/WORKFLOW.md`](docs/WORKFLOW.md) sets the loop for each slice: brief, build, check, review, log, then I verify it myself. [`docs/slices/`](docs/slices) holds the briefs, each ending with "what these checks do not prove".
- **Record:** [`docs/agent-log.md`](docs/agent-log.md) logs every round: what the agent did, what I checked or corrected, status as built-and-verified, built-but-unverified or not built, and every paid test call. It includes the agent's own mistakes (a wrong response shape that cost about $0.20, an edit made while a test run was in progress) next to my corrections (first-person journal entries instead of "you said", a calmer look, suggestions that must visibly change from Drained to Lots).
- **Checks the agent had to leave behind:** unit tests and browser tests with every paid call mocked, and the paid-usage counters compared before and after each full run (they must not change).
- **In practice:** the tech-lead role was the default session, and the log records the work under that session. The frontend and backend roles are defined but, per the log, were not run as separate parallel agents.

## DeepSpace integrations used

| Integration | Used for |
| --- | --- |
| `youtube/search-videos`, `youtube/get-video-details` | Finding videos. Fixed search phrases per activity, never the person's words. |
| `anthropic/chat-completion` | The bunny's replies, the check-in interpretation and ranking, and the journal notes. |
| `google/calendar-list-events` | Reading the person's own calendar (they connect it themselves). Only start and end times and names are read. |
| `serpapi/places-search` | Nearby places, from a location rounded to about a kilometre. |

Also DeepSpace platform features: auth, the Records database with per-user permissions, and server actions.

**Billing and limits.** The AI calls (the bunny, check-in interpretation, journal entries) and the video searches are paid
by the app owner. Per-account daily limits (80 chat messages, 25 check-ins) and app-wide daily limits (600 model calls, 120
video calls) bound the cost; past them the bunny says it is resting and the app shows plain ideas. Place searches, for
everyone signed in or not, go through the app's own route (`/api/public/places`): fixed kinds of place only, a location
rounded to about a kilometre, results shared for a day, and 60 fresh searches a day in total. Only Google Calendar is billed
to the signed-in person, because it reads that person's own Google account. The open integrations route refuses every
owner-paid integration, so they can only be reached through the app's own actions, which require sign-in and keep the
limits.

## Privacy and safety choices

- Every collection is private to its owner, including for admins. A test checks it.
- A check-in note and chat are only sent to the model for that purpose. The model never receives your calendar events
  unless you press "Reflect on this" for one, and written reflections are never sent to it.
- Journal entries are written as sentences in the person's own voice and checked in code: a sentence that is not built from what the person actually said is dropped.
- The bunny's replies are checked for links, medical or treatment language, diagnosis-like labels and stock phrases.
- YouTube rules are followed: embedded player only, handling for blocked and removed videos, stored details refreshed
  or hidden within 30 days.
- Daily limits on paid work, and a calm message when the bunny is resting.

## Run it locally

```bash
npm install
npx deepspace auth login          # your own browser
npx deepspace dev start           # http://localhost:5173
```

## Tests

```bash
npm run test:unit                                      # logic, with fakes
npx playwright test -c tests/playwright.config.ts      # real browser, real local database
```

The final run had 473 unit tests and 144 browser tests with no failures (one more browser test is skipped on purpose: it
checks DeepSpace's own debug page, which is not part of this app).

The browser tests use DeepSpace test accounts and mock every paid call (YouTube, the model, Google Calendar, Google Maps,
the browser's location), so a full run costs nothing. After a run, `npx deepspace app usage` should be unchanged.
Entries that only the model would write are put in the local database through a development-only hook, which is not in a
production build.

## What is and is not verified

Verified by tests: the recommendation logic and mix, safety checks, permissions and isolation between accounts, the
calendar layout and adding events by clicking or dragging, places ranking, open hours and the night rule, the Journal
views, the limits on paid calls, and every user flow in a browser against the real local database.

Checked by hand on the live site: the signed-out preview; signing in with an email account that has no credits and still
getting bunny replies, journal entries from conversations, check-ins with real videos and saved items (so the app owner
really pays for those); the open integrations route refusing owner-paid calls; real place search and photos with a real
location.

Not verified: how the real model sounds over many conversations, the real Google sign-in and Google Calendar flow end to
end, per-person billing of Calendar, whether a brand-new Google account behaves exactly like the email demo account, and
the app on real phones (only simulated widths are tested).

## Layout

```
src/pages/        screens (Home, Check-in, Chat, Journal, Saved, History, Preferences, Privacy)
src/components/   UI, including the floating bunny and the Journal calendar
src/recommend/    the check-in pipeline: filter, model steps, video retrieval, ordering
src/reflect/      the bunny: prompts, guards, style memory, journal notes
src/plans/        plans from the calendar and typed by hand
src/journal/      calendar layout and the mood chart logic (pure)
src/places/       nearby places logic (pure)
src/actions/      server actions
src/schemas/      collections and permissions
tests/            browser tests
```
