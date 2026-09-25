const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const MAX_BODY_BYTES = 20_000;
const VOCABULARY_PROMPT_VERSION = 2;
const MEANING_PROMPT_VERSION = 1;
const SYSTEM_VOCABULARY_KEY = 'system-vocabulary:v1';
const SYSTEM_VOCABULARY_MANIFEST_KEY = 'system-vocabulary:manifest:v1';
const VOCABULARY_BACKFILL_STATE_KEY = 'system-vocabulary:backfill:v1';
const VOCABULARY_BACKFILL_RETRY_PREFIX = 'system-vocabulary:backfill-retry:v1:';
const VOCABULARY_MANUAL_REVIEW_KEY = 'system-vocabulary:manual-review:v1';
const BACKFILL_SCAN_LIMIT = 96;
const BACKFILL_GENERATE_LIMIT = 2;
const BACKFILL_ATTEMPT_LIMIT = 2;
const BACKFILL_RETRY_DELAY_MS = 60 * 60 * 1000;
const BACKFILL_MAX_RETRY_ATTEMPTS = 5;
const DEFAULT_WORKERS_AI_DAILY_REQUEST_LIMIT = 100;
const PROVIDER_TIMEOUT_MS = 12_000;
const PROVIDER_HEDGE_DELAY_MS = 1_500;
const PROVIDER_CIRCUIT_BREAKER_MS = 2 * 60 * 1000;
const DICTIONARY_TIMEOUT_MS = 3_500;
const DICTIONARY_CACHE_SECONDS = 30 * 24 * 60 * 60;
const SPEAKING_CACHE_SECONDS = 24 * 60 * 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_RATE_LIMIT_BUCKETS = 5_000;
let freeModelCooldownUntil = 0;
let openRouterCooldownUntil = 0;
let groqCooldownUntil = 0;
let workersAiCooldownUntil = 0;
const providerHealth = new Map();
const activeSpeakingRequests = new Map();
const rateLimitBuckets = new Map();
const runtimeCacheMetrics = {
  total: 0,
  hits: 0,
  misses: 0,
  byStatus: {},
};

function getProviderHealth(provider) {
  return providerHealth.get(provider) || {
    successes: 0,
    failures: 0,
    consecutiveFailures: 0,
    averageLatencyMs: null,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    circuitOpenUntil: 0,
    lastResultAt: null,
  };
}

function recordProviderResult(
  provider,
  startedAt,
  success,
  usage = null,
  metrics = null,
  model = '',
  estimatedCostUsd = 0,
) {
  const previous = getProviderHealth(provider);
  const latencyMs = Math.max(0, Date.now() - startedAt);
  const consecutiveFailures = success ? 0 : previous.consecutiveFailures + 1;
  const next = {
    successes: previous.successes + (success ? 1 : 0),
    failures: previous.failures + (success ? 0 : 1),
    consecutiveFailures,
    averageLatencyMs: previous.averageLatencyMs == null
      ? latencyMs
      : Math.round(previous.averageLatencyMs * 0.75 + latencyMs * 0.25),
    promptTokens: previous.promptTokens + (Number(usage?.prompt_tokens) || 0),
    completionTokens: previous.completionTokens + (Number(usage?.completion_tokens) || 0),
    totalTokens: previous.totalTokens + (Number(usage?.total_tokens) || 0),
    estimatedCostUsd: previous.estimatedCostUsd + Math.max(0, Number(estimatedCostUsd) || 0),
    circuitOpenUntil: !success && consecutiveFailures >= 3
      ? Date.now() + PROVIDER_CIRCUIT_BREAKER_MS
      : success ? 0 : previous.circuitOpenUntil,
    lastResultAt: new Date().toISOString(),
  };
  providerHealth.set(provider, next);
  console.log(JSON.stringify({ event: 'provider_result', provider, success, latencyMs }));
  metrics?.writeDataPoint?.({
    indexes: [provider],
    blobs: [success ? 'success' : 'failure', cleanText(model, 120)],
    doubles: [
      latencyMs,
      Number(usage?.prompt_tokens) || 0,
      Number(usage?.completion_tokens) || 0,
      Number(usage?.total_tokens) || 0,
      Math.max(0, Number(estimatedCostUsd) || 0),
    ],
  });
}

function estimatePaidCostUsd(env, usage) {
  const promptTokens = Math.max(0, Number(usage?.prompt_tokens) || 0);
  const completionTokens = Math.max(0, Number(usage?.completion_tokens) || 0);
  const inputRate = Math.max(0, Number(env.AI_PAID_INPUT_USD_PER_MILLION) || 0);
  const outputRate = Math.max(0, Number(env.AI_PAID_OUTPUT_USD_PER_MILLION) || 0);
  return (promptTokens * inputRate + completionTokens * outputRate) / 1_000_000;
}

function providerScore(provider) {
  const health = getProviderHealth(provider.provider);
  return (health.circuitOpenUntil > Date.now() ? 1_000_000 : 0)
    + health.consecutiveFailures * 20_000
    + (health.averageLatencyMs ?? 1_000);
}

function providerHealthSnapshot(provider, now = Date.now()) {
  const health = getProviderHealth(provider);
  return {
    successes: health.successes,
    failures: health.failures,
    consecutiveFailures: health.consecutiveFailures,
    averageLatencyMs: health.averageLatencyMs,
    promptTokens: health.promptTokens,
    completionTokens: health.completionTokens,
    totalTokens: health.totalTokens,
    estimatedCostUsd: Number(health.estimatedCostUsd.toFixed(8)),
    circuitOpen: health.circuitOpenUntil > now,
    circuitOpenUntil: health.circuitOpenUntil || null,
    lastResultAt: health.lastResultAt,
  };
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const normalizedOrigin = origin.replace(/\/+$/, '');
  // WebViewAssetLoader serves the bundled Android app from this secure,
  // local-only origin so browser APIs and the backend can be used safely.
  if (normalizedOrigin === 'https://appassets.androidplatform.net') return origin;
  const allowed = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  if (!origin) return allowed[0] || '*';
  return allowed.includes('*') || allowed.includes(normalizedOrigin) ? origin : '';
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || 'null',
    'Access-Control-Allow-Headers': 'Content-Type, X-Request-ID, X-Idempotency-Key, Authorization',
    'Access-Control-Expose-Headers': 'X-Request-ID, Server-Timing, X-LingoGoc-Cache, Retry-After, RateLimit-Limit',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  };
}

function constantTimeEqual(leftValue, rightValue) {
  const left = String(leftValue || '');
  const right = String(rightValue || '');
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index % Math.max(1, left.length)) || 0)
      ^ (right.charCodeAt(index % Math.max(1, right.length)) || 0);
  }
  return difference === 0;
}

function rateLimitPolicy(request, env, path) {
  const ip = cleanText(request.headers.get('CF-Connecting-IP'), 80);
  if (!ip) return null;
  let category = 'read';
  let defaultLimit = 120;
  let configuredLimit = env.RATE_LIMIT_READ_PER_MINUTE;
  if (request.method === 'POST' && ['/api/vocabulary/enrich', '/api/vocabulary/meanings', '/api/speaking/chat'].includes(path)) {
    category = 'ai';
    defaultLimit = 30;
    configuredLimit = env.RATE_LIMIT_AI_PER_MINUTE;
  } else if (path.startsWith('/api/admin/')) {
    category = 'admin';
    defaultLimit = 20;
    configuredLimit = env.RATE_LIMIT_ADMIN_PER_MINUTE;
  } else if (path.includes('/speech/') || path.includes('/pronunciation')) {
    category = 'audio';
    defaultLimit = 240;
    configuredLimit = env.RATE_LIMIT_AUDIO_PER_MINUTE;
  }
  return {
    key: `${category}:${ip}`,
    limit: Math.max(1, Math.min(1_000, Number(configuredLimit) || defaultLimit)),
  };
}

function checkRateLimit(request, env, path, now = Date.now()) {
  const policy = rateLimitPolicy(request, env, path);
  if (!policy) return null;
  let bucket = rateLimitBuckets.get(policy.key);
  if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  bucket.count += 1;
  rateLimitBuckets.set(policy.key, bucket);
  if (rateLimitBuckets.size > MAX_RATE_LIMIT_BUCKETS) {
    for (const [key, value] of rateLimitBuckets) {
      if (value.resetAt <= now || rateLimitBuckets.size > MAX_RATE_LIMIT_BUCKETS) rateLimitBuckets.delete(key);
    }
  }
  return bucket.count > policy.limit
    ? { retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)), limit: policy.limit }
    : null;
}

function requireAdmin(request, env, origin) {
  const configuredKey = cleanText(env.ADMIN_API_KEY, 500);
  if (!configuredKey) {
    return json({ error: 'Vocabulary administration is not configured.', code: 'ADMIN_NOT_CONFIGURED' }, 503, origin);
  }
  const authorization = request.headers.get('Authorization') || '';
  if (!constantTimeEqual(authorization, `Bearer ${configuredKey}`)) {
    return json(
      { error: 'Administrator authorization is required.', code: 'ADMIN_UNAUTHORIZED' },
      401,
      origin,
      { 'WWW-Authenticate': 'Bearer' },
    );
  }
  return null;
}

function json(payload, status, origin, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(origin), ...extraHeaders },
  });
}

function cleanText(value, maxLength) {
  return typeof value === 'string'
    ? value.replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function waitWithSignal(delayMs, signal) {
  if (!delayMs) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason || new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, delayMs);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

async function readJson(request) {
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
  return JSON.parse(text);
}

function extractJson(text) {
  const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('INVALID_AI_JSON');
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      throw new Error('INVALID_AI_JSON');
    }
  }
}

