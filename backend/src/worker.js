const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const MAX_BODY_BYTES = 20_000;
const VOCABULARY_PROMPT_VERSION = 2;
const MEANING_PROMPT_VERSION = 1;
const SYSTEM_VOCABULARY_KEY = 'system-vocabulary:v1';
const SYSTEM_VOCABULARY_MANIFEST_KEY = 'system-vocabulary:manifest:v1';
const VOCABULARY_BACKFILL_STATE_KEY = 'system-vocabulary:backfill:v1';
const VOCABULARY_BACKFILL_RETRY_PREFIX = 'system-vocabulary:backfill-retry:v1:';
const BACKFILL_SCAN_LIMIT = 96;
const BACKFILL_GENERATE_LIMIT = 2;
const BACKFILL_ATTEMPT_LIMIT = 2;
const DEFAULT_WORKERS_AI_DAILY_REQUEST_LIMIT = 100;
const PROVIDER_TIMEOUT_MS = 12_000;
const DICTIONARY_TIMEOUT_MS = 3_500;
const DICTIONARY_CACHE_SECONDS = 30 * 24 * 60 * 60;
let freeModelCooldownUntil = 0;
let openRouterCooldownUntil = 0;
let groqCooldownUntil = 0;
let workersAiCooldownUntil = 0;

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
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  };
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
}) {
  const retryableStatuses = new Set([429, 500, 502, 503, 504]);
  let lastError = Object.assign(new Error(`${provider}_UNKNOWN`), { provider, quota: false });

  for (let attempt = 0; attempt < 3; attempt += 1) {
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
            if (content) return { content, model: payload?.model || model, provider };
          } catch {
            // Retry malformed provider JSON below.
          }
        }
        lastError = Object.assign(new Error(`${provider}_INVALID_RESPONSE`), { provider, quota: false });
      } else {
        const detail = cleanText(await response.text(), 500);
        const quota = isQuotaError(response.status, detail) || (response.status === 429 && attempt === 2);
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

    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
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
    return { content, model: payload?.model || model, provider };
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
    invoke: (signal) => callProviderModel({ ...options, messages, temperature, signal }),
  });

  if (groqApiKey && groqModel && now >= groqCooldownUntil) {
    addHttpProvider({
      apiKey: groqApiKey,
      baseUrl: groqBaseUrl,
      model: groqModel,
      provider: 'GROQ_FREE',
      extraBody: { response_format: { type: 'json_object' } },
    });
  }
  if (env.AI?.run && now >= workersAiCooldownUntil) {
    providers.push({
      provider: 'CLOUDFLARE_FREE',
      invoke: () => callWorkersAiModel(env, messages, temperature),
    });
  }
  if (xkiroApiKey && freeModel && freeModel !== 'set-your-model-id' && now >= freeModelCooldownUntil) {
    addHttpProvider({ apiKey: xkiroApiKey, baseUrl: xkiroBaseUrl, model: freeModel, provider: 'XKIRO_FREE' });
  }
  if (openRouterApiKey && openRouterModel && now >= openRouterCooldownUntil) {
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

  const markProviderCooldown = (providerError) => {
    if (!providerError?.quota) return;
    if (providerError.provider === 'GROQ_FREE') groqCooldownUntil = now + 5 * 60 * 1000;
    if (providerError.provider === 'CLOUDFLARE_FREE') workersAiCooldownUntil = now + 5 * 60 * 1000;
    if (providerError.provider === 'XKIRO_FREE') freeModelCooldownUntil = now + 5 * 60 * 1000;
    if (providerError.provider === 'OPENROUTER_FREE') openRouterCooldownUntil = now + 5 * 60 * 1000;
  };
  const invokeProvider = async (provider, signal) => {
    try {
      const completion = await provider.invoke(signal);
      return validateCompletion ? await validateCompletion(completion) : completion;
    } catch (error) {
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
    try {
      return await Promise.any(providers.map(async (provider, index) => {
        // Start the two preferred providers immediately. Hedge slower fallbacks
        // only when no valid answer has arrived, which preserves low latency
        // without spending all free-provider quotas on every interaction.
        const hedgeDelay = index < 2 ? 0 : (index - 1) * 800;
        await waitWithSignal(hedgeDelay, controllers[index].signal);
        return invokeProvider(provider, controllers[index].signal);
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
      try {
        const paidCompletion = await callProviderModel({
          apiKey: xkiroApiKey,
          baseUrl: xkiroBaseUrl,
          model: paidModel,
          messages,
          temperature,
          provider: 'XKIRO_PAID',
        });
        return validateCompletion ? await validateCompletion(paidCompletion) : paidCompletion;
      } catch (error) {
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
  const cached = await cache.match(cacheIdentity.edgeRequest);
  if (cached) {
    try {
      // Old edge entries with fewer than five distinct contexts are invalidated
      // and regenerated instead of being returned as a successful cache hit.
      const data = normalizeEnrichment(await cached.json(), word);
      if (env.VOCAB_CACHE && !data.persistedOnServer) {
        const backfilled = { ...data, persistedOnServer: true, serverSavedAt: new Date().toISOString() };
        await env.VOCAB_CACHE.put(cacheIdentity.serverKey, JSON.stringify(backfilled));
        return json({ data: { ...backfilled, fromCache: true } }, 200, origin, { 'X-LingoGoc-Cache': 'HIT+KV' });
      }
      return json({ data: { ...data, fromCache: true } }, 200, origin, { 'X-LingoGoc-Cache': 'HIT' });
    } catch {
      // Remove an incomplete edge response and continue with durable KV/AI.
      context.waitUntil(cache.delete(cacheIdentity.edgeRequest));
    }
  }

  if (env.VOCAB_CACHE) {
    const stored = await env.VOCAB_CACHE.get(cacheIdentity.serverKey, 'json');
    if (stored) {
      try {
        const persisted = normalizeEnrichment(stored, word);
        const edgeResponse = new Response(JSON.stringify(persisted), {
          headers: { ...JSON_HEADERS, 'Cache-Control': 'public, max-age=604800' },
        });
        context.waitUntil(cache.put(cacheIdentity.edgeRequest, edgeResponse));
        return json({ data: { ...persisted, fromCache: true, persistedOnServer: true } }, 200, origin, {
          'X-LingoGoc-Cache': 'KV',
        });
      } catch {
        const partial = normalizePartialEnrichment(stored, word);
        if (partial.primaryMeaningVi || partial.contextExamples.length) bestPartial = partial;
      }
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
    if (env.VOCAB_CACHE && bestPartial?.primaryMeaningVi) {
      await env.VOCAB_CACHE.put(cacheIdentity.serverKey, JSON.stringify({
        ...bestPartial,
        status: 'partial',
        persistedOnServer: true,
        serverSavedAt: new Date().toISOString(),
        lastError: cleanText(String(error?.message || 'UNKNOWN_ERROR').split(':')[0], 120),
      }));
    }
    throw error;
  }

  const result = {
    ...generated.normalized,
    generatedByModel: generated.completion.model,
    generatedByProvider: generated.completion.provider,
    status: 'complete',
    persistedOnServer: Boolean(env.VOCAB_CACHE),
    serverSavedAt: new Date().toISOString(),
  };
  if (env.VOCAB_CACHE) {
    // Await the durable write: the client only receives success after the
    // generated examples have been safely stored on the server.
    await env.VOCAB_CACHE.put(cacheIdentity.serverKey, JSON.stringify(result));
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
  if (!env.VOCAB_CACHE) return json({ data: { items: [], missing: items.map((item) => item.word) } }, 200, origin);

  const records = await Promise.all(items.map(async (item) => {
    const identity = await cacheIdentityFor({
      version: VOCABULARY_PROMPT_VERSION,
      model: getFreeModel(env),
      word: item.word,
    });
    const storedEnrichment = await env.VOCAB_CACHE.get(identity.serverKey, 'json');
    let enrichment = null;
    let partial = null;
    try {
      if (storedEnrichment) enrichment = normalizeEnrichment(storedEnrichment, item.word);
    } catch {
      enrichment = null;
      if (storedEnrichment) partial = normalizePartialEnrichment(storedEnrichment, item.word);
    }
    // A complete enrichment already contains the canonical Vietnamese meaning.
    // Only spend a second KV read when that richer record is unavailable.
    const storedMeaning = enrichment || partial?.primaryMeaningVi
      ? null
      : await env.VOCAB_CACHE.get(meaningCacheKey(env, item), 'json');
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
  return json({
    data: {
      items: ready,
      missing: items.filter((item) => !readyWords.has(item.word)).map((item) => item.word),
      needsEnrichment: items.filter((item) => !enrichedWords.has(item.word)).map((item) => item.word),
    },
  }, 200, origin, { 'Cache-Control': 'private, max-age=60' });
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
  await env.VOCAB_CACHE.put(VOCABULARY_BACKFILL_STATE_KEY, JSON.stringify(state));
}

function backfillRetryKey(word) {
  return `${VOCABULARY_BACKFILL_RETRY_PREFIX}${encodeURIComponent(word)}`;
}

function retryDelayMs(attempts) {
  return [30 * 60, 2 * 60 * 60, 6 * 60 * 60, 24 * 60 * 60][Math.min(Math.max(attempts - 1, 0), 3)] * 1000;
}

async function runScheduledVocabularyBackfill(env, context, scheduledTime = Date.now()) {
  if (!env.VOCAB_CACHE) return { status: 'disabled', reason: 'KV_NOT_CONFIGURED' };
  const catalog = await env.VOCAB_CACHE.get(SYSTEM_VOCABULARY_KEY, 'json');
  if (!catalog || !Array.isArray(catalog.words) || catalog.words.length !== 3000 || !catalog.contentHash) {
    return { status: 'disabled', reason: 'CATALOG_NOT_READY' };
  }

  const storedState = await env.VOCAB_CACHE.get(VOCABULARY_BACKFILL_STATE_KEY, 'json');
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
    const storedEnrichment = await env.VOCAB_CACHE.get(identity.serverKey, 'json');
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
      const retryKey = backfillRetryKey(word);
      const retryState = await env.VOCAB_CACHE.get(retryKey, 'json');
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
        generated += 1;
        state.generated += 1;
        state.generatedInCurrentPass += 1;
        state.lastSuccessAt = new Date().toISOString();
        state.lastWord = word;
        state.lastProvider = enrichmentPayload?.data?.generatedByProvider || null;
        state.lastError = null;
        if (env.VOCAB_CACHE.delete) await env.VOCAB_CACHE.delete(retryKey);
      } catch (error) {
        const code = cleanText(String(error?.message || 'UNKNOWN_ERROR').split(':')[0], 120);
        const isGlobalProviderFailure = error?.allProvidersQuota || code === 'AI_NOT_CONFIGURED';
        state.lastError = code;
        state.lastWord = word;
        if (isGlobalProviderFailure) {
          state.status = 'quota_wait';
          state.nextRunAt = new Date(now + 6 * 60 * 60 * 1000).toISOString();
          await saveBackfillState(env, state);
          return state;
        }
        const retryAttempts = (Number(retryState?.attempts) || 0) + 1;
        const nextRetryAt = new Date(now + retryDelayMs(retryAttempts)).toISOString();
        await env.VOCAB_CACHE.put(retryKey, JSON.stringify({
          word,
          attempts: retryAttempts,
          lastError: code,
          lastProviderErrors: error?.providerErrors || [],
          lastTriedAt: new Date(now).toISOString(),
          nextRetryAt,
        }), { expirationTtl: 7 * 24 * 60 * 60 });
        failed += 1;
        state.failed += 1;
        state.retried += retryAttempts > 1 ? 1 : 0;
        state.retryPendingInCurrentPass += 1;
      }
    }

    state.cursor += 1;
    scanned += 1;
    if (state.cursor >= catalog.words.length) {
      state.cursor = 0;
      state.passes += 1;
      if (state.generatedInCurrentPass === 0 && state.retryPendingInCurrentPass === 0) {
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
  const [state, manifest] = await Promise.all([
    env.VOCAB_CACHE?.get(VOCABULARY_BACKFILL_STATE_KEY, 'json'),
    env.VOCAB_CACHE?.get(SYSTEM_VOCABULARY_MANIFEST_KEY, 'json'),
  ]);
  return json({
    data: {
      ...(state || { status: 'not_started', cursor: 0, generated: 0 }),
      totalWords: manifest?.count || 3000,
      schedule: 'every 15 minutes (UTC)',
      generatedPerRun: BACKFILL_GENERATE_LIMIT,
      attemptedPerRun: BACKFILL_ATTEMPT_LIMIT,
      browserRequired: false,
    },
  }, 200, origin, { 'Cache-Control': 'no-store' });
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
  if (env.VOCAB_CACHE) {
    await Promise.all(items.map(async (item) => {
      const cachedMeaning = await env.VOCAB_CACHE.get(meaningCacheKey(env, item), 'json');
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
      const enrichment = await env.VOCAB_CACHE.get(enrichmentIdentity.serverKey, 'json');
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

async function speakingChat(request, env, origin) {
  const body = await readJson(request);
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
  const system = `You are a friendly English speaking coach. Scenario: ${scenario}. Reply at CEFR A2-B1 level. Return only JSON with keys replyEn, replyVi, correction, encouragement, and hints (an array of up to 3 objects with en and vi). Keep the conversation moving with one short question.`;
  const completion = await callChatModel(env, [{ role: 'system', content: system }, ...messages], 0.6);
  return json({ ...extractJson(completion.content), generatedByModel: completion.model }, 200, origin);
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
    const origin = allowedOrigin(request, env);
    if (!origin) return json({ error: 'Origin không được phép.' }, 403, 'null');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });

    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') {
      const freeModel = getFreeModel(env);
      const paidModel = getPaidModel(env);
      const groqConfigured = Boolean(env.GROQ_API_KEY);
      const workersAiConfigured = Boolean(env.AI?.run);
      const xkiroConfigured = Boolean((env.XTROUTER_API_KEY || env.AI_API_KEY) && freeModel);
      const openRouterConfigured = Boolean(env.OPENROUTER_API_KEY);
      const configuredFreeProviders = [groqConfigured, workersAiConfigured, xkiroConfigured, openRouterConfigured]
        .filter(Boolean).length;
      return json({
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
        freeProviderStrategy: configuredFreeProviders > 1 ? 'hedged-race' : 'single-provider',
        providerTimeoutMs: PROVIDER_TIMEOUT_MS,
        serverStorageConfigured: Boolean(env.VOCAB_CACHE),
      }, 200, origin);
    }

    try {
      if (url.pathname === '/api/vocabulary/manifest' && request.method === 'GET') {
        return await getSystemVocabularyManifest(env, origin);
      }
      if (url.pathname === '/api/vocabulary/catalog' && request.method === 'GET') {
        return await getSystemVocabulary(env, origin);
      }
      if (url.pathname === '/api/vocabulary/batch' && request.method === 'POST') {
        return await getVocabularyBatch(request, env, origin);
      }
      if (url.pathname === '/api/vocabulary/backfill/status' && request.method === 'GET') {
        return await getVocabularyBackfillStatus(env, origin);
      }
      if (url.pathname === '/api/vocabulary/enrich' && request.method === 'POST') {
        return await enrichVocabulary(request, env, origin, context);
      }
      if (url.pathname === '/api/vocabulary/meanings' && request.method === 'POST') {
        return await translateVocabularyMeanings(request, env, origin);
      }
      if (url.pathname === '/api/vocabulary/pronunciation' && request.method === 'GET') {
        return await speechAudio(request, origin, context);
      }
      if (url.pathname === '/api/vocabulary/dictionary' && request.method === 'GET') {
        return await dictionaryWordData(request, origin, context);
      }
      if (url.pathname === '/api/speech/audio' && request.method === 'GET') {
        return await speechAudio(request, origin, context);
      }
      if (url.pathname === '/api/vocabulary/cambridge' && request.method === 'GET') {
        // Optional licensed integration. Returning 204 lets the frontend use
        // Free Dictionary + AI enrichment without presenting a false error.
        return new Response(null, { status: 204, headers: corsHeaders(origin) });
      }
      if (url.pathname === '/api/speaking/chat' && request.method === 'POST') {
        return await speakingChat(request, env, origin);
      }
      if (url.pathname === '/api/speaking/speech' && request.method === 'POST') {
        return json({ error: 'Cloud TTS chưa được cấu hình; frontend sẽ dùng giọng đọc trình duyệt.' }, 501, origin);
      }
      return json({ error: 'Không tìm thấy endpoint.' }, 404, origin);
    } catch (error) {
      const [message, status, code, retryable] = publicError(error);
      return json({ error: message, code, retryable }, status, origin);
    }
  },
  async scheduled(controller, env, context) {
    context.waitUntil(runScheduledVocabularyBackfill(env, context, controller.scheduledTime));
  },
};
