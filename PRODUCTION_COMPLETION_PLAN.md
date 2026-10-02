# LingoGoc Production Completion Plan

Version: 1.1

Updated: 2026-09-25

Program status: `IN_PROGRESS`

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

Status: `DONE`

Production D1 `dataenglish_d1` is migrated, populated from KV, bound as `VOCAB_DB`,
and verified as the live durable source. KV remains the compatibility/cache layer.

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

The production `METRICS` binding is live. Gather production traffic and query the
Analytics Engine dataset to verify KPI targets before closing this task.

The remaining acceptance work requires account-level Analytics Engine query access;
there is no additional local implementation work that can prove the production KPI
targets. Resume this task when that production evidence is available.

### P1-03-R1 — Cache-first vocabulary loading

Status: `DONE`

Scope: avoid server reads for locally complete words, request only missing/partial
records, reuse one IndexedDB connection per visible batch, and Edge-cache safe batch
responses without changing existing KV keys. Acceptance: a page with 24 complete
local enrichments performs zero network requests; partial pages send only unresolved
words; repeated Worker batches avoid duplicate KV reads; abort/failure cooldown and
five-context validation remain correct. Tests: `npm.cmd run test:vocab`, a dedicated
batch-service test, `node backend/test-worker.mjs`, `npm.cmd run lint`, and
`npm.cmd run build`.

### P1-03-R2 — Retry freshness, actionable errors, and D1 batch reads

Status: `DONE`

Scope: implement optimization measures 1–6 in order: never Edge-cache incomplete
batches; prevent older batch responses from replacing manual-retry results; render the
retry result immediately; expose safe actionable failure states; preserve the existing
local cache-first zero-request path; and use one D1 query for a visible batch with KV
fallback. Acceptance: an incomplete batch is re-read immediately after enrichment; a
late pending response cannot overwrite a newer five-example result; error copy reflects
quota/network/validation/persistence state; complete local pages perform zero network;
and D1 resolves up to 24 words with one prepared query. Tests: vocabulary unit/browser,
Worker/D1 contracts, lint, production build, and the required release gate.

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

### P2-04-R1 — Restore the 3,000-word catalog layout
Status: `DONE`

Scope: make the catalog list the default vocabulary surface, keep page-number entry
directly below Previous/Next, and guarantee equal card/example-summary geometry across
mobile and desktop. Acceptance: page jump is visible and functional; every visible
card has a bounded summary container; cards and summary containers align within each
desktop row; mobile has no horizontal overflow. Tests: `npm.cmd run test:vocab`,
`npm.cmd run test:learning`, `npm.cmd run test:vocab:browser`, `npm.cmd run lint`, and
`npm.cmd run build`.

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

### P2-05-R1 — Realtime AI speaking with CEFR levels
Status: `IN_PROGRESS`

Objective: evolve the existing durable request/response Speaking feature into a
continuous, low-latency conversation for learner-selected A1, A2, B1, B2, and C1
levels without losing turns or multiplying provider calls.

Delivery tasks:

- `RT-00` — Completed locally. One validated CEFR policy matrix now covers reply
  length, language, correction density, hints, speech rate, topic complexity, and
  server-owned prompt constraints. The selected level survives reload and reaches the
  existing idempotent Worker request.
- `RT-01` — Completed locally. Session schema version 3 adds monotonic turn sequence,
  deterministic request IDs, acknowledged sequence, explicit waiting/reconnecting/
  failed/idle transport state, and safe migration of legacy messages and pending turns.
- `RT-02` — Completed locally. The Worker and frontend negotiate protocol version 1
  and exchange ordered NDJSON ack/delta/result/done events with heartbeat, strict
  session/turn/request validation, idempotent replay, bounded context, and the current
  chat route as pre-generation fallback. OpenAI-compatible HTTP providers stream SSE;
  unsupported providers safely return a final result. Client cancellation stops
  delivery while the same-ID generation finishes into cache, so resume cannot double
  token spend.
- `RT-03` — Completed locally. A tested pure reducer owns listening, transcribing,
  thinking, streaming, speaking, interruption, reconnecting, and recoverable error.
  `AiSpeakingView` derives recording/thinking/speaking behavior from this one source,
  rejects stale stream events, and exposes the state for the future avatar.
- `RT-04` — Completed locally. Partial transcript/reply rendering, bounded deduplicated
  sentence-boundary streaming TTS, automatic listening, and race-safe barge-in are
  implemented. Microphone, transport, and playback are orthogonal; stopping delivery
  never launches a fallback model, and submitted same-ID work may finish into cache to
  avoid duplicate token spend.
- `RT-05` — Completed locally. Sessions, turns, feedback, and latest validated
  summaries persist idempotently in D1. Raw audio is excluded; browser storage remains
  available when durable sync is absent, and a hashed per-session resume secret guards
  the guest read contract.
- `RT-06` — Completed locally. Android TTS/STT have separate transient audio-focus
  ownership, deterministic mutual interruption, foreground/background recovery, and
  headset/Bluetooth route observation. Physical-device matrix verification remains a
  release requirement.
- `RT-07` — Completed locally. A1-C1 rubric-calibrated grammar, vocabulary, fluency,
  and task-completion scores carry an explicit text-only basis. Model-supplied
  pronunciation is discarded; transcript alignment is stored only with microphone
  evidence and is labeled as alignment rather than acoustic pronunciation analysis.
- `RT-08` — Completed locally. Analytics Engine records privacy-safe latency, first
  text, reconnect, provider/token, cancellation, cache/deduplication, and durable-sync
  outcomes. Realtime rollout has an explicit Worker flag with legacy fallback.
- `RT-09` — Evaluate true full-duplex audio over WebSocket/Durable Objects only after
  streamed turn-taking meets its production reliability and latency targets.
- `RT-10` — Foundation completed locally. The Speaking UI now has a clearly disclosed
  fictional 3D AI tutor driven only by authoritative conversation state. A 2.28 kB
  optional shell lazy-loads a separate 487.72 kB procedural Three.js renderer only on
  the Speaking surface and only on capable devices. Listening, thinking/streaming,
  speaking, interruption, reconnect, and error remain visually distinct; mouth motion
  is strictly gated by actual TTS playback state and stops with barge-in. Avatar-off,
  reduced-motion, low-memory, sustained-low-FPS, WebGL-unavailable/context-loss, hidden-
  document, and GPU-cleanup paths retain the transcript and every core control. The
  renderer uses repository-owned geometry and does not imitate a real person. A future
  licensed GLB or provider-timed visemes must pass `web/SPEAKING_AVATAR_SPEC.md`; they
  are not required to replace the safe procedural implementation without physical-
  device performance evidence.

Acceptance:

- A learner can select A1–C1 and the Worker applies the matching policy on every turn.
- A ten-turn hands-free session continues after the initial microphone action and can
  be interrupted without duplicate AI calls or duplicate XP.
- Reload, navigation, temporary network loss, retry, and reconnect preserve exactly
  one durable result for each stable request ID.
- Partial transcript target is under 300 ms; first AI text p50/p95 is under 1.5/3 s;
  first audio p50 is under 2 s; interruption target is under 300 ms.
