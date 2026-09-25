# LingoGoc Production Completion Plan

Version: 1.1

Updated: 2026-09-25

Program status: `BLOCKED`

This file is the single source of truth for execution order, status, and handoff.
`PRODUCT_ROADMAP.md` contains long-term vision only.

## Objective and program definition of done

Stabilize every feature currently exposed on production web and Android before adding
new product surfaces.

- [ ] Exactly 3,000 unique, valid system words.
- [ ] Every word has a clear Vietnamese meaning, valid IPA, and five distinct bilingual
      contextual examples.
- [ ] No AI call when valid DB/browser/Edge data already exists.
- [ ] Word and sentence audio works on mobile Chrome, Cốc Cốc, desktop, and Android.
- [ ] Every learning module uses one progress/XP/SRS model.
- [ ] Reload, navigation, offline mode, and device changes do not lose completed work.
- [ ] No mock feature is presented as real.
- [ ] Warning-free lint plus unit, contract, E2E, mobile, and Android smoke tests.
- [ ] Releasable Worker, web, and Android pipelines with smoke tests and rollback.
- [ ] Observable error rate, latency, cache hit, provider usage, and cost.

States: `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`. Exactly one task may be
`IN_PROGRESS`.

## Verified production baseline

- Web and Worker are live.
- XKIRO, Groq, Workers AI, and OpenRouter are configured in production.
- KV and Edge Cache are active; D1 is not yet bound.
- Latest observed vocabulary backfill: cursor `2704/3000`, generated `873`, verified
  `1466`, retry/failed `130`; hourly cron, two generations per run, browser not needed.
- Manual AI retry can return five examples during KV quota exhaustion; browser,
  IndexedDB, Edge, and KV recovery paths exist.
- Latest known `ticket` production smoke: 5/5 examples and persisted in KV.
- Android debug build succeeds; signed AAB/release is not complete.
- Progress/XP/streak/SRS are primarily device-local.

---

## P0 — Production cleanup and release safety

### P0-01 — Inventory real, beta, local, and mock features

Status: `DONE`

Central feature registry added. Fake PvP became an honest local solo challenge. Mock
leaderboard/VIP flows were removed. Local completion recognition is clearly labeled
as non-server-verified.

### P0-02 — Eliminate behavior-affecting lint warnings

Status: `DONE`

React dependency, effect, ref, purity, and unused-code warnings fixed. CI uses
`oxlint --deny-warnings`.

### P0-03 — Production observability

Status: `DONE`

Frontend error boundary, request IDs, server timing, structured Worker logs, and
`GET /api/operations/status` added. Logs exclude prompts and secrets.

### P0-04 — CI/CD and production smoke tests

Status: `BLOCKED`

Production validation, direct Worker deployment, automated smoke, GitHub Pages, and
Android builds are proven. Unblock the remaining automated Worker deployment when the
GitHub environment `production` has `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`. Staging must still receive separate KV and D1 resources.

---

## P1 — Vocabulary and AI platform

### P1-01 — Complete and audit 3,000 words

Status: `BLOCKED`

Unblock when production cron completes backfill/retries and either the user approves
the 125 batch-read audit or migrated D1 provides the single read-only audit endpoint.

Acceptance: `3000/3000` valid headwords, meanings, IPA, and exactly five distinct
bilingual contexts; unrecoverable words enter manual review.

Current bundled baseline: 3,000 valid unique words, zero invalid IPA, but 2,495
low-quality meanings and 2,832 low-quality bundled examples. Server enrichment is the
quality overlay.

### P1-02 — Durable data and background queue

Status: `BLOCKED`

Unblock when authorized to create a separate D1 staging database, bind `VOCAB_DB`,
apply migrations, deploy staging, and run migration/smoke tests.

Completed locally:

- D1 schema for enrichments, jobs/retries, manual review, and system checkpoint.
- D1 → KV → Edge read order and D1-first dual writes with KV fallback.
- KV/Edge legacy promotion to D1 without AI calls.
- Retry/manual-review/checkpoint survival when KV writes fail.
- Safe, default-no-op KV export → idempotent D1 SQL preparation tool.
- Read-only `GET /api/vocabulary/audit`; no hidden 125-request fallback.

### P1-03 — Optimize AI routing speed and cost

Status: `BLOCKED`

Scope and acceptance:

- Per-provider quota state, health score, and circuit breaker.
- No unconditional hedged race.
- Cache first; then healthiest free provider; paid provider only under policy.
- Request only missing examples.
- Track p50/p95, success, tokens, and cost by provider/model.
- Targets: cache hit >90%, cached batch p95 <800 ms, first vocabulary data <1.5 s,
  API error rate <1%.

Implemented locally: health-ranked provider selection; one immediate provider;
1.5-second adaptive hedge or immediate failover; two-minute circuit after three final
failures; provider latency/success/error/token/cost metrics; isolate-local cache hit
metrics; Analytics Engine schema and p50/p95 runbook.

