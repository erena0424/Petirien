# CLAUDE.md — Petirien

A small everyday-emotional-support web app: mood/energy check-in → short companion chat → two or three activity + YouTube video suggestions → watch or save → optional "was this useful" feedback. Built on **DeepSpace** for the AI-Native GTM Engineer build exercise. **Deadline: Mon Oct 5, 2026, 11:59 PM ET.** Submission = live URL + repo + short note (product, integrations, main tradeoff, agent contributions, what Elena personally verified).

It is **not** therapy, **not** a medical device, and does **not** diagnose or treat anything. It is separate from Lobelia (the asthma app); do not import Lobelia code, data, or agents.

Read `docs/PLAN.md` first. It holds the verified platform facts, pipeline, data model, screens, tests, and open decisions as planned on day 1; `docs/agent-log.md` records what changed since. Platform and SDK facts are in `AGENTS.md` and the DeepSpace skill in `.agents/skills/deepspace/`. This file is the rules.

---

## Default agent

Unless a session names another agent, the default session acts as `tech-lead` (`.claude/agents/tech-lead.md`). `frontend-dev` and `backend-dev` do scoped work when `tech-lead` assigns it.

---

## Terminology

**Never use in UI, README, submission note, or code comments aimed at users:** diagnose, treat, treatment, cure, therapy, therapeutic, clinical, prescribe, "mental health care," "medical device," "depression/anxiety relief" as a promise.

| Say | Meaning |
|-----|---------|
| everyday emotional support | What the app is |
| check-in | Mood + energy + time + optional note |
| companion | The warm AI voice; never a therapist or friend-with-credentials |
| suggestion / pick | Activity + real video we retrieved |
| useful | The feedback measure. Never "did you feel better" |
| saved | Bookmarked video ID + metadata in our DB. Not downloaded, not synced to YouTube |

Companion replies must not diagnose, label conditions, give medical advice, or claim outcomes.

---

## ⛔ Critical rules

### Crisis language
If a note or message suggests self-harm or crisis, the app shows the static support card (US 988 + "this app is everyday support, not crisis care") and **skips recommendations**. Wording is reviewed by Elena. Never improvise crisis responses with the LLM.

### Never invent links or video facts
Every video shown comes from `youtube/search-videos` / `youtube/get-video-details`. The LLM may only choose among supplied candidate IDs; output IDs not in the candidate set are dropped in code. Explanations may only use supplied metadata.

### Secrets
Only via `npx deepspace secrets set`. Never in `.dev.vars`, env files, logs, commits, client bundle, README, or the agent log. Check `.gitignore` before the first commit.

### No real user text in the repo, logs, tests, or prompts you write
Fixtures and demos use made-up check-ins. Don't log note bodies. No stored chat transcripts: store structured `intent` only.

### Identity comes from the verified JWT
Never trust a user id from the client. Every user collection is `member: read/update/delete: 'own'`. Cross-account isolation must have a test.