- Raw audio is not retained without explicit consent; microphone state is always
  visible; denied permission has a text-input fallback.
- Web mobile Chrome, Coc Coc, desktop, and Android pass speech, interruption, weak-
  network, background/foreground, and viewport tests.
- The 3D tutor visibly distinguishes listening, thinking, and speaking; mouth movement
  starts and stops with audible TTS, barge-in stops both audio and speaking animation,
  and reconnect/error states never appear as if the tutor is still talking.
- The avatar is explicitly labeled as AI, does not impersonate a real person, keeps
  captions and all core controls keyboard/screen-reader accessible, respects
  `prefers-reduced-motion`, and leaves every Speaking function usable when 3D/WebGL is
  unavailable.
- The compressed avatar payload target is at most 4 MB, it is loaded only after the
  Speaking surface opens, and the experience targets 30 fps on supported mobile
  devices and 60 fps on desktop without delaying microphone readiness or first AI
  audio. Low-memory or sustained-low-frame-rate devices switch to the 2D fallback.

Required tests: `npm.cmd run test:speaking`, `npm.cmd run test:speaking:browser`, new
realtime state/stream Worker contracts, `npm.cmd run test:speech`, `node
backend/test-worker.mjs`, `npm.cmd run lint`, `npm.cmd run build`, and Android
`app\gradlew.bat assembleDebug` plus physical-device verification. `RT-10` additionally
requires deterministic animation-state tests, audio/animation stop synchronization,
WebGL failure and reduced-motion fallbacks, asset-size/lazy-load assertions, no mobile
overflow, and performance sampling on representative low/mid/high-tier devices.

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

Active task: `P2-05-R1 — Realtime AI speaking with CEFR levels`

Status: `IN_PROGRESS`

Branch: `main`

Last deployed production commit: `b02fabf844ca3507bf9c7010912b4599681e478e`

Last deployed production Worker version: `7a115d56-e768-43e4-8446-f7fd7732e334`

### Next work

1. Keep `RT-09` deferred until production telemetry proves streamed turn-taking misses
   its reliability or latency targets; WebSocket/Durable Objects are not justified by
   local tests alone.
2. Run the physical-device RT-06/RT-10 matrix on mobile Chrome, Coc Coc, and the debug
   APK: TTS/STT, barge-in, background/foreground, Bluetooth/headset routes, reduced
   motion, WebGL loss, low-memory fallback, and sustained frame-rate sampling.
3. After explicit push/deploy authorization, apply migration `0003`, release the
   feature-gated Worker/web/APK slice, collect production RT-08 latency/reliability
   telemetry, and decide whether RT-09 is justified. Do not add a GLB or WebSocket
   surface before that evidence.

## Handoff log

### 2026-10-02 — Realtime Speaking production release deployed

- Re-ran the complete required web/Worker gate, the 390 x 844 Speaking browser suite,
  Android `assembleDebug`, and `git diff --check`; all passed. Existing bundle-size,
  CRLF, and Android SDK XML compatibility notices remain non-blocking.
- Pushed feature commit `cfb76d96f8d3bce57ecbaa89fc791e9845535cdc` and deployment-
  documentation commit `b02fabf844ca3507bf9c7010912b4599681e478e` to `main`.
- Applied remote D1 migration `0003_speaking_durable_sessions.sql` successfully.
  A read-only production query confirmed `speaking_sessions`, `speaking_turns`, and
  `speaking_session_summaries`; it wrote zero rows.
- Direct Worker deployment succeeded at
  `https://lingogoc-api.lingogoc-api.workers.dev`, version
  `7a115d56-e768-43e4-8446-f7fd7732e334`. Production operations reports healthy,
  realtime protocol v1 enabled, D1 durable sessions and Analytics Engine configured,
  and raw-audio retention disabled.
- Production smoke passed health, the 3,000-word catalog, cached D1 enrichment, and
  speech audio using cached word `ticket`. GitHub Pages also returned HTTP 200 with
  the new deployment timestamp.
- GitHub Pages, Worker validation, and Android workflows succeeded at runs
  `36963349913`, `36963349935`, and `36963349899`, respectively.
- Remaining acceptance evidence is physical Chrome/Coc Coc/APK testing for TTS/STT,
  Bluetooth/headset routes, background/foreground recovery, reduced motion, WebGL
  fallback, and device frame rate. Exact next task: complete the RT-06/RT-10 physical-
  device matrix and observe RT-08 production latency/reliability before considering
  RT-09 WebSocket/Durable Objects.

### 2026-10-02 — RT-10 optional 3D tutor foundation completed locally

- Added an English visual, accessibility, licensing, animation, and performance
  contract. The shipped implementation uses original procedural geometry and makes no
  third-party likeness or asset claim.
- Added a persisted avatar toggle and an accessible fictional-AI label. The renderer
  consumes the existing authoritative conversation state; it cannot independently
  claim that the tutor is listening or speaking.
- Split the implementation into a 2.28 kB lazy shell and a separate 487.72 kB raw /
  122.37 kB gzip Three.js canvas chunk. Reduced-motion and reported low-memory devices
  select the CSS fallback before importing the canvas renderer.
- Added WebGL construction/context-loss fallback, five-second sustained-low-FPS
  fallback, hidden-document pause, resize handling, and complete GPU resource cleanup.
  Barge-in and TTS completion leave `speaking` immediately, which also closes the
  mouth animation.
- Mobile browser coverage verifies the fictional-AI disclosure, avatar toggle, state
  transitions, TTS/animation stop synchronization, reduced-motion fallback, and no
  horizontal overflow at 390 x 844.
- Passed the complete required web/Worker gate, `test:speaking:browser`, production
  build, and `git diff --check`. Android `assembleDebug` passed; the resulting debug
  APK is 5,205,231 bytes at `app/app/build/outputs/apk/debug/app-debug.apk`. Existing
  main/vocabulary chunk-size and Android SDK XML notices remain non-blocking.
- No push, deploy, D1 migration, production request, or account mutation occurred.
- Remaining release evidence requires physical mobile Chrome/Coc Coc/APK hardware and
  a production rollout/telemetry window, both outside safe local execution. Exact next
  action: install the debug APK and complete the RT-06/RT-10 device matrix; after
  explicit release authorization, push/deploy, migrate D1, and observe RT-08 metrics.

### 2026-10-02 — RT-08 privacy-safe Speaking telemetry completed locally

- Added a dedicated `SPEAKING` Analytics Engine series covering handshake, provider
  completion, first-text/total latency, prompt/completion/total tokens, reconnect count,
  cache replay/deduplication, cancellation, durable sync, and resume outcomes.
- Telemetry dimensions contain only bounded event/outcome/CEFR/provider/model values and
  numeric measurements. Contract tests reject session IDs, resume secrets, learner text,
  and AI reply text anywhere in Speaking analytics payloads.
- Added `SPEAKING_REALTIME_ENABLED` to Worker configuration. Disabled realtime returns
  the already-supported `501` contract, so the client falls back to the idempotent
  legacy endpoint rather than failing the lesson.
