import assert from 'node:assert/strict';
import worker from './src/worker.js';

let cachedResponse = null;
const dictionaryEdgeCache = new Map();
const vocabularyEdgeCache = new Map();
const speakingEdgeCache = new Map();
globalThis.caches = {
  default: {
    match: async (key) => {
      const url = typeof key === 'string' ? key : key.url;
      if (url.includes('/dictionary/')) return dictionaryEdgeCache.get(url)?.clone() || null;
      if (url.includes('/vocabulary/')) return vocabularyEdgeCache.get(url)?.clone() || null;
      if (url.includes('/speaking/')) return speakingEdgeCache.get(url)?.clone() || null;
      return null;
    },
    put: async (key, response) => {
      cachedResponse = response;
      const url = typeof key === 'string' ? key : key.url;
      if (url.includes('/dictionary/')) dictionaryEdgeCache.set(url, response.clone());
      if (url.includes('/vocabulary/')) vocabularyEdgeCache.set(url, response.clone());
      if (url.includes('/speaking/')) speakingEdgeCache.set(url, response.clone());
    },
    delete: async (key) => {
      const url = typeof key === 'string' ? key : key.url;
      return dictionaryEdgeCache.delete(url) || vocabularyEdgeCache.delete(url) || speakingEdgeCache.delete(url);
    },
  },
};