### Source-control latch is permanent
Decision (see PLAN §6 #1): create the GitHub repo and remote **before** the first `deepspace deploy`. **Never run `deepspace push`.** Check with `npx deepspace app source --json`.

### Elena-only actions (agents propose, Elena does)
- `npx deepspace auth login` (her browser)
- `deploy` and any production change
- Spending beyond the cap in `docs/agent-log.md` (default **$10** total; spikes are cents). Paid `integrations invoke` calls: one per question, record the result
- Creating the GitHub repo, pushing, making it public
- Anything sent to a person, including the DeepSpace clarification email (draft only)
- The final submission

Unclear whether something is outward-facing or spends money → ask first.

---

## Stack facts (details in `docs/PLAN.md`)

- DeepSpace scaffold (`npm create deepspace@latest <name>`): Vite + React client, Cloudflare Worker, Durable Object Records DB. Node 22.15+/24/26.
- Integrations: YouTube (`search-videos`, `get-video-details`) and an LLM (Anthropic/OpenAI via DeepSpace). Auth + Records + server actions are platform primitives. Cron for metadata refresh is a stretch.
- Integration calls return `{success, data}` or `{success:false, error, code}`. Render `error`, branch on `code`. Empty results are not errors. A failed resource must **never** reload the page.
- Run `npx deepspace integrations info <endpoint>` before guessing a request shape. Schemas are the source of truth.
- Records are envelopes: fields under `record.data`. Disable writes until `useMutations().ready`.
- Keep the scaffold's `users` schema; extend, don't rename.
- Paid calls need: sign-in required, per-user daily cap, caching, disabled button while in flight.
  - **Decided exception 3 (2026-10-04, Elena's decision):** DeepSpace's `youtube/*` integration is the only video source (the app's own Google key is not used) and is owner-billed, with an app-wide cap of 120 calls a day (`src/server/owner-cap.ts`). All place searches, signed in or not, use the capped owner-paid route (`/api/public/places`). The open `/api/integrations/*` route refuses any owner-paid integration, so these can only be reached through server actions.
  - **Decided exception 2 (2026-10-04, Elena's decision):** Anthropic calls are owner-billed (`src/integrations.ts`, `developer`) so a new account needs no credits to try the app. Still bounded: sign-in is required, per-account daily limits stay, and `src/server/owner-cap.ts` caps the whole app at 600 model calls a day (about $0.60). No quiet fallback to the person's own credits: if the cap, the owner's token or the owner's credits fail, the bunny says it is resting. Only Calendar stays user-billed.
  - **One decided exception (2026-10-02, Elena's request, so signed-out reviewers see Somewhere to go):** `POST /api/public/places` (`src/server/public-routes.ts`) is billed to the app owner. Fixed kinds only, location rounded server-side, shared 24 h cache, global cap of 60 fresh searches/day (about $2). Nothing else may be anonymous-paid.

### YouTube rules we must honor
- Player ≥ 200×200 (aim 480×270 on desktop). No UI overlaid on the player.
- Handle `onError` 100 (gone), 101/150 (embedding disabled) inline with an **Open on YouTube** link; Save still works.
- Related videos **cannot** be disabled (`rel=0` = same channel only; `modestbranding` is a no-op). Never claim distraction-free playback. We close/replace the player on `ENDED` and show the feedback card.
- Stored metadata (title, thumbnail, duration) must be refreshed or deleted within 30 days. Keep `metaRefreshedAt`; refresh when older than ~25 days. Video IDs and the user's own notes may persist.
- No autoplay by default.

### Look and feel (palette updated 2026-10-02 at Elena's request; replaces the earlier blue-header palette)
White is the foundation; the bunny's lavender and blue are restrained accents. The look comes from the companion bunny (Elena's own illustration, `public/bunny.gif`, still frame `bunny-still.png`).
- **Palette** (updated 2026-10-02 again, Elena approved: white, periwinkle, deep violet; tokens in `src/themes.css`, `calm` theme; never hard-code hex in components): background clean white `#FCFCFF` · card `#FFFFFF` · headings and text dark ink `#29243B` · muted `#655D70` · primary (buttons, links, active states) deep violet `#6554A0` · backdrop periwinkle `#E3E9FC` (behind the bunny, selected options; pale `#EEF2FD`) · lavender `#F0EBF8` (companion bubbles, reflection areas, footer) · butter `#F4D98B` (small stars only) · border `#E4E1EF` · input border `#8A859A` · header: floating white pill. The peach/apricot accent was tried and dropped.
- **Decorative accents:** butter (small stars), ink for headlines. Hero shapes: periwinkle blob, cloud, star, sparkle (`src/components/Sparkle.tsx`). Header is a floating rounded pill.
- **Type:** Nunito (variable, self-hosted via `@fontsource-variable/nunito`), 17px base (18px on wide screens, set on `html`, so all rem sizes scale), generous line spacing. Only the "Petirien" wordmark uses Fredoka (`@fontsource-variable/fredoka`, class `font-display`, self-hosted); headings are Nunito semibold.
- **Bunny:** used on landing, Home (big, fixed at the top), Messages (big), check-in header, loading, empty states, the reflection prompt, and as the floating companion. Decorative (`alt=""`); animated by default, still frame for `prefers-reduced-motion`. Not used on the support/crisis screens.
- **Voice:** short, specific, first person ("I'll find a few things"). Avoid "gentle ideas" repetition and marketing words (streamline, transform).
- Extend these tokens; do not introduce a new palette without Elena.

---

## Project structure

```
CLAUDE.md                     # this file: the rules every agent session follows
AGENTS.md                     # DeepSpace's own instructions for agents (SDK, deploy, version control)
.claude/agents/               # tech-lead, frontend-dev, backend-dev: the roles
docs/PLAN.md                  # the day-1 plan: verified platform facts, pipeline, data model, decisions
docs/WORKFLOW.md              # how work moves: slice, build, check, review, log, owner verifies
docs/slices/Sx.md             # the brief for each slice (goal, files owned, acceptance, what the checks do NOT prove)
docs/agent-log.md             # what the agent did, round by round, and what the owner checked or corrected
src/                          # the app: catalog.ts (curated activities), recommend/, reflect/, places/, journal/, ...
tests/                        # browser tests (paid calls mocked); unit tests sit beside the code in src/
```

---

## Build gates

1. **Survey first.** Confirm against docs, `integrations info`, or a real call. Facts carry a label: verified / assumed. Contradiction → stop and update `docs/PLAN.md`.
2. **Small reviewable increments.** One vertical slice at a time; Elena can review each. No unrequested features. Deferred list: calendar, voice, streaks, analytics. (The bunny companion was added at Elena's request on 2026-10-01; no other characters or animation systems.)
3. **Leave a check behind.** Every behavior gets an assertion or a named manual check. **State what the check does not prove.**
4. **Verify like a user.** Green tests are necessary, never sufficient: smoke the core loop on the deployed URL as a fresh account, exercise failure states, use two accounts for isolation.
5. **Label status honestly:** built-and-verified / built-but-unverified / not built. Never stub "coming soon."
6. **Log it.** Append to `docs/agent-log.md` after each slice: what the agent did, what Elena checked or corrected.
7. **Product facts from real calls**, recorded in the log, not remembered from chat.

---

## Anti-patterns

- LLM text that contains URLs, or a card rendered from model output without ID validation
- Trusting model JSON without Zod validation and a deterministic fallback
- One giant "AI does everything" endpoint with no testable filter
- Storing or logging note text
- Adding a fake integration to reach a count
- Reloading the page on error
- Polling paid endpoints or calling them on every keystroke
- Re-deriving decided things; changing the palette or scope mid-build
- Automated tests that make paid calls (YouTube, LLM). Mock or short-circuit them, and compare `npx deepspace app usage --json` before and after a full run (it must not change)
- Treating chat as the record

---

## Git

Commit as you go with Conventional Commits. Elena pushes and merges. Commits end with the attribution line specified in the session reminder.