Unblock when an authorized staging deploy can validate the Analytics Engine binding,
then production traffic can verify the KPI targets.

### P1-04 — Vocabulary administration

Status: `BLOCKED`

Read-only complete/partial/retry/manual-review dashboard; word/model/prompt/retry
history; controlled retry and audited manual corrections.

Implemented locally: bearer-protected D1 overview API with paginated issue/manual
review/audit data; controlled retry queueing that makes no immediate AI call; validated
manual correction that requires a clear Vietnamese meaning and five distinct bilingual
contexts, updates durable/cache data, resolves the job, and records an audit event.

Unblock when isolated staging D1 migrations and `ADMIN_API_KEY` are available for a
real environment smoke test. The UI remains absent from normal learner navigation.

---

## P2 — Unified learning experience

### P2-01 — Shared Learning Event Engine
Status: `DONE`

Idempotent answer/pronunciation/dictation/review/speaking events; XP, streak, progress,
and SRS update only through this engine; offline sync support.

Implemented locally: versioned event schema, pure reducer, processed-ID deduplication,
bounded offline pending queue, XP/progress/SRS persistence compatibility, and the first
migrated flow (`SmartReviewView`). New accounts now start with zero XP and empty real
progress instead of demo achievements.

All current XP/progress writers now dispatch through the engine. Streak changes only
on rewarded learning events, one-time reward keys prevent replay farming, and pending
events can be acknowledged after future server synchronization.

### P2-02 — Diagnostic test and personalized path
Status: `DONE`

Listening, vocabulary, and speaking assessment; real placement; repeatable historical
comparison.

The deterministic CEFR-oriented rubric now has a bounded, versioned 20-result history,
legacy-result migration, repeat comparison, and latest-result roadmap integration.

### P2-03 — Unified IPA, audio, TTS, and STT
Status: `BLOCKED`

One speech service and voice preset system for every word/sentence/example; consistent
loading/error/retry; real Chrome, Cốc Cốc, desktop, and Android tests.

Local implementation and automated Edge mobile/Android build verification are
complete. Final acceptance is blocked on physical-device Chrome and Cốc Cốc playback
and microphone checks.

### P2-04 — Vocabulary, flashcards, quiz, and SRS
Status: `DONE`

One meaning/IPA/example source; Forget/Hard/Good/Easy scheduling; every result updates
review timing; mobile-accessible search, pagination, and modal behavior.

Acceptance completed locally: shared cache-first presentation data is used by
flashcards, lists, detail, quizzes, Smart Review, Word Scramble, and Solo Challenge;
all answer results update SRS; mobile search, five-example modal, page jump, and four
review grades pass the Edge 390 x 844 behavior test. Test commands: `npm.cmd run
test:vocab`, `npm.cmd run test:learning`, and `npm.cmd run test:vocab:browser`.

### P2-05 — AI Speaking
Status: `DONE`

Durable sessions/transcripts/structured feedback; grammar/vocabulary/fluency/
pronunciation scores; timeout/resume/retry/cost controls; navigation cannot lose jobs.

Acceptance requires versioned durable local sessions, resumable pending requests,
structured rubric validation, bounded retries with no duplicate request/token spend,
and mobile navigation/reload coverage. Test commands: `npm.cmd run test:speaking`,
`node backend/test-worker.mjs`, the speaking mobile browser test, and the full gate.

Completed locally: versioned transcript and feedback persistence, safe pending-turn
recovery with stable idempotency keys, 45-second client timeout and manual retry,
normalized grammar/vocabulary/fluency/pronunciation scores, Worker single-flight and
24-hour response cache, and 390 x 844 navigation/reload/retry browser coverage.

### P2-06 — Supporting learning modules
Status: `DONE`

Connect Reflex, Dictation, Traps, IT Career, and Audio Pod to the event engine; playlist,
repeat, resume, completion, empty/error/offline states.

Completed locally: all five modules use the shared event engine for durable completion
or progress and a versioned local session store for navigation/reload resume. Audio Pod
has cancellable sequential playback, repeat-all/repeat-one/no-repeat modes, saved
filters/current word, deterministic completion events, and an empty state. Mobile
behavior coverage verifies Dictation, Traps, IT Career, and Reflex at 390 x 844.

---

## P3 — Accounts, synchronization, and security

### P3-01 — Guest-first accounts
Status: `BLOCKED`

No login before learning; optional email/Google sync; safe first-login guest merge.

Implemented locally: every installation receives a versioned persistent anonymous
guest ID without a login prompt, and a deterministic first-login merge contract unions
progress while taking the maximum XP/streak so replayed snapshots cannot double-award.
Unblock after selecting/configuring a real authentication provider and authorizing a
durable staging backend; no unfinished sign-in UI is exposed.

### P3-02 — Cross-device sync and offline queue
Status: `BLOCKED`