let providerRequest = null;
let providerCallCount = 0;
let customProviderResponse = null;
const serverCache = new Map();
let kvReadCount = 0;
const analyticsPoints = [];
globalThis.fetch = async (url, options) => {
  if (String(url).startsWith('https://translate.google.com/translate_tts')) {
    return new Response(new Uint8Array([73, 68, 51, 4]), {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  }
  if (String(url).startsWith('https://api.dictionaryapi.dev/api/v2/entries/en/')) {
    return new Response(JSON.stringify([{
      word: 'explore',
      phonetic: '/ɪkˈsplɔːr/',
      phonetics: [{ text: '/ɪkˈsplɔːr/', audio: '//audio.example/explore.mp3' }],
      meanings: [{
        partOfSpeech: 'verb',
        definitions: [{
          definition: 'Travel through an unfamiliar place to learn about it.',
          example: 'They explore the forest together.',
          synonyms: ['investigate'],
          antonyms: ['ignore'],
        }],
      }],
    }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  providerCallCount += 1;
  providerRequest = { url, options, body: JSON.parse(options.body) };
  if (customProviderResponse) return customProviderResponse(providerRequest);
  return new Response(JSON.stringify({
  choices: [{
    message: {
      content: JSON.stringify({
        primaryMeaningVi: 'chấp nhận',
        meaningNote: 'Dùng khi đồng ý nhận hoặc thừa nhận điều gì.',
        senses: [{ pos: 'verb', meaningVi: 'chấp nhận', usage: 'accept + noun' }],
        contextExamples: [
          { context: 'Đời sống', en: 'They accept card payments here.', vi: 'Ở đây họ chấp nhận thanh toán bằng thẻ.' },
          { context: 'Công việc', en: 'I accept the terms of the contract.', vi: 'Tôi chấp nhận các điều khoản của hợp đồng.' },
          { context: 'Hội thoại', en: 'Please accept my sincere apology.', vi: 'Xin hãy chấp nhận lời xin lỗi chân thành của tôi.' },
          { context: 'Học tập', en: 'The school will accept applications until Friday.', vi: 'Trường sẽ nhận đơn đăng ký đến thứ Sáu.' },
          { context: 'Cụm từ', en: 'We must accept responsibility for the mistake.', vi: 'Chúng ta phải nhận trách nhiệm về sai sót này.' },
        ],
        collocations: [{ phrase: 'accept responsibility', meaning: 'nhận trách nhiệm' }],
        mnemonicTip: 'Liên tưởng accept với đồng ý nhận.',
        wordFamily: 'acceptable, acceptance',
      }),
    },
  }],
  usage: { prompt_tokens: 120, completion_tokens: 240, total_tokens: 360 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const env = {
  XTROUTER_API_KEY: 'server-only-test-key',
  AI_FREE_MODEL: 'mistralai/mistral-large-2512',
  AI_PAID_MODEL: 'x-ai/grok-build-0.1',
  AI_BASE_URL: 'https://api.xkiro.com/v1',
  ALLOWED_ORIGINS: 'http://localhost:5173',
  VOCAB_CACHE: {
    get: async (key, type) => {
      kvReadCount += 1;
      const value = serverCache.get(key);
      return type === 'json' && value ? JSON.parse(value) : value || null;
    },
    put: async (key, value) => { serverCache.set(key, value); },
    delete: async (key) => { serverCache.delete(key); },
  },
  METRICS: {
    writeDataPoint: (point) => analyticsPoints.push(point),
  },
};

function createD1Mock() {
  const rows = new Map();
  const jobs = new Map();
  const manualReviews = new Map();
  const adminEvents = new Map();
  const states = new Map();
  return {
    rows,
    jobs,
    manualReviews,
    adminEvents,
    states,
    binding: {
      prepare(sql) {
        let values = [];
        return {
          bind(...boundValues) {
            values = boundValues;
            return this;
          },
          async first() {
            if (/FROM system_state/i.test(sql)) return states.get(values[0]) || null;
            if (/COUNT\(\*\) AS total_records/i.test(sql)) {
              const records = [...rows.values()].filter((row) => row.prompt_version === values[0]);
              const parsed = records.map((row) => ({ ...row, payload: JSON.parse(row.payload_json) }));
              return {
                total_records: parsed.length,
                complete_records: parsed.filter((row) => row.status === 'complete').length,
                five_example_records: parsed.filter((row) => row.payload.contextExamples?.length === 5).length,
                clear_meaning_records: parsed.filter((row) => {
                  const meaning = String(row.payload.primaryMeaningVi || '').trim();
                  return meaning.length >= 2 && !meaning.toLowerCase().startsWith('tá»« ');
                }).length,
              };
            }
            if (/COUNT\(\*\) AS open_count/i.test(sql)) {
              return { open_count: [...manualReviews.values()].filter((row) => !row.resolved_at).length };
            }
            if (/FROM vocabulary_enrichments/i.test(sql)) return rows.get(values[0]) || null;
            if (/FROM vocabulary_jobs/i.test(sql)) return jobs.get(values[0]) || null;
            throw new Error('Unexpected D1 SELECT');
          },
          async all() {
            if (/FROM vocabulary_enrichments/i.test(sql) && /GROUP BY status/i.test(sql)) {
              const counts = new Map();
              for (const row of rows.values()) {
                if (row.prompt_version !== values[0]) continue;
                counts.set(row.status, (counts.get(row.status) || 0) + 1);
              }
              return { results: [...counts].map(([status, count]) => ({ status, count })) };
            }
            if (/FROM vocabulary_jobs/i.test(sql) && /GROUP BY status/i.test(sql)) {
              const counts = new Map();
              for (const row of jobs.values()) counts.set(row.status, (counts.get(row.status) || 0) + 1);
              return { results: [...counts].map(([status, count]) => ({ status, count })) };
            }
            if (/FROM vocabulary_manual_review/i.test(sql)) {
              return {
                results: [...manualReviews.entries()]
                  .filter(([, row]) => !row.resolved_at)
                  .map(([word, row]) => ({ word, ...row })),
              };
            }
            if (/FROM vocabulary_admin_events/i.test(sql)) {
              return {
                results: [...adminEvents.entries()].map(([event_id, row]) => ({ event_id, ...row })),
              };
            }
            if (!/FROM vocabulary_enrichments/i.test(sql)) throw new Error('Unexpected D1 list');
            return {
              results: [...rows.values()]
                .filter((row) => row.prompt_version === values[0])
                .map((row) => {
                  const payload = JSON.parse(row.payload_json);
                  return {
                    word: row.word,
                    status: row.status,
                    example_count: payload.contextExamples?.length || 0,
                    meaning_vi: payload.primaryMeaningVi || '',
                    updated_at: row.updated_at,
                  };
                })
                .filter((row) => row.status !== 'complete' || row.example_count !== 5 || !row.meaning_vi),
            };
          },
          async run() {
            if (/INSERT INTO vocabulary_enrichments/i.test(sql)) {
              rows.set(values[0], {
                word: values[1],
                prompt_version: values[2],
                status: values[3],
                payload_json: values[4],
                provider: values[5],
                model: values[6],
                updated_at: values[7],
              });
            } else if (/INSERT INTO vocabulary_jobs/i.test(sql)) {
              jobs.set(values[0], {
                status: values[2],
                attempts: values[3],
                next_retry_at: values[4],
                last_error: values[5],
                last_provider_errors_json: values[6],
                updated_at: values[7],
              });
            } else if (/INSERT INTO vocabulary_manual_review/i.test(sql)) {
              manualReviews.set(values[0], {
                reason: values[2],
                attempts: values[3],
                created_at: values[4],
              });
            } else if (/UPDATE vocabulary_manual_review/i.test(sql)) {
              const current = manualReviews.get(values[0]);
              if (current) manualReviews.set(values[0], { ...current, resolved_at: values[2] });
            } else if (/INSERT INTO vocabulary_admin_events/i.test(sql)) {
              adminEvents.set(values[0], {
                action: values[1],
                word: values[2],
                payload_json: values[3],
                created_at: values[4],
              });
            } else if (/INSERT INTO system_state/i.test(sql)) {
              states.set(values[0], { payload_json: values[1], updated_at: values[2] });
            } else {
              throw new Error('Unexpected D1 mutation');
            }
            return { success: true };
          },
        };
      },
    },
  };
}
const pending = [];
const context = { waitUntil: (promise) => pending.push(promise) };
const speakingPreflightResponse = await worker.fetch(
  new Request('http://localhost:8787/api/speaking/chat', {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:5173' },
  }),
  env,
  context,
);
assert.equal(speakingPreflightResponse.status, 204);
assert.match(speakingPreflightResponse.headers.get('Access-Control-Allow-Headers'), /X-Idempotency-Key/);
const healthResponse = await worker.fetch(
  new Request('http://localhost:8787/health', { headers: { Origin: 'http://localhost:5173' } }),
  env,
  context,
);
const healthPayload = await healthResponse.json();
assert.equal(healthPayload.model, 'mistralai/mistral-large-2512');
assert.equal(healthPayload.freeModel, 'mistralai/mistral-large-2512');
assert.equal(healthPayload.paidFallbackModel, 'x-ai/grok-build-0.1');
assert.equal(healthPayload.paidFallbackConfigured, true);
assert.equal(healthPayload.groqConfigured, false);
assert.equal(healthPayload.workersAiConfigured, false);
assert.equal(healthPayload.openRouterConfigured, false);
assert.equal(healthPayload.freeProviderStrategy, 'single-provider');
assert.equal(healthPayload.serverStorageConfigured, true);
assert.match(healthResponse.headers.get('X-Request-ID'), /^[a-f0-9-]{36}$/);
assert.match(healthResponse.headers.get('Server-Timing'), /^app;dur=\d+$/);
assert.equal(healthResponse.headers.get('X-Content-Type-Options'), 'nosniff');
assert.equal(healthResponse.headers.get('X-Frame-Options'), 'DENY');
assert.equal(healthResponse.headers.get('Referrer-Policy'), 'no-referrer');
assert.match(healthResponse.headers.get('Content-Security-Policy'), /default-src 'none'/);
assert.match(healthResponse.headers.get('Strict-Transport-Security'), /max-age=31536000/);

const forbiddenOriginResponse = await worker.fetch(
  new Request('http://localhost:8787/health', { headers: { Origin: 'https://attacker.example' } }),
  env,
  context,
);
assert.equal(forbiddenOriginResponse.status, 403);
assert.equal(forbiddenOriginResponse.headers.get('Access-Control-Allow-Origin'), 'null');

const invalidContentTypeResponse = await worker.fetch(new Request('http://localhost:8787/api/vocabulary/batch', {
  method: 'POST',
  headers: { Origin: 'http://localhost:5173' },
  body: JSON.stringify({ items: [{ word: 'accept' }] }),
}), env, context);
assert.equal(invalidContentTypeResponse.status, 415);
assert.equal((await invalidContentTypeResponse.json()).code, 'UNSUPPORTED_MEDIA_TYPE');

const limitedEnv = { ...env, RATE_LIMIT_READ_PER_MINUTE: '2' };
const createRateLimitedRequest = () => new Request('http://localhost:8787/api/vocabulary/batch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'http://localhost:5173',
    'CF-Connecting-IP': '203.0.113.77',
  },
  body: JSON.stringify({ items: [{ word: 'rate-limit-check' }] }),
});
assert.equal((await worker.fetch(createRateLimitedRequest(), limitedEnv, context)).status, 200);
assert.equal((await worker.fetch(createRateLimitedRequest(), limitedEnv, context)).status, 200);
const rateLimitedResponse = await worker.fetch(createRateLimitedRequest(), limitedEnv, context);
assert.equal(rateLimitedResponse.status, 429);
assert.equal(rateLimitedResponse.headers.get('RateLimit-Limit'), '2');
assert.match(rateLimitedResponse.headers.get('Retry-After'), /^\d+$/);
assert.equal((await rateLimitedResponse.json()).code, 'RATE_LIMITED');

const androidHealthResponse = await worker.fetch(
  new Request('http://localhost:8787/health', {
    headers: { Origin: 'https://appassets.androidplatform.net' },
  }),
  env,
  context,
);
assert.equal(
  androidHealthResponse.headers.get('Access-Control-Allow-Origin'),
  'https://appassets.androidplatform.net',
  'the bundled Kotlin app origin must be accepted by CORS',
);

serverCache.set('system-vocabulary:v1', JSON.stringify({
  schemaVersion: 1,
  contentHash: 'catalog-test-hash',
  count: 3000,
  words: Array.from({ length: 3000 }, (_, index) => ({
    id: index + 1,
    word: `word ${index + 1}`,
    meaning: `nghĩa ${index + 1}`,
    example: `This is system word ${index + 1}.`,
    exampleVi: `Đây là từ hệ thống ${index + 1}.`,
  })),
}));
const catalogResponse = await worker.fetch(
  new Request('http://localhost:8787/api/vocabulary/catalog', { headers: { Origin: 'http://localhost:5173' } }),
  env,
  context,
);
const catalogPayload = await catalogResponse.json();
assert.equal(catalogResponse.status, 200);
assert.equal(catalogResponse.headers.get('X-LingoGoc-Source'), 'KV');
assert.equal(catalogPayload.data.words.length, 3000);
const manifestResponse = await worker.fetch(
  new Request('http://localhost:8787/api/vocabulary/manifest', { headers: { Origin: 'http://localhost:5173' } }),
  env,
  context,
);
const manifestPayload = await manifestResponse.json();
assert.equal(manifestResponse.status, 200);
assert.equal(manifestPayload.data.contentHash, 'catalog-test-hash');
assert.equal(manifestPayload.data.count, 3000);
serverCache.set('system-vocabulary:backfill:v1', JSON.stringify({
  contentHash: 'catalog-test-hash',
  cursor: 17,
  generated: 4,
  status: 'quota_wait',
  nextRunAt: new Date(Date.now() + 60_000).toISOString(),
}));
const scheduledPending = [];
await worker.scheduled(
  { scheduledTime: Date.now(), cron: '0 * * * *' },
  env,
  { waitUntil: (promise) => scheduledPending.push(promise) },
);
await Promise.all(scheduledPending);
const backfillStatusResponse = await worker.fetch(
  new Request('http://localhost:8787/api/vocabulary/backfill/status', { headers: { Origin: 'http://localhost:5173' } }),
  env,
  context,
);
const backfillStatusPayload = await backfillStatusResponse.json();
assert.equal(backfillStatusResponse.status, 200);
assert.equal(backfillStatusPayload.data.status, 'quota_wait');
assert.equal(backfillStatusPayload.data.cursor, 17);
assert.equal(backfillStatusPayload.data.totalWords, 3000);
assert.equal(backfillStatusPayload.data.schedule, 'hourly (UTC)');
const operationsResponse = await worker.fetch(
  new Request('http://localhost:8787/api/operations/status', {
    headers: { Origin: 'http://localhost:5173', 'X-Request-ID': 'contract-request-123' },
  }),
  env,
  context,
);
const operationsPayload = await operationsResponse.json();
assert.equal(operationsResponse.status, 200);
assert.equal(operationsResponse.headers.get('X-Request-ID'), 'contract-request-123');
assert.equal(operationsResponse.headers.get('Cache-Control'), 'no-store');
assert.equal(operationsPayload.data.storage.configured, true);
assert.equal(operationsPayload.data.storage.kvConfigured, true);
assert.equal(operationsPayload.data.storage.d1Configured, false);
assert.equal(operationsPayload.data.storage.durableSource, 'KV');
assert.equal(operationsPayload.data.providers.xkiro.configured, true);
assert.equal(operationsPayload.data.providers.xkiro.health.successes, 0);
assert.equal(operationsPayload.data.providers.xkiro.health.circuitOpen, false);
assert.equal(operationsPayload.data.backfill.cursor, 17);
assert.equal(operationsPayload.data.thresholds.slowRequestMs, 1500);
assert.equal(operationsPayload.data.thresholds.providerHedgeDelayMs, 1500);
assert.equal(providerCallCount, 0, 'paused scheduled backfill must not call the AI provider');
serverCache.delete('system-vocabulary:v1');
serverCache.delete('system-vocabulary:backfill:v1');

const request = new Request('http://localhost:8787/api/vocabulary/enrich', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ word: 'accept', meaning: 'chấp nhận', topic: 'Công việc' }),
});

const response = await worker.fetch(request, env, context);
const payload = await response.json();
await Promise.all(pending);

assert.equal(response.status, 200);
assert.equal(payload.data.contextExamples.length, 5);
assert.equal(payload.data.contextExamples[0].vi, 'Ở đây họ chấp nhận thanh toán bằng thẻ.');
assert.equal(payload.data.isAiGenerated, true);
assert.ok(cachedResponse);
assert.equal(JSON.stringify(payload).includes(env.XTROUTER_API_KEY), false);
assert.equal(providerRequest.url, 'https://api.xkiro.com/v1/chat/completions');
assert.equal(providerRequest.options.headers.Authorization, `Bearer ${env.XTROUTER_API_KEY}`);
assert.equal(providerRequest.body.model, 'mistralai/mistral-large-2512');
assert.equal(providerCallCount, 1);
assert.equal(payload.data.persistedOnServer, true);
assert.equal(serverCache.size, 1);

const providerMetricsResponse = await worker.fetch(
  new Request('http://localhost:8787/api/operations/status', { headers: { Origin: 'http://localhost:5173' } }),
  env,
  context,
);
const providerMetricsPayload = await providerMetricsResponse.json();
assert.equal(providerMetricsPayload.data.providers.xkiro.health.successes, 1);
assert.equal(providerMetricsPayload.data.providers.xkiro.health.totalTokens, 360);
assert.ok(providerMetricsPayload.data.cache.total >= 1);
assert.ok(providerMetricsPayload.data.cache.misses >= 1);
assert.equal(providerMetricsPayload.data.cache.byStatus.MISS, 1);
assert.ok(providerMetricsPayload.data.cache.hitRate >= 0 && providerMetricsPayload.data.cache.hitRate <= 1);
assert.ok(analyticsPoints.some((point) => point.indexes[0] === 'XKIRO_FREE'));
assert.ok(analyticsPoints.some((point) => point.indexes[0] === 'CACHE'));

const batchResponse = await worker.fetch(new Request('http://localhost:8787/api/vocabulary/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ items: [{ word: 'accept', pos: 'v' }, { word: 'not-ready', pos: 'adj' }] }),
}), env, context);
const batchPayload = await batchResponse.json();
assert.equal(batchResponse.status, 200);
assert.equal(batchPayload.data.items[0].word, 'accept');
assert.equal(batchPayload.data.items[0].enrichment.contextExamples.length, 5);
assert.deepEqual(batchPayload.data.missing, ['not-ready']);
assert.deepEqual(batchPayload.data.needsEnrichment, ['not-ready']);
assert.equal(providerCallCount, 1, 'batch reads must never call the AI provider');
assert.equal(batchResponse.headers.get('X-LingoGoc-Cache'), 'MISS-BATCH');
const readsAfterFirstBatch = kvReadCount;
const repeatedBatchResponse = await worker.fetch(new Request('http://localhost:8787/api/vocabulary/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ items: [{ word: 'accept', pos: 'v' }, { word: 'not-ready', pos: 'adj' }] }),
}), env, context);
assert.equal(repeatedBatchResponse.status, 200);
assert.equal(repeatedBatchResponse.headers.get('X-LingoGoc-Cache'), 'HIT-BATCH');
assert.equal(kvReadCount, readsAfterFirstBatch, 'a repeated batch must not read KV again');
assert.deepEqual((await repeatedBatchResponse.json()).data.missing, ['not-ready']);

const kvResponse = await worker.fetch(new Request('http://localhost:8787/api/vocabulary/enrich', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ word: 'accept', meaning: 'chấp nhận', topic: 'Công việc' }),
}), env, context);
const kvPayload = await kvResponse.json();
assert.equal(kvResponse.headers.get('X-LingoGoc-Cache'), 'HIT');
assert.equal(kvPayload.data.persistedOnServer, true);
assert.equal(providerCallCount, 1);

const edgePromotionD1 = createD1Mock();
const providerCallsBeforeEdgePromotion = providerCallCount;
const edgePromotionResponse = await worker.fetch(new Request('http://localhost:8787/api/vocabulary/enrich', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ word: 'accept', meaning: 'cháº¥p nháº­n', topic: 'CÃ´ng viá»‡c' }),
}), {
  ...env,
  VOCAB_DB: edgePromotionD1.binding,
  VOCAB_CACHE: {
    ...env.VOCAB_CACHE,
    get: async (key, type) => (key.startsWith('vocabulary:v') ? null : env.VOCAB_CACHE.get(key, type)),
  },
}, context);
assert.equal(edgePromotionResponse.status, 200);
assert.equal(edgePromotionResponse.headers.get('X-LingoGoc-Cache'), 'EDGE+D1');
assert.equal(edgePromotionD1.rows.size, 1, 'legacy Edge Cache data must be promoted to D1');
assert.equal(providerCallCount, providerCallsBeforeEdgePromotion, 'Edge-to-D1 promotion must not call AI');

