import assert from 'node:assert/strict';
import worker from './src/worker.js';

let cachedResponse = null;
const dictionaryEdgeCache = new Map();
globalThis.caches = {
  default: {
    match: async (key) => {
      const url = typeof key === 'string' ? key : key.url;
      return url.includes('/dictionary/') ? dictionaryEdgeCache.get(url)?.clone() || null : null;
    },
    put: async (key, response) => {
      cachedResponse = response;
      const url = typeof key === 'string' ? key : key.url;
      if (url.includes('/dictionary/')) dictionaryEdgeCache.set(url, response.clone());
    },
  },
};

let providerRequest = null;
let providerCallCount = 0;
let customProviderResponse = null;
const serverCache = new Map();
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
  AI_FREE_MODEL: 'mistralai/mistral-large-2512',
  AI_PAID_MODEL: 'x-ai/grok-build-0.1',
  AI_BASE_URL: 'https://api.xkiro.com/v1',
  ALLOWED_ORIGINS: 'http://localhost:5173',
  VOCAB_CACHE: {
    get: async (key, type) => {
      const value = serverCache.get(key);
      return type === 'json' && value ? JSON.parse(value) : value || null;
    },
    put: async (key, value) => { serverCache.set(key, value); },
    delete: async (key) => { serverCache.delete(key); },
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
assert.equal(healthPayload.freeModel, 'mistralai/mistral-large-2512');
assert.equal(healthPayload.paidFallbackModel, 'x-ai/grok-build-0.1');
assert.equal(healthPayload.paidFallbackConfigured, true);
assert.equal(healthPayload.groqConfigured, false);
assert.equal(healthPayload.workersAiConfigured, false);
assert.equal(healthPayload.openRouterConfigured, false);
assert.equal(healthPayload.freeProviderStrategy, 'single-provider');
assert.equal(healthPayload.serverStorageConfigured, true);

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
  { scheduledTime: Date.now(), cron: '*/15 * * * *' },
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
assert.equal(providerCallCount, 3);
assert.equal(payload.data.persistedOnServer, true);
assert.equal(serverCache.size, 1);

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
assert.equal(providerCallCount, 3, 'batch reads must never call the AI provider');

const kvResponse = await worker.fetch(new Request('http://localhost:8787/api/vocabulary/enrich', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ word: 'accept', meaning: 'chấp nhận', topic: 'Công việc' }),
}), env, context);
const kvPayload = await kvResponse.json();
assert.equal(kvResponse.headers.get('X-LingoGoc-Cache'), 'KV');
assert.equal(kvPayload.data.persistedOnServer, true);
assert.equal(providerCallCount, 3);

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
  }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
assert.equal(parallelPayload.generatedByModel, 'deepseek/deepseek-v4-flash-0731:free');
assert.ok(parallelProviderUrls.some((url) => url.startsWith(env.AI_BASE_URL)));
assert.ok(parallelProviderUrls.some((url) => url.startsWith('https://openrouter.ai/api/v1')));
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
assert.equal(allProviderPayload.generatedByModel, 'qwen/qwen3.8-27b');
assert.ok(allProviderUrls.some((url) => url.startsWith('https://api.groq.com/openai/v1')));
assert.equal(allProviderUrls.some((url) => url.startsWith(env.AI_BASE_URL)), false);
assert.equal(allProviderUrls.some((url) => url.startsWith('https://openrouter.ai/api/v1')), false);
assert.equal(workersAiCalls, 1);
customProviderResponse = null;

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
  const isGroq = url.startsWith('https://api.groq.com/openai/v1');
  const isOpenRouter = url.startsWith('https://openrouter.ai/api/v1');
  const content = JSON.stringify({
    primaryMeaningVi: isGroq ? 'to travel around and learn about a place' : 'khám phá; tìm hiểu',
    contextExamples: isGroq || isOpenRouter ? exploreExamples : exploreExamples.slice(0, 3),
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
assert.equal(validationFailoverPayload.data.generatedByProvider, 'XKIRO_FREE');
assert.ok(validationFailoverUrls.some((url) => url.startsWith('https://api.groq.com/openai/v1')));
assert.ok(validationFailoverUrls.some((url) => url.startsWith(env.AI_BASE_URL)));
assert.equal(validationFailoverUrls.some((url) => url.startsWith('https://openrouter.ai/api/v1')), false);

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
  body: JSON.stringify({ word: 'survey', meaning: "từ 'survey' (v)", topic: 'Công việc' }),
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
  }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const fallbackResponse = await worker.fetch(new Request('http://localhost:8787/api/vocabulary/enrich', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
  body: JSON.stringify({ word: 'backup', meaning: 'bản sao lưu', topic: 'Công nghệ' }),
}), env, context);
const fallbackPayload = await fallbackResponse.json();
assert.equal(fallbackResponse.status, 200);
assert.deepEqual(fallbackModels, [env.AI_FREE_MODEL, env.AI_PAID_MODEL]);
assert.equal(fallbackPayload.data.generatedByModel, env.AI_PAID_MODEL);
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
  { scheduledTime: Date.now(), cron: '*/15 * * * *' },
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
assert.deepEqual(nonBlockingState.lastRunSummary, {
  scanned: 2,
  attempted: 2,
  generated: 1,
  failed: 1,
  retrySkipped: 0,
});
assert.equal(scheduledProviderCalls, 2, 'one invalid word must not block the next vocabulary item');
customProviderResponse = null;
console.log('Worker vocabulary contract: OK');
