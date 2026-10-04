> **Read this first.** This is the plan written on day 1 (30 Sep 2026), before the first line of code. It is kept as it was, as the record of the plan the agent worked to. Many decisions were refined afterwards, at the owner's direction (the look, the bunny and journal, Google Calendar and Maps, the first-visitor flow); `docs/agent-log.md` records each change and why, and where the two disagree the log and the code are right.

# Plan: Calm Pick (working title) — DeepSpace build exercise

Written for Elena. Facts checked on 2026-09-30 against docs.deep.space, the DeepSpace CLI catalog, and Google's YouTube docs. Deadline: **Mon Oct 5, 2026, 11:59 PM ET**.

Legend: ✅ verified (source named) · ⚠️ assumed / not yet proven · ❓ your decision.

---

## 1. Is the scope credible in five days?

**Yes, if the core loop stays narrow.** Everything you listed is a thin layer over platform primitives that exist. The risk is not the build, it is three unknowns that must be spiked on Day 1 (§2 spikes), and cost/billing behavior for reviewers (§2).

Cuts that keep it credible:
- Catalog of ~20 activities, three categories. Not a taxonomy project.
- Companion = **one structured interpretation turn + one optional clarifying reply**, not an open-ended chat with persisted history.
- No transcript storage. Store structured intent only (privacy + scope).
- History screen = simple list. No charts.
- Cron refresh is a stretch; lazy refresh on library open is the default.

Schedule check (today is Day 1, Sep 30): tight but fine. **Day 1 must end with a deployed skeleton and all three spikes answered**, because every later day depends on them.

---

## 2. Platform capabilities

### Verified
| Claim | Source |
|---|---|
| Integration proxy: `integration.post('<provider>/<endpoint>', body)` client-side; `tools.integration(...)` in server actions; envelope `{success,data}` / `{success:false,error,code}` | docs `/guides/external-apis` |
| **YouTube endpoints exist**: `youtube/search-videos` ($0.013/req), `youtube/get-video-details` ($0.0065/req), `youtube/get-trending-videos` | `npx deepspace integrations list` |
| `search-videos` input: `q` (required), `order`, `maxResults` 1–50, `regionCode`, `publishedAfter/Before`. Output: `videos[]` each with `links.watch`, `links.embed`, `links.thumbnail`, `embedHtml`, `markdownLink`, `formatted`; plus `totalResults` | `integrations info youtube/search-videos` |
| `get-video-details` input: `id` (string). Description promises "snippet, statistics, and duration" | `integrations info youtube/get-video-details` |
| LLMs via `anthropic/chat-completion`, `openai/chat-completion`; in workers via `createDeepSpaceAI` + Zod tool schemas for structured output; models include `claude-sonnet-5`, `claude-haiku-4-5` | docs `/sdk-reference/worker/ai`, `/guides/ai-chat` |
| Auth (GitHub/Google OAuth), Records DB with RBAC; `permissions.member: {read:'own', update:'own', delete:'own'}` is enforced server-side in the Durable Object; `uniqueOn` for one-row-per-user | docs `/concepts/permissions` |
| Server actions = `POST /api/actions/{name}`, JWT-verified, `userId` from token, RBAC-bypassing `tools` | docs `/guides/server-actions` |
| Billing per integration: `developer` (owner pays, anonymous allowed) or `user` (caller pays, 401 if anonymous). No platform rate limit except Google; **app must add its own caps** | docs `/guides/external-apis` |
| Secrets: `npx deepspace secrets set K=V`, never `.dev.vars`/commits. Integrations need no API key of their own | docs `/guides/secrets` |
| Cron: `src/cron.ts`, min 1 min, `ctx.records` + `ctx.integrations.call`, owner-billed | docs `/guides/scheduled-jobs` |
| Node 22.15+/24/26 required (you have v24.13 ✅) | docs `/get-started/installation` |
| Deploy → `https://<name>.app.space` (name: lowercase, 2–63 chars, globally unique) | docs `/get-started/quickstart` |
| **Source control latches permanently on first use.** `deepspace push` (or deploy with no GitHub remote) claims DeepSpace; first deploy from a checkout whose remote is GitHub claims that repo | docs `/guides/source-control` |