const d1Mock = createD1Mock();
vocabularyEdgeCache.clear();
const kvWriteFailEnv = {
  ...env,
  VOCAB_DB: d1Mock.binding,
  VOCAB_CACHE: {
    ...env.VOCAB_CACHE,
    get: async (key, type) => {
      if (key.startsWith('vocabulary:v')) return null;
      return env.VOCAB_CACHE.get(key, type);
    },
    put: async (key, value) => {
      if (key.startsWith('vocabulary:v')) throw new Error('KV_WRITE_LIMIT');
      serverCache.set(key, value);
    },
  },
};
const providerCallsBeforeD1 = providerCallCount;
const d1PersistResponse = await worker.fetch(new Request('http://localhost:8787/api/vocabulary/enrich', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ word: 'accept', meaning: 'cháº¥p nháº­n', topic: 'CÃ´ng viá»‡c', force: true }),
}), kvWriteFailEnv, context);
const d1PersistPayload = await d1PersistResponse.json();
assert.equal(d1PersistResponse.status, 200);
assert.equal(d1PersistPayload.data.persistedOnServer, true);
assert.equal(d1PersistPayload.data.cacheWritePending, true);
assert.equal(d1Mock.rows.size, 1, 'D1 must retain enrichment when the KV cache write fails');
assert.equal(d1Mock.jobs.get('accept').status, 'complete');
assert.equal(providerCallCount, providerCallsBeforeD1 + 1);