Sync progress/SRS/bookmarks/settings/speaking; offline event queue; versioned conflict
resolution; export/import/delete.

Implemented locally: versioned full-data export/import, legacy backup support, strict
size/schema validation, transactional rollback, and deterministic merge rules for
progress, SRS, event queues, diagnostic history, Speaking, and module sessions. Device
guest identity is never cloned during import. The authenticated server-sync envelope
and acknowledgement rules are documented. Unblock real cross-device sync with P3-01
authentication and durable per-account storage.

### P3-03 — API protection
Status: `BLOCKED`

Route/IP/user/device rate limits, bot protection, CSP/security headers/minimal CORS,
secret rotation, and server authority for important XP/VIP/certificates.

Implemented locally: bounded per-isolate IP/route-class limits, JSON/body validation,
constant-time admin authentication, minimal origin handling, consistent API security
headers, a frontend CSP, regression coverage, and a documented secret-rotation runbook.
Unblock globally consistent bot/rate enforcement with Cloudflare WAF configuration;
user/device enforcement and server-authoritative rewards also depend on P3-01 and a
durable authenticated backend.

---

## P4 — Production-ready Android

### P4-01 — Offline data and updates
Status: `DONE`

Versioned APK catalog, differential online updates, clear network state, queued offline
progress.

The APK now carries a complete fallback catalog plus a generated SHA-256 manifest.
The app restores a valid newer catalog from local cache, checks only the small server
manifest on startup, verifies the downloaded catalog hash/count before replacing the
cache, and falls back safely after corrupt or partial data. Android reports validated,
limited, and offline connectivity to the UI. Learning events remain persisted in the
bounded offline queue; authenticated acknowledgement remains part of blocked P3-02.

### P4-02 — Native bridge and device testing
Status: `BLOCKED`

TTS/STT lifecycle, microphone permission, interruption/audio focus; Android 8/10/12/
14/15, low-RAM, weak-network, mobile Chrome, and Cốc Cốc tests.

Implemented locally: native TTS now validates language availability, owns and releases
audio focus, stops cleanly on interruption/backgrounding, and reports cancellation
without launching a second fallback voice. Native recognition rejects overlaps,
cleans up on lifecycle changes, and cannot start in the background after permission
resolution. Browser speech/recognition also stops on page hide. Static contracts,
instrumentation smoke tests, APK/androidTest builds, a workflow-dispatch emulator
matrix for API 26/29/31/34/35, and a physical-device checklist are present.

Unblock final acceptance with workflow execution plus physical-device APK, Chrome,
and Cốc Cốc speaker/microphone evidence under interruption, weak-network, and
low-memory cases. No connected device or emulator is available in this workspace.

### P4-03 — Android release
Status: `BLOCKED`

Secret-backed signing, versioned AAB/APK, Play internal testing, crash reporting,
privacy policy, release notes.

Implemented locally: validated environment-driven version name/code, all-or-nothing
secret-backed signing, a protected manually dispatched signed AAB/APK workflow with
checksums, release-configuration tests, an unsigned local release build, privacy
disclosure, release notes, and an explicit release checklist. Unblock final acceptance
with GitHub signing secrets, physical/device-matrix evidence, a hosted privacy URL and
Play Data safety review, Play internal-testing access, and an authorized, privacy-
reviewed crash-reporting provider.

---

## P5 — Real community, certification, and commerce

### P5-01 — Real battle and leaderboard
Status: `BLOCKED`

Realtime PvP, server weekly leaderboard/reset/anti-cheat, separate offline solo mode.

The existing learner surface remains an accurately labeled offline solo challenge.
Real PvP/leaderboards require P3-01 authentication, durable staging data, realtime
infrastructure, and anti-cheat authority; no mock opponent or ranking UI will be added.

### P5-02 — Verifiable certificates
Status: `BLOCKED`

Clear graduation criteria, server-signed certificate ID, public verification page.

The current output remains explicitly labeled as a local completion record. Verified
certificates require authenticated server-authoritative progress, a durable issuance
ledger, signing-key custody, and an authorized public verification deployment.

### P5-03 — Real VIP and payments
Status: `BLOCKED`

Server-created orders; VietQR/MoMo/VNPAY webhooks; only valid webhooks activate VIP;
transaction history, expiry, refund handling.

Mock VIP/payment UI remains hidden. Implementation requires a selected legal merchant
account/provider, webhook credentials, product/refund policy, P3 authentication, and
durable audited order storage before any learner-facing payment surface is safe.

---

## Test targets

- Unit: SRS, XP, streak, scoring, normalization, provider routing.
- Contract: every Worker endpoint and quota/timeout/KV/D1 failure.
- E2E desktop/mobile: all audio, manual AI retry, reload persistence, navigation during
  AI work, quiz/SRS, backup/restore, offline/online transition.
- Android: build, instrumentation smoke, native TTS/STT, backup files.
- Production: health, catalog, batch, cached enrichment, speech, rollback.