- Reconnect attempts now flow from the persisted client transport state to handshake and
  turn telemetry. Cancellation remains same-ID/cache-safe and is separately measurable.
- Operations status reports realtime flag, protocol version, D1/Analytics readiness, and
  the invariant that raw audio is not retained.
- Passed full minimum release gates, realtime 390 x 844 browser checks, Worker privacy/
  failure contracts, production build, and `git diff --check`. Existing bundle-size and
  CRLF notices remain.
- No push, deploy, production query/mutation, or real provider call occurred.
- Exact next task: defer `RT-09` pending production telemetry, then begin the `RT-10`
  accessible optional avatar rendering contract and fallback shell.

### 2026-10-02 — RT-07 evidence-safe CEFR scoring completed locally

- Added explicit A1-C1 scoring rubrics to every Speaking prompt. The validated response
  now carries grammar, vocabulary, fluency, and task-completion scores plus
  `scoringVersion: 1` and `scoreBasis: text`.
- Worker normalization constructs the allowed score object itself, so a provider's
  unsolicited `pronunciation` field is always discarded before cache, D1, or UI use.
- Local completion accepts a speech-alignment score only with the explicit
  `speech-recognition-transcript-alignment` evidence tag. A bare numeric value or an AI
  value becomes `null`; durable merges retain valid local evidence without trusting
  server text scoring as pronunciation evidence.
- Reworded transcript comparison feedback and UI labels so the product says “speech
  transcript match,” not that it measured stress, phonemes, or acoustic pronunciation.
- Worker contracts exercise all five CEFR rubrics, score clamping, task completion,
  score metadata, model-pronunciation rejection, and stable cached retries. Session
  tests cover evidence required/absent and idempotent durable merge.
- Passed the complete web release gate, realtime 390 x 844 browser test,
  `git diff --check`, and Android `assembleDebug` with the updated web bundle. Only
  existing bundle-size and SDK-tooling notices remain.
- No push, deploy, production mutation, or external AI request occurred.
- Exact next task: `RT-08` privacy-safe Speaking telemetry and feature-gated rollout.

### 2026-10-02 — RT-06 Android speech lifecycle completed locally

- Split native TTS and STT into separate transient audio-focus requests. Starting
  recognition interrupts speech, starting speech interrupts recognition, and external
  focus loss returns a recoverable event instead of leaving either engine active.
- Recognition focus is released on result, error, explicit stop, lifecycle stop, and
  failed startup. Kotlin now catches recognizer startup failures and reports a stable
  browser error/end pair.
- Moved lifecycle shutdown to `onPause`, retained the idempotent `onStop` guard, and
  added foreground/background events so browser state cannot remain falsely active when
  the WebView loses visibility.
- Registered an Android audio-device callback and exposed the current device/headset/
  Bluetooth route to the browser. The callback is unregistered during bridge teardown.
- Extended JavaScript speech state with lifecycle/audio-route environment data without
  changing existing playback/recognition consumers or browser fallbacks.
- Passed lint, mobile speech unit checks, Android bridge contracts, Speaking unit tests,
  real 390 x 844 speech/Speaking browser tests, `git diff --check`, and Android
  `assembleDebug`. The APK is 4,618,070 bytes at
  `app/app/build/outputs/apk/debug/app-debug.apk`.
- Android build required a project-local Gradle/Android home because the sandbox default
  resolved to `C:\.gradle`/`C:\.android`; no repository source was changed to encode
  those machine-specific paths. Existing SDK deprecation/XML and web bundle-size notices
  remain non-blocking.
- No push, deploy, production mutation, or dependency version change occurred.
- Exact next task: `RT-07` level-calibrated evidence-safe Speaking scoring.

### 2026-10-02 — RT-05 durable Speaking persistence completed locally

- Added idempotent D1 tables for Speaking sessions, turns, feedback payloads, and
  validated latest-turn summaries. The schema stores transcripts and structured
  feedback but explicitly excludes raw audio, recordings, and blobs.
- Added a random per-session resume secret to local schema v4. Only its SHA-256 hash is
  stored in D1; the secret is sent in POST bodies and mismatches receive `403`.
- Realtime handshake creates or verifies the durable session. Validated turn writes run
  through `waitUntil`, so D1 latency or outage cannot delay/block the AI stream; retrying
  a stable request ID cannot create a duplicate turn or summary.
- Added `POST /api/speaking/realtime/resume` plus an idempotent browser merge keyed by
  session and turn sequence. A result completed after navigation can clear the matching
  local pending turn without duplicating messages or feedback.
- Guest limitation remains explicit: the secret lives in that browser profile, so this
  is reload/navigation recovery, not authenticated cross-device synchronization.
- Contract tests cover durable creation, turn persistence, summary persistence, replay
  deduplication, bad-secret rejection, and graceful D1 outage. Migration tests reject
  accidental raw-audio columns. Mobile browser Speaking tests remain green.
- Passed lint, vocabulary, mobile speech, migration, learning, diagnostic, admin,
  Speaking unit, Speaking mobile browser, Worker contract, production build, and
  `git diff --check`. Only the existing bundle-size and CRLF notices remain.
- No push, deploy, D1 migration execution, dependency install, or production mutation
  occurred.
- Exact next task: `RT-06` Android native bridge audit, beginning with current WebView
  TTS/STT lifecycle and audio-focus ownership.

### 2026-09-30 — RT-04 sentence-stream TTS and orthogonal state completed

- Split conversation state into microphone, transport, and playback domains with one
  derived visible status. Streaming can continue while TTS reads a completed sentence;
  when playback pauses between sentences the UI correctly returns to streaming rather
  than falsely reporting idle.
- Added a pure bounded sentence queue that consumes cumulative AI text, detects
  sentence boundaries, flushes an unpunctuated final tail, limits queued entries, and
  never requeues text already consumed by an earlier delta.
- AI audio now begins when the first complete streamed sentence arrives. Final
  validated `replyEn` flushes only the remaining tail, so the final response is not
  replayed after its streamed sentences.
- Barge-in, scenario changes, navigation, provider errors, and explicit stops clear the
  queue and invalidate all old TTS callbacks. Microphone and recognition cannot overlap
  playback; submitted generation remains same-ID and cacheable rather than spawning an
  unsafe fallback request.
- Unit tests cover orthogonal streaming/playback transitions, stale recognition end,
  incremental sentence extraction, final-tail flush, and replay deduplication. The real
  390 x 844 browser test records backend-audio text and proves a streamed final sentence
  is played exactly once while prior barge-in/reload/retry checks remain green.
- Passed lint, Speaking unit/state tests, mobile speech, realtime mobile browser,
  Worker contracts, production build, and `git diff --check`. No push, deploy,
  production request, dependency install, or production data mutation occurred.
- Exact next task: `RT-05` D1 migration and idempotent session/turn persistence, keeping
  raw audio out of storage and local sessions functional when durable sync is absent.

### 2026-09-30 — RT-03 completed; RT-04 race-safe TTS barge-in implemented