vocabularyEdgeCache.clear();
const providerCallsBeforeD1Read = providerCallCount;
const d1ReadResponse = await worker.fetch(new Request('http://localhost:8787/api/vocabulary/enrich', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ word: 'accept', meaning: 'cháº¥p nháº­n', topic: 'CÃ´ng viá»‡c' }),
}), kvWriteFailEnv, context);
assert.equal(d1ReadResponse.status, 200);
assert.equal(d1ReadResponse.headers.get('X-LingoGoc-Cache'), 'D1');
assert.equal(providerCallCount, providerCallsBeforeD1Read, 'D1 hit must never call an AI provider');

const d1AuditResponse = await worker.fetch(
  new Request('http://localhost:8787/api/vocabulary/audit', { headers: { Origin: 'http://localhost:5173' } }),
  kvWriteFailEnv,
  context,
);
const d1AuditPayload = await d1AuditResponse.json();
assert.equal(d1AuditResponse.status, 200);
assert.equal(d1AuditResponse.headers.get('Cache-Control'), 'no-store');
assert.equal(d1AuditPayload.data.totalRecords, 1);
assert.equal(d1AuditPayload.data.completeRecords, 1);
assert.equal(d1AuditPayload.data.fiveExampleRecords, 1);
assert.equal(d1AuditPayload.data.missingRecords, 2999);
assert.equal(d1AuditPayload.data.releaseReady, false);

const unauthorizedAdminResponse = await worker.fetch(
  new Request('http://localhost:8787/api/admin/vocabulary', { headers: { Origin: 'http://localhost:5173' } }),
  { ...kvWriteFailEnv, ADMIN_API_KEY: 'admin-test-key' },
  context,
);
assert.equal(unauthorizedAdminResponse.status, 401);
assert.equal((await unauthorizedAdminResponse.json()).code, 'ADMIN_UNAUTHORIZED');
const adminResponse = await worker.fetch(
  new Request('http://localhost:8787/api/admin/vocabulary?limit=10&offset=0', {
    headers: { Origin: 'http://localhost:5173', Authorization: 'Bearer admin-test-key' },
  }),
  { ...kvWriteFailEnv, ADMIN_API_KEY: 'admin-test-key' },
  context,
);
const adminPayload = await adminResponse.json();
assert.equal(adminResponse.status, 200);
assert.equal(adminResponse.headers.get('Cache-Control'), 'no-store');
assert.equal(adminPayload.data.enrichmentCounts.complete, 1);
assert.equal(adminPayload.data.jobCounts.complete, 1);
assert.deepEqual(adminPayload.data.issues, []);
assert.deepEqual(adminPayload.data.manualReview, []);
assert.deepEqual(adminPayload.data.auditEvents, []);

d1Mock.manualReviews.set('accept', {
  reason: 'INSUFFICIENT_BILINGUAL_EXAMPLES',
  attempts: 5,
  created_at: new Date().toISOString(),
  resolved_at: null,
});
const callsBeforeAdminRetry = providerCallCount;
const adminRetryResponse = await worker.fetch(
  new Request('http://localhost:8787/api/admin/vocabulary/retry', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173',
      Authorization: 'Bearer admin-test-key',
    },
    body: JSON.stringify({ word: 'accept' }),
  }),
  { ...kvWriteFailEnv, ADMIN_API_KEY: 'admin-test-key' },
  context,
);
const adminRetryPayload = await adminRetryResponse.json();
assert.equal(adminRetryResponse.status, 202);
assert.equal(adminRetryPayload.data.status, 'retry_pending');
assert.equal(adminRetryPayload.data.aiCalled, false);
assert.equal(providerCallCount, callsBeforeAdminRetry, 'queueing an admin retry must not spend AI tokens');
assert.equal(d1Mock.jobs.get('accept').status, 'retry_pending');
assert.ok(d1Mock.manualReviews.get('accept').resolved_at);
assert.equal([...d1Mock.adminEvents.values()][0].word, 'accept');
const adminAfterRetryResponse = await worker.fetch(
  new Request('http://localhost:8787/api/admin/vocabulary', {
    headers: { Origin: 'http://localhost:5173', Authorization: 'Bearer admin-test-key' },
  }),
  { ...kvWriteFailEnv, ADMIN_API_KEY: 'admin-test-key' },
  context,
);
const adminAfterRetryPayload = await adminAfterRetryResponse.json();
assert.equal(adminAfterRetryPayload.data.jobCounts.retry_pending, 1);
assert.equal(adminAfterRetryPayload.data.auditEvents[0].action, 'retry_queued');

const adminCorrectionExamples = [
  { context: 'Daily life', en: 'I accept the package at the door.', vi: 'Tôi nhận gói hàng ở cửa.' },
  { context: 'Work', en: 'We accept the revised proposal.', vi: 'Chúng tôi chấp nhận đề xuất đã sửa.' },
  { context: 'Study', en: 'The school will accept my application.', vi: 'Trường sẽ nhận đơn của tôi.' },
  { context: 'Conversation', en: 'Can you accept my apology?', vi: 'Bạn có thể chấp nhận lời xin lỗi của tôi không?' },
  { context: 'Collocation', en: 'Leaders accept responsibility for mistakes.', vi: 'Lãnh đạo nhận trách nhiệm về sai sót.' },
];
const callsBeforeCorrection = providerCallCount;
const invalidCorrectionResponse = await worker.fetch(
  new Request('http://localhost:8787/api/admin/vocabulary/correction', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173',
      Authorization: 'Bearer admin-test-key',
    },
    body: JSON.stringify({ word: 'accept', enrichment: { primaryMeaningVi: 'chấp nhận', contextExamples: [] } }),
  }),
  { ...kvWriteFailEnv, ADMIN_API_KEY: 'admin-test-key' },
  context,
);
assert.equal(invalidCorrectionResponse.status, 400);
const correctionResponse = await worker.fetch(
  new Request('http://localhost:8787/api/admin/vocabulary/correction', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173',
      Authorization: 'Bearer admin-test-key',
    },
    body: JSON.stringify({
      word: 'accept',
      note: 'Reviewed by operator',
      enrichment: { primaryMeaningVi: 'chấp nhận; tiếp nhận', contextExamples: adminCorrectionExamples },
    }),
  }),
  { ...kvWriteFailEnv, ADMIN_API_KEY: 'admin-test-key' },
  context,
);
const correctionPayload = await correctionResponse.json();
await Promise.all(pending.splice(0));
assert.equal(correctionResponse.status, 200);
assert.equal(correctionPayload.data.isAiGenerated, false);
assert.equal(correctionPayload.data.contextExamples.length, 5);
assert.equal(providerCallCount, callsBeforeCorrection, 'manual correction must not call AI');
assert.equal(d1Mock.jobs.get('accept').status, 'complete');
assert.equal([...d1Mock.adminEvents.values()].at(-1).action, 'manual_correction');