function isUsefulVietnameseMeaning(value, word = '') {
  const meaning = cleanText(value, 240);
  if (!meaning || meaning.length < 2) return false;
  if (/^từ(?: vựng)?\s*['"]/i.test(meaning) || /chưa có nghĩa/i.test(meaning)) return false;
  if (word && meaning.toLocaleLowerCase('en') === word.toLocaleLowerCase('en')) return false;
  const hasVietnameseSignal = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(meaning)
    || /\b(?:là|và|hoặc|của|cho|với|một|người|việc|sự|để|không|trong|trên|dùng|làm|có|được)\b/i.test(meaning);
  return hasVietnameseSignal;
}

function normalizePartialEnrichment(data, word) {
  const normalizedWord = word.toLowerCase();
  const seenContexts = new Set();
  const examples = Array.isArray(data?.contextExamples)
    ? data.contextExamples
      .map((item) => ({
        context: cleanText(item?.context, 80),
        en: cleanText(item?.en, 500),
        vi: cleanText(item?.vi, 500),
      }))
      .filter((item) => {
        const contextKey = item.context.toLowerCase();
        const isValid = item.context
          && item.en.toLowerCase().includes(normalizedWord)
          && item.en.length >= 8
          && item.vi.length >= 5
          && !seenContexts.has(contextKey);
        if (isValid) seenContexts.add(contextKey);
        return isValid;
      })
      .slice(0, 5)
    : [];
  return {
    word,
    primaryMeaningVi: isUsefulVietnameseMeaning(data?.primaryMeaningVi, word)
      ? cleanText(data?.primaryMeaningVi, 240)
      : '',
    meaningNote: cleanText(data?.meaningNote, 500),
    senses: Array.isArray(data?.senses) ? data.senses.slice(0, 5).map((item) => ({
      pos: cleanText(item?.pos, 40),
      meaningVi: cleanText(item?.meaningVi, 240),
      usage: cleanText(item?.usage, 300),
    })).filter((item) => item.meaningVi) : [],
    contextExamples: examples,
    collocations: Array.isArray(data?.collocations) ? data.collocations.slice(0, 6).map((item) => ({
      phrase: cleanText(item?.phrase, 120),
      meaning: cleanText(item?.meaning, 240),
    })).filter((item) => item.phrase && item.meaning) : [],
    mnemonicTip: cleanText(data?.mnemonicTip, 500),
    wordFamily: cleanText(data?.wordFamily, 500),
    generatedByModel: cleanText(data?.generatedByModel, 120),
    isAiGenerated: true,
    persistedOnServer: Boolean(data?.persistedOnServer),
    serverSavedAt: cleanText(data?.serverSavedAt, 40),
    status: examples.length === 5 && isUsefulVietnameseMeaning(data?.primaryMeaningVi, word) ? 'complete' : 'partial',
  };
}

function normalizeEnrichment(data, word) {
  const normalized = normalizePartialEnrichment(data, word);
  if (!normalized.primaryMeaningVi) throw new Error('INVALID_VIETNAMESE_MEANING');
  if (normalized.contextExamples.length !== 5) throw new Error('INSUFFICIENT_BILINGUAL_EXAMPLES');
  return { ...normalized, status: 'complete' };
}

function mergePartialEnrichment(existing, incoming, word) {
  if (!existing) return normalizePartialEnrichment(incoming, word);
  return normalizePartialEnrichment({
    ...existing,
    ...incoming,
    primaryMeaningVi: incoming?.primaryMeaningVi || existing.primaryMeaningVi,
    meaningNote: incoming?.meaningNote || existing.meaningNote,
    senses: incoming?.senses?.length ? incoming.senses : existing.senses,
    contextExamples: [
      ...(existing.contextExamples || []),
      ...(incoming?.contextExamples || []),
    ],
    collocations: incoming?.collocations?.length ? incoming.collocations : existing.collocations,
    mnemonicTip: incoming?.mnemonicTip || existing.mnemonicTip,
    wordFamily: incoming?.wordFamily || existing.wordFamily,
  }, word);
}

function getFreeModel(env) {
  return cleanText(env.AI_FREE_MODEL || env.AI_MODEL, 120);
}

function getPaidModel(env) {
  const paid = cleanText(env.AI_PAID_MODEL, 120);
  return paid && paid !== getFreeModel(env) ? paid : '';
}

function isQuotaError(status, detail) {
  return status === 402
    || ((status === 400 || status === 403 || status === 429)
      && /quota|rate.?limit|daily.?limit|insufficient|credit|balance|billing|resource.?exhausted|too many requests/i.test(detail));
}

async function callProviderModel({
  apiKey,
  baseUrl,
  model,
  messages,
  temperature,
  extraHeaders = {},
  extraBody = {},
  signal,
  provider,
  maxAttempts = 1,
}) {
  const retryableStatuses = new Set([429, 500, 502, 503, 504]);
  let lastError = Object.assign(new Error(`${provider}_UNKNOWN`), { provider, quota: false });
  const attemptLimit = Math.max(1, Math.min(2, Number(maxAttempts) || 1));

  for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
    try {
      const timeoutSignal = AbortSignal.timeout(PROVIDER_TIMEOUT_MS);
      const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...extraHeaders,
        },
        signal: requestSignal,
        body: JSON.stringify({ model, temperature, messages, ...extraBody }),
      });
      if (response.ok) {
        const rawPayload = await response.text();
        if (rawPayload.trim()) {
          try {
            const payload = JSON.parse(rawPayload);
            const content = payload?.choices?.[0]?.message?.content || '';
            if (content) return { content, model: payload?.model || model, provider, usage: payload?.usage || null };
          } catch {
            // Retry malformed provider JSON below.
          }
        }
        lastError = Object.assign(new Error(`${provider}_INVALID_RESPONSE`), { provider, quota: false });
      } else {
        const detail = cleanText(await response.text(), 500);
        const quota = isQuotaError(response.status, detail) || (response.status === 429 && attempt === attemptLimit - 1);
        lastError = Object.assign(
          new Error(`AI_PROVIDER_${response.status}${detail ? `: ${detail}` : ''}`),
          { provider, status: response.status, quota },
        );
        if (!retryableStatuses.has(response.status) || isQuotaError(response.status, detail)) throw lastError;
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error?.provider) lastError = error;
      else if (error?.name === 'TimeoutError') {
        lastError = Object.assign(new Error(`${provider}_TIMEOUT`), { provider, status: 504, quota: false });
      } else lastError = Object.assign(new Error(`${provider}_NETWORK_ERROR`), { provider, quota: false });
      if ((error?.quota || !retryableStatuses.has(error?.status)) && error?.provider) throw error;
    }

    if (attempt < attemptLimit - 1) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw lastError;
}

async function claimWorkersAiDailyBudget(env) {
  if (!env.VOCAB_CACHE) return;
  const limit = Math.max(1, Math.min(500, Number(env.WORKERS_AI_DAILY_REQUEST_LIMIT) || DEFAULT_WORKERS_AI_DAILY_REQUEST_LIMIT));
  const day = new Date().toISOString().slice(0, 10);
  const key = `usage:workers-ai:${day}`;
  const usage = await env.VOCAB_CACHE.get(key, 'json');
  const count = Number(usage?.count) || 0;
  if (count >= limit) {
    throw Object.assign(new Error('WORKERS_AI_DAILY_LIMIT'), {
      provider: 'CLOUDFLARE_FREE',
      status: 429,
      quota: true,
    });
  }
  await env.VOCAB_CACHE.put(key, JSON.stringify({ count: count + 1, day }), { expirationTtl: 172800 });
}

