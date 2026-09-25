# LingoGoc Agent Instructions

Scope: the entire repository.

## Current objective

Finish and stabilize every feature already exposed in production before adding new
product surfaces. `PRODUCTION_COMPLETION_PLAN.md` is the only execution plan and
checkpoint.

## Required session startup

1. Read all of `AGENTS.md` and `PRODUCTION_COMPLETION_PLAN.md`.
2. Run `git status --short`; never overwrite changes of unknown origin.
3. Read `Current checkpoint`, `Next work`, and `Handoff log` in the plan.
4. Continue the single `IN_PROGRESS` task. If none exists, promote the first priority
   `TODO` task to `IN_PROGRESS`.
5. Resume from evidence in the checkpoint; do not repeat completed work.

## Continuous execution

- Every task needs a stable ID, scope, acceptance criteria, and test commands.
- Allowed states: `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`.
- Only one task may be `IN_PROGRESS`.
- Update the plan immediately after meaningful progress.
- When the user says “continue” or equivalent, move automatically to the next task
  after a task reaches `DONE`; do not request confirmation for safe in-scope work.
- Stop only when the objective is complete, new authority is required, or a real
  blocker is recorded in the checkpoint.
- Before ending a session, append a handoff entry containing completed work, changed
  files, tests/results, remaining risks, and the exact next task/command.
- On quota failure, do not retry continuously. Save state, mark the task `BLOCKED` only
  when no useful work remains, and continue an independent task.
- Background data completion must not depend on a learner keeping the website open.

## Product priority

1. Correctness, no data loss, and no duplicate token spend.
2. The 3,000-word catalog: clear Vietnamese meaning, valid IPA, exactly five distinct
   bilingual contexts.
3. Consistent TTS/STT on mobile Chrome, Cốc Cốc, desktop, and Android.
4. One source of truth for SRS, XP, streak, and learning progress.
5. Mobile performance, observability, and production testing.
6. Accounts, cross-device sync, and Android release.
7. Real battle, leaderboard, certificates, and payments.

Do not add new screens while P0/P1 tasks remain unfinished.

## Production rules

- Never present mock users, opponents, payments, or data as real.
- The frontend cannot self-confirm VIP, important XP, or certificates.
- KV and Edge Cache are caches; durable business data needs an auditable source of
  truth.
- AI work must be idempotent by word and prompt version.
- Always read browser/cache/database data before calling AI.
- Vocabulary is complete only with a clear Vietnamese meaning, valid IPA, and exactly
  five bilingual examples in distinct contexts.
- If KV quota is exhausted, return valid results, retain them in browser/Edge Cache,
  and synchronize later.
- Never commit API keys, keystores, or secrets.
- Do not push or deploy unless the user explicitly requests it in the current session.

## Minimum tests before `DONE`

From `web`:

```powershell
npm.cmd run lint
npm.cmd run test:vocab
npm.cmd run test:speech
npm.cmd run test:migration
npm.cmd run test:learning
npm.cmd run test:diagnostic
npm.cmd run test:admin
node backend/test-worker.mjs
npm.cmd run build
```

- Frontend tasks require a matching mobile viewport check.
- Worker changes require contract/regression coverage in `backend/test-worker.mjs`.
- Android changes require `app\gradlew.bat assembleDebug` or an equivalent workflow.
- A build alone does not prove behavioral acceptance.

## Push/deploy procedure

Only when explicitly requested:

1. Run relevant tests and `git diff --check`.
2. Commit an accurate description and push `main`.
3. Deploy the Worker from `web/backend` when backend code changed.
4. Monitor GitHub Pages and Android workflows to completion.
5. Run a production smoke test for the fixed behavior.
6. Record commit, Worker version, workflow URL, and smoke result in the checkpoint.

Production:

- Web: `https://quyenlaaaa.github.io/lingogoc-app/`
- Worker: `https://lingogoc-api.lingogoc-api.workers.dev`

## Repository layout

- `web/`: React UI, data, scripts, and Cloudflare Worker.
- `app/`: Android Kotlin/WebView, native TTS/STT, offline packaging.
- `PRODUCT_ROADMAP.md`: long-term vision, not an execution checkpoint.
- `PRODUCTION_COMPLETION_PLAN.md`: current execution source of truth.
