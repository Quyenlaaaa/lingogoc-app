import assert from 'node:assert/strict';
import worker from './src/worker.js';

let cachedResponse = null;
globalThis.caches = {
  default: {
    match: async () => null,
    put: async (_key, response) => { cachedResponse = response; },
  },
};

let providerRequest = null;
let providerCallCount = 0;
let customProviderResponse = null;
const serverCache = new Map();
globalThis.fetch = async (url, options) => {
  providerCallCount += 1;
  providerRequest = { url, options, body: JSON.parse(options.body) };
  if (customProviderResponse) return customProviderResponse(providerRequest);
  if (providerCallCount < 3) {
    return new Response(JSON.stringify({ error: 'temporary provider overload' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
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
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const env = {
  XTROUTER_API_KEY: 'server-only-test-key',
  AI_MODEL: 'mistralai/mistral-large-2512',
  AI_BASE_URL: 'https://api.xkiro.com/v1',
  ALLOWED_ORIGINS: 'http://localhost:5173',
  VOCAB_CACHE: {
    get: async (key, type) => {
      const value = serverCache.get(key);
      return type === 'json' && value ? JSON.parse(value) : value || null;
    },
    put: async (key, value) => { serverCache.set(key, value); },
  },
};
const pending = [];
const context = { waitUntil: (promise) => pending.push(promise) };
const healthResponse = await worker.fetch(
  new Request('http://localhost:8787/health', { headers: { Origin: 'http://localhost:5173' } }),
  env,
  context,
);
const healthPayload = await healthResponse.json();
assert.equal(healthPayload.model, 'mistralai/mistral-large-2512');
assert.equal(healthPayload.serverStorageConfigured, true);

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
assert.equal(providerCallCount, 3);
assert.equal(payload.data.persistedOnServer, true);
assert.equal(serverCache.size, 1);

const kvResponse = await worker.fetch(new Request('http://localhost:8787/api/vocabulary/enrich', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ word: 'accept', meaning: 'chấp nhận', topic: 'Công việc' }),
}), env, context);
const kvPayload = await kvResponse.json();
assert.equal(kvResponse.headers.get('X-LingoGoc-Cache'), 'KV');
assert.equal(kvPayload.data.persistedOnServer, true);
assert.equal(providerCallCount, 3);

let regenerationCalls = 0;
customProviderResponse = async () => {
  regenerationCalls += 1;
  const content = regenerationCalls === 1
    ? JSON.stringify({ contextExamples: [] })
    : JSON.stringify({
      primaryMeaningVi: 'kiên nhẫn',
      contextExamples: [
        { context: 'Đời sống', en: 'Please be patient while I check your order.', vi: 'Vui lòng kiên nhẫn trong lúc tôi kiểm tra đơn hàng.' },
        { context: 'Công việc', en: 'A patient manager listens before making a decision.', vi: 'Một quản lý kiên nhẫn sẽ lắng nghe trước khi quyết định.' },
        { context: 'Học tập', en: 'Be patient with yourself when learning English.', vi: 'Hãy kiên nhẫn với chính mình khi học tiếng Anh.' },
      ],
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
assert.equal(regeneratedPayload.data.contextExamples.length, 3);
assert.equal(regenerationCalls, 2, 'invalid AI content must be regenerated automatically');
customProviderResponse = null;

const cambridgeResponse = await worker.fetch(
  new Request('http://localhost:8787/api/vocabulary/cambridge?word=accept', {
    headers: { Origin: 'http://localhost:5173' },
  }),
  env,
  context,
);
assert.equal(cambridgeResponse.status, 204);
console.log('Worker vocabulary contract: OK');
