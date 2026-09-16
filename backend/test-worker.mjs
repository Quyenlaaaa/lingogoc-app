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
globalThis.fetch = async (url, options) => {
  providerRequest = { url, options, body: JSON.parse(options.body) };
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
  AI_MODEL: 'x-ai/grok-build-0.1',
  AI_BASE_URL: 'https://api.xkiro.com/v1',
  ALLOWED_ORIGINS: 'http://localhost:5173',
};
const pending = [];
const context = { waitUntil: (promise) => pending.push(promise) };
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
assert.equal(providerRequest.body.model, 'x-ai/grok-build-0.1');

const cambridgeResponse = await worker.fetch(
  new Request('http://localhost:8787/api/vocabulary/cambridge?word=accept', {
    headers: { Origin: 'http://localhost:5173' },
  }),
  env,
  context,
);
assert.equal(cambridgeResponse.status, 204);
console.log('Worker vocabulary contract: OK');