const noD1AuditResponse = await worker.fetch(
  new Request('http://localhost:8787/api/vocabulary/audit', { headers: { Origin: 'http://localhost:5173' } }),
  env,
  context,
);
assert.equal(noD1AuditResponse.status, 503);
assert.equal((await noD1AuditResponse.json()).code, 'D1_NOT_CONFIGURED');

const parallelProviderUrls = [];
customProviderResponse = async ({ url }) => {
  parallelProviderUrls.push(url);
  if (url.startsWith(env.AI_BASE_URL)) {
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
    replyEn: 'How can I help you today?',
    replyVi: 'HÃ´m nay tÃ´i cÃ³ thá»ƒ giÃºp gÃ¬ cho báº¡n?',
    correction: '',
    encouragement: 'Great start!',
    hints: [],
  }) } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
const parallelResponse = await worker.fetch(new Request('http://localhost:8787/api/speaking/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ scenario: 'Daily conversation', messages: [{ role: 'user', content: 'Hello' }] }),
}), {
  ...env,
  OPENROUTER_API_KEY: 'openrouter-test-key',
  OPENROUTER_FREE_MODEL: 'deepseek/deepseek-v4-flash-0731:free',
  OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
  OPENROUTER_SITE_URL: 'https://example.com',
  OPENROUTER_APP_NAME: 'LingoGoc Test',
}, context);
const parallelPayload = await parallelResponse.json();
assert.equal(parallelResponse.status, 200);
assert.equal(parallelProviderUrls.length, 1, 'a normal fast request must call only one free provider');
assert.equal(
  parallelPayload.generatedByModel,
  parallelProviderUrls[0].startsWith('https://openrouter.ai/api/v1')
    ? 'deepseek/deepseek-v4-flash-0731:free'
    : 'mistralai/mistral-large-2512',
);

let idempotentProviderCalls = 0;
customProviderResponse = async () => {
  idempotentProviderCalls += 1;
  await new Promise((resolve) => setTimeout(resolve, 20));
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
    replyEn: 'Your saved speaking reply is ready.',
    replyVi: 'Câu trả lời luyện nói đã sẵn sàng.',
    correction: 'Your sentence is correct.',
    encouragement: 'Keep going!',
    hints: [{ en: 'What would you recommend?', vi: 'Bạn đề xuất món nào?' }],
    scores: { grammar: 104, vocabulary: 82.2, fluency: -4, pronunciation: 100 },
  }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const createIdempotentSpeakingRequest = () => new Request('http://localhost:8787/api/speaking/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'http://localhost:5173',
    'X-Idempotency-Key': 'speaking:test-session:turn-1',
  },
  body: JSON.stringify({
    requestId: 'speaking:test-session:turn-1',
    scenario: 'Coffee shop',
    messages: [{ role: 'user', content: 'A coffee, please.' }],
  }),
});
const [idempotentFirst, idempotentConcurrent] = await Promise.all([
  worker.fetch(createIdempotentSpeakingRequest(), env, context),
  worker.fetch(createIdempotentSpeakingRequest(), env, context),
]);
const idempotentFirstPayload = await idempotentFirst.json();
assert.equal(idempotentFirst.status, 200);
assert.equal(idempotentConcurrent.status, 200);
assert.equal(idempotentProviderCalls, 1, 'concurrent speaking retries must share one provider call');
assert.deepEqual(idempotentFirstPayload.scores, { grammar: 100, vocabulary: 82, fluency: 0 });
assert.equal('pronunciation' in idempotentFirstPayload.scores, false, 'AI must not fabricate pronunciation');
const idempotentCached = await worker.fetch(createIdempotentSpeakingRequest(), env, context);
assert.equal(idempotentCached.status, 200);
assert.equal(idempotentCached.headers.get('X-LingoGoc-Cache'), 'HIT');
assert.equal(idempotentProviderCalls, 1, 'completed speaking retries must reuse the cached response');
customProviderResponse = null;