## Current checkpoint

Active task: `P0-04 — CI/CD and production smoke tests`

Status: `BLOCKED`

Branch: `main`

Last deployed production commit: `fd307ffaac05115992f2923f34cd8f23b2e21276`

Last deployed production Worker version: `81f8f670-d8d4-4d31-ae31-6f09a928e2b8`

### Next work

1. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to the protected GitHub
   `production` environment, then rerun the Worker deployment workflow.
2. Provision isolated staging KV/D1 resources before enabling staging writes.
3. Run `Android Device Matrix` and complete `app/DEVICE_TEST_MATRIX.md` on physical
   Chrome, Cốc Cốc, and the APK.

## Handoff log

### 2026-09-24 — P1-03 local completion; P1-04 started

- Added configurable paid-model input/output rates and cumulative estimated USD cost
  to isolate status and Analytics Engine provider data points.
- Added documented 24-hour provider/cache queries for weighted success rate, p50/p95,
  token volume, estimated cost, and cache hit rate.
- Full local release gate passed: lint, feature registry, vocabulary, mobile speech,
  D1 migration preparation, Worker contract, production build, and diff checks. The
  only build notice remains the existing >500 kB chunk warning.
- P1-03 is blocked only on an authorized staging deploy and real traffic KPI check.
- P1-04 is now the sole active task. Next command: implement and test the protected
  read-only D1 administration endpoint before any operator UI.

### 2026-09-24 — P1-04 protected administration API

- Added protected D1 counts and paginated issue, manual-review, and audit-event data.
- Added controlled retry queueing; it resets retry state but does not invoke AI in the
  admin request.
- Added strictly validated manual correction with durable D1/KV/Edge update, job and
  manual-review resolution, and an audit event.
- Added a lazy-loaded operator UI reachable only with `?admin=1`; it keeps the
  credential only in React memory, is absent from learner navigation, and collapses to
  a mobile layout at 640 px.
- Added migration `0002_vocabulary_admin_audit.sql` and contract coverage for missing
  authorization, read-only overview, token-free retry queueing, invalid corrections,
  valid five-context corrections, and audit history.
- Static UI checks and the production build pass. Next: add real browser behavior
  tests, then validate isolated staging D1/admin secret. Do not expose the UI in normal
  production navigation before that validation.

### 2026-09-24 — P1-04 browser completion; P2-01 started

- Added real Microsoft Edge tests using the installed browser and `playwright-core`;
  no additional browser binary is downloaded.
- Desktop/mobile tests cover unauthorized and D1-unavailable errors, counts, paging,
  retry, correction submission, in-memory credential clearing, two-column mobile
  layout, and horizontal overflow at 390 x 844.
- P1-04 is blocked only on isolated staging D1/admin-secret validation; the dashboard
  remains accessible only through `?admin=1`, not learner navigation.
- P2-01 is the sole active task. Next: inventory direct XP/progress/SRS writes and
  introduce the versioned idempotent learning-event reducer with tests.

### 2026-09-24 — P2-01 event engine foundation

- Inventory found direct progress/XP writes in Vocabulary, IPA, Reflex, IT Career,
  Dictation, Traps, Speaking, Solo Challenge, Word Scramble, and Smart Review, plus a
  separate SRS store.
- Added a versioned reducer and local event journal with processed-ID deduplication and
  a bounded pending queue for future offline sync.
- Replaced the duplicated SM-2 implementations with one exported pure calculation
  shared by legacy compatibility and the event reducer; regression tests cover the
  1/3/7-day review progression.
- Migrated Smart Review so one deterministic session/word event updates SRS and awards
  10 XP atomically; duplicate dispatches do not repeat either change.
- Migrated Vocabulary mastery and IPA completion to toggle events. Removing completion
  never subtracts earned XP, and completing the same target again cannot farm XP
  because reward claims are persistent.
- Removed demo XP, streak, mastered words, bookmarks, IPA, and Reflex progress from
  new-user defaults. Existing stored progress remains untouched.
- Added learning-engine tests and included learning/admin contracts in both CI release
  gates. `resetUserData` now also clears the event journal.
- Full local gate passed, including the Edge desktop/mobile administration suite,
  Worker contract, learning tests, build, and diff checks. The only build notice is
  the existing >500 kB chunk warning.
- Next: migrate Reflex and IT Career completion with one-time reward keys, then move to
  the answer-based modules one at a time.

### 2026-09-24 — P2-01 completed; P2-02 started

- Migrated Reflex, IT Career, Dictation, Traps, AI Speaking, Solo Challenge, and Word
  Scramble to the shared engine. Vocabulary, IPA, and Smart Review were already moved.
- Reflex pronunciation now only marks completion; repeated success no longer toggles
  a completed pattern off. Replayable lessons use persistent reward keys, preventing
  XP farming across sessions.