### YouTube embedding (Google docs)
| Fact | Source |
|---|---|
| Player ≥ 200×200 px; 480×270 recommended for 16:9 with controls | IFrame API ref, Required Minimum Functionality |
| Must not overlay/obscure the player with UI | Required Minimum Functionality |
| `onError`: **100** = not found/removed/private; **101 / 150** = embedding disabled by owner; 2 = bad ID; 5 = HTML5 error; 153 = missing Referer | IFrame API ref |
| `enablejsapi=1` + `origin` recommended; `playsinline=1` for mobile; browsers may block autoplay (`onAutoplayBlocked`) | IFrame API ref |
| **Related videos cannot be disabled.** `rel=0` only restricts them to the *same channel*. `modestbranding` is deprecated (no effect) | Player parameters |
| **Stored API metadata (title, thumbnail, duration…) may be kept ≤ 30 days unless refreshed.** Video IDs themselves have no stated restriction | YouTube Developer Policies |

**Consequences for the design (please read):**
1. Do **not** promise distraction-free playback. Honest copy: "Plays in YouTube's player; we hide suggestions by closing the player when the video ends."
2. Saved library stores `videoId` + your own note permanently, but **refreshes metadata** (title/thumb/duration) from `get-video-details` when older than ~25 days. This also detects removed videos.
3. Embedding-disabled/removed video → inline "This one can't play here" + **Open on YouTube** link + Save still works.

