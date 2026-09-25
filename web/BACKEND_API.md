# LingoGoc Backend Contract

The frontend knows only `VITE_API_BASE_URL`. XKIRO, Groq, OpenRouter, Cambridge, and
other credentials remain in Worker secrets and are never returned to clients.

Every Worker response includes `X-Request-ID` and `Server-Timing`. Report the request
ID when diagnosing an error; do not send prompts or secrets. CORS permits configured
web origins and the secure Android asset origin.

## Health and operations

### `GET /health`

Returns configured models/providers, routing strategy, timeout/hedge values, and
storage availability. It never returns keys.

### `GET /api/operations/status`

Read-only, non-cacheable status for provider cooldown/circuit/latency/token metrics,
KV/D1 storage, runtime cache hit metrics, cron/backfill, thresholds, and alerts.

### `GET /api/vocabulary/backfill/status`

Returns the hourly backfill checkpoint, generated/retry counts, and manual-review
summary. It does not start AI work. After five word-specific failures, that word has
status `manual_review` and no `nextRetryAt`.

### `GET /api/vocabulary/audit`

Runs one read-only D1 aggregate for total/complete/five-example/clear-meaning records,
open manual reviews, and up to 100 issue samples. It never calls AI or falls back to
batch POSTs. Without `VOCAB_DB`, it returns `503 D1_NOT_CONFIGURED`.

## Vocabulary catalog and cache

### `GET /api/vocabulary/catalog`

Returns the system-managed 3,000-word catalog from KV.

### `GET /api/vocabulary/manifest`

Returns catalog count, content hash, schema version, and prompt version for cheap
client synchronization.

### `POST /api/vocabulary/batch`

Reads at most 24 cached enrichment/meaning records. It never invokes an AI provider.

```json
{
  "items": [
    { "word": "accept", "pos": "v" },
    { "word": "explore", "pos": "v" }
  ]
}
```

Response fields include `items`, `missing`, and `needsEnrichment`.

## Vocabulary AI

### `POST /api/vocabulary/enrich`

```json
{
  "word": "accept",
  "meaning": "chấp nhận",
  "topic": "Work",
  "dictionaryDefinitions": [
    { "partOfSpeech": "verb", "text": "Receive or agree to something." }
  ],
  "force": false
}
```

Valid output has a clear Vietnamese meaning and exactly five distinct bilingual
contexts:

```json
{
  "data": {
    "word": "accept",
    "primaryMeaningVi": "chấp nhận; đồng ý nhận",
    "meaningNote": "...",
    "senses": [{ "pos": "verb", "meaningVi": "chấp nhận", "usage": "..." }],
    "contextExamples": [
      { "context": "Work", "en": "I accepted the offer.", "vi": "Tôi đã nhận lời đề nghị." }
    ],
    "collocations": [{ "phrase": "accept responsibility", "meaning": "nhận trách nhiệm" }],
    "mnemonicTip": "...",
    "wordFamily": "acceptance, acceptable",
    "status": "complete",
    "persistedOnServer": true
  }
}
```

The service reads D1/KV/Edge before AI. One-to-four valid examples are preserved and
only the missing count is requested. `force: true` bypasses the retry cooldown but not
valid cached data. Interactive results can return with `persistencePending` when all
durable writes fail so the browser can retain them.

### `POST /api/vocabulary/meanings`

Normalizes Vietnamese meanings for at most 30 words. Existing enrichment/meaning cache
is reused first; only unresolved entries reach AI.

```json
{
  "items": [
    { "word": "ability", "pos": "n", "meaning": "khả năng" }
  ]
}
```

## Dictionary and audio

### `GET /api/vocabulary/dictionary?word=explore`

Returns public dictionary phonetics, definitions, examples, audio, synonyms, and
antonyms. Cold upstream lookup is time-limited and successful results are Edge-cached.

### `GET /api/vocabulary/cambridge?word=accept`

Optional licensed integration. Returns `204 No Content` when not configured so the
client can continue with other legal sources.

### `GET /api/vocabulary/pronunciation?word=hello`
### `GET /api/speech/audio?text=How%20are%20you%3F&lang=en-US`

Return audio bytes with an audio content type. Both word and sentence playback use the
same endpoint behavior and Edge caching.

## Speaking

### `POST /api/speaking/chat`

Accepts `scenario` and up to 12 recent messages. Returns English/Vietnamese reply,
correction, encouragement, hints, and model metadata.

### `POST /api/speaking/speech`

Currently returns `501`; clients use browser/native TTS instead. Do not present this as
a configured cloud speech service.

## Future authenticated sync contract

No account sync endpoint is exposed until a real authentication provider and durable
staging database are configured. The client-side contract is already versioned:

- Snapshot format: `lingogoc-local-backup`, version `1`.
- Personal sections: user progress/settings, SRS, processed and pending learning
  events, diagnostic history, Speaking sessions, and learning-module sessions.
- Device guest IDs are metadata only and are never imported onto another device.
- Conflict resolution unions completed IDs and idempotency keys, retains the newest
  SRS/session record, takes the maximum XP/streak instead of adding snapshots, and
  keeps at most 2,000 event IDs and 20 diagnostic results.
- A future server request must include an authenticated account ID, device ID,
  `baseRevision`, snapshot version, and pending event IDs. A successful response must
  return a new revision and acknowledged event IDs. The client may remove pending
  events only after that acknowledgement.

This contract deliberately makes no network request today; presenting local backup as
cloud sync would be misleading.

## Error behavior

Errors use JSON with `error`, stable `code`, `retryable`, and `requestId` where
applicable. Provider cooldown and quota responses include `nextRetryAt` when known.
Clients must not retry continuously; automatic retry waits for the recorded cooldown,
while manual retry is an explicit user action.

## Request protection

POST endpoints require `application/json` and reject request bodies larger than 20 KB.
The Worker uses `CF-Connecting-IP` for bounded per-isolate limits configured by
`RATE_LIMIT_READ_PER_MINUTE`, `RATE_LIMIT_AI_PER_MINUTE`,
`RATE_LIMIT_ADMIN_PER_MINUTE`, and `RATE_LIMIT_AUDIO_PER_MINUTE`. A limited request
returns `429`, `Retry-After`, and `RateLimit-Limit` without calling a provider.

Every response includes `nosniff`, frame, referrer, permissions, CSP, and HSTS headers.
Allowed browser origins are explicit; the secure Android WebViewAssetLoader origin is
also supported. Production must additionally enable Cloudflare WAF/rate-limiting rules
for globally consistent enforcement across isolates and points of presence.