- Speaking and Solo Challenge use per-turn/per-round idempotency IDs. Word Scramble
  updates mastery and XP atomically and reports the XP actually awarded.
- Removed unused direct XP/mastery mutators. Streak advances only on rewarded learning
  events rather than application load. Added pending-event acknowledgement while
  retaining processed IDs for replay protection.
- P2-01 acceptance is complete locally. Next: audit and version diagnostic result
  history and connect deterministic placement recommendations to the roadmap.

### 2026-09-24 — P2-02 completed; P2-03 started

- Added versioned diagnostic history with automatic migration of the former latest-only
  result, completed-at deduplication, chronological ordering, and a 20-result bound.
- Result UI shows the five latest attempts and score/level change from the previous
  attempt. Roadmap reads the latest validated result through the same history service.
- Deterministic scoring tests cover an all-correct B2 result, legacy migration,
  duplicate saves, latest selection, and bounded history. Reset clears both latest and
  historical diagnostic data.
- Full release gate passed after one trailing-newline fix: lint, all feature/data/
  speech/migration/learning/diagnostic/admin tests, Worker contract, Edge desktop/mobile
  administration checks, production build, and diff checks. Only the existing >500 kB
  chunk notice remains.
- P2-03 is now active. Next: inventory playback/STT callers against `speechHelper` and
  the Android native bridge, then consolidate state/error/retry behavior.

### 2026-09-24 — English documentation conversion; P1-03 active

- Converted `AGENTS.md`, both plans, root/backend/Android readmes, and the API guide to
  concise English. Remaining Vietnamese text is intentional learning-data examples or
  the Cốc Cốc product name.
- P1-02 local implementation is complete but blocked on authorization for real D1
  staging creation/binding/deploy.
- P1-03 router now health-ranks providers, calls one immediately, hedges after 1.5 s,
  fails over immediately on rejection, and opens a two-minute circuit after three
  consecutive final failures.
- Operations reports provider success/failure, latency, token totals, circuit state,
  and isolate-local cache hit rate without prompts or secrets. Optional Analytics
  Engine binding `METRICS` records cross-isolate provider/cache data points.
- Interactive HTTP providers now make one attempt before router failover; background
  providers may make one controlled retry. This replaces the previous three-attempt
  delay/token multiplier.
- Contract tests prove normal requests use one provider, circuit-open suppresses a
  fourth call, a slow primary starts exactly one hedge, D1 survives KV failures, and
  D1/Edge hits do not call AI.
- No push, deploy, D1 creation, or production mutation occurred.
- Next: finish P1-03 metrics/retry work from `Next work`.

### 2026-09-24 — Earlier completed checkpoints

- P0-01: feature registry; removed misleading mock VIP/leaderboard/PvP behavior.
- P0-02: zero-warning lint and React behavior fixes.
- P0-03: error boundary, request IDs, timing, operations endpoint, structured logs.
- P0-04: workflows/smoke/rollback prepared; blocked on deploy authorization/secrets.
- P1-01: bundled baseline and safe server audit prepared; cron/audit still incomplete.
- P1-02: D1 schema, dual storage, migration preparation, audit endpoint, and failure
  tests completed locally.

All latest local release gates passed: lint, feature registry, vocabulary, mobile
speech, migration preparation, Worker contract, production build, migration SQL, and
`git diff --check`. The only build notice is the existing >500 kB chunk warning.

### 2026-09-24 — P2-03 local completion; P2-04 started

- Audited every playback and recognition entry point. All live callers already used
  `speechHelper`; the unused dictionary MP3 helper was the only separate `Audio`
  owner and now delegates to the shared service.
- Added observable playback and recognition lifecycle state, 15-second playback and
  60-second recognition start/session timeouts, cancellation, normalized errors, and
  retry of the last speech or external-audio request.
- Added one global mobile-safe status surface so every learning screen reports slow or
  failed speech and offers a working `Thử lại` action instead of failing silently.
- Expanded unit regression coverage for browser, backend audio, Android bridge, STT,
  state transitions, retry, and a source scan that rejects future direct `Audio`
  construction outside the service.
- Added a real Edge/Chromium 390 x 844 behavior test covering blocked playback, retry,
  viewport fit, and horizontal overflow. Chrome and Cốc Cốc physical-device checks
  remain the only P2-03 blocker.
- Android debug assembly succeeded with the updated web bundle. The full local release
  gate also passed; only the existing >500 kB chunk warning remains.
- Changed files for this checkpoint: `web/src/utils/speechHelper.js`,
  `web/src/utils/realDictionaryService.js`, `web/src/components/SpeechStatus.jsx`,
  `web/src/App.jsx`, `web/scripts/test_speech_mobile.mjs`,
  `web/scripts/test_speech_browser.mjs`, and `web/package.json`.
- P2-04 is now active. Next command: inventory vocabulary and SRS data/scheduling reads
  with `rg`, then consolidate the first duplicated path without changing catalog data.