- Removed the component's independent recording, thinking, and speaking state flags.
  All UI decisions now derive from the tested conversation reducer, preventing
  contradictory combinations such as listening and speaking at the same time.
- Added guarded `LISTEN_STOP`: a late recognition `onend` callback can return a live
  listening state to idle, but cannot overwrite a newer thinking/streaming AI turn.
- Added a monotonically increasing playback generation ID. Replacing/stopping speech
  invalidates every earlier TTS callback, so a stale `onEnd` cannot restart hands-free
  listening after the learner interrupts or changes scenario.
- The microphone control remains enabled during AI playback. Pressing it stops TTS
  first, then enters listening; unsupported recognition reports a recoverable error
  after audio has still been stopped. Thinking/generation remains an explicit stop
  operation using the same stable turn ID.
- Expanded the real 390 x 844 browser test with a controlled long-running audio object:
  replay enters authoritative `speaking`, tapping the barge-in action calls audio
  `pause` immediately, and UI leaves `speaking`. Reducer tests cover late callback
  ordering, while existing navigation/reload/retry/delta checks continue to pass.
- Passed lint, Speaking state/session tests, mobile speech tests, production build,
  realtime mobile browser coverage, and `git diff --check`. No push, deploy, production
  request, dependency install, or production data mutation occurred.
- RT-04 remains active because early sentence-level streaming TTS is not implemented.
  Exact next task: design the orthogonal transport/playback state and bounded sentence
  queue before speaking partial output, so generation, TTS, and microphone never race.

### 2026-09-30 — RT-02 provider token streaming and cancellation completed

- Added streaming calls for the OpenAI-compatible Groq, XKIRO, and OpenRouter
  providers. The parser consumes SSE incrementally, retains usage/model metadata, and
  accepts a valid non-stream JSON response when a provider ignores `stream: true`.
- The streaming router calls one health-ranked free provider at a time. It may move to
  another provider only before any learner-visible text is emitted; after a delta it
  fails the same turn instead of silently multiplying token spend.
- Incremental JSON is converted into safe cumulative `replyEn` delta events. The
  client renders those deltas inside the active AI bubble with an accessible reduced-
  motion cursor, while final structured feedback still comes only from validated JSON.
- Client navigation/cancellation closes delivery but deliberately does not launch a
  fallback model. The in-flight same-ID job finishes and stores its final cache entry;
  a reconnect/retry replays that result without a second provider call.
- Extended Worker contracts with a real two-chunk provider SSE stream, ordered delta
  assertions, final normalization, cached replay, invalid turn rejection, and cancel-
  after-ack followed by same-ID resume. Mobile browser mocks now exercise cumulative
  deltas through the production parser.
- RT-03 integration now drives the visible status and partial bubble from its pure
  state reducer. Legacy booleans still control several buttons/waveform paths and are
  the next consolidation target before avatar work.
- Passed Worker contracts, lint, Speaking persistence/state tests, production build,
  and the 390 x 844 realtime Speaking browser test. No push, deploy, production AI
  request, dependency install, or production data mutation occurred.
- Exact next task: finish `RT-03` UI state consolidation, then implement `RT-04`
  microphone barge-in and TTS/recognition mutual exclusion.

### 2026-09-30 — RT-01 completed; RT-02 safe realtime transport connected

- Upgraded local Speaking sessions from schema 2 to 3. Every user/AI message,
  feedback record, and pending turn now carries a monotonic turn sequence. New request
  IDs are deterministic (`speaking:<session>:turn:<sequence>`), while legacy explicit
  IDs remain readable and retryable.
- Added normalized transport state with active request/turn, last acknowledged
  sequence, reconnect count, and waiting/reconnecting/failed/idle phases. Retry and
  background completion retain the active session rule and cannot allocate a second
  sequence or steal focus from a newer session.
- Legacy schema-1/2 transcripts migrate by reconstructing user/AI turn pairs and
  matching saved pending messages; existing data defaults safely to A2 without loss.
- Added protocol-version-1 Worker endpoints for session negotiation and NDJSON turns.
  The stream emits ordered ack/result/done events plus heartbeat, validates that the
  session, sequence, and deterministic idempotency key agree, disables buffering and
  caching of the stream, and reuses the existing single-flight/final-response cache.
- Connected the browser client to the realtime transport. It falls back to the legacy
  chat endpoint only when realtime is unsupported before generation starts; errors
  after turn submission require a safe same-ID retry, preventing hidden duplicate
  provider calls.
- Began RT-03 with a pure ordered-event conversation reducer. Stale or wrong-request
  stream events cannot roll UI state backward; microphone partials, turn submission,
  NDJSON ack/result/error, TTS start/end, interruption, and recognition failures now
  feed one visible `data-speaking-state` source that the future 3D avatar can consume.
- Worker contracts prove ordered events, invalid-turn rejection, and cached replay
  without another model call. The 390 x 844 browser test now exercises realtime
  handshake/NDJSON, deterministic turn IDs, reload acknowledgement state, navigation,
  and same-ID manual retry.
- Passed `npm.cmd run test:speaking`, `npm.cmd run test:speech`, `npm.cmd run lint`,
  `node backend/test-worker.mjs`, `npm.cmd run build`, `npm.cmd run
  test:speaking:browser`, and `git diff --check`. The bundle-size and line-ending
  notices remain non-blocking.
- No push, deploy, production request, or data mutation occurred. Remaining RT-02
  work: provider token-delta parsing and active cancellation. Exact next files are
  `web/backend/src/worker.js`, `web/src/utils/speakingAiService.js`, and a new pure
  conversation-state reducer used by `AiSpeakingView`.

### 2026-09-30 — RT-10 conversational 3D avatar UI/UX added to the plan

- Added a dedicated `RT-10` workstream to make the existing Speaking surface feel like
  a direct conversation through a fictional, clearly disclosed 3D AI tutor rather
  than a real-person impersonation.
- Planned state-driven gaze, posture, expression, gesture, and lip movement for idle,
  listening, thinking, speaking, interruption, reconnecting, and error. Lip motion
  must follow actual TTS output; amplitude-based motion is the safe first delivery,
  with timed visemes reserved for providers that supply reliable timing.
- Added accessibility and resilience requirements: captions and controls remain
  usable, reduced motion and animation-off are supported, WebGL/context loss falls
  back to 2D, and barge-in stops audio and the speaking animation together.
- Added mobile performance budgets: lazy loading, at most 4 MB compressed avatar
  payload, 30 fps mobile/60 fps desktop targets, no delay to microphone readiness or
  first audio, and automatic fallback on weak devices.
- Sequenced implementation after the authoritative realtime state machine so visual
  animation cannot drift from listening/speaking/network truth. No code, dependency,
  asset, push, deploy, or production change was made for this plan-only update.
- Exact next task remains `RT-01`: implement monotonic turn sequencing and reconnect
  state migration; avatar asset specification can then proceed without blocking the
  transport work.

### 2026-09-30 — Realtime Speaking plan saved; RT-00 CEFR foundation completed