async function callWorkersAiModel(env, messages, temperature) {
  const provider = 'CLOUDFLARE_FREE';
  const model = cleanText(env.WORKERS_AI_MODEL || '@cf/google/gemma-4-26b-a4b-it', 160);
  await claimWorkersAiDailyBudget(env);
  let timeoutHandle;
  try {
    const payload = await Promise.race([
      env.AI.run(model, {
        messages,
        temperature,
        max_completion_tokens: 1800,
        response_format: { type: 'json_object' },
      }),
      new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error('WORKERS_AI_TIMEOUT')), PROVIDER_TIMEOUT_MS);
      }),
    ]);
    const content = payload?.response || payload?.choices?.[0]?.message?.content || '';
    if (!content) throw new Error('CLOUDFLARE_FREE_INVALID_RESPONSE');
    return { content, model: payload?.model || model, provider, usage: payload?.usage || null };
  } catch (error) {
    if (error?.provider) throw error;
    const detail = cleanText(error?.message || error, 300);
    const quota = /quota|limit|capacity|busy|neurons|rate/i.test(detail);
    throw Object.assign(new Error(`AI_PROVIDER_CLOUDFLARE${detail ? `: ${detail}` : ''}`), {
      provider,
      status: quota ? 429 : 502,
      quota,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function callChatModel(env, messages, temperature = 0.45, validateCompletion = null) {
  const xkiroApiKey = env.XTROUTER_API_KEY || env.AI_API_KEY;
  const freeModel = getFreeModel(env);
  const paidModel = getPaidModel(env);
  const xkiroBaseUrl = String(env.AI_BASE_URL || 'https://api.xkiro.com/v1').replace(/\/+$/, '');
  const groqApiKey = cleanText(env.GROQ_API_KEY, 500);
  const groqModel = cleanText(env.GROQ_FREE_MODEL || 'qwen/qwen3.8-27b', 160);
  const groqBaseUrl = String(env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
  const openRouterApiKey = cleanText(env.OPENROUTER_API_KEY, 500);
  const openRouterModel = cleanText(env.OPENROUTER_FREE_MODEL || 'deepseek/deepseek-v4-flash-0731:free', 160);
  const openRouterBaseUrl = String(env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
  const now = Date.now();
  const providers = [];
  const addHttpProvider = (options) => providers.push({
    provider: options.provider,
    invoke: (signal) => callProviderModel({
      ...options,
      messages,
      temperature,
      signal,
      maxAttempts: env.AI_ROUTING_MODE === 'background' ? 2 : 1,
    }),
  });

  if (groqApiKey && groqModel && now >= groqCooldownUntil && getProviderHealth('GROQ_FREE').circuitOpenUntil <= now) {
    addHttpProvider({
      apiKey: groqApiKey,
      baseUrl: groqBaseUrl,
      model: groqModel,
      provider: 'GROQ_FREE',
      extraBody: { response_format: { type: 'json_object' } },
    });
  }
  if (env.AI?.run && now >= workersAiCooldownUntil && getProviderHealth('CLOUDFLARE_FREE').circuitOpenUntil <= now) {
    providers.push({
      provider: 'CLOUDFLARE_FREE',
      invoke: () => callWorkersAiModel(env, messages, temperature),
    });
  }
  if (xkiroApiKey && freeModel && freeModel !== 'set-your-model-id' && now >= freeModelCooldownUntil && getProviderHealth('XKIRO_FREE').circuitOpenUntil <= now) {
    addHttpProvider({ apiKey: xkiroApiKey, baseUrl: xkiroBaseUrl, model: freeModel, provider: 'XKIRO_FREE' });
  }
  if (openRouterApiKey && openRouterModel && now >= openRouterCooldownUntil && getProviderHealth('OPENROUTER_FREE').circuitOpenUntil <= now) {
    addHttpProvider({
      apiKey: openRouterApiKey,
      baseUrl: openRouterBaseUrl,
      model: openRouterModel,
      provider: 'OPENROUTER_FREE',
      extraBody: { response_format: { type: 'json_object' } },
      extraHeaders: {
        ...(env.OPENROUTER_SITE_URL ? { 'HTTP-Referer': env.OPENROUTER_SITE_URL } : {}),
        ...(env.OPENROUTER_APP_NAME ? { 'X-Title': env.OPENROUTER_APP_NAME } : {}),
      },
    });
  }
  providers.sort((left, right) => providerScore(left) - providerScore(right));

  const markProviderCooldown = (providerError) => {
    if (!providerError?.quota) return;
    if (providerError.provider === 'GROQ_FREE') groqCooldownUntil = now + 5 * 60 * 1000;
    if (providerError.provider === 'CLOUDFLARE_FREE') workersAiCooldownUntil = now + 5 * 60 * 1000;
    if (providerError.provider === 'XKIRO_FREE') freeModelCooldownUntil = now + 5 * 60 * 1000;
    if (providerError.provider === 'OPENROUTER_FREE') openRouterCooldownUntil = now + 5 * 60 * 1000;
  };
  const invokeProvider = async (provider, signal) => {
    const startedAt = Date.now();
    try {
      const completion = await provider.invoke(signal);
      const result = validateCompletion ? await validateCompletion(completion) : completion;
      recordProviderResult(provider.provider, startedAt, true, completion.usage, env.METRICS, completion.model);
      return result;
    } catch (error) {
      if (error?.name !== 'AbortError') recordProviderResult(provider.provider, startedAt, false, null, env.METRICS);
      if (error && !error.provider) error.provider = provider.provider;
      throw error;
    }
  };
  let freeErrors = [];
  if (env.AI_ROUTING_MODE === 'background') {
    for (const provider of providers) {
      try {
        return await invokeProvider(provider);
      } catch (error) {
        freeErrors.push(error);
        markProviderCooldown(error);
      }
    }
  } else if (providers.length) {
    const controllers = providers.map(() => new AbortController());
    const failureSignals = providers.map(() => {
      let resolve;
      const promise = new Promise((done) => { resolve = done; });
      return { promise, resolve };
    });
    try {
      return await Promise.any(providers.map(async (provider, index) => {
        // Start one healthy provider. Only hedge when it has not produced a
        // valid answer within the latency threshold, avoiding duplicate token
        // spend for normal requests while retaining an interactive fallback.
        const hedgeDelay = index * PROVIDER_HEDGE_DELAY_MS;
        if (index > 0) {
          await Promise.race([
            waitWithSignal(hedgeDelay, controllers[index].signal),
            failureSignals[index - 1].promise,
          ]);
        }
        try {
          return await invokeProvider(provider, controllers[index].signal);
        } catch (error) {
          failureSignals[index].resolve();
          throw error;
        }
      }));
    } catch (error) {
      freeErrors = error?.errors || [error];
      freeErrors.forEach(markProviderCooldown);
    } finally {
      controllers.forEach((controller) => controller.abort());
    }
  }

  const freeProvidersCoolingDown = now < groqCooldownUntil
    || now < workersAiCooldownUntil
    || now < freeModelCooldownUntil
    || now < openRouterCooldownUntil;
  const canUsePaidFallback = xkiroApiKey && paidModel
    && (freeProvidersCoolingDown || freeErrors.some((error) => error?.quota));
  if (canUsePaidFallback) {
    let paidError = null;
    for (let attempt = 0; attempt < (validateCompletion ? 2 : 1); attempt += 1) {
      const paidStartedAt = Date.now();
      try {
        const paidCompletion = await callProviderModel({
          apiKey: xkiroApiKey,
          baseUrl: xkiroBaseUrl,
          model: paidModel,
          messages,
          temperature,
          provider: 'XKIRO_PAID',
        });
        const result = validateCompletion ? await validateCompletion(paidCompletion) : paidCompletion;
        recordProviderResult(
          'XKIRO_PAID',
          paidStartedAt,
          true,
          paidCompletion.usage,
          env.METRICS,
          paidCompletion.model,
          estimatePaidCostUsd(env, paidCompletion.usage),
        );
        return result;
      } catch (error) {
        recordProviderResult('XKIRO_PAID', paidStartedAt, false, null, env.METRICS, paidModel);
        paidError = error;
        if (attempt === 0 && validateCompletion && !error?.quota) {
          await new Promise((resolve) => setTimeout(resolve, 750));
        }
      }
    }
    throw paidError || new Error('AI_PROVIDER_UNKNOWN');
  }
  if (!providers.length) throw new Error('AI_NOT_CONFIGURED');
  const finalError = freeErrors[0] || new Error('AI_PROVIDER_UNKNOWN');
  finalError.allProvidersQuota = freeErrors.length > 0 && freeErrors.every((error) => error?.quota);
  finalError.providerErrors = freeErrors.map((error) => ({
    provider: error?.provider || 'unknown',
    code: cleanText(String(error?.message || 'UNKNOWN_ERROR').split(':')[0], 120),
    quota: Boolean(error?.quota),
  }));
  throw finalError;
}

async function cacheIdentityFor(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return {
    edgeRequest: new Request(`https://lingogoc-cache.invalid/vocabulary/${hash}`, { method: 'GET' }),
    serverKey: `vocabulary:v${VOCABULARY_PROMPT_VERSION}:${hash}`,
  };
}

async function batchCacheRequestFor(items, env) {
  const bytes = new TextEncoder().encode(JSON.stringify({
    version: VOCABULARY_PROMPT_VERSION,
    model: getFreeModel(env),
    items: items.map((item) => [item.word, item.pos]),
  }));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return new Request(`https://lingogoc-cache.invalid/vocabulary/batch/${hash}`, { method: 'GET' });
}

async function readDurableEnrichment(env, cacheKey) {
  if (env.VOCAB_DB) {
    try {
      const row = await env.VOCAB_DB.prepare(`
        SELECT payload_json
        FROM vocabulary_enrichments
        WHERE cache_key = ?1
        LIMIT 1
      `).bind(cacheKey).first();
      if (row?.payload_json) return { data: JSON.parse(row.payload_json), source: 'D1' };
    } catch (error) {
      console.error(JSON.stringify({
        event: 'd1_read_error',
        code: cleanText(String(error?.message || 'D1_READ_FAILED').split(':')[0], 120),
      }));
    }
  }
  if (!env.VOCAB_CACHE) return null;
  const data = await env.VOCAB_CACHE.get(cacheKey, 'json');
  return data ? { data, source: 'KV' } : null;
}

async function writeDurableEnrichment(env, cacheKey, word, data) {
  const payload = JSON.stringify(data);
  let d1Saved = false;
  let kvSaved = false;
  let firstError = null;

  if (env.VOCAB_DB) {
    try {
      await env.VOCAB_DB.prepare(`
        INSERT INTO vocabulary_enrichments (
          cache_key, word, prompt_version, status, payload_json, provider, model, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        ON CONFLICT(cache_key) DO UPDATE SET
          status = excluded.status,
          payload_json = excluded.payload_json,
          provider = excluded.provider,
          model = excluded.model,
          updated_at = excluded.updated_at
      `).bind(
        cacheKey,
        word,
        VOCABULARY_PROMPT_VERSION,
        cleanText(data?.status || 'partial', 20),
        payload,
        cleanText(data?.generatedByProvider, 80),
        cleanText(data?.generatedByModel, 120),
        new Date().toISOString(),
      ).run();
      d1Saved = true;
    } catch (error) {
      firstError = error;
      console.error(JSON.stringify({
        event: 'd1_write_error',
        code: cleanText(String(error?.message || 'D1_WRITE_FAILED').split(':')[0], 120),
      }));
    }
  }

  if (env.VOCAB_CACHE) {
    try {
      await env.VOCAB_CACHE.put(cacheKey, payload);
      kvSaved = true;
    } catch (error) {
      firstError ||= error;
    }
  }

  if (!d1Saved && !kvSaved) throw firstError || new Error('DURABLE_STORAGE_NOT_CONFIGURED');
  return { d1Saved, kvSaved, cacheWritePending: d1Saved && !kvSaved };
}

async function enrichVocabulary(request, env, origin, context) {
  const body = await readJson(request);
  const word = cleanText(body?.word, 80).toLowerCase();
  if (!word || !/^[a-z][a-z '-]*$/i.test(word)) return json({ error: 'Từ vựng không hợp lệ.' }, 400, origin);

  const input = {
    word,
    meaning: cleanText(body?.meaning, 300),
    topic: cleanText(body?.topic, 100),
    dictionaryDefinitions: Array.isArray(body?.dictionaryDefinitions)
      ? body.dictionaryDefinitions.slice(0, 5).map((item) => ({
        partOfSpeech: cleanText(item?.partOfSpeech, 40),
        text: cleanText(item?.text, 400),
      }))
      : [],
  };

  const cache = caches.default;
  // Keep the free model as the stable cache namespace. Paid fallback output is
  // interchangeable for this prompt and should be reused instead of paid twice.
  const cacheIdentity = await cacheIdentityFor({
    version: VOCABULARY_PROMPT_VERSION,
    model: getFreeModel(env),
    word,
  });
  let bestPartial = null;
  // D1 is the source of truth when configured. In the KV-only deployment,
  // Edge Cache remains the fastest first read as before.
  const cached = env.VOCAB_DB ? null : await cache.match(cacheIdentity.edgeRequest);
  if (cached) {
    let data = null;
    try {
      // Old edge entries with fewer than five distinct contexts are invalidated
      // and regenerated instead of being returned as a successful cache hit.
      data = normalizeEnrichment(await cached.json(), word);
    } catch {
      // Only invalid content should evict Edge Cache. A temporary KV write
      // failure must keep the completed AI result available after page reload.
      context.waitUntil(cache.delete(cacheIdentity.edgeRequest));
    }
    if (data) {
      if ((env.VOCAB_DB || env.VOCAB_CACHE) && !data.persistedOnServer) {
        const backfilled = { ...data, persistedOnServer: true, serverSavedAt: new Date().toISOString() };
        try {
          const saved = await writeDurableEnrichment(env, cacheIdentity.serverKey, word, backfilled);
          return json({ data: {
            ...backfilled,
            fromCache: true,
            cacheWritePending: saved.cacheWritePending,
          } }, 200, origin, { 'X-LingoGoc-Cache': saved.d1Saved ? 'HIT+D1' : 'HIT+KV' });
        } catch (error) {
          return json({ data: {
            ...data,
            fromCache: true,
            persistencePending: true,
            persistenceError: cleanText(String(error?.message || 'KV_WRITE_FAILED').split(':')[0], 120),
          } }, 200, origin, { 'X-LingoGoc-Cache': 'HIT+PENDING' });
        }
      }
      return json({ data: { ...data, fromCache: true } }, 200, origin, { 'X-LingoGoc-Cache': 'HIT' });
    }
  }

  if (env.VOCAB_DB || env.VOCAB_CACHE) {
    const durable = await readDurableEnrichment(env, cacheIdentity.serverKey);
    if (durable?.data) {
      try {
        const persisted = normalizeEnrichment(durable.data, word);
        if (env.VOCAB_DB && durable.source === 'KV') {
          await writeDurableEnrichment(env, cacheIdentity.serverKey, word, persisted);
        }
        const edgeResponse = new Response(JSON.stringify(persisted), {
          headers: { ...JSON_HEADERS, 'Cache-Control': 'public, max-age=604800' },
        });
        context.waitUntil(cache.put(cacheIdentity.edgeRequest, edgeResponse));
        return json({ data: { ...persisted, fromCache: true, persistedOnServer: true } }, 200, origin, {
          'X-LingoGoc-Cache': durable.source,
        });
      } catch {
        const partial = normalizePartialEnrichment(durable.data, word);
        if (partial.primaryMeaningVi || partial.contextExamples.length) bestPartial = partial;
      }
    }
  }

  if (env.VOCAB_DB) {
    const legacyEdge = await cache.match(cacheIdentity.edgeRequest);
    if (legacyEdge) {
      let promoted = null;
      try {
        promoted = {
          ...normalizeEnrichment(await legacyEdge.json(), word),
          persistedOnServer: true,
          serverSavedAt: new Date().toISOString(),
        };
      } catch {
        context.waitUntil(cache.delete(cacheIdentity.edgeRequest));
      }
      if (promoted) {
        try {
        const saved = await writeDurableEnrichment(env, cacheIdentity.serverKey, word, promoted);
        return json({ data: {
          ...promoted,
          fromCache: true,
          cacheWritePending: saved.cacheWritePending,
        } }, 200, origin, { 'X-LingoGoc-Cache': 'EDGE+D1' });
        } catch (error) {
          return json({ data: {
            ...promoted,
            fromCache: true,
            persistencePending: true,
            persistenceError: cleanText(String(error?.message || 'D1_WRITE_FAILED').split(':')[0], 120),
          } }, 200, origin, { 'X-LingoGoc-Cache': 'EDGE+PENDING' });
        }
      }
    }
  }

  if ((env.VOCAB_CACHE || env.VOCAB_DB) && body?.force !== true) {
    const retryState = await readVocabularyJob(env, word);
    const nextRetryAtMs = Date.parse(retryState?.nextRetryAt || '');
    if (Number.isFinite(nextRetryAtMs) && nextRetryAtMs > Date.now()) {
      return json({
        error: 'AI đang tạm nghỉ sau lần gọi lỗi. Hệ thống sẽ tự thử lại sau 1 giờ hoặc bạn có thể bấm Thử lại AI.',
        code: 'ENRICHMENT_COOLDOWN',
        retryable: true,
        nextRetryAt: retryState.nextRetryAt,
      }, 429, origin);
    }
  }

  const missingExampleCount = Math.max(0, 5 - (bestPartial?.contextExamples?.length || 0));
  const generationInput = {
    ...input,
    existingExamples: bestPartial?.contextExamples || [],
    missingExampleCount,
  };
  const systemPrompt = `You are a meticulous English-Vietnamese lexicographer for CEFR A1-B2 learners.
Return only valid JSON with plain text values and no Markdown. Never use generic templates such as "She used the word ... in her sentence."
When existingExamples is empty, create exactly 5 natural examples in genuinely different situations: daily life, work or study, conversation, the supplied topic, and an idiomatic or common collocation context.
When existingExamples is supplied, preserve those examples and return exactly missingExampleCount NEW examples. Their contexts and sentences must differ from every existing example. Do not repeat existing examples.
Every English sentence must use the target word naturally. Every Vietnamese translation must faithfully translate that sentence and sound natural to Vietnamese speakers.
The primaryMeaningVi field must be a concise Vietnamese definition, never an English definition or a placeholder such as "từ 'word'".
Use the supplied English dictionary definitions to disambiguate meaning. Do not invent rare senses.
Schema: {"primaryMeaningVi":"...","meaningNote":"...","senses":[{"pos":"...","meaningVi":"...","usage":"..."}],"contextExamples":[{"context":"...","en":"...","vi":"..."}],"collocations":[{"phrase":"...","meaning":"..."}],"mnemonicTip":"...","wordFamily":"..."}`;
  const partialScore = (value) => (value?.primaryMeaningVi ? 10 : 0) + (value?.contextExamples?.length || 0);
  const validateVocabularyCompletion = (completion) => {
    const raw = extractJson(completion.content);
    const candidate = { ...raw, generatedByModel: completion.model };
    const partial = mergePartialEnrichment(bestPartial, candidate, word);
    if (partialScore(partial) > partialScore(bestPartial)) bestPartial = partial;
    return { completion, normalized: normalizeEnrichment(partial, word) };
  };

  let generated;
  try {
    generated = await callChatModel(env, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(generationInput) },
    ], 0.45, validateVocabularyCompletion);
  } catch (error) {
    if ((env.VOCAB_DB || env.VOCAB_CACHE) && bestPartial?.primaryMeaningVi) {
      try {
        await writeDurableEnrichment(env, cacheIdentity.serverKey, word, {
          ...bestPartial,
          status: 'partial',
          persistedOnServer: true,
          serverSavedAt: new Date().toISOString(),
          lastError: cleanText(String(error?.message || 'UNKNOWN_ERROR').split(':')[0], 120),
        });
      } catch {
        // Preserve the original provider error when KV has reached its limit.
      }
    }
    if (env.VOCAB_CACHE || env.VOCAB_DB) {
      try {
        const previousRetry = await readVocabularyJob(env, word);
        const attempts = (Number(previousRetry?.attempts) || 0) + 1;
        const now = Date.now();
        await writeVocabularyJob(env, {
          word,
          attempts,
          status: 'retry_pending',
          lastError: cleanText(String(error?.message || 'UNKNOWN_ERROR').split(':')[0], 120),
          lastProviderErrors: error?.providerErrors || [],
          lastTriedAt: new Date(now).toISOString(),
          nextRetryAt: new Date(now + retryDelayMs(attempts)).toISOString(),
        });
      } catch {
        // A failed retry marker must not replace the useful provider error.
      }
    }
    throw error;
  }

  let result = {
    ...generated.normalized,
    generatedByModel: generated.completion.model,
    generatedByProvider: generated.completion.provider,
    status: 'complete',
    persistedOnServer: false,
    serverSavedAt: '',
  };
  if (env.VOCAB_DB || env.VOCAB_CACHE) {
    try {
      const persistedResult = {
        ...result,
        persistedOnServer: true,
        serverSavedAt: new Date().toISOString(),
      };
      const saved = await writeDurableEnrichment(env, cacheIdentity.serverKey, word, persistedResult);
      persistedResult.cacheWritePending = saved.cacheWritePending;
      result = persistedResult;
      if (env.VOCAB_CACHE?.delete || env.VOCAB_DB) {
        try {
          await completeVocabularyJob(env, word);
        } catch {
          // The completed value is durable; stale retry metadata is harmless.
        }
      }
    } catch (error) {
      // Scheduled work must only count durable results. Interactive/manual
      // requests still return the completed payload so the browser can cache it
      // even when the daily Workers KV write limit has been exhausted.
      if (env.AI_ROUTING_MODE === 'background') throw error;
      result = {
        ...result,
        persistencePending: true,
        persistenceError: cleanText(String(error?.message || 'KV_WRITE_FAILED').split(':')[0], 120),
      };
    }
  }
  const cacheResponse = new Response(JSON.stringify(result), {
    headers: { ...JSON_HEADERS, 'Cache-Control': 'public, max-age=604800' },
  });
  context.waitUntil(cache.put(cacheIdentity.edgeRequest, cacheResponse));
  return json({ data: result }, 200, origin, { 'X-LingoGoc-Cache': 'MISS' });
}

async function getSystemVocabulary(env, origin) {
  if (!env.VOCAB_CACHE) {
    return json({ error: 'Kho dữ liệu server chưa được cấu hình.' }, 503, origin);
  }
  const catalog = await env.VOCAB_CACHE.get(SYSTEM_VOCABULARY_KEY, 'json');
  if (!catalog || !Array.isArray(catalog.words) || catalog.words.length !== 3000) {
    return json({ error: 'Kho từ hệ thống trên DB chưa được đồng bộ đầy đủ.' }, 503, origin);
  }
  const contentHash = cleanText(catalog.contentHash, 128);
  return json({ data: catalog }, 200, origin, {
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
    ...(contentHash ? { ETag: `"${contentHash}"` } : {}),
    'X-LingoGoc-Source': 'KV',
  });
}

async function getSystemVocabularyManifest(env, origin) {
  if (!env.VOCAB_CACHE) {
    return json({ error: 'Kho dữ liệu server chưa được cấu hình.' }, 503, origin);
  }
  let manifest = await env.VOCAB_CACHE.get(SYSTEM_VOCABULARY_MANIFEST_KEY, 'json');
  if (!manifest) {
    const catalog = await env.VOCAB_CACHE.get(SYSTEM_VOCABULARY_KEY, 'json');
    if (catalog) {
      manifest = {
        schemaVersion: catalog.schemaVersion,
        contentHash: catalog.contentHash,
        updatedAt: catalog.updatedAt,
        count: catalog.count,
        enrichmentPromptVersion: catalog.enrichmentPromptVersion,
      };
    }
  }
  if (!manifest || manifest.count !== 3000 || !manifest.contentHash) {
    return json({ error: 'Manifest kho từ hệ thống chưa sẵn sàng.' }, 503, origin);
  }
  return json({ data: manifest }, 200, origin, {
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
    ETag: `"${cleanText(manifest.contentHash, 128)}"`,
    'X-LingoGoc-Source': 'KV',
  });
}

async function getVocabularyBatch(request, env, origin) {
  const body = await readJson(request);
  const seen = new Set();
  const items = (Array.isArray(body?.items) ? body.items : [])
    .slice(0, 24)
    .map((item) => ({
      word: cleanText(item?.word, 80).toLowerCase(),
      pos: cleanText(item?.pos || item?.type, 30).toLowerCase(),
    }))
    .filter((item) => {
      if (!item.word || !/^[a-z][a-z '-]*$/i.test(item.word) || seen.has(item.word)) return false;
      seen.add(item.word);
      return true;
    });
  if (!items.length) return json({ error: 'Danh sách từ vựng không hợp lệ.' }, 400, origin);
  if (!env.VOCAB_CACHE && !env.VOCAB_DB) {
    return json({ data: { items: [], missing: items.map((item) => item.word) } }, 200, origin);
  }

  const batchCacheRequest = await batchCacheRequestFor(items, env);
  const batchCache = caches.default;
  const cachedBatch = await batchCache.match(batchCacheRequest);
  if (cachedBatch) {
    try {
      return json(await cachedBatch.json(), 200, origin, {
        'Cache-Control': 'private, max-age=60',
        'X-LingoGoc-Cache': 'HIT-BATCH',
      });
    } catch {
      await batchCache.delete(batchCacheRequest);
    }
  }

  const records = await Promise.all(items.map(async (item) => {
    const identity = await cacheIdentityFor({
      version: VOCABULARY_PROMPT_VERSION,
      model: getFreeModel(env),
      word: item.word,
    });
    const storedEnrichment = (await readDurableEnrichment(env, identity.serverKey))?.data;
    let enrichment = null;
    let partial = null;
    try {
      if (storedEnrichment) enrichment = normalizeEnrichment(storedEnrichment, item.word);
    } catch {
      enrichment = null;
      if (storedEnrichment) partial = normalizePartialEnrichment(storedEnrichment, item.word);
    }
    if (!enrichment) {
      const edgeResponse = await caches.default.match(identity.edgeRequest);
      if (edgeResponse) {
        try {
          enrichment = normalizeEnrichment(await edgeResponse.json(), item.word);
          if (!enrichment.persistedOnServer) {
            const backfilled = {
              ...enrichment,
              persistedOnServer: true,
              serverSavedAt: new Date().toISOString(),
            };
            try {
              await writeDurableEnrichment(env, identity.serverKey, item.word, backfilled);
              enrichment = backfilled;
            } catch (error) {
              enrichment = {
                ...enrichment,
                persistencePending: true,
                persistenceError: cleanText(String(error?.message || 'KV_WRITE_FAILED').split(':')[0], 120),
              };
            }
          }
        } catch {
          enrichment = null;
        }
      }
    }
    // A complete enrichment already contains the canonical Vietnamese meaning.
    // Only spend a second KV read when that richer record is unavailable.
    const storedMeaning = enrichment || partial?.primaryMeaningVi
      ? null
      : await env.VOCAB_CACHE?.get(meaningCacheKey(env, item), 'json');
    const meaningVi = cleanText(enrichment?.primaryMeaningVi || partial?.primaryMeaningVi || storedMeaning?.meaningVi, 240);
    return (enrichment || meaningVi) ? {
      word: item.word,
      meaningVi,
      enrichment,
      status: enrichment ? 'complete' : 'partial',
      exampleCount: enrichment?.contextExamples?.length || partial?.contextExamples?.length || 0,
    } : null;
  }));
  const ready = records.filter(Boolean);
  const readyWords = new Set(ready.map((item) => item.word));
  const enrichedWords = new Set(ready.filter((item) => item.enrichment).map((item) => item.word));
  const payload = {
    data: {
      items: ready,
      missing: items.filter((item) => !readyWords.has(item.word)).map((item) => item.word),
      needsEnrichment: items.filter((item) => !enrichedWords.has(item.word)).map((item) => item.word),
    },
  };
  await batchCache.put(batchCacheRequest, new Response(JSON.stringify(payload), {
    headers: { ...JSON_HEADERS, 'Cache-Control': 'public, max-age=60' },
  }));
  return json(payload, 200, origin, {
    'Cache-Control': 'private, max-age=60',
    'X-LingoGoc-Cache': 'MISS-BATCH',
  });
}

function newBackfillState(contentHash) {
  return {
    contentHash,
    cursor: 0,
    passes: 0,
    generated: 0,
    generatedInCurrentPass: 0,
    retryPendingInCurrentPass: 0,
    verifiedInCurrentPass: 0,
    failed: 0,
    retried: 0,
    manualReview: 0,
    status: 'active',
    nextRunAt: null,
    lastRunAt: null,
    lastSuccessAt: null,
    lastWord: null,
    lastProvider: null,
    lastError: null,
  };
}

async function saveBackfillState(env, state) {
  const payload = JSON.stringify(state);
  let d1Saved = false;
  let kvSaved = false;
  let firstError = null;
  if (env.VOCAB_DB) {
    try {
      await env.VOCAB_DB.prepare(`
        INSERT INTO system_state (state_key, payload_json, updated_at)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(state_key) DO UPDATE SET
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `).bind(VOCABULARY_BACKFILL_STATE_KEY, payload, new Date().toISOString()).run();
      d1Saved = true;
    } catch (error) {
      firstError = error;
    }
  }
  if (env.VOCAB_CACHE) {
    try {
      await env.VOCAB_CACHE.put(VOCABULARY_BACKFILL_STATE_KEY, payload);
      kvSaved = true;
    } catch (error) {
      firstError ||= error;
    }
  }
  if (!d1Saved && !kvSaved) throw firstError || new Error('BACKFILL_STATE_STORAGE_NOT_CONFIGURED');
}

async function readBackfillState(env) {
  if (env.VOCAB_DB) {
    try {
      const row = await env.VOCAB_DB.prepare(`
        SELECT payload_json FROM system_state WHERE state_key = ?1 LIMIT 1
      `).bind(VOCABULARY_BACKFILL_STATE_KEY).first();
      if (row?.payload_json) return JSON.parse(row.payload_json);
    } catch (error) {
      console.error(JSON.stringify({
        event: 'd1_state_read_error',
        code: cleanText(String(error?.message || 'D1_STATE_READ_FAILED').split(':')[0], 120),
      }));
    }
  }
  return env.VOCAB_CACHE?.get(VOCABULARY_BACKFILL_STATE_KEY, 'json') || null;
}

function backfillRetryKey(word) {
  return `${VOCABULARY_BACKFILL_RETRY_PREFIX}${encodeURIComponent(word)}`;
}

async function readVocabularyJob(env, word) {
  if (env.VOCAB_DB) {
    try {
      const row = await env.VOCAB_DB.prepare(`
        SELECT status, attempts, next_retry_at, last_error, last_provider_errors_json, updated_at
        FROM vocabulary_jobs
        WHERE word = ?1 AND prompt_version = ?2
        LIMIT 1
      `).bind(word, VOCABULARY_PROMPT_VERSION).first();
      if (row) {
        return {
          word,
          status: row.status,
          attempts: Number(row.attempts) || 0,
          nextRetryAt: row.next_retry_at || null,
          lastError: row.last_error || '',
          lastProviderErrors: JSON.parse(row.last_provider_errors_json || '[]'),
          lastTriedAt: row.updated_at || null,
        };
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: 'd1_job_read_error',
        code: cleanText(String(error?.message || 'D1_JOB_READ_FAILED').split(':')[0], 120),
      }));
    }
  }
  return env.VOCAB_CACHE?.get(backfillRetryKey(word), 'json') || null;
}

async function writeVocabularyJob(env, job) {
  const record = {
    word: cleanText(job.word, 80).toLowerCase(),
    status: cleanText(job.status || 'retry_pending', 30),
    attempts: Number(job.attempts) || 0,
    nextRetryAt: job.nextRetryAt || null,
    lastError: cleanText(job.lastError, 120),
    lastProviderErrors: Array.isArray(job.lastProviderErrors) ? job.lastProviderErrors : [],
    lastTriedAt: job.lastTriedAt || new Date().toISOString(),
  };
  let d1Saved = false;
  let kvSaved = false;
  let firstError = null;
  if (env.VOCAB_DB) {
    try {
      await env.VOCAB_DB.prepare(`
        INSERT INTO vocabulary_jobs (
          word, prompt_version, status, attempts, next_retry_at, last_error,
          last_provider_errors_json, locked_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, ?8)
        ON CONFLICT(word, prompt_version) DO UPDATE SET
          status = excluded.status,
          attempts = excluded.attempts,
          next_retry_at = excluded.next_retry_at,
          last_error = excluded.last_error,
          last_provider_errors_json = excluded.last_provider_errors_json,
          locked_at = NULL,
          updated_at = excluded.updated_at
      `).bind(
        record.word,
        VOCABULARY_PROMPT_VERSION,
        record.status,
        record.attempts,
        record.nextRetryAt,
        record.lastError,
        JSON.stringify(record.lastProviderErrors),
        record.lastTriedAt,
      ).run();
      d1Saved = true;
    } catch (error) {
      firstError = error;
    }
  }
  if (env.VOCAB_CACHE) {
    try {
      const options = record.status === 'manual_review' ? undefined : { expirationTtl: 7 * 24 * 60 * 60 };
      await env.VOCAB_CACHE.put(backfillRetryKey(record.word), JSON.stringify(record), options);
      kvSaved = true;
    } catch (error) {
      firstError ||= error;
    }
  }
  if (!d1Saved && !kvSaved) throw firstError || new Error('DURABLE_JOB_STORAGE_NOT_CONFIGURED');
  return { d1Saved, kvSaved };
}

async function completeVocabularyJob(env, word) {
  if (env.VOCAB_DB) {
    await writeVocabularyJob(env, {
      word,
      status: 'complete',
      attempts: 0,
      nextRetryAt: null,
      lastError: '',
      lastProviderErrors: [],
    });
  }
  if (env.VOCAB_CACHE?.delete) await env.VOCAB_CACHE.delete(backfillRetryKey(word));
}

async function updateManualReviewQueue(env, item, error = null) {
  const stored = await env.VOCAB_CACHE?.get(VOCABULARY_MANUAL_REVIEW_KEY, 'json');
  const items = Array.isArray(stored?.items) ? stored.items : [];
  const word = cleanText(item?.word, 80).toLowerCase();
  const remaining = items.filter((entry) => entry.word !== word);
  if (error) {
    remaining.push({
      word,
      pos: cleanText(item?.pos || item?.type, 30),
      reason: cleanText(error.code, 120),
      attempts: Number(error.attempts) || BACKFILL_MAX_RETRY_ATTEMPTS,
      lastTriedAt: error.lastTriedAt,
    });
  }
  let d1Saved = false;
  let kvSaved = false;
  let firstError = null;
  if (env.VOCAB_DB && error) {
    try {
      await env.VOCAB_DB.prepare(`
        INSERT INTO vocabulary_manual_review (
          word, prompt_version, reason, attempts, payload_json, created_at, resolved_at, resolution_note
        ) VALUES (?1, ?2, ?3, ?4, NULL, ?5, NULL, '')
        ON CONFLICT(word, prompt_version) DO UPDATE SET
          reason = excluded.reason,
          attempts = excluded.attempts,
          resolved_at = NULL,
          resolution_note = '',
          created_at = excluded.created_at
      `).bind(
        word,
        VOCABULARY_PROMPT_VERSION,
        cleanText(error.code, 120),
        Number(error.attempts) || BACKFILL_MAX_RETRY_ATTEMPTS,
        error.lastTriedAt || new Date().toISOString(),
      ).run();
      d1Saved = true;
    } catch (writeError) {
      firstError = writeError;
    }
  }
  if (env.VOCAB_CACHE) {
    try {
      await env.VOCAB_CACHE.put(VOCABULARY_MANUAL_REVIEW_KEY, JSON.stringify({
        updatedAt: new Date().toISOString(),
        items: remaining,
      }));
      kvSaved = true;
    } catch (writeError) {
      firstError ||= writeError;
    }
  }
  if (error && !d1Saved && !kvSaved) throw firstError || new Error('MANUAL_REVIEW_STORAGE_NOT_CONFIGURED');
  return remaining.length;
}

function retryDelayMs() {
  return BACKFILL_RETRY_DELAY_MS;
}

async function runScheduledVocabularyBackfill(env, context, scheduledTime = Date.now()) {
  if (!env.VOCAB_CACHE) return { status: 'disabled', reason: 'KV_NOT_CONFIGURED' };
  const catalog = await env.VOCAB_CACHE.get(SYSTEM_VOCABULARY_KEY, 'json');
  if (!catalog || !Array.isArray(catalog.words) || catalog.words.length !== 3000 || !catalog.contentHash) {
    return { status: 'disabled', reason: 'CATALOG_NOT_READY' };
  }

  const storedState = await readBackfillState(env);
  const state = storedState?.contentHash === catalog.contentHash
    ? { ...newBackfillState(catalog.contentHash), ...storedState }
    : newBackfillState(catalog.contentHash);
  const now = Number(scheduledTime) || Date.now();
  if (state.status === 'complete') return state;
  if (state.status === 'quota_wait' && state.nextRunAt && Date.parse(state.nextRunAt) > now) return state;
  if (state.status === 'running' && Date.parse(state.lastRunAt) + 30 * 60 * 1000 > now) return state;

  state.status = 'running';
  state.lastRunAt = new Date(now).toISOString();
  state.nextRunAt = null;
  await saveBackfillState(env, state);
  let scanned = 0;
  let generated = 0;
  let attempted = 0;
  let failed = 0;
  let retrySkipped = 0;

  while (scanned < BACKFILL_SCAN_LIMIT && generated < BACKFILL_GENERATE_LIMIT && attempted < BACKFILL_ATTEMPT_LIMIT) {
    const item = catalog.words[state.cursor];
    if (!item) {
      state.cursor = 0;
      continue;
    }
    const word = cleanText(item.word, 80).toLowerCase();
    const identity = await cacheIdentityFor({
      version: VOCABULARY_PROMPT_VERSION,
      model: getFreeModel(env),
      word,
    });
    const storedEnrichment = (await readDurableEnrichment(env, identity.serverKey))?.data;
    let isComplete = false;
    try {
      if (storedEnrichment) {
        normalizeEnrichment(storedEnrichment, word);
        isComplete = true;
        state.verifiedInCurrentPass += 1;
      }
    } catch {
      isComplete = false;
    }

    if (!isComplete) {
      const retryState = await readVocabularyJob(env, word);
      if (retryState?.status === 'manual_review') {
        state.manualReview = Math.max(Number(state.manualReview) || 0, 1);
        state.cursor += 1;
        scanned += 1;
        if (state.cursor >= catalog.words.length) {
          state.cursor = 0;
          state.passes += 1;
          state.generatedInCurrentPass = 0;
          state.retryPendingInCurrentPass = 0;
          state.verifiedInCurrentPass = 0;
        }
        continue;
      }
      if (retryState?.nextRetryAt && Date.parse(retryState.nextRetryAt) > now) {
        retrySkipped += 1;
        state.retryPendingInCurrentPass += 1;
        state.cursor += 1;
        scanned += 1;
        if (state.cursor >= catalog.words.length) {
          state.cursor = 0;
          state.passes += 1;
          state.generatedInCurrentPass = 0;
          state.retryPendingInCurrentPass = 0;
          state.verifiedInCurrentPass = 0;
        }
        continue;
      }
      attempted += 1;
      try {
        const request = new Request('https://lingogoc-internal.invalid/api/vocabulary/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word, meaning: item.meaning, topic: item.topic, pos: item.pos || item.type }),
        });
        // Scheduled bulk work is deliberately free-tier only. Interactive
        // requests still retain the configured paid fallback, but an unattended
        // cron must never create unbounded wallet charges.
        const enrichmentResponse = await enrichVocabulary(request, {
          ...env,
          AI_PAID_MODEL: '',
          AI_ROUTING_MODE: 'background',
        }, '', context);
        const enrichmentPayload = await enrichmentResponse.json();
        if (!enrichmentResponse.ok) {
          const enrichmentError = new Error(enrichmentPayload?.code || `ENRICHMENT_HTTP_${enrichmentResponse.status}`);
          enrichmentError.retryAfter = enrichmentPayload?.nextRetryAt || null;
          throw enrichmentError;
        }
        generated += 1;
        state.generated += 1;
        state.generatedInCurrentPass += 1;
        state.lastSuccessAt = new Date().toISOString();
        state.lastWord = word;
        state.lastProvider = enrichmentPayload?.data?.generatedByProvider || null;
        state.lastError = null;
      } catch (error) {
        const code = cleanText(String(error?.message || 'UNKNOWN_ERROR').split(':')[0], 120);
        const isGlobalProviderFailure = error?.allProvidersQuota || code === 'AI_NOT_CONFIGURED';
        state.lastError = code;
        state.lastWord = word;
        if (isGlobalProviderFailure) {
          state.status = 'quota_wait';
          state.nextRunAt = new Date(now + BACKFILL_RETRY_DELAY_MS).toISOString();
          await saveBackfillState(env, state);
          return state;
        }
        const retryAttempts = (Number(retryState?.attempts) || 0) + 1;
        const requiresManualReview = retryAttempts >= BACKFILL_MAX_RETRY_ATTEMPTS;
        const nextRetryAt = new Date(now + retryDelayMs(retryAttempts)).toISOString();
        const retryRecord = {
          word,
          attempts: retryAttempts,
          status: requiresManualReview ? 'manual_review' : 'retry_pending',
          lastError: code,
          lastProviderErrors: error?.providerErrors || [],
          lastTriedAt: new Date(now).toISOString(),
          nextRetryAt: requiresManualReview ? null : nextRetryAt,
        };
        await writeVocabularyJob(env, retryRecord);
        if (requiresManualReview) {
          state.manualReview = await updateManualReviewQueue(env, item, {
            code,
            attempts: retryAttempts,
            lastTriedAt: retryRecord.lastTriedAt,
          });
        }
        failed += 1;
        state.failed += 1;
        state.retried += retryAttempts > 1 ? 1 : 0;
        if (!requiresManualReview) state.retryPendingInCurrentPass += 1;
      }
    }

    state.cursor += 1;
    scanned += 1;
    if (state.cursor >= catalog.words.length) {
      state.cursor = 0;
      state.passes += 1;
      if (state.generatedInCurrentPass === 0
        && state.retryPendingInCurrentPass === 0
        && (Number(state.manualReview) || 0) === 0) {
        state.status = 'complete';
        state.completedAt = new Date().toISOString();
        await saveBackfillState(env, state);
        return state;
      }
      state.generatedInCurrentPass = 0;
      state.retryPendingInCurrentPass = 0;
      state.verifiedInCurrentPass = 0;
    }
    if (!isComplete) await saveBackfillState(env, state);
  }

  state.status = 'active';
  state.nextRunAt = null;
  state.lastRunSummary = { scanned, attempted, generated, failed, retrySkipped };
  await saveBackfillState(env, state);
  return state;
}

async function getVocabularyBackfillStatus(env, origin) {
  const [state, manifest, manualReview] = await Promise.all([
    readBackfillState(env),
    env.VOCAB_CACHE?.get(SYSTEM_VOCABULARY_MANIFEST_KEY, 'json'),
    env.VOCAB_CACHE?.get(VOCABULARY_MANUAL_REVIEW_KEY, 'json'),
  ]);
  return json({
    data: {
      ...(state || { status: 'not_started', cursor: 0, generated: 0 }),
      totalWords: manifest?.count || 3000,
      schedule: 'hourly (UTC)',
      generatedPerRun: BACKFILL_GENERATE_LIMIT,
      attemptedPerRun: BACKFILL_ATTEMPT_LIMIT,
      browserRequired: false,
      manualReview: {
        count: Array.isArray(manualReview?.items) ? manualReview.items.length : 0,
        items: Array.isArray(manualReview?.items) ? manualReview.items.slice(0, 100) : [],
      },
    },
  }, 200, origin, { 'Cache-Control': 'no-store' });
}

async function getVocabularyD1Audit(env, origin) {
  if (!env.VOCAB_DB) {
    return json({
      error: 'D1 chưa được cấu hình; audit không thực hiện request AI hoặc fallback sang batch POST.',
      code: 'D1_NOT_CONFIGURED',
    }, 503, origin, { 'Cache-Control': 'no-store' });
  }
  const [summary, issues, manualReview] = await Promise.all([
    env.VOCAB_DB.prepare(`
      SELECT
        COUNT(*) AS total_records,
        SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) AS complete_records,
        SUM(CASE WHEN COALESCE(json_array_length(json_extract(payload_json, '$.contextExamples')), 0) = 5 THEN 1 ELSE 0 END) AS five_example_records,
        SUM(CASE
          WHEN length(trim(COALESCE(json_extract(payload_json, '$.primaryMeaningVi'), ''))) >= 2
            AND lower(trim(COALESCE(json_extract(payload_json, '$.primaryMeaningVi'), ''))) NOT LIKE 'từ %'
          THEN 1 ELSE 0 END) AS clear_meaning_records
      FROM vocabulary_enrichments
      WHERE prompt_version = ?1
    `).bind(VOCABULARY_PROMPT_VERSION).first(),
    env.VOCAB_DB.prepare(`
      SELECT word, status,
        COALESCE(json_array_length(json_extract(payload_json, '$.contextExamples')), 0) AS example_count,
        json_extract(payload_json, '$.primaryMeaningVi') AS meaning_vi,
        updated_at
      FROM vocabulary_enrichments
      WHERE prompt_version = ?1 AND (
        status <> 'complete'
        OR COALESCE(json_array_length(json_extract(payload_json, '$.contextExamples')), 0) <> 5
        OR length(trim(COALESCE(json_extract(payload_json, '$.primaryMeaningVi'), ''))) < 2
        OR lower(trim(COALESCE(json_extract(payload_json, '$.primaryMeaningVi'), ''))) LIKE 'từ %'
      )
      ORDER BY updated_at ASC
      LIMIT 100
    `).bind(VOCABULARY_PROMPT_VERSION).all(),
    env.VOCAB_DB.prepare(`
      SELECT COUNT(*) AS open_count
      FROM vocabulary_manual_review
      WHERE prompt_version = ?1 AND resolved_at IS NULL
    `).bind(VOCABULARY_PROMPT_VERSION).first(),
  ]);
  const totalRecords = Number(summary?.total_records) || 0;
  const completeRecords = Number(summary?.complete_records) || 0;
  const fiveExampleRecords = Number(summary?.five_example_records) || 0;
  const clearMeaningRecords = Number(summary?.clear_meaning_records) || 0;
  return json({
    data: {
      checkedAt: new Date().toISOString(),
      promptVersion: VOCABULARY_PROMPT_VERSION,
      expectedWords: 3000,
      totalRecords,
      completeRecords,
      fiveExampleRecords,
      clearMeaningRecords,
      missingRecords: Math.max(0, 3000 - totalRecords),
      manualReviewOpen: Number(manualReview?.open_count) || 0,
      releaseReady: totalRecords === 3000
        && completeRecords === 3000
        && fiveExampleRecords === 3000
        && clearMeaningRecords === 3000
        && (Number(manualReview?.open_count) || 0) === 0,
      issueSamples: Array.isArray(issues?.results) ? issues.results : [],
    },
  }, 200, origin, { 'Cache-Control': 'no-store' });
}

async function getVocabularyAdminOverview(request, env, origin) {
  const accessError = requireAdmin(request, env, origin);
  if (accessError) return accessError;
  if (!env.VOCAB_DB) {
    return json({ error: 'D1 is required for vocabulary administration.', code: 'D1_NOT_CONFIGURED' }, 503, origin);
  }
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 25));
  const offset = Math.max(0, Math.min(10_000, Number(url.searchParams.get('offset')) || 0));
  const [enrichmentCounts, jobCounts, issues, manualReview, auditEvents] = await Promise.all([
    env.VOCAB_DB.prepare(`
      SELECT status, COUNT(*) AS count
      FROM vocabulary_enrichments
      WHERE prompt_version = ?1
      GROUP BY status
    `).bind(VOCABULARY_PROMPT_VERSION).all(),
    env.VOCAB_DB.prepare(`
      SELECT status, COUNT(*) AS count
      FROM vocabulary_jobs
      WHERE prompt_version = ?1
      GROUP BY status
    `).bind(VOCABULARY_PROMPT_VERSION).all(),
    env.VOCAB_DB.prepare(`
      SELECT word, status, provider, model, updated_at,
        COALESCE(json_array_length(json_extract(payload_json, '$.contextExamples')), 0) AS example_count,
        json_extract(payload_json, '$.primaryMeaningVi') AS meaning_vi
      FROM vocabulary_enrichments
      WHERE prompt_version = ?1 AND status <> 'complete'
      ORDER BY updated_at ASC
      LIMIT ?2 OFFSET ?3
    `).bind(VOCABULARY_PROMPT_VERSION, limit, offset).all(),
    env.VOCAB_DB.prepare(`
      SELECT word, reason, attempts, created_at
      FROM vocabulary_manual_review
      WHERE prompt_version = ?1 AND resolved_at IS NULL
      ORDER BY created_at ASC
      LIMIT ?2 OFFSET ?3
    `).bind(VOCABULARY_PROMPT_VERSION, limit, offset).all(),
    env.VOCAB_DB.prepare(`
      SELECT event_id, action, word, payload_json, created_at
      FROM vocabulary_admin_events
      ORDER BY created_at DESC
      LIMIT ?1 OFFSET ?2
    `).bind(limit, offset).all(),
  ]);
  const toCounts = (rows) => Object.fromEntries(
    (Array.isArray(rows?.results) ? rows.results : [])
      .map((row) => [cleanText(row.status, 30), Number(row.count) || 0])
      .filter(([status]) => status),
  );
  return json({
    data: {
      checkedAt: new Date().toISOString(),
      promptVersion: VOCABULARY_PROMPT_VERSION,
      pagination: { limit, offset },
      enrichmentCounts: toCounts(enrichmentCounts),
      jobCounts: toCounts(jobCounts),
      issues: Array.isArray(issues?.results) ? issues.results : [],
      manualReview: Array.isArray(manualReview?.results) ? manualReview.results : [],
      auditEvents: Array.isArray(auditEvents?.results) ? auditEvents.results : [],
    },
  }, 200, origin, { 'Cache-Control': 'no-store' });
}

async function writeVocabularyAdminEvent(env, action, word, payload, createdAt = new Date().toISOString()) {
  await env.VOCAB_DB.prepare(`
    INSERT INTO vocabulary_admin_events (event_id, action, word, payload_json, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5)
  `).bind(
    crypto.randomUUID(),
    cleanText(action, 40),
    cleanText(word, 80).toLowerCase(),
    JSON.stringify(payload || {}),
    createdAt,
  ).run();
}

async function resolveVocabularyManualReview(env, word, note, resolvedAt) {
  await env.VOCAB_DB.prepare(`
    UPDATE vocabulary_manual_review
    SET resolved_at = ?3, resolution_note = ?4
    WHERE word = ?1 AND prompt_version = ?2 AND resolved_at IS NULL
  `).bind(word, VOCABULARY_PROMPT_VERSION, resolvedAt, cleanText(note, 500)).run();
  await updateManualReviewQueue(env, { word }, null);
}

async function queueVocabularyAdminRetry(request, env, origin) {
  const accessError = requireAdmin(request, env, origin);
  if (accessError) return accessError;
  if (!env.VOCAB_DB) {
    return json({ error: 'D1 is required for vocabulary administration.', code: 'D1_NOT_CONFIGURED' }, 503, origin);
  }
  const body = await readJson(request);
  const word = cleanText(body?.word, 80).toLowerCase();
  if (!/^[a-z]+(?:[ '-][a-z]+)*$/.test(word)) {
    return json({ error: 'A valid English headword is required.', code: 'INVALID_WORD' }, 400, origin);
  }
  const queuedAt = new Date().toISOString();
  await writeVocabularyJob(env, {
    word,
    status: 'retry_pending',
    attempts: 0,
    nextRetryAt: queuedAt,
    lastError: '',
    lastProviderErrors: [],
    lastTriedAt: queuedAt,
  });
  await resolveVocabularyManualReview(env, word, 'Queued for controlled retry', queuedAt);
  await writeVocabularyAdminEvent(
    env,
    'retry_queued',
    word,
    { promptVersion: VOCABULARY_PROMPT_VERSION },
    queuedAt,
  );
  return json({
    data: {
      word,
      status: 'retry_pending',
      nextRetryAt: queuedAt,
      aiCalled: false,
    },
  }, 202, origin, { 'Cache-Control': 'no-store' });
}

async function saveVocabularyAdminCorrection(request, env, origin, context) {
  const accessError = requireAdmin(request, env, origin);
  if (accessError) return accessError;
  if (!env.VOCAB_DB) {
    return json({ error: 'D1 is required for vocabulary administration.', code: 'D1_NOT_CONFIGURED' }, 503, origin);
  }
  const body = await readJson(request);
  const word = cleanText(body?.word, 80).toLowerCase();
  if (!/^[a-z]+(?:[ '-][a-z]+)*$/.test(word)) {
    return json({ error: 'A valid English headword is required.', code: 'INVALID_WORD' }, 400, origin);
  }
  let corrected;
  try {
    corrected = {
      ...normalizeEnrichment(body?.enrichment, word),
      generatedByProvider: 'MANUAL',
      generatedByModel: 'manual-correction',
      isAiGenerated: false,
      persistedOnServer: true,
      serverSavedAt: new Date().toISOString(),
    };
  } catch (error) {
    return json({
      error: 'Correction requires a clear Vietnamese meaning and exactly five distinct bilingual contexts.',
      code: cleanText(error?.message || 'INVALID_CORRECTION', 120),
    }, 400, origin);
  }
  const cacheIdentity = await cacheIdentityFor({
    version: VOCABULARY_PROMPT_VERSION,
    model: getFreeModel(env),
    word,
  });
  const saved = await writeDurableEnrichment(env, cacheIdentity.serverKey, word, corrected);
  const edgeResponse = new Response(JSON.stringify(corrected), {
    headers: { ...JSON_HEADERS, 'Cache-Control': 'public, max-age=604800' },
  });
  context.waitUntil(caches.default.put(cacheIdentity.edgeRequest, edgeResponse));
  await completeVocabularyJob(env, word);
  await resolveVocabularyManualReview(env, word, body?.note || 'Validated manual correction', corrected.serverSavedAt);
  await writeVocabularyAdminEvent(env, 'manual_correction', word, {
    promptVersion: VOCABULARY_PROMPT_VERSION,
    meaningVi: corrected.primaryMeaningVi,
    exampleCount: corrected.contextExamples.length,
    note: cleanText(body?.note, 500),
  }, corrected.serverSavedAt);
  return json({ data: { ...corrected, cacheWritePending: saved.cacheWritePending } }, 200, origin, {
    'Cache-Control': 'no-store',
  });
}

function meaningCacheKey(env, item) {
  return `meaning:v${MEANING_PROMPT_VERSION}:${getFreeModel(env) || 'default'}:${item.word}:${item.pos || '-'}`;
}

async function translateVocabularyMeanings(request, env, origin) {
  const body = await readJson(request);
  const seen = new Set();
  const items = (Array.isArray(body?.items) ? body.items : [])
    .slice(0, 30)
    .map((item) => ({
      word: cleanText(item?.word, 80).toLowerCase(),
      pos: cleanText(item?.pos || item?.type, 30).toLowerCase(),
      currentMeaning: cleanText(item?.meaning || item?.currentMeaning, 300),
    }))
    .filter((item) => {
      if (!item.word || !/^[a-z][a-z '-]*$/i.test(item.word) || seen.has(item.word)) return false;
      seen.add(item.word);
      return true;
    });
  if (!items.length) return json({ error: 'Danh sách từ vựng không hợp lệ.' }, 400, origin);

  const resolved = new Map();
  if (env.VOCAB_CACHE || env.VOCAB_DB) {
    await Promise.all(items.map(async (item) => {
      const cachedMeaning = await env.VOCAB_CACHE?.get(meaningCacheKey(env, item), 'json');
      const meaningVi = cleanText(cachedMeaning?.meaningVi, 240);
      if (meaningVi) {
        resolved.set(item.word, { word: item.word, meaningVi, source: 'meaning-cache' });
        return;
      }

      // Reuse the richer vocabulary record when this word was enriched before.
      const enrichmentIdentity = await cacheIdentityFor({
        version: VOCABULARY_PROMPT_VERSION,
        model: getFreeModel(env),
        word: item.word,
      });
      const enrichment = (await readDurableEnrichment(env, enrichmentIdentity.serverKey))?.data;
      const enrichedMeaning = cleanText(enrichment?.primaryMeaningVi, 240);
      if (enrichedMeaning) {
        resolved.set(item.word, { word: item.word, meaningVi: enrichedMeaning, source: 'enrichment-cache' });
      }
    }));
  }

  const missing = items.filter((item) => !resolved.has(item.word));
  if (missing.length) {
    const systemPrompt = `You are an English-Vietnamese lexicographer for Vietnamese CEFR A1-B2 learners.
Return only valid JSON with no Markdown using this schema: {"meanings":[{"word":"...","meaningVi":"..."}]}.
For every supplied word, provide one concise, natural, modern Vietnamese definition matching its part of speech. Include up to three common senses separated by semicolons when needed. Prefer meanings useful in daily English. Correct noisy or mistranslated supplied meanings. Never explain in English, transliterate, or omit a word.`;
    const validated = await callChatModel(env, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify({ items: missing }) },
    ], 0.15, (completion) => {
        const raw = extractJson(completion.content);
        const requested = new Set(missing.map((item) => item.word));
        const generated = (Array.isArray(raw?.meanings) ? raw.meanings : [])
          .map((item) => ({
            word: cleanText(item?.word, 80).toLowerCase(),
            meaningVi: cleanText(item?.meaningVi, 240),
            source: 'ai',
          }))
          .filter((item) => requested.has(item.word) && isUsefulVietnameseMeaning(item.meaningVi, item.word));
        if (new Set(generated.map((item) => item.word)).size !== missing.length) {
          throw new Error('INCOMPLETE_MEANING_TRANSLATION');
        }
        return { completion, generated };
      });
    const generated = validated.generated;

    await Promise.all(generated.map(async (item) => {
      resolved.set(item.word, item);
      if (env.VOCAB_CACHE) {
        const input = missing.find((candidate) => candidate.word === item.word);
        await env.VOCAB_CACHE.put(meaningCacheKey(env, input), JSON.stringify({
          meaningVi: item.meaningVi,
          savedAt: new Date().toISOString(),
        }));
      }
    }));
  }

  return json({
    data: {
      meanings: items.map((item) => resolved.get(item.word)).filter(Boolean),
    },
  }, 200, origin, { 'Cache-Control': 'private, max-age=300' });
}

async function dictionaryWordData(request, origin, context) {
  const word = cleanText(new URL(request.url).searchParams.get('word'), 80).toLowerCase();
  if (!word || !/^[a-z][a-z '-]*$/i.test(word)) {
    return json({ error: 'Từ cần tra không hợp lệ.' }, 400, origin);
  }
  const cache = caches.default;
  const cacheKey = new Request(`https://lingogoc-cache.invalid/dictionary/${encodeURIComponent(word)}`);
  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: { ...Object.fromEntries(cached.headers), ...corsHeaders(origin), 'X-LingoGoc-Cache': 'HIT' },
    });
  }
  const unavailable = () => {
    const negativeResponse = new Response(JSON.stringify({ data: null, available: false }), {
      status: 200,
      headers: { ...JSON_HEADERS, 'Cache-Control': 'public, max-age=3600' },
    });
    context.waitUntil(cache.put(cacheKey, negativeResponse.clone()));
    return new Response(negativeResponse.body, {
      status: 200,
      headers: { ...Object.fromEntries(negativeResponse.headers), ...corsHeaders(origin), 'X-LingoGoc-Cache': 'MISS-NEGATIVE' },
    });
  };

  let response;
  try {
    response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(DICTIONARY_TIMEOUT_MS),
    });
  } catch {
    return unavailable();
  }
  if (!response.ok) return unavailable();

  let payload;
  try {
    payload = await response.json();
  } catch {
    return unavailable();
  }
  const entry = Array.isArray(payload) ? payload[0] : null;
  if (!entry) return unavailable();

  const examples = [];
  const definitions = [];
  const synonyms = new Set();
  const antonyms = new Set();
  for (const meaning of Array.isArray(entry.meanings) ? entry.meanings : []) {
    for (const definition of Array.isArray(meaning.definitions) ? meaning.definitions : []) {
      if (definition.definition && definitions.length < 5) {
        definitions.push({ partOfSpeech: cleanText(meaning.partOfSpeech, 40), text: cleanText(definition.definition, 400) });
      }
      if (definition.example && examples.length < 6) examples.push(cleanText(definition.example, 500));
      for (const synonym of Array.isArray(definition.synonyms) ? definition.synonyms : []) synonyms.add(cleanText(synonym, 80));
      for (const antonym of Array.isArray(definition.antonyms) ? definition.antonyms : []) antonyms.add(cleanText(antonym, 80));
    }
    for (const synonym of Array.isArray(meaning.synonyms) ? meaning.synonyms : []) synonyms.add(cleanText(synonym, 80));
    for (const antonym of Array.isArray(meaning.antonyms) ? meaning.antonyms : []) antonyms.add(cleanText(antonym, 80));
  }
  const audioUrl = (Array.isArray(entry.phonetics) ? entry.phonetics : [])
    .map((item) => cleanText(item?.audio, 500))
    .find((url) => url && url.endsWith('.mp3')) || '';
  const result = {
    word: cleanText(entry.word || word, 80),
    phonetic: cleanText(entry.phonetic || entry.phonetics?.find((item) => item?.text)?.text, 120),
    audioUrl: audioUrl.startsWith('//') ? `https:${audioUrl}` : audioUrl,
    definitions,
    examples: [...new Set(examples)].slice(0, 6),
    synonyms: [...synonyms].filter(Boolean).slice(0, 6),
    antonyms: [...antonyms].filter(Boolean).slice(0, 6),
    sourceUrls: Array.isArray(entry.sourceUrls) ? entry.sourceUrls.slice(0, 3) : [],
  };
  const cacheResponse = new Response(JSON.stringify({ data: result }), {
    headers: { ...JSON_HEADERS, 'Cache-Control': `public, max-age=${DICTIONARY_CACHE_SECONDS}` },
  });
  context.waitUntil(cache.put(cacheKey, cacheResponse.clone()));
  return new Response(cacheResponse.body, {
    status: 200,
    headers: { ...Object.fromEntries(cacheResponse.headers), ...corsHeaders(origin), 'X-LingoGoc-Cache': 'MISS' },
  });
}

async function speechAudio(request, origin, context) {
  const url = new URL(request.url);
  const text = cleanText(url.searchParams.get('text') || url.searchParams.get('word'), 200);
  const requestedLanguage = cleanText(url.searchParams.get('lang'), 12).toLowerCase();
  const language = /^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(requestedLanguage) ? requestedLanguage : 'en-us';
  const hasControlCharacters = [...text].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if (!text || hasControlCharacters) {
    return json({ error: 'Nội dung đọc không hợp lệ.' }, 400, origin);
  }

  const cache = caches.default;
  const cacheKey = new Request(`https://lingogoc-cache.invalid/speech/${language}/${encodeURIComponent(text)}`);
  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      status: 200,
      headers: {
        'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg',
        'Cache-Control': cached.headers.get('Cache-Control') || 'public, max-age=604800',
        ...corsHeaders(origin),
      },
    });
  }

  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(language)}&q=${encodeURIComponent(text)}`;
  const audioResponse = await fetch(ttsUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 LingoGoc/1.0' },
  });
  if (!audioResponse.ok || !audioResponse.body) {
    return json({ error: 'Không thể tạo audio cho nội dung này.' }, 502, origin);
  }

  const responseHeaders = {
    'Content-Type': audioResponse.headers.get('Content-Type') || 'audio/mpeg',
    'Cache-Control': 'public, max-age=604800',
  };
  const cacheResponse = new Response(audioResponse.body, { status: 200, headers: responseHeaders });
  context.waitUntil(cache.put(cacheKey, cacheResponse.clone()));
  return new Response(cacheResponse.body, {
    status: 200,
    headers: { ...responseHeaders, ...corsHeaders(origin) },
  });
}

function normalizeSpeakingScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null;
}

function normalizeSpeakingReply(data, model) {
  const replyEn = cleanText(data?.replyEn || data?.reply_en, 1000);
  if (!replyEn) throw new Error('INVALID_AI_JSON');
  return {
    replyEn,
    replyVi: cleanText(data?.replyVi || data?.reply_vi, 1000),
    correction: cleanText(data?.correction, 1000),
    encouragement: cleanText(data?.encouragement, 1000),
    hints: (Array.isArray(data?.hints) ? data.hints : []).slice(0, 3).map((hint) => ({
      en: cleanText(hint?.en, 500),
      vi: cleanText(hint?.vi, 500),
    })).filter((hint) => hint.en),
    scores: {
      grammar: normalizeSpeakingScore(data?.scores?.grammar),
      vocabulary: normalizeSpeakingScore(data?.scores?.vocabulary),
      fluency: normalizeSpeakingScore(data?.scores?.fluency),
    },
    generatedByModel: model,
  };
}

async function speakingChat(request, env, origin) {
  const body = await readJson(request);
  const suppliedRequestId = cleanText(request.headers.get('X-Idempotency-Key') || body?.requestId, 160);
  const requestId = suppliedRequestId && /^[a-zA-Z0-9._:-]+$/.test(suppliedRequestId)
    ? suppliedRequestId
    : crypto.randomUUID();
  const cache = caches.default;
  const cacheKey = new Request(`https://lingogoc-cache.invalid/speaking/${encodeURIComponent(requestId)}`);
  const cached = await cache.match(cacheKey);
  if (cached) {
    return json(await cached.json(), 200, origin, {
      'Cache-Control': `private, max-age=${SPEAKING_CACHE_SECONDS}`,
      'X-LingoGoc-Cache': 'HIT',
    });
  }
  const scenario = cleanText(
    typeof body?.scenario === 'string'
      ? body.scenario
      : body?.scenario?.titleEn || body?.scenario?.title || body?.scenario?.id,
    120,
  ) || 'Daily conversation';
  const history = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
  const messages = history.map((item) => ({
    role: item?.role === 'assistant' ? 'assistant' : 'user',
    content: cleanText(item?.content, 1000),
  })).filter((item) => item.content);
  const system = `You are a friendly English speaking coach. Scenario: ${scenario}. Reply at CEFR A2-B1 level. Return only JSON with keys replyEn, replyVi, correction, encouragement, hints (up to 3 objects with en and vi), and scores with grammar, vocabulary, and fluency integers from 0 to 100. Do not include a pronunciation score. Keep the conversation moving with one short question.`;
  let work = activeSpeakingRequests.get(requestId);
  if (!work) {
    work = (async () => {
      const completion = await callChatModel(env, [{ role: 'system', content: system }, ...messages], 0.6);
      return normalizeSpeakingReply(extractJson(completion.content), completion.model);
    })();
    activeSpeakingRequests.set(requestId, work);
  }
  try {
    const result = await work;
    const cacheResponse = new Response(JSON.stringify(result), {
      headers: { ...JSON_HEADERS, 'Cache-Control': `private, max-age=${SPEAKING_CACHE_SECONDS}` },
    });
    await cache.put(cacheKey, cacheResponse);
    return json(result, 200, origin, {
      'Cache-Control': `private, max-age=${SPEAKING_CACHE_SECONDS}`,
      'X-LingoGoc-Cache': 'MISS',
    });
  } finally {
    if (activeSpeakingRequests.get(requestId) === work) activeSpeakingRequests.delete(requestId);
  }
}