### 2026-09-24 — P2-04 presentation and grading foundation

- Inventory confirmed that Smart Review rendered raw bundled meaning, IPA, and example
  fields even when a durable corrected enrichment was already cached; vocabulary and
  detail views also maintain separate display-selection logic.
- Added a pure shared presentation selector with the required precedence: durable
  enrichment, cached Vietnamese translation, then quality-checked bundled data. It
  deduplicates trusted bilingual examples and never presents spelling as IPA.
- Migrated Smart Review to the shared presentation source, so corrected meanings,
  IPA, and examples are reused without an API call.
- Replaced misleading hard-coded review intervals with Forget/Hard/Good/Easy options
  calculated by the same SRS function that persists the result.
- Vocabulary, learning-engine, lint, production build, and diff checks pass. Added the
  temporary Gradle home to `.gitignore`; its remaining locked local cache is ignored
  and is not part of source control.
- Next: migrate `VocabView` and `WordDetailModal` to `getVocabularyPresentation`, then
  add mobile interaction coverage for the unified cards and grade controls.

### 2026-09-24 — P2-04 completed; P2-05 started

- Migrated flashcards, vocabulary list, quiz prompts/options, and word detail to the
  shared cache-first presentation selector. Corrected enrichment wins over cached
  translation and bundled fallback without launching AI calls.
- Word detail now shows at most the canonical five deduplicated examples, reuses saved
  bilingual contexts first, and exposes a mobile-accessible close action.
- Fixed hidden 3D flashcard faces intercepting taps on the visible face.
- Quiz, Word Scramble, and Solo Challenge answers now emit idempotent `word.reviewed`
  events so every result updates the same SRS schedule. Review buttons show the exact
  interval calculated by the persistence engine.
- Added a real 390 x 844 Edge behavior suite for search, cached corrections, five-row
  modal fit, page-number navigation placement, quiz-to-SRS persistence, four grades,
  and horizontal overflow.
- Full release gate and `test:vocab:browser` pass. Only the existing >500 kB chunk
  warning remains; no push or deploy occurred.
- Changed files in this slice: `web/src/utils/vocabularyPresentation.js`,
  `web/src/utils/srsEngine.js`, `web/src/components/VocabView.jsx`,
  `web/src/components/WordDetailModal.jsx`, `web/src/components/SmartReviewView.jsx`,
  `web/src/components/WordScrambleGame.jsx`, `web/src/components/BattleView.jsx`,
  `web/src/index.css`, `web/scripts/test_vocab_quality.mjs`,
  `web/scripts/test_vocabulary_learning_browser.mjs`, and `web/package.json`.
- P2-05 is active. Next command: inspect `AiSpeakingView`, its storage writes, and the
  `/api/speaking/chat` Worker contract before introducing the durable session model.

### 2026-09-24 — P2-05 completed; P2-06 started

- AI Speaking now stores versioned sessions, transcripts, feedback, hints, pending
  turns, and rubric scores locally. Navigation does not abort an active AI job, and a
  reload resumes the same turn with the same idempotency key.
- Added a 45-second request timeout and an explicit retry action. Background results
  are persisted before any mounted-component check, while an older background session
  cannot replace the learner's newer active scenario.
- The Worker validates structured speaking output, excludes fabricated pronunciation,
  coalesces concurrent identical requests, and caches successful responses for 24
  hours. CORS explicitly permits the idempotency header.
- Unit tests cover persistence, score normalization, retry identity, hints, and active
  session isolation. Worker contracts prove concurrent and completed retries make one
  provider call. The Edge 390 x 844 suite covers leaving during a request, returning,
  reload persistence, manual retry identity, score rendering, and viewport width.
- Full release gate passed: lint, vocabulary, speech, migration, learning, diagnostic,
  admin, Worker contract, production build, speaking unit/browser suites, and
  `git diff --check`. The existing >500 kB bundle warning remains.
- Changed files in this slice: `web/src/components/AiSpeakingView.jsx`,
  `web/src/utils/speakingSessionStore.js`, `web/src/utils/speakingAiService.js`,
  `web/backend/src/worker.js`, `web/backend/test-worker.mjs`,
  `web/scripts/test_speaking_sessions.mjs`, `web/scripts/test_speaking_browser.mjs`,
  `web/src/index.css`, and `web/package.json`.
- P2-06 is active. Next command: inventory the five supporting modules and their
  persistence/event behavior with `rg` before selecting the first incomplete slice.

### 2026-09-24 — P2-06 completed; P3-01 started

- Added a bounded, versioned session store shared by Reflex, Dictation, Traps, IT
  Career, and Audio Pod. Resetting learner data clears these resumable sessions.
- Dictation drafts/evaluation and Trap answers/explanations survive navigation;
  correct results now write `completedDictation` and `completedTraps` through the
  learning-event engine. Reflex restores category/pattern/example/feedback and safely
  tears down recognition. IT Career restores mode/search/category and has a real empty
  result state.