- Added `P2-05-R1` to this execution checkpoint with stable `RT-00` through `RT-09`
  delivery slices, acceptance criteria, latency targets, privacy constraints, fallback
  order, and required web/Worker/Android verification. No second execution plan was
  created, preserving this file as the repository's single source of truth.
- Marked P1-03 blocked on account-level Analytics Engine production query evidence;
  its local implementation is exhausted. The separate production IPA data mutation
  remains unauthorized and was not performed.
- Implemented one shared client CEFR matrix for A1, A2, B1, B2, and C1. Each policy
  defines learner-facing guidance, speech-rate adjustment, response complexity,
  Vietnamese support, and correction density.
- Upgraded Speaking local sessions to schema version 2 with a normalized level and
  safe A2 migration for existing sessions. Level selection restarts only the active
  scenario, persists across reload, and remains attached to pending/retried turns.
- The existing idempotent chat request now sends the selected level. The Worker
  validates it against a server-owned allowlist, applies only the corresponding prompt
  policy, returns the effective level, and still excludes fabricated pronunciation.
- Added a five-level mobile-safe selector to the existing Speaking screen and adjusted
  device TTS rate by level without adding a new learner screen.
- Passed `npm.cmd run test:speaking`, `npm.cmd run test:speech`, `npm.cmd run lint`,
  `node backend/test-worker.mjs`, `npm.cmd run build`, `npm.cmd run
  test:speaking:browser`, and `git diff --check`. The existing bundle-size notice and
  line-ending notices remain non-blocking.
- Changed files: this checkpoint, `web/src/utils/speakingLevels.js`, Speaking service,
  session store, view and CSS, Speaking unit/browser tests, and Worker code/contracts.
  No push, deploy, production write, AI provider request, or secret change occurred.
- Remaining risk: prompt policy is not yet a streaming contract, sessions remain
  device-local, and physical Chrome/Coc Coc/APK microphone and audio evidence remains
  blocked on devices. Exact next task: implement `RT-01` monotonic turn sequencing and
  reconnect state migration, starting with `web/src/utils/speakingSessionStore.js` and
  its persistence tests.

### 2026-09-30 — `euro` fix deployed; examples reach 3,000/3,000

- Pushed commit `63b09ef1de3deb073a4def608647ac1564186cc7` and deployed
  Worker version `000c833e-0e0b-44f0-90a5-bf819d06bd7b`. Production smoke passed
  before any enrichment call.
- Made exactly one forced production retry for `euro` after deployment. Groq free
  returned two valid new contexts using the now-accepted plural `euros`; the existing
  three contexts were preserved, the completed five-context record was stored in D1
  and KV, and there was no cache-write pending state.
- D1 verification shows the `euro` job is `complete`, attempts reset to zero, no next
  retry or last error remains, and the former manual-review row is resolved with the
  note `Completed by vocabulary enrichment`. No second AI call was made.
- The full 125-batch cache-only audit now reports 3,000 server records, 3,000 complete
  five-context records, zero partial/missing/incomplete records, 3,000 clear Vietnamese
  meanings, zero low-quality resolved meanings, and zero failed batches.
- GitHub Pages, Worker, and Android workflows succeeded at runs `36658256265`,
  `36658256192`, and `36658256272`. Production still reports 2,179 stale
  spelling-as-IPA catalog values, so `releaseReady` remains false for that separate
  data-synchronization issue.
- Exact next action: explicitly authorize the validated catalog sync, verify IPA in
  production becomes valid without overwriting D1 meanings/examples, then re-run the
  3,000-word audit and production smoke.

### 2026-09-30 — `euro` API validation root cause fixed locally

- Traced the repeated `INSUFFICIENT_BILINGUAL_EXAMPLES` response to English morphology,
  not provider connectivity: the validator generated the invalid plural `euroes`, so
  natural AI sentences containing `euros` were discarded before the partial 3/5
  record could reach five contexts.
- Added a narrow set of common `-o` words whose plural takes `-s` (`euro`, `photo`,
  `piano`, `radio`, `studio`, `video`, and `zoo`). The validator now accepts `euros`
  and rejects `euroes` without weakening whole-word boundary checks.
- Worker contracts, lint, and `git diff --check` pass. Changed files:
  `web/backend/src/worker.js`, `web/backend/test-worker.mjs`, and this checkpoint.
  No production API call, push, or deployment occurred in this slice.
- Exact next action after explicit push/deploy authorization: release this Worker,
  issue one forced retry for `euro`, verify D1 changes from 3/5 to 5/5 and resolves
  manual review, then run the cache-only 3,000-word audit.

### 2026-09-30 — Remaining-example retry release deployed

- Pushed production code commit `b957f654b9e300ddd70eb1d9b9e51b9efadd801c`
  and deployed Worker version `1f1bd787-0f0a-453f-b988-6d6783777012` with D1, KV,
  Analytics Engine, Workers AI, and the hourly trigger active.
- GitHub Pages, Worker, and Android Kotlin APK workflows all
  completed successfully at runs `36540576946`, `36540576955`, and `36540576802`.
  Production smoke passed health, the 3,000-word catalog, cached D1 enrichment, and
  speech audio using cached word `ticket`.
- A cache-first read after deployment found that the hourly queue had already repaired
  `rubber` and `son` to clear Vietnamese meanings plus five persisted contexts. They
  were not called again. `euro` correctly exposed its three persisted contexts in the
  new partial payload and UI contract.
- Exactly one controlled forced retry was made for `euro`. It returned request ID
  `50c90e09-2f2b-411f-a497-0d6b7a9728a7` with
  `INSUFFICIENT_BILINGUAL_EXAMPLES`; no loop or second AI call followed. D1 preserved
  3/5, set the job to `manual_review` at attempt 27, and retained diagnostics from
  Groq, Cloudflare, XKIRO, and OpenRouter.
- The post-release 125-batch cache-only audit completed with no failed batches and no
  enrichment calls: 3,000 server records, 2,999 complete/five-context records, one
  partial record (`euro`), 3,000 clear Vietnamese meanings, and zero low-quality
  resolved meanings. Production still serves 2,179 stale spelling-as-IPA catalog
  values, so the broader vocabulary release is not yet ready.
- Remaining authority/configuration blocker: production has no `ADMIN_API_KEY`, so
  the audited manual-correction endpoint cannot safely complete `euro`. Do not bypass
  it with an unaudited direct D1 mutation. Exact next action: configure that secret,
  submit a reviewed five-context correction for `euro`, re-audit to `3000/3000`, then
  separately authorize the validated catalog synchronization for IPA repair.

### 2026-09-29 — Remaining-example and retry repair completed locally

- The Worker now accepts the valid unaccented Vietnamese meanings `cao su` and
  `con trai`, sends the requested part of speech to providers, preserves valid
  examples even when a provider returns an invalid meaning, and retains aggregate
  free/paid provider diagnostics instead of replacing them with the last failure.
- D1 batch reads expose partial enrichment payloads. The browser persists and renders
  the exact AI count (for example `3/5` and `Còn thiếu 2 ví dụ`), preserves partial
  examples while retrying, invalidates stale batch/failure cache entries on manual
  retry, and bounds a keep-alive request at three minutes so it cannot lock future
  retries forever. Navigation can still leave the component while the request runs.
