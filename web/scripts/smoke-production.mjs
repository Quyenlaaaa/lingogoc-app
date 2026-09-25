import assert from 'node:assert/strict';

const apiBase = String(process.env.LINGOGOC_API_BASE_URL || 'https://lingogoc-api.lingogoc-api.workers.dev').replace(/\/+$/, '');
const smokeWord = String(process.env.LINGOGOC_SMOKE_WORD || 'ticket').trim().toLowerCase();

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'X-Request-ID': `smoke-${crypto.randomUUID()}`,
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  assert.ok(response.headers.get('X-Request-ID'), `${path} must expose X-Request-ID`);
  assert.ok(response.headers.get('Server-Timing'), `${path} must expose Server-Timing`);
  return response;
}

const healthResponse = await request('/health');
assert.equal(healthResponse.status, 200);
const health = await healthResponse.json();
assert.equal(health.ok, true);
assert.equal(health.aiConfigured, true);
assert.equal(health.serverStorageConfigured, true);

const operationsResponse = await request('/api/operations/status');
assert.equal(operationsResponse.status, 200);
const operations = await operationsResponse.json();
assert.notEqual(operations.data.status, 'critical');
assert.equal(operations.data.storage.configured, true);

const manifestResponse = await request('/api/vocabulary/manifest');
assert.equal(manifestResponse.status, 200);
const manifest = await manifestResponse.json();
assert.equal(manifest.data.count, 3000);
assert.ok(manifest.data.contentHash);

const batchResponse = await request('/api/vocabulary/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ items: [{ word: smokeWord, pos: 'n' }] }),
});
assert.equal(batchResponse.status, 200);
const batch = await batchResponse.json();
const record = batch.data.items.find((item) => item.word === smokeWord);
assert.ok(record, `${smokeWord} must exist in durable cache before smoke testing`);
assert.equal(record.enrichment.contextExamples.length, 5);

const enrichResponse = await request('/api/vocabulary/enrich', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ word: smokeWord, meaning: record.meaningVi || '', topic: 'smoke-test' }),
});
assert.equal(enrichResponse.status, 200);
assert.ok(['HIT', 'HIT+KV', 'KV'].includes(enrichResponse.headers.get('X-LingoGoc-Cache')),
  'smoke enrichment must reuse cache instead of calling AI');
const enrichment = await enrichResponse.json();
assert.equal(enrichment.data.contextExamples.length, 5);

const speechResponse = await request('/api/speech/audio?text=hello&lang=en-US', {
  headers: { Accept: 'audio/mpeg' },
});
assert.equal(speechResponse.status, 200);
assert.match(speechResponse.headers.get('Content-Type') || '', /^audio\//);
assert.ok((await speechResponse.arrayBuffer()).byteLength > 0);

console.log(`Production smoke checks passed for ${apiBase} using cached word "${smokeWord}".`);