- Rebuilt Audio Pod sequencing around speech completion callbacks with cancellable
  timers, repeat-all/repeat-one/no-repeat, saved filter/current-word resume, empty
  playlist handling, and deterministic per-word completion events that cannot farm XP.
- Fixed the global speech error toast blocking the mobile bottom navigation and
  Explore sheet by placing it above navigation but below modal layers.
- Added module-store unit tests and an Edge 390 x 844 suite covering Dictation draft
  and completion, Trap completion/explanation, IT empty/search resume, Reflex resume,
  and horizontal overflow. Added speaking/module unit gates to both CI workflows.
- Full gate passed: lint, vocabulary, speech, migration, learning, speaking, modules,
  diagnostic, admin, Worker contracts, production build, module mobile behavior, and
  `git diff --check`. Only the existing >500 kB bundle notice remains.
- Changed files in this slice: `web/src/utils/learningModuleSessionStore.js`,
  `web/src/components/DictationView.jsx`, `TrapsView.jsx`, `ReflexView.jsx`,
  `ItCareerView.jsx`, `AudioPodView.jsx`, `SpeechStatus.jsx`, `web/src/utils/storage.js`,
  `web/src/App.jsx`, `web/src/index.css`, module unit/browser scripts, `web/package.json`,
  and both validation workflows.
- P3-01 is active. Next command: inventory current identity and backup/restore flows
  before defining a guest identity and merge contract. No push or deploy occurred.

### 2026-09-24 — P3-01/P3-02 local foundations; P3-03 started

- Added a persistent versioned guest identity created silently on first use and a
  deterministic first-login merge contract. Progress collections are unioned while
  XP/streak use maxima, preventing snapshot replay from double-awarding rewards.
- Replaced the former user-data-only JSON file with a versioned full local snapshot:
  user settings/progress, SRS, processed and pending events, diagnostic history,
  Speaking sessions, and supporting-module sessions.
- Import accepts legacy backups, rejects corrupt or over-2-MB files, merges newer data
  deterministically, never imports a source device guest ID, and rolls all keys back
  if any storage write fails. Settings now reports results inline and Android receives
  the same complete JSON through its native save bridge.
- Documented the future authenticated sync envelope, revisions, pending-event IDs, and
  acknowledgement rule without claiming a nonexistent cloud-sync endpoint.
- Unit and Edge 390 x 844 tests cover full export content, safe merge, legacy import,
  invalid files, rollback, identity preservation, and horizontal overflow. Full local
  release gate and `git diff --check` pass; only the existing >500 kB bundle notice
  remains.
- Changed files in this slice: `web/src/utils/guestIdentity.js`,
  `web/src/utils/localBackupService.js`, `web/src/components/SettingsModal.jsx`,
  `web/src/App.jsx`, backup/identity test scripts, `web/package.json`, both validation
  workflows, and `web/BACKEND_API.md`.
- P3-01 and real P3-02 sync are blocked on a chosen auth provider plus durable staging
  storage. P3-03 is active. Next command: inventory Worker route/CORS/header/rate-limit
  coverage before implementing protection. No push or deploy occurred.

### 2026-09-24 — P3-03/P4-01 local completion; P4-02 started

- Added bounded per-isolate IP/route-class throttling, JSON/body guards, constant-time
  admin-key comparison, minimal CORS, consistent API security headers, and frontend
  CSP. Added Worker/security regression coverage and documented rate variables, WAF
  requirements, and the secret-rotation runbook.
- P3-03 is blocked only on globally consistent Cloudflare WAF rules plus the P3-01
  authenticated/durable backend needed for user/device limits and authoritative
  rewards.
- Added a versioned SHA-256 catalog manifest to every web/APK build. A valid cached
  3,000-word server catalog is restored before the background manifest check; changed
  catalogs are downloaded once, hash/count verified, and stored. Corrupt, tampered, or
  incomplete cache data falls back to the complete catalog bundled in the APK.
- Added browser/native online, limited, and offline state reporting. The mobile banner
  confirms local progress storage and shows queued learning-event count. Android
  registers and releases its network callback with the Activity lifecycle.
- Added offline catalog and Edge 390 x 844 behavior tests, CI gates, documentation, and
  build-cache ignores. Required web tests, Worker contracts, production build, mobile
  offline viewport test, `git diff --check`, and `assembleDebug` passed. The existing
  bundle-size warning and three Android deprecation warnings remain non-blocking.
- Changed files in this slice: Worker/security files from P3-03,
  `web/src/utils/systemVocabularyService.js`, `networkState.js`, `NetworkStatus.jsx`,
  `web/src/App.jsx`, `web/src/index.css`, `web/vite.config.js`, offline tests,
  `web/package.json`, both web/Android workflows, `app/MainActivity.kt`, app docs, and
  `.gitignore`.
