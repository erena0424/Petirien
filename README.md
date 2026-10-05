# Petirien

A small web app for everyday emotional support. You say how you feel, a bunny companion listens, and it offers a few small things to do: a video, a real place nearby, or a simple idea. It can also help you look back on the plans in your calendar, and it keeps a journal in your own words.

Petirien is not therapy, medical advice, or crisis care. It never diagnoses or treats anything. If someone writes something that suggests they may be in crisis, the app stops, skips recommendations, and shows real support resources. The bunny also says plainly that it is an AI.

**Try it:** https://petirien.app.space

The signed-out Home has sample suggestions and a place-to-go card with no account. To use the bunny, journal, and check-ins, sign in with Google or GitHub. The AI and video calls are paid by the app owner, so DeepSpace credits are not required.

**Demo account:** In the sign-in window, choose **Sign in with email**:

- Email: `petirien-demo@deepspace.test`
- Password: `Pet-omSwl0gwmcZxiV`

The demo account contains invented conversations, journal entries, events, check-ins, and saved items. It is shared, so anything you add may be visible to the next visitor.

## What it does

- **Check-in & activity suggestions:** Share your mood and energy, with optional preferences such as how much time you have, whether you want to be inside or outside, and what would help. Petirien suggests a mix of videos, nearby places, and simple activities. Feedback on suggestions shapes future ones.
- **The bunny:** A floating companion on every page and a full Chat page. Conversations are saved by default, with a "Don't save this chat" option. You can also adjust how the bunny communicates in Preferences.
- **Plans and reflection:** Connect Google Calendar to see upcoming plans and start a conversation with the bunny about any event, coming or past.
- **Your own events:** Add events directly in Petirien, so the calendar and reflection features also work without connecting Google Calendar.
- **Journal:** View calendar events, reflections written from your conversations, and mood and energy over time.
- **Places near you:** Get nearby activity suggestions from Google Maps if you choose to share your location. Location is rounded to about a kilometre and remembered only in the browser.
- **Saved, History, Preferences, Privacy:** Save ideas, review check-ins, adjust preferences, and delete your data.

## Design tradeoffs

- **Predictable suggestions over open AI generation.** Activities come from a curated catalog of 28 written ahead of time (`src/catalog.ts`, initially drafted by Claude Code and reviewed by me) rather than being generated on the fly. Code first narrows the catalog based on time, energy, and preferences, and the model interprets the check-in and ranks the remaining activities. This limits novelty, but makes recommendations more predictable, prevents invented activity links, and reduces generation costs.
- **Cost and caching.** AI, YouTube, and place searches use app-owned credits, while Google Calendar uses each signed-in user's own connection. I added per-user and app-wide usage limits and cached place searches so repeated queries can reuse previous results instead of making another paid request.
- **Left out on purpose.** I left out weather, voice, and analytics dashboards because they would add complexity without making the core reflection experience meaningfully better.
- **What I would do next.** Expand the activity selection and give the bunny a more distinctive personality.

## How this was built with AI agents

I used Claude Code as my primary implementation agent, with project-specific instructions in `CLAUDE.md` and a phased development plan. Before implementation, I had the agents investigate the relevant code, propose a plan, and review it rather than immediately generating code.

I manually tested the app after each phase and changed both the functionality and design based on what I observed. The development process is documented in `docs/PLAN.md`, `docs/WORKFLOW.md`, and `docs/agent-log.md`, including issues encountered and changes made after testing.

## DeepSpace integrations used

| Integration | Used for |
| --- | --- |
| `youtube/search-videos`, `youtube/get-video-details` | Finding guided activity videos |
| `anthropic/chat-completion` | Bunny conversations, check-in interpretation and ranking, and journal entries |
| `google/calendar-list-events` | Reading a user's connected Google Calendar |
| `serpapi/places-search` | Finding nearby places from an approximate location |

I also used DeepSpace's authentication, Records database with per-user permissions, and server actions.

Owner-paid integrations are protected by per-user and app-wide usage limits. Place searches are cached and shared where possible to reduce repeated API calls and cost. Google Calendar is connected and billed separately for each signed-in user because it accesses that user's own Google account.

## Privacy and safety choices

- Every collection is private to its owner, including for admins.
- Check-in notes and chats are only sent to the model when needed for that interaction. Calendar events are not sent to the model unless the user chooses **Reflect on this** for an event.
- Journal entries are generated from what the user actually said, with additional checks before they are saved.
- Bunny replies are checked for links, medical or treatment language, diagnosis-like labels, and other unsafe output.
- Potential self-harm language interrupts the normal conversation flow and shows fixed human-support resources rather than relying on model-generated crisis guidance.

## Run it locally

```bash
npm install
npx deepspace auth login
npx deepspace dev start
```

The local app runs at `http://localhost:5173`.

## Tests

```bash
npm run test:unit
npx playwright test -c tests/playwright.config.ts
```

The final run had **473 unit tests and 144 browser tests with no failures**. One additional browser test for DeepSpace's own debug page is intentionally skipped.

Paid integrations are mocked during automated testing, so the test suite does not consume integration credits.

## What is verified

Automated tests cover recommendation logic, safety checks, permissions and isolation between accounts, calendar behavior, nearby-place ranking and opening hours, paid-call limits, responsive layouts, error handling, and core user flows against the local database.

I also manually tested the deployed application, including the signed-out experience, email sign-in with an account that has no credits, real bunny conversations and journal generation, check-ins with real videos, saved items, and place search with a real location. I also used ChatGPT Work to independently test the deployed application and fixed issues it surfaced.

## Layout

```text
src/pages/        screens (Home, Check-in, Chat, Journal, Saved, History, Preferences, Privacy)
src/components/   UI, including the floating bunny and the Journal calendar
src/recommend/    the check-in pipeline: filter, model steps, video retrieval, ordering
src/reflect/      the bunny: prompts, guards, style memory, journal notes
src/plans/        plans from the calendar and typed by hand
src/journal/      calendar layout and mood chart logic
src/places/       nearby places logic
src/actions/      server actions
src/schemas/      collections and permissions
tests/            browser tests
```