### Not verified — Day 1 spikes (each is a few cents)
Requires `npx deepspace auth login` (your browser; agents can't do it).
1. ⚠️ **Does `search-videos` return duration?** Output schema is open (`additionalProperties`). Run `integrations invoke youtube/search-videos --body '{"q":"5 minute guided breathing","maxResults":5}'` and inspect `formatted`/fields.
2. ⚠️ **Does `get-video-details` accept several comma-separated ids?** (YouTube's own API does; the proxy might not.) Also: does it return `embeddable`, `madeForKids`? If not, embeddability is only discoverable at play time (error 101/150).
3. ⚠️ **Latency and reviewer billing.** Time a full search→details→LLM round trip. Check what a reviewer with a fresh account experiences under `developer` vs `user` billing.
4. ⚠️ Does the end-of-video screen flash before we can swap the player on `ENDED`? Test on a real phone-width viewport.
5. ⚠️ RunningMap reference app: I could not find it in github.com/deepdotspace (StoryNest, ThreadHunt found). Ask DeepSpace or skip.

### Which three integrations?
"Integration" is ambiguous in the brief (you flagged this). Honest read:

| # | Integration | Real job in the app | Counts as... |
|---|---|---|---|
| 1 | **YouTube** (`search-videos`, `get-video-details`) | Real retrieval + metadata | Third-party catalog integration ✅ |
| 2 | **LLM** (`anthropic/chat-completion` or `createDeepSpaceAI`) | Interpret request, rank, explain, schema-validated | Third-party catalog integration ✅ |
| 3 | **Auth + Records (per-user RBAC)** | Accounts, saved library, prefs, feedback, isolation | Platform primitive |
| tentative | **Google Calendar** (`google/calendar-list-events`) | "How much time do I actually have?" prefill (see §2b) | Third-party catalog integration ✅ (if unblocked) |
| stretch | **Cron** | Refresh saved-video metadata, flag removed | Platform primitive |

Only two *catalog* integrations fit without being arbitrary (Exa/Tavily web search adds nothing over YouTube search; Google Calendar is deferred; Resend email isn't wanted). **Do not add a fake third.** Recommendation: build 1–3 and cron if time allows, and send DeepSpace a one-line clarification (draft below). Drafting only; you send it.

> Draft (you send): "Quick clarification on the 'at least three integrations' bar — does that mean third-party catalog integrations, or does the platform's auth, records database, and scheduled jobs count? My app uses YouTube and an LLM from the catalog plus auth/records/cron."

### 2b. TENTATIVE: Google Calendar slice (build only if the gate below passes)

**What it does:** On the check-in screen, an optional "Use my calendar" button reads today's events and pre-fills **available minutes** (time until the next event, capped). Nothing else. No event creation, no storing events.

**Verified:** four endpoints exist (`calendar-list-events/-create/-update/-delete`, $0.013 each, `[oauth]`); the platform runs the OAuth flow, users connect their own Google account, consent is per-feature/incremental, billing is always the signed-in user (Google endpoints cannot be developer-billed), and a not-connected call returns `{success:true, data:{requiresOAuth:true, authUrl, scopes}}`.
**Unverified:** whether DeepSpace's Google client is verified by Google, i.e. whether any Google account can connect or users see an "unverified app" screen / test-user cap. Docs are silent (searched the OAuth guide and full docs).

**Order (decided): build and test the core loop WITHOUT calendar first.** Calendar work starts only after the core is deployed and tested (target: Day 3, Oct 2). The one thing worth doing early is a 10-minute, few-cent spike: call `google/calendar-list-events` with a second Google account and note what happens (connect screen, warning, 402). Write the result in `docs/agent-log.md`; don't build anything on it yet.

**Gate (all must be true before building; the old "Oct 1 eve" deadline is replaced by "core done"):**
1. DeepSpace (or your own second Google account test) confirms a non-allowlisted account can connect without being blocked.
2. Core loop (check-in → picks → watch → save) is already working and deployed.
3. Reviewer path works **without** calendar: the button is optional and minutes can always be typed.

If the gate fails, cut it. No partial version.

**Design if built:**
- Client: `integration.post('google/calendar-list-events', {timeMin, timeMax})`; branch on `data.requiresOAuth` → send user to `authUrl`; 4 states (loading/error/empty/success); local retry, no page reload; handle the `upstream_provider_error` / "Token refresh failed" signature as a reconnect case.
- Privacy: event titles/attendees never leave the browser, are never sent to the LLM, stored, or logged. Only a derived number (minutes free) enters the check-in. Show "We only use how much time you have."
- Tests: mock `page.route()` for the envelope (connected, `requiresOAuth`, 502 refresh failure, empty day). Live Google consent is manual only (docs: no live consent in automated tests). Manual check: second account, revoke in Google settings, confirm reconnect prompt.
- Cost: one $0.013 call per tap, user-billed; users without credits get a 402 → show "enter minutes yourself."
- Not proven by these tests: Google's real consent screen behavior for a stranger.

**How to ask DeepSpace (they publish no support email; I found none in the docs):**
1. **The hiring contact from your assignment** (best first stop; you already have it and they can route the question).
2. **DeepSpace Discord:** https://discord.gg/hcKSav5PpU (linked from the docs home page). Use a public channel; do not post the assignment or any confidential details.
3. **GitHub issue** on https://github.com/deepdotspace/deepspace (SDK) for doc gaps. Optional.

Draft (you send; don't include your take-home details): "Two quick platform questions for an app I'm building: (1) Are the `google/*` integrations (e.g. Calendar) usable by any Google account on a deployed app, or are there test-user limits / unverified-app warnings? (2) For the exercise's 'at least three integrations' guidance, do platform features like auth, records, and scheduled jobs count alongside catalog integrations like YouTube and an LLM?"

### 2c. Backup integrations (only if calendar is cut and you still want a third catalog integration)

Checked against the live catalog on 2026-09-30. Outputs not yet spiked.

| Rank | Candidate | Real job | Cost | Risk |
|---|---|---|---|---|
| 1 | **OpenWeatherMap** (`current`, `forecast`, `geocoding`) | Weather-aware filter: rain/cold/heat → indoor picks; nice day → "a walk" becomes eligible. City typed by user (geocoding) | ~$0.002/call | Low: no per-user OAuth, can be owner-billed. Coarse location only, not stored |
| 2 | **SerpApi Google Maps** (`places-search`) | "A walk nearby": one or two parks/gardens for the movement goal, only when weather allows | $0.0325/call | Medium: hours/safety not guaranteed; results vary by reviewer location; needs fallback city. No routing or map tiles exist in the catalog |
| 3 | **ElevenLabs** (`generate-speech`) | Read a short, fixed, pre-written grounding/breathing script aloud (audio for the user's "little energy" moment) | ~$0.0001–0.0002/char (a 600-char script ≈ $0.04–0.12) | Medium: voice was deferred; only use fixed reviewed scripts, cache the audio, cap per user |

**Weak fits (don't add just to count):**
- **Wikipedia** (`get-page-summary`): could explain a technique, but that's general info, not support, and content quality/claims are out of our control.
- **Exa / web search** for recipes or resources: open web results in a wellbeing app invite unvetted advice. Skip. Also `websearch/advanced-search` is $0.13/call.
- **Resend email**: reminders/nudges aren't wanted.
- **Composio** (connect user apps): can't list which toolkits exist without logging in; it's per-user OAuth with the same reviewer-connect risk as Google.

**Recipes:** there is **no recipe integration**. The honest, cheap way is a catalog category ("nourish: easy 10-minute snack/cook-along") served by the **existing YouTube pipeline**. It adds a category, not an integration.

**Mental health resources:** keep these **static and reviewed** (988, plus one or two well-known organizations you choose). Not retrieved live; crisis content must never come from search or an LLM. It's content, not an integration.

**Health data:** the catalog has **no** Apple Health / Fitbit / Oura / Strava / sleep endpoint (searched for health, fitness, sleep, fitbit, oura, strava, whoop). Don't chase it. The substitute is one optional self-reported line in the check-in (e.g., "slept well / not great"), stored as a tag. It is not an integration, and it avoids a whole class of privacy risk.

**Billing decision** ❓ — recommend `developer` billing for YouTube + LLM (reviewers may have no credits; `user` billing gives them a 402), **gated behind sign-in, per-user daily cap, and search-result caching** so a stranger can't burn your credits. Estimated cost per check-in ≈ 3 searches ($0.04) + ~4 details ($0.03) + 2 LLM calls (cents) ≈ **$0.10 worst case**; caching cuts it a lot.

---

## 3. Recommendation and retrieval pipeline

One server action, `recommend`, JWT-verified (identity from token only).

```
check-in (mood, energy, minutes, goal?, note?) + prefs + recent feedback
  │
  ├─1. HARD FILTER (deterministic, no LLM): catalog.filter(
  │      minutes ≤ available, effort ≤ cap(energy), not in dislikes/avoid,
  │      not rejected this session)
  │
  ├─2. LLM #1 "interpret" (Haiku-class, tool call, Zod-validated):
  │      → { goal, candidateActivityIds[3–5 from filtered set], reply,
  │          needsSupportResources: boolean }
  │      Unknown IDs are dropped. If needsSupportResources → skip to §safety.
  │
  ├─3. RETRIEVE: for top 3 activities, youtube/search-videos using the
  │      activity's CURATED query (from catalog, not LLM-invented),
  │      maxResults 6–8. Cache per query 24h.
  │
  ├─4. ENRICH: get-video-details on the shortlist → duration, title, channel.
  │      Drop videos longer than available time (+ small slack) or missing data.
  │
  ├─5. LLM #2 "rank & explain" (tool call, Zod-validated): from the REAL
  │      candidate list only, pick one video per activity, write ≤2 sentences
  │      each. Output videoIds are validated against the candidate set;
  │      anything else is discarded. Explanations may use only supplied metadata.
  │
  └─6. RETURN 2–3 cards + "None of these fit"
```

**Why this shape:** constraints are deterministic (testable), the LLM only chooses among things that exist, and links come only from the retrieval step, so "never invented links" is enforced by code, not by prompting.

**Failure ladder (each is a demoable state):**
| Failure | Behavior |
|---|---|
| LLM #1 fails/invalid | Deterministic score (goal tags + prefs) picks activities; template reason |
| LLM #2 fails/invalid | Top-duration-fit video per activity; template reason |
| YouTube fails/empty | Show the activity as text-only with "Try again" + link to Saved |
| Video unplayable (101/150/100) | Inline message, Open on YouTube, Save still possible |
| Daily cap reached | Friendly message, Saved library still works |
| Everything down | Saved library + manual browse of catalog activities still work |

**"None fit":** chips (*too long / too much effort / not my thing / different kind*) → re-run with exclusions. Max 2 rounds, then offer "take a break" and Saved. Each reject is stored as feedback.

**Feedback:** "Was this useful?" yes / somewhat / no (+ optional reason chip). **Not** "did your mood improve." Last ~10 feedback rows feed into prompts as tags only, never raw text.

**Safety ❓:** `needsSupportResources` (LLM flag) shows a static card with US 988 and a line that the app is everyday support, not crisis care, and skips recommendations. Plus a permanent footer line. No diagnosis/treatment language anywhere. This is the one behavior that needs an independent human check before you submit.

---

## 4. Smallest useful data model and screens

All collections: `member: { read:'own', create:true, update:'own', delete:'own' }`. Keep scaffold's `users` schema. Catalog lives in code (`src/catalog.ts`), not the DB.

| Collection | Fields |
|---|---|
| `checkins` | mood(1–5), energy(1–5), minutes, goal, intent(text, LLM-derived, short), note(optional, user text) |
| `suggestions` | checkinId, activityId, videoId, title, reason, rank, status(`shown`/`opened`/`rejected`/`saved`), helpful(`yes`/`somewhat`/`no`/null), reasonChip |
| `savedVideos` | videoId (uniqueOn per user), title, channel, thumbnail, durationSec, activityId, userNote, metaRefreshedAt, availability(`ok`/`no_embed`/`gone`) |
| `preferences` | one per user (`uniqueOn`): likedTags[], dislikedTags[], defaultMinutes, avoid[] |
| `usage` | day, count (for per-user cap) |
| `searchCache` | query, results(json), fetchedAt — app-owned, written by server action |

Decision: **no stored chat transcripts.** `note` is optional and deletable.

Screens (6, mobile-first):
1. **Home** — "Check in" primary, "Saved" secondary (satisfies direct-to-library).
2. **Check-in** — mood, energy, minutes, goal chips, optional text.
3. **Companion + Picks** — short reply, 2–3 cards (thumbnail, title, duration, why), Watch / Save / Not this one, "None fit".
4. **Watch** — embedded player, Save, then feedback card.
5. **Saved** — grid/list, filter by category, note, unavailable badge.
6. **Preferences + History** — likes/dislikes/avoid, past check-ins with feedback, "delete my data".

Design tokens (your palette): bg `#FAFAF8`, card `#FFFFFF`, text `#252B29`, muted `#66706B`, border `#E3E7E2`, accent `#426653`, selected `#EDF3EE`. Check white-on-`#426653` contrast ≥ 4.5:1 (it is ~6:1 by my estimate; verify). Follow `/design/product-polish` from DeepSpace docs.

---

## 5. Tests and demo

**Automated (`npx deepspace test run` + Playwright multi-user fixture):**
- Hard filter: given time/energy/dislikes → excluded activities never returned (pure unit test).
- Validator: LLM output with an unknown activityId or videoId is dropped (feed a fake response).
- **Account isolation:** user B cannot read/update/delete user A's `savedVideos`, `checkins`, `suggestions`, `preferences` (two sessions, `test accounts list`).
- Save is idempotent (`uniqueOn`), unsave works.
- Recommend returns 401 unauthenticated; daily cap enforced.
- Integration boundary mocked with `page.route()` for failure states; **one** real YouTube call total per test.

**Manual, you personally (this is your "what I verified" section):**
- Live smoke as a fresh Google/GitHub account: check-in → picks → watch → save → feedback → reload → library persists.
- Embedding-disabled video (find one) and a deleted video ID: fallback shows, no crash.
- Offline/YouTube failure: ladder states appear, no full-page reload.
- Phone-width viewport: no horizontal scroll, player ≥ 200px.
- Crisis phrase in note → support card, no recommendations.
- Forbidden-words grep over UI strings (`diagnos|treat|cure|therap|clinical|prescrib`).
- Secrets: grep repo + bundle for keys; `.dev.vars` ignored.

**Demo order (≈3 min):** Saved (proves persistence) → fresh check-in → companion → picks with reasons → play → save → "none fit" → unplayable-video fallback → second account can't see first's library.

---

## 6. Decisions you must make (recommendations first)

| # | Decision | Recommendation |
|---|---|---|
| 1 | **Source control latch** — GitHub or DeepSpace (permanent) | **GitHub.** Submission requires a repo. Create the GitHub repo + remote **before the first deploy** and never run `deepspace push`. |
| 2 | Billing mode for YouTube/LLM | `developer` + sign-in + per-user cap + cache (§2) |
| 3 | Spend cap for the week | e.g. **$10**; agents stop and ask beyond it |
| 4 | App name | **Not urgent.** Scaffold with a placeholder. The name is only a lease on `<name>.app.space`; the app id is permanent. Rename with `npx deepspace deploy --rename`: new URL works immediately, old URL stops (not redirected, reserved 30 days, can rename back). So don't share the URL until the name is final; rename by Oct 4 |
| 5 | Categories | Meditation / gentle movement / creative break, plus a 4th "connect" *only* if catalog time allows (goal "feel connected" otherwise has no activity) |
| 6 | Goal list | calm down · express · connect · move · take a break. Drop any with no catalog entries |
| 7 | Crisis handling copy | Static 988 card + footer; you review wording |
| 8 | Video language/region | English, `regionCode: US`, to keep results consistent |
| 9 | Length cap | Videos ≤ available minutes + 2; never > 30 min |
| 10 | Who are demo users | Reviewer account isn't known; ensure public sign-in works and a first-run path exists with an empty library |
| 11 | DeepSpace clarifications | Integration definition + Google verification (drafts in §2 and §2b); RunningMap link. Ask the hiring contact first |
| 11b | Calendar slice | Decided: core loop first, calendar after (target Oct 2) if the §2b gate passes; backups in §2c (weather first) |
| 13 | Public repo hygiene | No personal data, no real check-in text, keep `docs/` planning out or scrubbed |

---

## Next steps today (Day 1)
1. You: `npx deepspace auth login`; decide #1, #2, #4.
2. Agent: spikes 1–3 (record outputs in `docs/agent-log.md`, no secrets/user text).
3. Agent: scaffold, deploy skeleton (after your go-ahead on deploy), commit.
4. Write catalog (20 items) while spikes run.

Sources: [DeepSpace docs](https://docs.deep.space/) · [deepspace-skill](https://github.com/deepdotspace/deepspace-skill) · [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference) · [Player parameters](https://developers.google.com/youtube/player_parameters) · [Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality) · [Developer Policies](https://developers.google.com/youtube/terms/developer-policies)

---

## 7. Roadmap: companion chat with long-term memory (added 2026-10-01, not built)

Elena's idea: a chat where the companion works out what someone feels like, recommends precisely, and gradually learns their preferences from it.

**Where we are:** the check-in is one structured turn (mood/energy/time/goal/note, then the model interprets it). The original brief's step 2, "talk briefly with the companion", is only partly met.

**Proposed in three stages, each shippable on its own:**
1. **Learn from feedback, no chat (small, safe).** From "Was this useful?" answers, compute which *tags* helped (deterministic, no model). Show "What I've noticed" on Preferences in plain words ("Quiet videos with no talking usually helped") with Keep / Dismiss. Only kept items change ranking. Cost: none beyond today's calls.
2. **Short clarifying chat (1 to 3 turns).** Before ideas, the companion may ask one question ("More like winding down, or getting some energy out?"). Structured output, same validation and fallbacks as today. Every turn runs the crisis checks (phrase list plus the model flag).
3. **Memory.** After a chat the model *proposes* memory items as short statements ("prefers short things when tired"). The person confirms each one; confirmed items live in an editable "What I remember" list, are used in prompts, and are removed by Delete my data. No raw transcripts are stored.

**Principles:** memory is visible, editable, and opt-in per item; nothing is learned silently; no diagnosis or health inferences; items are about activity taste and context only.

**Costs and risks to decide on:** each chat turn is another paid model call (billing attribution is still unverified, see the agent log); open-ended chat widens the safety surface; DeepSpace's `ai-chat` feature would give streaming and persistent history but stores transcripts, which conflicts with our no-transcripts rule unless we accept that and add deletion.

**Timing:** the deadline is Oct 5. Recommended order: finish preferences, get real videos working, deploy and verify live, privacy page, README and submission note. Then stage 1 if time remains. Stages 2 and 3 are best described in the submission note as the next step unless the core is done and verified with a day to spare.

### Stage 4 (idea, 2026-10-01): activities made for the person by the AI

Elena's thought: depending on what someone writes, the AI could compose an activity instead of only picking from the 20 hand-written ones.

**Why it is a real decision:** the hand-written catalog is deliberate (consistent, safe, reviewed). AI-written steps are open-ended wellness instructions, so they carry more risk (unsafe physical advice, medical-sounding claims, tone drift).

**If we do it, guardrails I would require:**
- Only low-risk kinds: writing, drawing, sensory or grounding, simple breathing **without breath-holds**, a short slow walk. No exercise or stretching beyond what the catalog already covers.
- Fixed output shape (title, what you need, 3 to 5 steps, one tip), validated; the stop-if-it-hurts line is added by code, never by the model.
- Same copy guard as everything else (no forbidden words, links, stock phrases) and the crisis checks on the person's text.
- Clearly labeled "Made for you by AI. Skip anything that doesn't feel right." Saveable like any idea, but stored with its text (it is not in the catalog).
- One extra model call, only when the catalog has no good fit or the person asks for something different.

**Recommendation:** after the deadline, or before it only if everything else is verified live. It should be described in the submission note as the next step.

---

## 8. UI notes from Elena (not started)

**Floating bunny (2026-10-01):** Elena does not like the current layout for the bunny chat. Instead of the bunny and the message box sitting inside a fixed card on Home, make the **bunny and the message button float** over the page, so the bunny looks like a character in front of the screen (a "2D" companion) and feels closer to the person. This is a note for later, to be designed after the reflection feature works and is verified.

Things to think through when we do it: it must stay usable at phone width and not cover content or the footer's "Need support now?" link; it should be reachable by keyboard and screen readers (a real button with a label, focus management when it opens); it should respect "reduce motion" (no bobbing for those who turn it off); and the chat panel it opens should keep the same rules (AI disclosure, nothing stored until saved, crisis support card).

## 9. Direction change 2026-10-01: saved conversations (supersedes the S6 "summary only" rule)
See `docs/slices/S7.md`. Summary: chats are saved by default with a "Don't save this chat" option; Messages tab; floating bunny; small automatic notes; learned preferences are an **open decision** (recommended: visible, not hidden).