- P4-02 is active. Next command: audit native TTS/STT initialization, audio focus,
  callback cancellation, Activity recreation, and permission behavior against
  `speechHelper.js` and its contract tests. No push or deploy occurred.

### 2026-09-25 — P4-02/P4-03 local completion; program externally blocked

- Native Android TTS now validates language support, requests/releases transient audio
  focus, handles focus loss as cancellation without starting an overlapping fallback,
  and stops when the Activity leaves the foreground. STT rejects overlapping sessions,
  cleans up on lifecycle changes, and cannot begin in the background after permission
  resolution. Browser speech/STT also stops on page hide.
- Added deterministic Android bridge/source contracts, cancellation regression tests,
  an instrumentation smoke APK, a workflow-dispatch API 26/29/31/34/35 emulator
  matrix, and a physical-device acceptance checklist. `assembleDebug`,
  `assembleDebugAndroidTest`, speech tests, and bridge tests pass. Physical APK,
  Chrome, and Cốc Cốc speaker/microphone validation remains required.
- Added environment-driven semantic version/version code validation, all-or-nothing
  signing variables, a protected signed-release workflow, AAB/APK checksum artifacts,
  privacy disclosure, release notes, release checklist, and static release tests.
  Local unsigned `bundleRelease assembleRelease` passed in an isolated Gradle cache;
  version metadata generation was verified with version code 42/name 1.2.3.
- Changed files in this slice: `app/MainActivity.kt`, `app/app/build.gradle.kts`,
  `app/gradle.properties`, Android instrumentation tests and documentation,
  `web/src/utils/speechHelper.js`, speech/Android contract scripts,
  `web/package.json`, `.gitignore`, and the Android build/device/release workflows.
- Remaining risks/blocks: no device is connected; the emulator workflow has not been
  run on GitHub; no signing secrets, Play access, hosted privacy URL, crash-reporting
  provider, authenticated backend, or payment/provider authority is available. P5
  surfaces remain honestly local/hidden rather than simulated.
- Exact next action: after authorization, push the current branch, run `Android Device
  Matrix`, complete `app/DEVICE_TEST_MATRIX.md` on physical Chrome/Cốc Cốc/APK, then
  configure protected signing/Play secrets and run `Android Signed Release`. No push,
  deploy, account mutation, keystore creation, or Play upload occurred.

### 2026-09-25 — Production release completed; CI secret/staging blocker recorded

- Full release gate passed: lint, feature, vocabulary, speech, migration, learning,
  speaking, module, identity, backup, security, offline, Android bridge/release,
  diagnostic, admin, Worker contract, production build, and every Edge 390 x 844
  browser suite. Android `assembleDebug` and `assembleDebugAndroidTest` also passed.
- The mobile gate found and fixed the global speech-status toast layering: it now
  remains visible above Settings while only its action buttons accept pointer input,
  so it cannot block Explore or other controls.
- Pushed commits `d6267bf53a677fc07680e86c409d4cc12420c167` and
  `fd307ffaac05115992f2923f34cd8f23b2e21276` to `main`. GitHub Pages succeeded at
  https://github.com/Quyenlaaaa/lingogoc-app/actions/runs/36085110528 and Android at
  https://github.com/Quyenlaaaa/lingogoc-app/actions/runs/36085110553.
- Direct Wrangler production deployment succeeded at
  `https://lingogoc-api.lingogoc-api.workers.dev`, version
  `81f8f670-d8d4-4d31-ae31-6f09a928e2b8`. Automated production smoke passed health,
  operations, the 3,000-word catalog, cached batch/enrichment without an AI call, and
  speech audio using cached word `ticket`.
- Worker workflow validation succeeded at
  https://github.com/Quyenlaaaa/lingogoc-app/actions/runs/36085110573, but its deploy
  and smoke jobs were skipped because the GitHub `production` environment does not
  contain `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The direct deployment
  closes the current production release but not that automation gap.
- Cloudflare rejected the Analytics Engine binding because it is not enabled on this
  account (error 10089). The optional binding is now commented out; isolate-local
  operations metrics remain available, and Analytics Engine can be re-enabled after
  account activation.
- A direct Pages content probe from this workspace timed out after CI had reported a
  successful deployment; the automated workflow is the release evidence. Physical
  Chrome/Cốc Cốc/APK audio and microphone checks and the workflow-dispatch Android
  emulator matrix remain outstanding.
- Changed in the final release slice: all accumulated production stabilization work,
  `web/src/components/SpeechStatus.jsx`, `web/src/index.css`,
  `web/backend/wrangler.toml`, `web/backend/DEPLOYMENT.md`, and this checkpoint.
- Exact next action: configure the two protected Cloudflare GitHub secrets, rerun the
  Worker workflow, provision isolated staging KV/D1, then execute the Android Device
  Matrix and physical-device checklist. Do not repeat the completed local release
  gate unless code changes.
