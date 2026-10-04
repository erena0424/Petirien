# Workflow: slices, agents, schedule

Written for Elena. Reference: `docs/PLAN.md` (facts, design), `CLAUDE.md` (rules). Deadline **Mon Oct 5, 2026, 11:59 PM ET**. Today = Day 1 (Wed Sep 30).

## How work moves

One vertical slice at a time. Each slice runs this loop:

1. **Brief** (tech-lead): goal, files owned, contract, acceptance checks, what the checks don't prove. Slice briefs live in `docs/slices/Sx.md` (short).
2. **Build** (backend-dev / frontend-dev, or tech-lead directly for small slices).
3. **Check:** automated test + the named manual check.
4. **Review** (tech-lead, reading the diff): mandatory for auth, permissions, LLM-output validation, anything that spends money. Verify each finding against source.
5. **Log:** append a row to `docs/agent-log.md` (what the agent did).
6. **Elena verifies** the manual check and writes what she checked or corrected (this is the "what I personally verified" section of the submission).
7. **Commit** (Conventional Commits). Elena pushes.

**Parallelism rule:** after S1, backend (S2) and frontend (S3) may run in parallel **only if** `src/contract.ts` (the `recommend` request/response types, shared by both) is written first by tech-lead, each agent owns disjoint files, and the frontend runs against a mocked action until S2 lands. Otherwise go sequentially. Five days doesn't need more than two streams.

**Agent roles:**
- `tech-lead` (default session): briefs, spikes, contract, review, log.
- `backend-dev`: schemas, actions, pipeline, tests for them.
- `frontend-dev`: screens, player, states, mobile.
- Elena: login, deploy approval, spend, decisions, manual checks, submission.

## Slices

| # | Slice | Owner | Done when (evidence) | Manual check (Elena) |
|---|---|---|---|---|
| S0 | **Setup + spikes** | Elena + tech-lead | Logged in; GitHub repo with remote; app scaffolded; `dev start` runs; skeleton deployed at `<name>.app.space`; spike answers in log | Open live URL, sign in |
| S1 | **Foundation**: schemas + RBAC (PLAN §4), auth gate, theme tokens, routes, `catalog.ts` shape + ~20 items, `contract.ts` | backend-dev (one writer) + tech-lead | Type-check passes; isolation test (user B can't read/edit user A's rows) passes | Two accounts, confirm separation |
| S2 | **Recommend pipeline**: hard filter → LLM interpret → YouTube search/details → LLM rank/explain → validation → fallbacks; cap + cache | backend-dev | Unit tests: filter, validator drops unknown IDs, each fallback rung; 401 when signed out; cap enforced; one real YouTube call | Run one real check-in, inspect that links open real videos |
| S3 | **Core flow UI**: Home, Check-in, Companion + Picks, Watch (IFrame player, error 100/101/150, ENDED handling) | frontend-dev | Loading/error/empty/success on every async; phone width OK | Play a normal video; find an embed-disabled one; confirm fallback |
| **M1** | **Milestone: core loop live** (target end Oct 1/early Oct 2) | | Fresh account: check-in → picks → watch works on the deployed URL | Full walk-through, recorded in log |
| S4 | **Saved library**: save/unsave (idempotent), note, unavailable badge, lazy metadata refresh (>25 days), direct access without check-in | both | Save persists across reload and sessions; refresh logic tested with a fake date | Save, reload, sign out/in |
| S5 | **Preferences, history, feedback**: likes/dislikes/avoid, "useful?" + reason chip, "none fit" re-run, feedback tags into prompts, delete my data | both | Changing a preference changes hard-filter output (test); feedback rows stored; delete works | Change a preference, see different picks |
| S6 | **Hardening**: crisis card path, forbidden-words grep, secrets grep, contrast check, failure drills (YouTube down, LLM invalid, cap hit, offline) | tech-lead + both | Checklist in PLAN §5 all ticked with evidence | Crisis phrase test; turn off network; read every screen's copy |
| S7 | **Optional**: calendar (PLAN §2b), else weather (PLAN §2c) | per gate | Only if M1 is green and gate passes | Per slice |
| S8 | **Finish**: README, architecture note, submission note, final live smoke, screenshots | tech-lead drafts, Elena finalizes | Live URL works for a fresh account; repo public-ready and scrubbed | Submit |

**Rule:** S7 never starts before S6's checklist is green. If time runs short, cut S7, then S5's "none fit" re-run, before cutting anything in S6.

## Schedule (ET)

| Day | Date | Target | Cut if late |
|---|---|---|---|
| 1 | Wed Sep 30 | S0 done, skeleton deployed, spikes logged; start S1 | Calendar spike |
| 2 | Thu Oct 1 | S1 + S2 done; S3 in progress | |
| 3 | Fri Oct 2 | S3 done → **M1 live**; S4 started | |
| 4 | Sat Oct 3 | S4, S5 done; S6 started | Weather/calendar (S7) |
| 5 | Sun Oct 4 | S6 done; optional S7 only if ahead; S8 drafts; live smoke | "None fit" re-run |
| Buffer | Mon Oct 5 | Final fixes, final live smoke, submit **well before 11:59 PM** (aim by 6 PM) | Anything not yet verified |

The schedule compresses your five days (you'd listed Day 5 as final) into four build days plus a buffer. Mon Oct 5 is for fixes and submission, not new features.

## Slice brief template (`docs/slices/Sx.md`)

```
# Sx: <name>
Goal:
Files owned (exclusive):
Contract / inputs:
In scope (enumerated):
Out of scope:
Acceptance (automated):
Acceptance (manual, Elena):
What these checks do NOT prove:
Risks / stop conditions:
```

## Per-slice rules for agents
- Enumerated changes only; unlisted collection/field/endpoint → stop, tell tech-lead.
- Facts labelled verified/assumed; spike before building on an assumption.
- One paid integration call per question; log it.
- No note text, transcripts, or keys in logs, tests, commits, or README.
- Status words: built-and-verified / built-but-unverified / not built.

## Submission note skeleton (fill from the log)
1. Product in two sentences (everyday emotional support, not therapy).
2. Integrations used and what each does (YouTube, LLM, auth + records; calendar/weather if built).
3. Main tradeoff (e.g., curated catalog + real retrieval vs open discovery; no transcript storage).
4. Agent contributions (from `docs/agent-log.md`).
5. What I personally verified (from the manual checks, with dates).
6. Known limits (related videos can't be disabled; metadata refresh window; what wasn't built).
