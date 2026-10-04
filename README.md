# Petirien

A small web app for everyday emotional support. You say how you feel, a bunny companion listens, and it offers a few
small things to do: a video, a real place nearby, or a simple idea. It can also help you look back on the plans in your
calendar, and it keeps a journal in your own words.

Petirien is **not therapy, not medical advice, and not crisis care.** It never diagnoses or treats anything. If someone
writes something that suggests they may be in crisis, the app stops, skips recommendations, and shows real support
(988 call, text and chat, Crisis Text Line, 911). The bunny says plainly that it is an AI.

Built on [DeepSpace](https://deep.space) for the AI-native GTM engineer build exercise.

## What it does

- **Check-in:** mood and energy, then optional time, what would help, screen or no screen, inside or outside, and a note.
  The default mix is one video, one place to visit, and one other idea. Every suggestion has a good / not for me button,
  and what you say shapes the next ones. Variety is built in, so the same few ideas do not come up every time.
- **The bunny:** a floating companion on every page, and a full Chat page. Conversations are saved by default, with a
  "Don't save this chat" option. The bunny remembers only a fixed vocabulary of how you like it to talk (tone, length,
  questions), which you can see and edit in Preferences.
- **Plans and reflection:** connect your own Google Calendar and see today and tomorrow on Home. "Reflect on this" starts a
  conversation with the bunny about any plan, coming or past, without assuming how you feel about it.
- **Journal:** a calendar (Month, Week, Day, List) with your calendar's events at their times, the bunny's notes written in
  your own voice, and a mood and energy chart. Events you have not written about are there too, so you can reflect on any
  of them later.
- **Places near you:** concrete suggestions ("Take a walk to ...", "Spend quality time at ...") from Google Maps, using your
  location only if you allow it (rounded to about a kilometre and remembered in your browser only, with Update and Forget buttons). A place can be marked good, not right now (it sits out for two weeks), or never. A place that is closed is never suggested: each place is kept with its weekly opening hours and open or closed is worked out from the clock when it is shown, and from 9 PM to 6 AM nothing outdoors is: Home looks only for a café or library, "Not sure" on a check-in is sent as inside, and the card says why.
- **Home:** (signed out: sample suggestions and a place to go) two video ideas for right now (no history needed), a place to go, your plans, and what you saved.
- **Saved, History, Preferences, Privacy:** save videos and ideas, review check-ins, set what to avoid, and delete
  everything in one step.

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

Also DeepSpace platform features: auth, the Records database with per-user permissions, and server actions. Paid
integrations are billed to the signed-in person. The one exception is "Somewhere to go" for visitors who have not signed in:
it goes through `/api/public/places`, billed to the app owner, and boxed in (fixed kinds of place, a location rounded to
about a kilometre, results shared and kept for a day, and 60 fresh searches a day for all visitors together, about $2). An optional Google API key
(a DeepSpace secret) only backs YouTube up and checks which videos can be embedded.

## Privacy and safety choices

- Every collection is private to its owner, including for admins. A test checks it.
- A check-in note and chat are only sent to the model for that purpose. The model never receives your calendar events
  unless you press "Reflect on this" for one, and written reflections are never sent to it.
- Journal notes are checked in code: a bullet that is not built from what the person actually said is dropped.
- The bunny's replies are checked for links, medical or treatment language, diagnosis-like labels and stock phrases.
- YouTube rules are followed: embedded player only, handling for blocked and removed videos, stored details refreshed
  or hidden within 30 days.
- Daily limits on paid work, and a calm message when someone is out of credits.

## Run it locally

```bash
npm install
npx deepspace auth login          # your own browser
npx deepspace dev start           # http://localhost:5173
```

Optional: `npx deepspace secrets set YOUTUBE_API_KEY --stdin` for the backup YouTube key.

## Tests

```bash
npm run test:unit                                      # logic, with fakes
npx playwright test -c tests/playwright.config.ts      # real browser, real local database
```

The browser tests use DeepSpace test accounts and mock every paid call (YouTube, the model, Google Calendar, Google Maps,
the browser's location), so a full run costs nothing. After a run, `npx deepspace app usage` should be unchanged.
Entries that only the model would write are put in the local database through a development-only hook, which is not in a
production build.

## What is and is not verified

Verified by tests: the recommendation logic and mix, safety checks, permissions, the calendar layout, places ranking and
rotation, the Journal views, every user flow in a browser against the real local database.

Not verified by automation, and checked by hand instead: how the real model sounds, the real Google sign-in and calendar
response, real Google Maps results and the browser's location prompt, and billing of the integrations to the signed-in
person.

## Layout

```
src/pages/        screens (Home, Check-in, Messages, Journal, Saved, History, Preferences, Privacy)
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