- Failed forced retries keep words in `manual_review` once the threshold is reached;
  successful retries mark the job complete and resolve the review row. The hourly D1
  priority query now includes eligible jobs with no enrichment row, continues even
  from a previously complete catalog checkpoint, and still honors cooldown/manual
  review plus the free-only background policy.
- Replaced the removed OpenRouter model slug with the supported `openrouter/free`
  router. Paid fallback policy was not broadened, so unattended/background repair
  cannot create unbounded paid usage.
- Regression coverage proves partial batch visibility, examples-only partial
  persistence, `son` failure/success state transitions, POS propagation, missing-row
  hourly priority, and the 390 x 844 partial-to-5/5 retry flow. Passed `lint`,
  `test:vocab`, `test:speech`, `test:migration`, `test:learning`, `test:diagnostic`,
  `test:admin`, Worker contracts, production build, mobile/desktop vocabulary browser
  checks, and `git diff --check`. The existing bundle-size warning remains.
- Changed in this implementation slice: Worker routing/queue/batch logic and tests,
  vocabulary client cache/loading/UI and browser coverage, OpenRouter configuration
  and documentation, plus this checkpoint. The earlier server-audit script changes
  remain uncommitted in the same worktree.
- No production write, AI request, push, or deploy occurred. Production therefore
  still has `euro` at 3/5 and `rubber`/`son` at 0/5 until an explicitly authorized
  release. Exact next action: run the release gate if needed, commit/push `main`,
  deploy the Worker, retry only those three words once, and re-audit all 3,000 words.

### 2026-09-29 — Remaining-example and manual-retry diagnosis

- Completed a cache-only 125-batch production audit of all 3,000 words without an
  enrichment request or AI token spend. Exactly 2,997 words pass the runtime
  five-context validator. The only incomplete words are `euro` (3/5), `rubber`
  (0/5 and no enrichment row), and `son` (0/5 and no enrichment row).
- D1 proves the Retry AI button reaches the backend and bypasses cooldown: current
  job attempts are 24 for `euro` and 22 each for `rubber` and `son`. All three also
  retain unresolved manual-review rows, while their jobs have been overwritten as
  `retry_pending`, exposing inconsistent retry/review state.
- Latest provider evidence: Groq and XKIRO free outputs failed content validation;
  Cloudflare failed/timed out; the configured OpenRouter model returned HTTP 404;
  and the paid XKIRO path returned HTTP 403 for `son`. Paid fallback currently runs
  only for quota/cooldown failures, so invalid free responses and ordinary provider
  errors cannot use it. The UI collapses these distinct causes into the generic
  provider-unavailable message.
- Root validator defect: correct unaccented Vietnamese meanings such as `cao su` and
  `con trai` fail the current Vietnamese-signal heuristic. The missing-job scheduler
  also prioritizes only existing partial enrichment rows, so missing `rubber` and
  `son` are revisited by the catalog cursor instead of the hourly retry queue.
- Additional confirmed gaps: batch reads hide `euro`'s three persisted examples;
  failed forced retries can reopen `retry_pending` without reconciling manual review;
  a successful normal retry does not resolve the review row; paid failures discard
  free-provider diagnostics; incomplete client batch state may remain cached.
- No production write, AI call, push, or deploy occurred. Exact next implementation:
  repair the Vietnamese-meaning validator and missing-job priority query first, then
  make retry/manual-review transitions atomic, preserve/return partial examples,
  replace or disable the OpenRouter 404 model, retain aggregate provider diagnostics,
  and add Worker plus mobile-browser regression coverage before deployment.

### 2026-09-25 — Full 3,000-word production audit

- Ran the cache-only production audit across all 125 batches; it made no enrichment
  requests and therefore spent no AI tokens. The catalog contains 3,000 unique valid
  headwords with no numbered placeholders such as `can1`/`can2`.
- The effective production read path returned 2,800 records: 2,693 currently pass the
  runtime five-context validator, 107 are returned as partial, and 200 have no server
  record. Across the resolved catalog, 147 meanings still match the low-quality
  heuristic. D1 independently reports 2,791 records, 2,776 rows marked complete with
  five stored examples, 15 partial rows, and 209 missing rows; this mismatch proves
  some rows marked complete are rejected by the stricter runtime validator and that
  nine fallback records exist outside D1.
- Confirmed `deny` now reads from durable storage with a clear Vietnamese meaning and
  five valid bilingual contexts.
- Found a stale production catalog: KV hash
  `9b8abd1a598e10d587a1b4444b29a7b7bd1133c15100ed83ae18bd0d43df8c8a`
  differs from the validated source hash
  `da343445ec5eff3fbd91d88649ac7af4af143f063752a88a2be78355b294be90`.
  Consequently, production still exposes 2,179 spelling-as-IPA placeholders even
  though the current source has zero invalid IPA entries.
- Updated `web/scripts/audit-server-vocabulary.mjs` to retry HTTP 429 responses,
  normalize record keys, and report partial example counts/status totals accurately.
  Tests passed: `npm.cmd run test:vocab`, `node --check
  scripts/audit-server-vocabulary.mjs`, and `npm.cmd run lint`.
- No push, deploy, AI generation, or production write was performed. Remaining risk:
  production is not release-ready until the corrected catalog is explicitly synced
  to KV and the 307 effective incomplete records plus 147 low-quality meanings are
  repaired. Exact next action after production-write authorization: run
  `npm.cmd run sync:vocab-db`, re-run the full audit, then prioritize runtime-rejected
  D1 rows before missing words without overwriting valid existing data.
- The local release audit confirms the source catalog has zero invalid IPA entries,
  but its fallback content is intentionally not release-ready on its own: 2,495
  fallback meanings and 2,832 fallback examples are low quality. Server enrichment
  must therefore remain the display source while those fallback fields are replaced.
  `npm.cmd run audit:vocab` completed successfully and reported these quality gaps.

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

### 2026-09-25 — P2-04-R1 catalog layout regression fixed locally

- Restored the 3,000-word catalog as the default vocabulary surface so pagination and
  summary cards are immediately discoverable; flashcards remain available through the
  explicit `Thẻ Nhớ 3D` mode.
- Made the page-jump control visually distinct and kept `Nhập trang` plus `Chuyển tới`
  directly below Previous/Next. The control was verified by navigating to page 2.
- Locked every example-summary frame to 142 px, hardened card/header sizing, and
  ellipsized long topic badges so cards align without leaking content.
- Expanded the real-browser regression test to require the list default, visible and
  equal summary frames at 390 x 844, aligned desktop cards and frames at 1280 x 900,
  working page entry, and no mobile horizontal overflow.
- Passed `lint`, `test:vocab`, `test:learning`, `test:speech`, `test:migration`,
  `test:diagnostic`, `test:admin`, Worker contracts, production build, and
  `test:vocab:browser`. The existing >500 kB chunk notice remains non-blocking.
- Changed files: `web/src/components/VocabView.jsx`, `web/src/index.css`,
  `web/scripts/test_vocabulary_learning_browser.mjs`, and this checkpoint.