const adaptiveHedgeUrls = [];
customProviderResponse = async ({ url, body }) => {
  adaptiveHedgeUrls.push(url);
  if (adaptiveHedgeUrls.length === 1) {
    await new Promise((resolve) => setTimeout(resolve, 1_700));
  }
  return new Response(JSON.stringify({
    model: body.model,
    choices: [{ message: { content: JSON.stringify({
      replyEn: 'The adaptive fallback is ready.',
      replyVi: 'Phương án dự phòng thích ứng đã sẵn sàng.',
      correction: '',
      encouragement: 'Great!',
      hints: [],
    }) } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const adaptiveHedgeResponse = await worker.fetch(new Request('http://localhost:8787/api/speaking/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ scenario: 'Adaptive hedge', messages: [{ role: 'user', content: 'Hello' }] }),
}), {
  ...env,
  OPENROUTER_API_KEY: 'openrouter-test-key',
  OPENROUTER_FREE_MODEL: 'deepseek/deepseek-v4-flash-0731:free',
  OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
}, context);
assert.equal(adaptiveHedgeResponse.status, 200);
assert.equal(adaptiveHedgeUrls.length, 2, 'a slow primary must start exactly one adaptive hedge');
customProviderResponse = null;

const allProviderUrls = [];
let workersAiCalls = 0;
customProviderResponse = async ({ url, body }) => {
  allProviderUrls.push(url);
  if (!url.startsWith('https://api.groq.com/openai/v1')) {
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  return new Response(JSON.stringify({
    model: body.model,
    choices: [{ message: { content: JSON.stringify({
      replyEn: 'All providers are ready.',
      replyVi: 'Tất cả nhà cung cấp đã sẵn sàng.',
      correction: '',
      encouragement: 'Great!',
      hints: [],
    }) } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const allProviderResponse = await worker.fetch(new Request('http://localhost:8787/api/speaking/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ scenario: 'Daily conversation', messages: [{ role: 'user', content: 'Hello again' }] }),
}), {
  ...env,
  GROQ_API_KEY: 'groq-test-key',
  GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
  GROQ_FREE_MODEL: 'qwen/qwen3.8-27b',
  OPENROUTER_API_KEY: 'openrouter-test-key',
  OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
  AI: {
    run: async () => {
      workersAiCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { response: JSON.stringify({ replyEn: 'Cloudflare ready.', replyVi: 'Cloudflare sẵn sàng.' }) };
    },
  },
}, context);
const allProviderPayload = await allProviderResponse.json();
assert.equal(allProviderResponse.status, 200);
assert.ok(allProviderPayload.generatedByModel);
assert.equal(allProviderUrls.length + workersAiCalls, 1, 'healthy-provider routing must avoid unconditional races');
customProviderResponse = null;

let circuitProviderCalls = 0;
const circuitEnv = {
  ...env,
  XTROUTER_API_KEY: '',
  AI_API_KEY: '',
  AI_PAID_MODEL: '',
  AI: {
    run: async () => {
      circuitProviderCalls += 1;
      return { response: '' };
    },
  },
};
for (let attempt = 0; attempt < 3; attempt += 1) {
  const circuitFailureResponse = await worker.fetch(new Request('http://localhost:8787/api/speaking/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
    body: JSON.stringify({ scenario: 'Circuit test', messages: [{ role: 'user', content: 'Hello' }] }),
  }), circuitEnv, context);
  assert.equal(circuitFailureResponse.status, 502);
}
const openCircuitResponse = await worker.fetch(new Request('http://localhost:8787/api/speaking/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ scenario: 'Circuit test', messages: [{ role: 'user', content: 'Hello again' }] }),
}), circuitEnv, context);
assert.equal(openCircuitResponse.status, 503);
assert.equal(circuitProviderCalls, 3, 'open circuit must suppress another provider call');
const circuitStatusResponse = await worker.fetch(
  new Request('http://localhost:8787/api/operations/status', { headers: { Origin: 'http://localhost:5173' } }),
  circuitEnv,
  context,
);
const circuitStatusPayload = await circuitStatusResponse.json();
assert.equal(circuitStatusPayload.data.providers.workersAi.health.circuitOpen, true);
assert.equal(circuitStatusPayload.data.providers.workersAi.health.consecutiveFailures, 3);

const exploreExamples = [
  { context: 'Đời sống', en: 'We explore the old town on foot.', vi: 'Chúng tôi khám phá khu phố cổ bằng cách đi bộ.' },
  { context: 'Công việc', en: 'The team will explore several new ideas.', vi: 'Nhóm sẽ tìm hiểu một số ý tưởng mới.' },
  { context: 'Học tập', en: 'Students explore how plants grow.', vi: 'Học sinh tìm hiểu cách cây cối phát triển.' },
  { context: 'Hội thoại', en: 'Would you like to explore this area with me?', vi: 'Bạn có muốn khám phá khu vực này cùng tôi không?' },
  { context: 'Cụm từ', en: 'The report explores the issue in depth.', vi: 'Báo cáo tìm hiểu vấn đề một cách sâu sắc.' },
];
const validationFailoverUrls = [];
customProviderResponse = async ({ url, body }) => {
  validationFailoverUrls.push(url);
  const isFirstAttempt = validationFailoverUrls.length === 1;
  const content = JSON.stringify({
    primaryMeaningVi: isFirstAttempt ? 'to travel around and learn about a place' : 'khám phá; tìm hiểu',
    contextExamples: exploreExamples,
  });
  return new Response(JSON.stringify({ model: body.model, choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
const validationFailoverResponse = await worker.fetch(new Request('http://localhost:8787/api/vocabulary/enrich', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ word: 'explore', meaning: "từ 'explore' (v)", topic: 'Đời sống' }),
}), {
  ...env,
  AI_ROUTING_MODE: 'background',
  AI_PAID_MODEL: '',
  GROQ_API_KEY: 'groq-test-key',
  GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
  OPENROUTER_API_KEY: 'openrouter-test-key',
  OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
}, context);
const validationFailoverPayload = await validationFailoverResponse.json();
assert.equal(validationFailoverResponse.status, 200);
assert.equal(validationFailoverPayload.data.contextExamples.length, 5);
assert.equal(validationFailoverPayload.data.primaryMeaningVi, 'khám phá; tìm hiểu');
assert.equal(validationFailoverUrls.length, 2, 'background routing must fail over sequentially after invalid content');
assert.ok(validationFailoverPayload.data.generatedByProvider.endsWith('_FREE'));

customProviderResponse = async ({ body }) => new Response(JSON.stringify({
  model: body.model,
  choices: [{ message: { content: JSON.stringify({
    primaryMeaningVi: 'khảo sát; xem xét',
    contextExamples: [
      { context: 'Công việc', en: 'We survey the customers every month.', vi: 'Chúng tôi khảo sát khách hàng mỗi tháng.' },
    ],
  }) } }],
}), { status: 200, headers: { 'Content-Type': 'application/json' } });
const partialResponse = await worker.fetch(new Request('http://localhost:8787/api/vocabulary/enrich', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ word: 'survey', meaning: "từ 'survey' (v)", topic: 'Công việc' }),
}), {
  ...env,
  XTROUTER_API_KEY: '',
  AI_PAID_MODEL: '',
  GROQ_API_KEY: 'groq-test-key',
  GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
}, context);
assert.equal(partialResponse.status, 502);
const partialBatchResponse = await worker.fetch(new Request('http://localhost:8787/api/vocabulary/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ items: [{ word: 'survey', pos: 'v' }] }),
}), env, context);
const partialBatchPayload = await partialBatchResponse.json();
assert.equal(partialBatchPayload.data.items[0].meaningVi, 'khảo sát; xem xét');
assert.equal(partialBatchPayload.data.items[0].status, 'partial');
assert.deepEqual(partialBatchPayload.data.needsEnrichment, ['survey']);
const cooldownResponse = await worker.fetch(new Request('http://localhost:8787/api/vocabulary/enrich', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ word: 'survey', meaning: "từ 'survey' (v)", topic: 'Công việc' }),
}), env, context);
const cooldownPayload = await cooldownResponse.json();
assert.equal(cooldownResponse.status, 429);
assert.equal(cooldownPayload.code, 'ENRICHMENT_COOLDOWN');
assert.ok(Date.parse(cooldownPayload.nextRetryAt) > Date.now());
let requestedMissingExamples = null;
customProviderResponse = async ({ body }) => {
  const input = JSON.parse(body.messages.at(-1).content);
  requestedMissingExamples = input.missingExampleCount;
  const content = JSON.stringify({
    primaryMeaningVi: 'khảo sát; xem xét',
    contextExamples: [
      { context: 'Đời sống', en: 'They survey the neighborhood before moving.', vi: 'Họ khảo sát khu phố trước khi chuyển đến.' },
      { context: 'Học tập', en: 'Students survey local wildlife for the project.', vi: 'Học sinh khảo sát động vật địa phương cho dự án.' },
      { context: 'Hội thoại', en: 'Can we survey the area this afternoon?', vi: 'Chúng ta có thể khảo sát khu vực vào chiều nay không?' },
      { context: 'Cụm từ', en: 'Engineers conduct a survey of the bridge.', vi: 'Các kỹ sư tiến hành khảo sát cây cầu.' },
    ],
  });
  return new Response(JSON.stringify({ model: body.model, choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
const completedPartialResponse = await worker.fetch(new Request('http://localhost:8787/api/vocabulary/enrich', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ word: 'survey', meaning: "từ 'survey' (v)", topic: 'Công việc', force: true }),
}), {
  ...env,
  XTROUTER_API_KEY: '',
  AI_PAID_MODEL: '',
  GROQ_API_KEY: 'groq-test-key',
  GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
}, context);
const completedPartialPayload = await completedPartialResponse.json();
assert.equal(completedPartialResponse.status, 200);
assert.equal(requestedMissingExamples, 4);
assert.equal(completedPartialPayload.data.contextExamples.length, 5);
customProviderResponse = null;

const fallbackModels = [];
customProviderResponse = async ({ body }) => {
  fallbackModels.push(body.model);
  if (body.model === env.AI_FREE_MODEL) {
    return new Response(JSON.stringify({ error: 'Daily quota exhausted' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
    primaryMeaningVi: 'bản sao lưu; phương án dự phòng',
    contextExamples: [
      { context: 'Đời sống', en: 'Keep a backup of your photos.', vi: 'Hãy giữ một bản sao lưu ảnh của bạn.' },
      { context: 'Công việc', en: 'The team created a backup before the update.', vi: 'Nhóm đã tạo bản sao lưu trước khi cập nhật.' },
      { context: 'Học tập', en: 'My backup notes helped me revise.', vi: 'Ghi chú dự phòng giúp tôi ôn tập.' },
      { context: 'Hội thoại', en: 'Do you have a backup plan?', vi: 'Bạn có phương án dự phòng không?' },
      { context: 'Cụm từ', en: 'We always keep a backup copy.', vi: 'Chúng tôi luôn giữ một bản sao dự phòng.' },
    ],
  }) } }], usage: { prompt_tokens: 1000, completion_tokens: 2000, total_tokens: 3000 } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
const fallbackResponse = await worker.fetch(new Request('http://localhost:8787/api/vocabulary/enrich', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ word: 'backup', meaning: 'bản sao lưu', topic: 'Công nghệ' }),
}), {
  ...env,
  AI_PAID_INPUT_USD_PER_MILLION: '1',
  AI_PAID_OUTPUT_USD_PER_MILLION: '2',
}, context);
const fallbackPayload = await fallbackResponse.json();
assert.equal(fallbackResponse.status, 200);
assert.deepEqual(fallbackModels, [env.AI_FREE_MODEL, env.AI_PAID_MODEL]);
assert.equal(fallbackPayload.data.generatedByModel, env.AI_PAID_MODEL);
const paidMetricsResponse = await worker.fetch(
  new Request('http://localhost:8787/api/operations/status', { headers: { Origin: 'http://localhost:5173' } }),
  env,
  context,
);
const paidMetricsPayload = await paidMetricsResponse.json();
assert.equal(paidMetricsPayload.data.providers.paidFallback.health.estimatedCostUsd, 0.005);
assert.ok(analyticsPoints.some((point) => point.indexes[0] === 'XKIRO_PAID' && point.doubles[4] === 0.005));
customProviderResponse = null;

let regenerationCalls = 0;
const cooldownModels = [];
const patientExamples = [
  { context: 'Đời sống', en: 'Please be patient while I check your order.', vi: 'Vui lòng kiên nhẫn trong lúc tôi kiểm tra đơn hàng.' },
  { context: 'Công việc', en: 'A patient manager listens before making a decision.', vi: 'Một quản lý kiên nhẫn sẽ lắng nghe trước khi quyết định.' },
  { context: 'Học tập', en: 'Be patient with yourself when learning English.', vi: 'Hãy kiên nhẫn với chính mình khi học tiếng Anh.' },
  { context: 'Hội thoại', en: 'Can you be patient for just a few more minutes?', vi: 'Bạn có thể kiên nhẫn thêm vài phút nữa không?' },
  { context: 'Cụm từ', en: 'The doctor was patient with every worried parent.', vi: 'Bác sĩ kiên nhẫn với từng phụ huynh đang lo lắng.' },
];
customProviderResponse = async ({ body }) => {
  regenerationCalls += 1;
  cooldownModels.push(body.model);
  const content = JSON.stringify({
    primaryMeaningVi: 'kiên nhẫn',
    contextExamples: regenerationCalls === 1 ? patientExamples.slice(0, 4) : patientExamples,
  });
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

const regeneratedResponse = await worker.fetch(new Request('http://localhost:8787/api/vocabulary/enrich', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ word: 'patient', meaning: 'kiên nhẫn', topic: 'Học tập' }),
}), env, context);
const regeneratedPayload = await regeneratedResponse.json();
assert.equal(regeneratedResponse.status, 200);
assert.equal(regeneratedPayload.data.contextExamples.length, 5);
assert.equal(regenerationCalls, 2, 'invalid AI content must be regenerated automatically');
assert.deepEqual(cooldownModels, [env.AI_PAID_MODEL, env.AI_PAID_MODEL], 'free quota cooldown must avoid repeated failed free calls');
customProviderResponse = null;

