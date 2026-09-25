# LingoGoc Cloudflare Worker

The Worker protects provider keys, serves the system vocabulary, enriches words,
normalizes Vietnamese meanings, proxies/cache audio and dictionary data, supports AI
speaking, and runs background vocabulary completion.

## Local development

1. Copy `.dev.vars.example` to `.dev.vars`.
2. Add only the provider keys needed locally.
3. From `web`, run `npx wrangler dev --config backend/wrangler.toml`.
4. Set frontend `VITE_API_BASE_URL=http://localhost:8787`.

Contract tests use mocks and require no real key:

```powershell
cd web
node backend/test-worker.mjs
```

`.dev.vars` is ignored. Never commit secrets.

## Provider routing

Supported free providers:

- Groq: `qwen/qwen3.8-27b`
- Cloudflare Workers AI: `@cf/google/gemma-4-26b-a4b-it`
- XKIRO: `mistralai/mistral-large-2512`
- OpenRouter: `deepseek/deepseek-v4-flash-0731:free`

Interactive routing ranks providers by recent latency, consecutive failures, and
circuit state. One provider starts immediately. A second starts after 1.5 seconds only
when needed, or immediately when the preceding provider fails. Three consecutive final
failures open a two-minute circuit. Quota errors retain a five-minute cooldown.

Background backfill is strictly sequential and disables the paid model. Interactive
XKIRO paid fallback (`x-ai/grok-build-0.1`) is considered only under the configured
quota policy. Every provider call has a 12-second timeout. Operations status exposes
counts, latency, tokens, and circuit state without prompts or keys.

The optional `METRICS` Analytics Engine binding stores provider and cache data points
across Worker isolates. Wrangler creates dataset `lingogoc_worker_metrics` on the first
write after deployment; local tests use a mock binding. See Cloudflare's Analytics
Engine SQL API for p50/p95 aggregation.

Cloudflare Workers AI uses binding `AI` and a KV-tracked UTC daily limit. Configure
Groq with:

```powershell
npx wrangler secret put GROQ_API_KEY --config backend/wrangler.toml
```

## Vocabulary completion

The hourly cron scans at most 96 catalog entries and attempts/generates at most two
missing words per run. It does not require an open browser and never enables paid AI.

- Cache/database is checked before AI.
- Partial valid meanings/examples are preserved.
- Only `5 - existingExamples` new contexts are requested.
- Word-specific failures wait one hour.
- The fifth failure enters manual review and stops automatic retries.
- Provider-wide quota pauses the queue instead of hammering the provider.

Inspect state with `GET /api/vocabulary/backfill/status`.

## Storage

### Current KV compatibility

KV stores the system catalog/manifest, cache entries, and backward-compatible
checkpoint data. Edge Cache accelerates dictionary, audio, and enrichment reads.

### D1 durable source of truth

`migrations/0001_vocabulary_durable_store.sql` creates:

- `vocabulary_enrichments`
- `vocabulary_jobs`
- `vocabulary_manual_review`
- `system_state`

When optional binding `VOCAB_DB` exists, reads use D1 → KV → Edge and writes commit to
D1 before refreshing KV. A successful D1 write remains durable if KV quota is
exhausted; the response may set `cacheWritePending`. Without D1, KV-only behavior is
unchanged.

Create an isolated staging database first:

```powershell
npx wrangler d1 create lingogoc-vocabulary-staging
npx wrangler d1 migrations apply lingogoc-vocabulary-staging --local
```

Bind it as `VOCAB_DB` only in the intended environment. Never use production KV/D1 in
staging.

## Safe KV-to-D1 preparation

```powershell
cd web
npm.cmd run migrate:vocab-d1
npm.cmd run migrate:vocab-d1 -- --input=scripts/data_cache/kv-export.json
npm.cmd run migrate:vocab-d1 -- --input=scripts/data_cache/kv-export.json --write-sql
```

- No arguments: safe no-op.
- Input only: validate/report; no Cloudflare connection.
- `--write-sql`: create idempotent SQL and an unapplied checkpoint under ignored
  `scripts/data_cache`.

After a staging migration, `GET /api/vocabulary/audit` performs a single read-only D1
audit. It never invokes AI or silently runs 125 batch requests.

## Dictionary and speech

`GET /api/vocabulary/dictionary` has a 3.5-second upstream timeout and 30-day successful
Edge cache. List/flashcard screens do not fan out dictionary calls; details load lazily.

Word pronunciation and sentence playback share the server audio behavior. The Android
app can use its native TTS bridge when browser speech is unreliable.

## Deploy

Deploy only after explicit authorization and passing the release gate:

```powershell
cd web\backend
npx wrangler secret put XTROUTER_API_KEY
npx wrangler deploy
```

Catalog synchronization is a separate controlled action:

```powershell
cd web
node scripts/sync-vocabulary-kv.mjs --dry-run
npm.cmd run sync:vocab-db
```

The sync script refuses anything other than 3,000 valid unique words. See
`DEPLOYMENT.md` for GitHub secrets, smoke tests, staging isolation, and rollback.

## Non-secret variables

- `AI_BASE_URL`, `AI_FREE_MODEL`, `AI_PAID_MODEL`
- `AI_PAID_INPUT_USD_PER_MILLION`, `AI_PAID_OUTPUT_USD_PER_MILLION` (set both
  to the provider's current rates; zero disables cost estimation)
- `GROQ_BASE_URL`, `GROQ_FREE_MODEL`
- `OPENROUTER_BASE_URL`, `OPENROUTER_FREE_MODEL`
- `OPENROUTER_SITE_URL`, `OPENROUTER_APP_NAME`
- `WORKERS_AI_MODEL`, `WORKERS_AI_DAILY_REQUEST_LIMIT`
- `ALLOWED_ORIGINS`
- `RATE_LIMIT_READ_PER_MINUTE`, `RATE_LIMIT_AI_PER_MINUTE`
- `RATE_LIMIT_ADMIN_PER_MINUTE`, `RATE_LIMIT_AUDIO_PER_MINUTE`

Secrets include `XTROUTER_API_KEY`, `GROQ_API_KEY`, and `OPENROUTER_API_KEY`.
Set `ADMIN_API_KEY` as a Worker secret before enabling the protected vocabulary
administration API. Never expose it through frontend build variables.

Protected administration endpoints currently include:

- `GET /api/admin/vocabulary?limit=25&offset=0`: D1 counts and issue queues.
- `POST /api/admin/vocabulary/retry`: queue one validated headword without calling AI
  in the request; body `{ "word": "example" }`.
- `POST /api/admin/vocabulary/correction`: persist a validated correction containing a
  clear Vietnamese meaning and exactly five distinct bilingual contexts.

Both require `Authorization: Bearer <ADMIN_API_KEY>`. Apply migration
`0002_vocabulary_admin_audit.sql` before using mutations.