- Remaining risk: the fix is local and is not visible on production until a new push
  and GitHub Pages deployment are explicitly authorized.
- Exact next command after authorization: run `git diff --check`, commit the four
  files, push `main`, monitor GitHub Pages, and repeat the production mobile smoke.

### 2026-09-25 — P1-03-R1 cache-first vocabulary loading completed locally

- Production diagnosis confirmed the KV namespace remains configured and healthy;
  deploys did not delete it. A cold 24-word batch measured 1,548 ms end-to-end/390 ms
  Worker time, while the immediate warm call measured 420 ms/29 ms. Backfill was
  still active at cursor 2,751/3,000 with 918 generated and 131 retry-pending words.
- The browser now loads all visible enrichments through one IndexedDB connection,
  combines them with localStorage meanings, returns immediately when every word has a
  clear Vietnamese meaning and five contexts, and sends only unresolved words to the
  Worker. Existing KV keys and persisted data are unchanged.
- The Worker now Edge-caches normalized batch payloads for 60 seconds using prompt,
  model, word, and part-of-speech identity. A repeated identical batch returns
  `HIT-BATCH` without any additional KV read; misses report `MISS-BATCH` for metrics.
- Mobile browser coverage proves 24 locally complete words create zero batch network
  requests; deleting one cached word creates one request containing only that word.
  Existing page-jump, equal summary-frame, desktop alignment, SRS, and overflow checks
  continue to pass.
- Passed lint, vocabulary, learning, speech, migration, diagnostic, admin, offline,
  Worker contracts, production build, and the mobile/desktop vocabulary browser suite.
  The existing >500 kB chunk notice remains non-blocking.
- Changed in this slice: `web/src/utils/geminiService.js`,
  `web/src/utils/vocabularyBatchService.js`, `web/backend/src/worker.js`,
  `web/backend/test-worker.mjs`, the vocabulary browser test, and this checkpoint.
  The unpushed P2-04-R1 UI files remain part of the same clean release candidate.
- Remaining risk: the browser and Worker optimizations are local until explicitly
  pushed/deployed; D1 single-query batch reads and stable provider-independent legacy
  cache-key migration remain future staging work.
- Exact next command after push/deploy authorization: run `git diff --check`, commit
  the combined UI/cache release, push `main`, deploy the Worker, monitor Pages/Android,
  and compare cold/warm production batch timings plus mobile network request counts.

### 2026-09-25 — Catalog UI and cache-first release deployed

- Pushed `8f1735a5d6312664a996c14807dc3e6f4f8f6933` (`Restore vocabulary catalog and
  optimize cache reads`) to `main` with the P2-04-R1 UI restoration and P1-03-R1
  browser/Worker caching improvements.
- Full release gate passed: all unit/static suites, Worker contracts, production web
  build, and the mobile/desktop vocabulary browser suite. Local Android assembly could
  not reuse the host's Gradle cache and the isolated Gradle download timed out; the
  clean GitHub Android workflow subsequently built successfully.
- GitHub Pages succeeded at
  https://github.com/Quyenlaaaa/lingogoc-app/actions/runs/36088062842 and Android at
  https://github.com/Quyenlaaaa/lingogoc-app/actions/runs/36088062878.
- Direct Worker deployment succeeded at
  `https://lingogoc-api.lingogoc-api.workers.dev`, version
  `dbe0b521-78ce-4d8e-b643-631ba8422def`. Automated smoke passed health, catalog,
  cached enrichment, and speech for `ticket`.
- Production batch verification returned `MISS-BATCH` on the first 24-word request
  (1,246 ms end-to-end, 447 ms Worker) and `HIT-BATCH` on the repeat (343 ms
  end-to-end, 8 ms Worker), proving the repeat avoided durable KV reads.
- Worker validation succeeded at
  https://github.com/Quyenlaaaa/lingogoc-app/actions/runs/36088062940. Its deploy and
  smoke steps remain skipped because the protected GitHub Cloudflare secrets are not
  configured; the direct Wrangler deployment closed this release only.
- Direct HTTP access to GitHub Pages from this workspace timed out at connection after
  20 seconds, as in the prior release. The successful Pages deployment workflow is
  the available web release evidence; physical Chrome/Cốc Cốc verification remains.
- Exact next action: add the two protected Cloudflare GitHub secrets and perform the
  physical mobile checklist, confirming default catalog mode, equal summary frames,
  page-number navigation, and zero batch request on a fully cached page.

### 2026-09-25 — P1-03-R2 optimization measures 1–6 completed locally

- Incomplete Worker batches are now `no-store` and report
  `MISS-BATCH-INCOMPLETE`; only batches with no missing or enrichment-pending words
  enter the five-minute Edge Cache. A contract reproduces the former `get` bug and
  proves a successful manual enrichment is visible on the very next batch read.
- Every vocabulary batch and manual retry receives a monotonically increasing client
  version. A batch response older than a retry start or completion cannot replace the
  newer loading, success, or failure state.
- Manual retry renders its response directly and persists through the existing browser
  cache without issuing another batch request. The mobile browser suite proves one
  unresolved word causes one enrichment call, then immediately renders 5/5 examples.
- Replaced the generic `AI đang bận` copy with safe quota, provider, network/timeout,
  invalid-content, cooldown, and backend-configuration messages. Worker request IDs
  propagate to the card, and KV-write-pending success clearly says the device copy is
  safe while server synchronization remains pending.
- Preserved the previously proven local cache-first path: 24 complete local records
  produce zero batch calls, while one unresolved word sends only that word.
- D1 batch reads now calculate the 24 cache identities, execute one parameterized
  `SELECT cache_key, payload_json ... IN (...)`, and use KV only for D1 misses. A D1
  mock contract asserts one visible batch performs exactly one D1 SELECT.
- Passed lint, all unit/static suites, Worker/D1 contracts, production build, and the
  mobile/desktop vocabulary browser suite. The existing >500 kB bundle warning remains.
- Changed files: `web/backend/src/worker.js`, `web/backend/test-worker.mjs`,
  `web/src/components/VocabView.jsx`, `web/src/utils/geminiService.js`,
  `web/src/utils/vocabularyEnrichmentUi.js`, `web/src/index.css`, the vocabulary tests,
  and this checkpoint.
- Remaining risk: D1 query code is complete but production has no `VOCAB_DB` binding,
  so it correctly continues using KV. This slice is local and has not been pushed or
  deployed because the user did not request deployment in this session.
- Exact next command after explicit push/deploy authorization: run `git diff --check`,
  commit the R2 slice, push `main`, deploy the Worker, verify `get` retry then immediate
  batch freshness, monitor Pages/Android, and record the Worker version/workflow URLs.

### 2026-09-25 — Production D1 populated; binding deploy awaiting confirmation

- Confirmed Wrangler OAuth access to account `f66e7a88ef5ff3163fc23274f3379b2a`
  and found the existing empty D1 database `dataenglish_d1`.