const ticketExamples = [
  { context: 'Đời sống', en: 'I bought a ticket for the evening show.', vi: 'Tôi đã mua vé cho suất diễn buổi tối.' },
  { context: 'Công việc', en: 'Please open a support ticket for this issue.', vi: 'Vui lòng mở một phiếu hỗ trợ cho vấn đề này.' },
  { context: 'Học tập', en: 'Each student received a ticket to the science museum.', vi: 'Mỗi học sinh nhận được một vé vào bảo tàng khoa học.' },
  { context: 'Hội thoại', en: 'Where can I collect my train ticket?', vi: 'Tôi có thể nhận vé tàu ở đâu?' },
  { context: 'Cụm từ', en: 'A return ticket is cheaper than two single tickets.', vi: 'Vé khứ hồi rẻ hơn hai vé một chiều.' },
];
customProviderResponse = async ({ body }) => new Response(JSON.stringify({
  model: body.model,
  choices: [{ message: { content: JSON.stringify({
    primaryMeaningVi: 'vé; phiếu',
    contextExamples: ticketExamples,
  }) } }],
}), { status: 200, headers: { 'Content-Type': 'application/json' } });
const kvLimitedEnv = {
  ...env,
  VOCAB_CACHE: {
    ...env.VOCAB_CACHE,
    put: async (key, value) => {
      if (key.startsWith('vocabulary:v')) throw new Error('KV put() limit exceeded for the day.');
      serverCache.set(key, value);
    },
  },
};
const manualKvLimitResponse = await worker.fetch(new Request('http://localhost:8787/api/vocabulary/enrich', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ word: 'ticket', meaning: 'vé', topic: 'Du lịch', force: true }),
}), kvLimitedEnv, context);
const manualKvLimitPayload = await manualKvLimitResponse.json();
assert.equal(manualKvLimitResponse.status, 200, 'manual retry must return AI data when KV writes are exhausted');
assert.equal(manualKvLimitPayload.data.contextExamples.length, 5);
assert.equal(manualKvLimitPayload.data.persistedOnServer, false);
assert.equal(manualKvLimitPayload.data.persistencePending, true);
await Promise.all(pending);
const providerCallsBeforeEdgeReload = providerCallCount;
const edgeReloadBatchResponse = await worker.fetch(new Request('http://localhost:8787/api/vocabulary/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ items: [{ word: 'ticket', pos: 'n' }] }),
}), kvLimitedEnv, context);
const edgeReloadBatchPayload = await edgeReloadBatchResponse.json();
assert.equal(edgeReloadBatchResponse.status, 200);
assert.equal(edgeReloadBatchPayload.data.items[0].enrichment.contextExamples.length, 5,
  'page reload must recover completed examples from Edge Cache while KV writes are exhausted');
assert.equal(providerCallCount, providerCallsBeforeEdgeReload,
  'recovering examples after reload must not spend another AI request');
customProviderResponse = null;

let meaningProviderCalls = 0;
customProviderResponse = async () => {
  meaningProviderCalls += 1;
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      meanings: [{ word: 'abandon', meaningVi: 'từ bỏ; bỏ rơi' }],
    }) } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const meaningRequest = () => new Request('http://localhost:8787/api/vocabulary/meanings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({
    items: [
      { word: 'accept', pos: 'v', meaning: 'chấp nhận' },
      { word: 'abandon', pos: 'v', meaning: 'bộm từ bỏ' },
    ],
  }),
});
const meaningResponse = await worker.fetch(meaningRequest(), env, context);
const meaningPayload = await meaningResponse.json();
assert.equal(meaningResponse.status, 200);
assert.equal(meaningPayload.data.meanings.length, 2);
assert.equal(meaningPayload.data.meanings.find((item) => item.word === 'accept').meaningVi, 'chấp nhận');
assert.equal(meaningPayload.data.meanings.find((item) => item.word === 'abandon').meaningVi, 'từ bỏ; bỏ rơi');
assert.equal(meaningProviderCalls, 1, 'one batch request should translate every uncached meaning');

await worker.fetch(meaningRequest(), env, context);
assert.equal(meaningProviderCalls, 1, 'translated meanings must be served from KV cache');
customProviderResponse = null;

const pronunciationResponse = await worker.fetch(
  new Request('http://localhost:8787/api/vocabulary/pronunciation?word=hello', {
    headers: { Origin: 'http://localhost:5173' },
    redirect: 'manual',
  }),
  env,
  context,
);
assert.equal(pronunciationResponse.status, 200);
assert.equal(pronunciationResponse.headers.get('Content-Type'), 'audio/mpeg');
assert.ok((await pronunciationResponse.arrayBuffer()).byteLength > 0);

const sentenceAudioResponse = await worker.fetch(
  new Request('http://localhost:8787/api/speech/audio?text=How%20are%20you%3F&lang=en-US', {
    headers: { Origin: 'http://localhost:5173' },
  }),
  env,
  context,
);
assert.equal(sentenceAudioResponse.status, 200);
assert.equal(sentenceAudioResponse.headers.get('Content-Type'), 'audio/mpeg');
assert.ok((await sentenceAudioResponse.arrayBuffer()).byteLength > 0);

