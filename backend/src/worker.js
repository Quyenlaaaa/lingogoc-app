const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const MAX_BODY_BYTES = 20_000;

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  if (!origin) return allowed[0] || '*';
  return allowed.includes('*') || allowed.includes(origin.replace(/\/+$/, '')) ? origin : '';
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
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
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
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function normalizeEnrichment(data, word) {
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
  if (examples.length < 3) throw new Error('INSUFFICIENT_BILINGUAL_EXAMPLES');

  return {
    word,
    primaryMeaningVi: cleanText(data?.primaryMeaningVi, 240),
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
    isAiGenerated: true,
  };
}

async function callChatModel(env, messages, temperature = 0.45) {
  const apiKey = env.XTROUTER_API_KEY || env.AI_API_KEY;
  if (!apiKey || !env.AI_MODEL || env.AI_MODEL === 'set-your-model-id') {
    throw new Error('AI_NOT_CONFIGURED');
  }
  const baseUrl = String(env.AI_BASE_URL || 'https://api.xkiro.com/v1').replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(env.OPENROUTER_SITE_URL ? { 'HTTP-Referer': env.OPENROUTER_SITE_URL } : {}),
      ...(env.OPENROUTER_APP_NAME ? { 'X-Title': env.OPENROUTER_APP_NAME } : {}),
    },
    body: JSON.stringify({ model: env.AI_MODEL, temperature, messages }),
  });
  if (!response.ok) {
    const detail = cleanText(await response.text(), 500);
    throw new Error(`AI_PROVIDER_${response.status}${detail ? `: ${detail}` : ''}`);
  }
  const payload = await response.json();
  return payload?.choices?.[0]?.message?.content || '';
}

async function cacheKeyFor(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return new Request(`https://lingogoc-cache.invalid/vocabulary/${hash}`, { method: 'GET' });
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
  const key = await cacheKeyFor(input);
  const cached = await cache.match(key);
  if (cached) {
    const data = await cached.json();
    return json({ data: { ...data, fromCache: true } }, 200, origin, { 'X-LingoGoc-Cache': 'HIT' });
  }

  const systemPrompt = `You are a meticulous English-Vietnamese lexicographer for CEFR A1-B2 learners.
Return only valid JSON. Never use generic templates such as "She used the word ... in her sentence."
Create exactly 5 natural examples in genuinely different situations: daily life, work or study, conversation, the supplied topic, and an idiomatic or common collocation context.
Every English sentence must use the target word naturally. Every Vietnamese translation must faithfully translate that sentence and sound natural to Vietnamese speakers.
Use the supplied English dictionary definitions to disambiguate meaning. Do not invent rare senses.
Schema: {"primaryMeaningVi":"...","meaningNote":"...","senses":[{"pos":"...","meaningVi":"...","usage":"..."}],"contextExamples":[{"context":"...","en":"...","vi":"..."}],"collocations":[{"phrase":"...","meaning":"..."}],"mnemonicTip":"...","wordFamily":"..."}`;
  const content = await callChatModel(env, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: JSON.stringify(input) },
  ]);
  const result = normalizeEnrichment(extractJson(content), word);
  const cacheResponse = new Response(JSON.stringify(result), {
    headers: { ...JSON_HEADERS, 'Cache-Control': 'public, max-age=604800' },
  });
  context.waitUntil(cache.put(key, cacheResponse));
  return json({ data: result }, 200, origin, { 'X-LingoGoc-Cache': 'MISS' });
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
  const content = await callChatModel(env, [{ role: 'system', content: system }, ...messages], 0.6);
  return json(extractJson(content), 200, origin);
}

function publicError(error) {
  const code = String(error?.message || 'UNKNOWN_ERROR');
  if (code === 'PAYLOAD_TOO_LARGE') return ['Dữ liệu gửi lên quá lớn.', 413];
  if (code === 'AI_NOT_CONFIGURED') return ['Backend chưa được cấu hình XTROUTER_API_KEY và AI_MODEL.', 503];
  if (code.startsWith('AI_PROVIDER_')) return ['Nhà cung cấp AI đang từ chối hoặc tạm thời không khả dụng.', 502];
  if (code === 'INVALID_AI_JSON' || code === 'INSUFFICIENT_BILINGUAL_EXAMPLES') return ['AI trả về dữ liệu chưa đúng định dạng, vui lòng thử lại.', 502];
  if (error instanceof SyntaxError) return ['JSON không hợp lệ.', 400];
  return ['Máy chủ AI gặp lỗi tạm thời.', 500];
}

export default {
  async fetch(request, env, context) {
    const origin = allowedOrigin(request, env);
    if (!origin) return json({ error: 'Origin không được phép.' }, 403, 'null');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });

    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true, aiConfigured: Boolean((env.XTROUTER_API_KEY || env.AI_API_KEY) && env.AI_MODEL) }, 200, origin);
    }

    try {
      if (url.pathname === '/api/vocabulary/enrich' && request.method === 'POST') {
        return await enrichVocabulary(request, env, origin, context);
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
      const [message, status] = publicError(error);
      return json({ error: message }, status, origin);
    }
  },
};