async function getOperationsStatus(env, origin) {
  const now = Date.now();
  const configured = {
    xkiro: Boolean((env.XTROUTER_API_KEY || env.AI_API_KEY) && getFreeModel(env)),
    groq: Boolean(env.GROQ_API_KEY),
    workersAi: Boolean(env.AI?.run),
    openRouter: Boolean(env.OPENROUTER_API_KEY),
    paidFallback: Boolean(getPaidModel(env)),
  };
  const providerState = {
    xkiro: { configured: configured.xkiro, coolingDown: freeModelCooldownUntil > now, cooldownUntil: freeModelCooldownUntil || null, health: providerHealthSnapshot('XKIRO_FREE', now) },
    groq: { configured: configured.groq, coolingDown: groqCooldownUntil > now, cooldownUntil: groqCooldownUntil || null, health: providerHealthSnapshot('GROQ_FREE', now) },
    workersAi: { configured: configured.workersAi, coolingDown: workersAiCooldownUntil > now, cooldownUntil: workersAiCooldownUntil || null, health: providerHealthSnapshot('CLOUDFLARE_FREE', now) },
    openRouter: { configured: configured.openRouter, coolingDown: openRouterCooldownUntil > now, cooldownUntil: openRouterCooldownUntil || null, health: providerHealthSnapshot('OPENROUTER_FREE', now) },
    paidFallback: { configured: configured.paidFallback, coolingDown: false, cooldownUntil: null, health: providerHealthSnapshot('XKIRO_PAID', now) },
  };
  let backfill = null;
  if (env.VOCAB_CACHE || env.VOCAB_DB) {
    try {
      backfill = await readBackfillState(env);
    } catch {
      backfill = null;
    }
  }
  const lastRunMs = Date.parse(backfill?.lastRunAt || '');
  const alerts = [];
  if (!env.VOCAB_CACHE && !env.VOCAB_DB) alerts.push({ code: 'STORAGE_UNAVAILABLE', severity: 'critical' });
  if (!Object.values(configured).some(Boolean)) alerts.push({ code: 'AI_UNAVAILABLE', severity: 'critical' });
  if (backfill?.status === 'quota_wait') alerts.push({ code: 'BACKFILL_QUOTA_WAIT', severity: 'warning' });
  if (Number.isFinite(lastRunMs) && now - lastRunMs > 2 * 60 * 60 * 1000) {
    alerts.push({ code: 'BACKFILL_STALE', severity: 'warning' });
  }
  return json({
    data: {
      status: alerts.some((item) => item.severity === 'critical') ? 'critical' : alerts.length ? 'degraded' : 'healthy',
      checkedAt: new Date(now).toISOString(),
      storage: {
        configured: Boolean(env.VOCAB_CACHE || env.VOCAB_DB),
        kvConfigured: Boolean(env.VOCAB_CACHE),
        d1Configured: Boolean(env.VOCAB_DB),
        durableSource: env.VOCAB_DB ? 'D1' : env.VOCAB_CACHE ? 'KV' : null,
      },
      cache: {
        ...runtimeCacheMetrics,
        hitRate: runtimeCacheMetrics.total
          ? Number((runtimeCacheMetrics.hits / runtimeCacheMetrics.total).toFixed(4))
          : null,
      },
      providers: providerState,
      backfill: backfill ? {
        status: backfill.status || 'unknown',
        cursor: Number(backfill.cursor) || 0,
        generated: Number(backfill.generated) || 0,
        failed: Number(backfill.failed) || 0,
        retryPending: Number(backfill.retryPendingInCurrentPass) || 0,
        lastRunAt: backfill.lastRunAt || null,
        lastSuccessAt: backfill.lastSuccessAt || null,
        nextRunAt: backfill.nextRunAt || null,
      } : null,
      thresholds: {
        slowRequestMs: 1500,
        providerTimeoutMs: PROVIDER_TIMEOUT_MS,
        providerHedgeDelayMs: PROVIDER_HEDGE_DELAY_MS,
        staleBackfillMs: 2 * 60 * 60 * 1000,
      },
      alerts,
    },
  }, 200, origin, { 'Cache-Control': 'no-store' });
}