- Bound `VOCAB_DB` locally, applied both production migrations remotely, exported all
  `2,781` `vocabulary:v2:*` records from KV in 100-key read batches, and imported them
  idempotently without deleting KV or calling any AI provider.
- Read-only verification found `2,781` unique keys/words: `2,765` complete and `16`
  partial. `get`, `explore`, `fire`, and `rank` each have a clear Vietnamese meaning
  and five examples in D1.
- Added a repeatable KV export tool. Updated SQL preparation to omit unsupported manual
  transaction statements; D1 file import supplies rollback behavior. Migration tests
  and Worker contracts pass.
- Enabled the local `METRICS` binding for dataset `lingogoc_worker_metrics`. Wrangler
  dry-run recognizes KV, D1, Analytics Engine, and Workers AI bindings. Analytics will
  remain empty until this Worker version is deployed and receives a real request.
- No push or Worker deployment occurred. Exact next action after explicit production
  deploy authorization: run the release gate, deploy the Worker, invoke health and a
  cached vocabulary request, verify `d1Configured: true`, and confirm the first
  Analytics Engine data points. If Cloudflare returns error 10089 again, the user must
  activate Analytics Engine for the account in the dashboard before retrying.

### 2026-09-25 — D1 and Analytics Engine production release

- Full release gate passed: lint, vocabulary, speech, migration, learning, diagnostic,
  administration, security, Worker contracts, production build, and the 390 x 844 plus
  desktop vocabulary browser suite. The existing bundle-size notice remains.
- Pushed commit `1cc50099d17d392118a36eeb226c97062a08edbe` to `main` and deployed Worker version
  `2d58dbd1-601f-4e17-b788-25c9f5c6ecc5` with `VOCAB_DB`, `VOCAB_CACHE`, `METRICS`,
  and Workers AI bindings accepted by Cloudflare.
- The first smoke attempt exposed only a stale assertion that did not recognize the
  new `X-LingoGoc-Cache: D1` source. Production returned the cached `ticket` result
  with five examples and no AI call; the smoke assertion was updated and the complete
  production smoke then passed health, catalog, D1 enrichment, and speech audio.
- Production operations is healthy with `d1Configured: true` and `durableSource: D1`.
  The D1 audit reports 2,781 unique records, 2,765 complete/five-example records, 16
  partial records, and 219 catalog words not yet enriched. Hourly background completion
  remains active and now writes D1 first.
- Pushed follow-up commit `6fc3d85e70f7767e5d40d08279dbd2f3be70d095`. GitHub Pages,
  Worker validation, and Android succeeded at runs `36093187456`, `36093187365`, and
  `36093187516`, respectively.
- Exact next task: collect/query `lingogoc_worker_metrics` after ingestion becomes
  visible, verify cache/provider latency KPIs, and continue completing the 219 missing
  plus 16 partial words without duplicate AI calls.

### 2026-09-25 — Partial vocabulary retry prioritization completed locally

- Diagnosed all 16 production partial enrichments: each has valid Vietnamese meaning,
  but together they are missing 26 examples. All retain legacy retry metadata in KV;
  no D1 retry/manual-review rows existed yet.
- The Worker now promotes a legacy KV retry record into D1 on first read, preserving
  attempts, cooldown, provider errors, and timestamps without an AI call.
- Each hourly run performs one bounded D1 query for eligible partial enrichments and
  handles them before the normal 3,000-word cursor. Cooldowns/manual review remain
  authoritative, existing examples are preserved, and the existing limit of two free
  AI attempts/generations per run is unchanged.
- Regression coverage proves a partial word far from the cursor is discovered, a
  future cooldown prevents its AI call, and its legacy retry attempts are durably
  promoted to D1. Existing KV-write-failure/manual-review behavior remains covered.
- Lint, vocabulary, speech, migration, learning, diagnostic, administration, Worker
  contracts, production build, and `git diff --check` pass; only the existing bundle
  size notice remains.
- Changed files: `web/backend/src/worker.js`, `web/backend/test-worker.mjs`, and this
  checkpoint. No production mutation, push, or deploy occurred in this slice.
- Exact next action after explicit authorization: commit/push, deploy the Worker,
  verify the 16 legacy jobs promote into D1 across scheduled runs, and re-run the D1
  audit until partial count reaches zero or genuine fifth-attempt failures enter manual
  review.

### 2026-09-25 — Partial retry prioritization deployed

- Pushed commit `c9de884e903b464bedb1d83eb477155f896fc690` and deployed Worker
  version `b2879f58-422f-4158-8182-35aa44047c5c` with the D1 partial-priority queue and
  automatic legacy KV retry promotion.
- Production smoke passed health, 3,000-word catalog, cached D1 enrichment, and speech.
  Operations remained healthy with D1 as the durable source. The pre-cron audit baseline
  remains 2,781 records, 2,765 complete, 16 partial, and 219 not yet enriched.
- GitHub Pages, Worker validation, and Android succeeded at runs `36094965677`,
  `36094966018`, and `36094965606`, respectively.
- Exact next task: inspect the first hourly run after this deploy, verify partial jobs
  appear in D1 and the partial count falls, then continue hourly observation without
  manual duplicate calls.

### 2026-09-25 — Inflected headword validation fix

- A real manual retry for `deny` reached D1 but remained at four examples because the
  validator required the exact substring `deny`; natural output using `denied` was
  incorrectly discarded. The request correctly persisted the best partial result and
  advanced its retry job, so no database write was lost.
- Added boundary-aware English morphology validation for regular plural/third-person,
  past, and `-ing` forms, including consonant-`y`, silent-`e`, `-ie`, and doubled-final
  spelling. Common irregular forms cover `be`, `do`, `find`, `get`, `go`, `have`,
  `teach`, and `throw`.
- Regression tests accept `denies`, `denied`, `denying`, and `found` for their correct
  headwords while rejecting unrelated substring matches such as `identity` for `deny`.
- Full release gate passed: lint, vocabulary, speech, migration, learning, diagnostic,
  administration, Worker contracts, and production build. Only the existing bundle
  size notice remains.
- Changed files: `web/backend/src/worker.js`, `web/backend/test-worker.mjs`, and this
  checkpoint. Exact next action: deploy, force one controlled retry for `deny`, and
  verify the durable D1 record changes from four to five examples.

### 2026-09-25 — Inflected-form fix deployed and `deny` completed

- Pushed commit `987e027cf31b98d003285f8382eb2a25f9acb556` and deployed Worker
  version `f91fd3c9-f855-42fd-b475-5b8873f516ea`.
- One controlled forced retry for `deny` succeeded through `GROQ_FREE`: the existing
  four contexts were preserved and the natural sentence “The landlord denied my
  request…” became the fifth context. D1 now reports `status=complete`, five examples,
  job attempts reset to zero, no next retry, and no last error.
- The production partial count fell from 16 to 15. Production smoke passed after the
  write. GitHub Pages, Worker validation, and Android succeeded at runs `36095751223`,
  `36095751312`, and `36095751289`, respectively.
- Exact next task: let the prioritized hourly queue apply the same inflection-aware
  validation to the remaining 15 partial words and verify the count after each run.
