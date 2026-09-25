# LingoGoc AI

English-learning platform for Vietnamese learners, delivered as a React web app and a
Kotlin Android app. The system includes a 3,000-word catalog, IPA, contextual bilingual
examples, flashcards, quizzes, review, dictation, reflex training, audio, and AI
speaking support.

Production web: <https://quyenlaaaa.github.io/lingogoc-app/>

Production Worker: <https://lingogoc-api.lingogoc-api.workers.dev>

## Repository

```text
lingogoc-app/
├── web/                         React/Vite frontend, data, scripts, Worker
│   ├── backend/                 Cloudflare Worker and D1 migrations
│   ├── scripts/                 tests, audits, migration tools
│   └── src/                     product source
├── app/                         Kotlin Android/WebView application
├── AGENTS.md                    repository execution rules
├── PRODUCTION_COMPLETION_PLAN.md current task/checkpoint source of truth
└── PRODUCT_ROADMAP.md           long-term direction
```

## Local web development

Requirements: Node.js 22 or later and npm.

```powershell
cd web
npm.cmd ci
npm.cmd run dev
```

Production build:

```powershell
npm.cmd run build
```

Set `VITE_API_BASE_URL` only when using a non-production Worker.

## Required validation

From `web`:

```powershell
npm.cmd run lint
npm.cmd run test:features
npm.cmd run test:vocab
npm.cmd run test:speech
npm.cmd run test:migration
node backend/test-worker.mjs
npm.cmd run build
```

`npm run lint` fails on warnings. Worker changes require contract coverage in
`backend/test-worker.mjs`.

## System vocabulary

Learners use one system-managed 3,000-word catalog. Production reads the catalog from
`GET /api/vocabulary/catalog`; `web/src/data/vocabData.js` is the offline/failure
fallback. IPA data is validated so an English spelling such as `/fire/` is never shown
as phonetic transcription.

The Worker reads valid enrichment from durable/cache layers before AI. A complete
record requires a clear Vietnamese meaning and exactly five bilingual examples with
distinct contexts. Scheduled backfill runs without a browser and uses free providers
only. After five word-specific failures, the word enters manual review instead of
retrying forever.

Useful commands:

```powershell
# Bundled-data audit; optional report is written under web/reports
npm.cmd run audit:vocab
npm.cmd run audit:vocab -- --write-report

# Safe default: describes the server audit but sends no batch requests
npm.cmd run audit:vocab-server

# Explicit production batch audit; may promote valid Edge entries into KV
npm.cmd run audit:vocab-server -- --allow-production-cache-reads --strict

# Validate catalog synchronization without writing KV
node scripts/sync-vocabulary-kv.mjs --dry-run
```

Do not run bulk production audits or data writes without explicit approval.

## AI routing and persistence

Supported free providers include Groq, Cloudflare Workers AI, XKIRO free models, and
OpenRouter. Interactive requests start the healthiest provider, hedge after 1.5
seconds only if needed, and open a short circuit after repeated failures. Background
backfill is sequential and cannot use the paid fallback. XKIRO paid fallback is only
eligible for interactive requests under the configured quota policy.

When `VOCAB_DB` is configured, D1 is the source of truth and KV/Edge are caches. Without
D1, the existing KV path remains compatible. The migration preparation tool is a
default no-op and never connects to Cloudflare:

```powershell
npm.cmd run migrate:vocab-d1
npm.cmd run migrate:vocab-d1 -- --input=scripts/data_cache/kv-export.json
npm.cmd run migrate:vocab-d1 -- --input=scripts/data_cache/kv-export.json --write-sql
```

The generated SQL/checkpoint stays under ignored `scripts/data_cache`. Apply it to an
isolated staging D1 database before any production migration.

## Android

The Kotlin app packages the production web bundle and supplies native TTS/STT bridges.

```powershell
cd app
.\gradlew.bat assembleDebug
```

Debug APK: `app/app/build/outputs/apk/debug/app-debug.apk`.

See `app/README.md` for Android Studio and release guidance.

## Privacy and security

- API keys exist only as Worker secrets.
- Never commit `.env`, `.dev.vars`, keystores, signing passwords, or private learning
  exports.
- Browser learning state is currently device-local; export a backup before clearing
  site data.
- Server enrichment may be shared across devices; personal learning history must not
  be logged with prompts or secrets.
- Frontend code cannot self-confirm VIP, important XP, payments, or certificates.

## Deployment

Push/deploy is performed only after explicit user authorization. The release gate runs
all tests above, deploys the Worker when backend code changed, deploys GitHub Pages,
then runs the production smoke test. See `web/backend/DEPLOYMENT.md` for secrets,
staging isolation, and rollback.

Third-party data notices are in `web/THIRD_PARTY_NOTICES.md`.