function requestIdFor(request) {
  const supplied = cleanText(request.headers.get('X-Request-ID'), 80);
  return supplied && /^[a-zA-Z0-9._:-]+$/.test(supplied) ? supplied : crypto.randomUUID();
}

function withRequestMetadata(response, requestId, startedAt, path, metrics = null) {
  const durationMs = Date.now() - startedAt;
  const headers = new Headers(response.headers);
  const cacheStatus = headers.get('X-LingoGoc-Cache');
  if (cacheStatus) {
    runtimeCacheMetrics.total += 1;
    runtimeCacheMetrics.byStatus[cacheStatus] = (runtimeCacheMetrics.byStatus[cacheStatus] || 0) + 1;
    if (cacheStatus.startsWith('MISS')) runtimeCacheMetrics.misses += 1;
    else runtimeCacheMetrics.hits += 1;
    metrics?.writeDataPoint?.({
      indexes: ['CACHE'],
      blobs: [path, cacheStatus],
      doubles: [cacheStatus.startsWith('MISS') ? 0 : 1, Date.now() - startedAt],
    });
  }
  headers.set('X-Request-ID', requestId);
  headers.set('Server-Timing', `app;dur=${durationMs}`);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
  headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (durationMs >= 1500) {
    console.warn(JSON.stringify({ event: 'slow_request', requestId, path, status: response.status, durationMs }));
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function publicError(error) {
  const code = String(error?.message || 'UNKNOWN_ERROR');
  if (code === 'PAYLOAD_TOO_LARGE') return ['Dữ liệu gửi lên quá lớn.', 413, code, false];
  if (code === 'AI_NOT_CONFIGURED') return ['Backend chưa được cấu hình XTROUTER_API_KEY và AI_FREE_MODEL.', 503, code, false];
  if (code.startsWith('AI_PROVIDER_')) return ['Nhà cung cấp AI đang từ chối hoặc tạm thời không khả dụng.', 502, code, true];
  if (code === 'INVALID_AI_JSON' || code === 'INSUFFICIENT_BILINGUAL_EXAMPLES' || code === 'INVALID_VIETNAMESE_MEANING' || code === 'INCOMPLETE_MEANING_TRANSLATION') return ['AI trả về dữ liệu chưa đúng định dạng, hệ thống sẽ thử lại.', 502, code, true];
  if (error instanceof SyntaxError) return ['JSON không hợp lệ.', 400, 'INVALID_REQUEST_JSON', false];
  return ['Máy chủ AI gặp lỗi tạm thời.', 500, code, true];
}

export default {
  async fetch(request, env, context) {
    const startedAt = Date.now();
    const requestId = requestIdFor(request);
    const url = new URL(request.url);
    const respond = (response) => withRequestMetadata(response, requestId, startedAt, url.pathname, env.METRICS);
    const origin = allowedOrigin(request, env);
    if (!origin) return respond(json({ error: 'Origin không được phép.' }, 403, 'null'));
    if (request.method === 'OPTIONS') return respond(new Response(null, { status: 204, headers: corsHeaders(origin) }));
    const rateLimit = checkRateLimit(request, env, url.pathname);
    if (rateLimit) {
      return respond(json({
        error: 'Quá nhiều yêu cầu. Hãy thử lại sau.',
        code: 'RATE_LIMITED',
        retryable: true,
      }, 429, origin, {
        'Retry-After': String(rateLimit.retryAfter),
        'RateLimit-Limit': String(rateLimit.limit),
        'Cache-Control': 'no-store',
      }));
    }
    if (request.method === 'POST' && !String(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) {
      return respond(json({
        error: 'Content-Type phải là application/json.',
        code: 'UNSUPPORTED_MEDIA_TYPE',
        retryable: false,
      }, 415, origin, { 'Cache-Control': 'no-store' }));
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      const freeModel = getFreeModel(env);
      const paidModel = getPaidModel(env);
      const groqConfigured = Boolean(env.GROQ_API_KEY);
      const workersAiConfigured = Boolean(env.AI?.run);
      const xkiroConfigured = Boolean((env.XTROUTER_API_KEY || env.AI_API_KEY) && freeModel);
      const openRouterConfigured = Boolean(env.OPENROUTER_API_KEY);
      const configuredFreeProviders = [groqConfigured, workersAiConfigured, xkiroConfigured, openRouterConfigured]
        .filter(Boolean).length;
      return respond(json({
        ok: true,
        aiConfigured: configuredFreeProviders > 0,
        model: freeModel,
        freeModel,
        paidFallbackModel: paidModel,
        paidFallbackConfigured: Boolean(paidModel),
        groqModel: cleanText(env.GROQ_FREE_MODEL || 'qwen/qwen3.8-27b', 160),
        groqConfigured,
        workersAiModel: cleanText(env.WORKERS_AI_MODEL || '@cf/google/gemma-4-26b-a4b-it', 160),
        workersAiConfigured,
        workersAiDailyRequestLimit: Math.max(1, Math.min(500, Number(env.WORKERS_AI_DAILY_REQUEST_LIMIT) || DEFAULT_WORKERS_AI_DAILY_REQUEST_LIMIT)),
        openRouterModel: cleanText(env.OPENROUTER_FREE_MODEL || 'deepseek/deepseek-v4-flash-0731:free', 160),
        openRouterConfigured,
        freeProviderStrategy: configuredFreeProviders > 1 ? 'health-ranked-adaptive-hedge' : 'single-provider',
        providerTimeoutMs: PROVIDER_TIMEOUT_MS,
        providerHedgeDelayMs: PROVIDER_HEDGE_DELAY_MS,
        serverStorageConfigured: Boolean(env.VOCAB_CACHE || env.VOCAB_DB),
        d1Configured: Boolean(env.VOCAB_DB),
      }, 200, origin));
    }

    try {
      if (url.pathname === '/api/vocabulary/manifest' && request.method === 'GET') {
        return respond(await getSystemVocabularyManifest(env, origin));
      }
      if (url.pathname === '/api/vocabulary/catalog' && request.method === 'GET') {
        return respond(await getSystemVocabulary(env, origin));
      }
      if (url.pathname === '/api/vocabulary/batch' && request.method === 'POST') {
        return respond(await getVocabularyBatch(request, env, origin));
      }
      if (url.pathname === '/api/vocabulary/backfill/status' && request.method === 'GET') {
        return respond(await getVocabularyBackfillStatus(env, origin));
      }
      if (url.pathname === '/api/vocabulary/audit' && request.method === 'GET') {
        return respond(await getVocabularyD1Audit(env, origin));
      }
      if (url.pathname === '/api/admin/vocabulary' && request.method === 'GET') {
        return respond(await getVocabularyAdminOverview(request, env, origin));
      }
      if (url.pathname === '/api/admin/vocabulary/retry' && request.method === 'POST') {
        return respond(await queueVocabularyAdminRetry(request, env, origin));
      }
      if (url.pathname === '/api/admin/vocabulary/correction' && request.method === 'POST') {
        return respond(await saveVocabularyAdminCorrection(request, env, origin, context));
      }
      if (url.pathname === '/api/operations/status' && request.method === 'GET') {
        return respond(await getOperationsStatus(env, origin));
      }
      if (url.pathname === '/api/vocabulary/enrich' && request.method === 'POST') {
        return respond(await enrichVocabulary(request, env, origin, context));
      }
      if (url.pathname === '/api/vocabulary/meanings' && request.method === 'POST') {
        return respond(await translateVocabularyMeanings(request, env, origin));
      }
      if (url.pathname === '/api/vocabulary/pronunciation' && request.method === 'GET') {
        return respond(await speechAudio(request, origin, context));
      }
      if (url.pathname === '/api/vocabulary/dictionary' && request.method === 'GET') {
        return respond(await dictionaryWordData(request, origin, context));
      }
      if (url.pathname === '/api/speech/audio' && request.method === 'GET') {
        return respond(await speechAudio(request, origin, context));
      }
      if (url.pathname === '/api/vocabulary/cambridge' && request.method === 'GET') {
        // Optional licensed integration. Returning 204 lets the frontend use
        // Free Dictionary + AI enrichment without presenting a false error.
        return respond(new Response(null, { status: 204, headers: corsHeaders(origin) }));
      }
      if (url.pathname === '/api/speaking/chat' && request.method === 'POST') {
        return respond(await speakingChat(request, env, origin));
      }
      if (url.pathname === '/api/speaking/speech' && request.method === 'POST') {
        return respond(json({ error: 'Cloud TTS chưa được cấu hình; frontend sẽ dùng giọng đọc trình duyệt.' }, 501, origin));
      }
      return respond(json({ error: 'Không tìm thấy endpoint.' }, 404, origin));
    } catch (error) {
      const [message, status, code, retryable] = publicError(error);
      console.error(JSON.stringify({
        event: 'request_error',
        requestId,
        path: url.pathname,
        method: request.method,
        status,
        code: cleanText(code, 120),
        retryable,
        durationMs: Date.now() - startedAt,
      }));
      return respond(json({ error: message, code, retryable, requestId }, status, origin));
    }
  },
  async scheduled(controller, env, context) {
    context.waitUntil(runScheduledVocabularyBackfill(env, context, controller.scheduledTime));
  },
};