const cambridgeResponse = await worker.fetch(
  new Request('http://localhost:8787/api/vocabulary/cambridge?word=accept', {
    headers: { Origin: 'http://localhost:5173' },
  }),
  env,
  context,
);
assert.equal(cambridgeResponse.status, 204);

const dictionaryRequest = () => new Request('http://localhost:8787/api/vocabulary/dictionary?word=explore', {
  headers: { Origin: 'http://localhost:5173' },
});
const dictionaryResponse = await worker.fetch(dictionaryRequest(), env, context);
const dictionaryPayload = await dictionaryResponse.json();
await Promise.all(pending.splice(0));
assert.equal(dictionaryResponse.status, 200);
assert.equal(dictionaryResponse.headers.get('X-LingoGoc-Cache'), 'MISS');
assert.equal(dictionaryPayload.data.examples[0], 'They explore the forest together.');
assert.equal(dictionaryPayload.data.audioUrl, 'https://audio.example/explore.mp3');
const cachedDictionaryResponse = await worker.fetch(dictionaryRequest(), env, context);
assert.equal(cachedDictionaryResponse.headers.get('X-LingoGoc-Cache'), 'HIT');

serverCache.clear();
serverCache.set('system-vocabulary:v1', JSON.stringify({
  schemaVersion: 1,
  contentHash: 'non-blocking-backfill-test',
  count: 3000,
  words: [
    { id: 1, word: 'stumble', meaning: "từ 'stumble' (v)", pos: 'v', topic: 'Đời sống' },
    { id: 2, word: 'explore', meaning: "từ 'explore' (v)", pos: 'v', topic: 'Đời sống' },
    ...Array.from({ length: 2998 }, (_, index) => ({
      id: index + 3,
      word: `placeholder ${index + 3}`,
      meaning: 'đang chờ',
      pos: 'n',
      topic: 'Đời sống',
    })),
  ],
}));
let scheduledProviderCalls = 0;
customProviderResponse = async ({ body }) => {
  scheduledProviderCalls += 1;
  const input = JSON.parse(body.messages.at(-1).content);
  const examples = input.word === 'explore'
    ? exploreExamples
    : [{ context: 'Đời sống', en: 'I stumble sometimes.', vi: 'Đôi khi tôi bị vấp.' }];
  return new Response(JSON.stringify({
    model: body.model,
    choices: [{ message: { content: JSON.stringify({
      primaryMeaningVi: input.word === 'explore' ? 'khám phá; tìm hiểu' : 'vấp; tình cờ gặp',
      contextExamples: examples,
    }) } }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const nonBlockingPending = [];
await worker.scheduled(
  { scheduledTime: Date.now(), cron: '0 * * * *' },
  {
    ...env,
    XTROUTER_API_KEY: '',
    AI_PAID_MODEL: '',
    GROQ_API_KEY: 'groq-test-key',
    GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
  },
  { waitUntil: (promise) => nonBlockingPending.push(promise) },
);
await Promise.all(nonBlockingPending);
const nonBlockingState = JSON.parse(serverCache.get('system-vocabulary:backfill:v1'));
assert.equal(nonBlockingState.status, 'active');
assert.equal(nonBlockingState.cursor, 2);
assert.equal(nonBlockingState.generated, 1);
assert.equal(nonBlockingState.failed, 1);
const stumbleRetry = JSON.parse(serverCache.get('system-vocabulary:backfill-retry:v1:stumble'));
const stumbleRetryDelay = Date.parse(stumbleRetry.nextRetryAt) - Date.parse(stumbleRetry.lastTriedAt);
assert.equal(stumbleRetryDelay, 60 * 60 * 1000, 'incomplete words must retry after one hour');
assert.deepEqual(nonBlockingState.lastRunSummary, {
  scanned: 2,
  attempted: 2,
  generated: 1,
  failed: 1,
  retrySkipped: 0,
});
assert.equal(scheduledProviderCalls, 1, 'scheduled retries must reuse a valid Edge Cache result without another AI call');

serverCache.set('system-vocabulary:backfill:v1', JSON.stringify({
  ...nonBlockingState,
  cursor: 0,
  status: 'active',
}));
serverCache.set('system-vocabulary:backfill-retry:v1:stumble', JSON.stringify({
  word: 'stumble',
  attempts: 4,
  status: 'retry_pending',
  nextRetryAt: new Date(Date.now() - 1_000).toISOString(),
}));
await worker.scheduled(
  { scheduledTime: Date.now() + 2 * 60 * 60 * 1000, cron: '0 * * * *' },
  {
    ...env,
    XTROUTER_API_KEY: '',
    AI_PAID_MODEL: '',
    GROQ_API_KEY: 'groq-test-key',
    GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
  },
  { waitUntil: (promise) => nonBlockingPending.push(promise) },
);
await Promise.all(nonBlockingPending.splice(0));
const manualRetry = JSON.parse(serverCache.get('system-vocabulary:backfill-retry:v1:stumble'));
const manualQueue = JSON.parse(serverCache.get('system-vocabulary:manual-review:v1'));
assert.equal(manualRetry.status, 'manual_review');
assert.equal(manualRetry.nextRetryAt, null);
assert.equal(manualQueue.items[0].word, 'stumble');
assert.equal(manualQueue.items[0].attempts, 5);

const manualStatusResponse = await worker.fetch(
  new Request('http://localhost:8787/api/vocabulary/backfill/status', { headers: { Origin: 'http://localhost:5173' } }),
  env,
  context,
);
const manualStatusPayload = await manualStatusResponse.json();
assert.equal(manualStatusPayload.data.manualReview.count, 1);
assert.equal(manualStatusPayload.data.manualReview.items[0].word, 'stumble');

const d1Backfill = createD1Mock();
d1Backfill.jobs.set('stumble', {
  status: 'retry_pending',
  attempts: 4,
  next_retry_at: new Date(Date.now() - 1_000).toISOString(),
  last_error: 'INSUFFICIENT_BILINGUAL_EXAMPLES',
  last_provider_errors_json: '[]',
  updated_at: new Date(Date.now() - 60_000).toISOString(),
});
serverCache.delete('system-vocabulary:backfill:v1');
serverCache.delete('system-vocabulary:manual-review:v1');
serverCache.delete('system-vocabulary:backfill-retry:v1:stumble');
const kvUnavailableEnv = {
  ...env,
  VOCAB_DB: d1Backfill.binding,
  XTROUTER_API_KEY: '',
  AI_PAID_MODEL: '',
  GROQ_API_KEY: 'groq-test-key',
  GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
  VOCAB_CACHE: {
    ...env.VOCAB_CACHE,
    put: async () => { throw new Error('KV_WRITE_LIMIT'); },
    delete: async () => { throw new Error('KV_WRITE_LIMIT'); },
  },
};
await worker.scheduled(
  { scheduledTime: Date.now() + 4 * 60 * 60 * 1000, cron: '0 * * * *' },
  kvUnavailableEnv,
  { waitUntil: (promise) => nonBlockingPending.push(promise) },
);
await Promise.all(nonBlockingPending.splice(0));
const d1BackfillState = JSON.parse(d1Backfill.states.get('system-vocabulary:backfill:v1').payload_json);
assert.equal(d1BackfillState.cursor, 2, 'D1 checkpoint must advance when KV writes fail');
assert.equal(d1Backfill.jobs.get('stumble').status, 'manual_review');
assert.equal(d1Backfill.jobs.get('stumble').next_retry_at, null);
assert.equal(d1Backfill.manualReviews.get('stumble').attempts, 5);
assert.equal(serverCache.has('system-vocabulary:backfill:v1'), false, 'test must prove state came from D1');
customProviderResponse = null;
console.log('Worker vocabulary contract: OK');
