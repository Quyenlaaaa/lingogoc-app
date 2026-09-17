// Vocabulary enrichment is performed by the LingoGoc backend. Provider keys
// never enter localStorage or the public browser bundle.
import { getBackendUrl, hasBackendApi, readJsonResponse } from './backendApi';

const VOCAB_ENRICHMENT_PREFIX = 'lingogoc_vocab_enrichment_v3_';
const CACHE_SCHEMA_VERSION = 1;
const CACHE_DATABASE = 'lingogoc_learning_cache';
const CACHE_STORE = 'vocabulary_enrichment';
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const activeEnrichmentRequests = new Map();
const REQUIRED_CONTEXT_EXAMPLES = 5;

function cleanText(value, maxLength = 500) {
  return typeof value === 'string'
    ? value.replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function normalizeEnrichment(data) {
  const seenContexts = new Set();
  const contextExamples = Array.isArray(data?.contextExamples)
    ? data.contextExamples
      .map((example) => ({
        context: cleanText(example?.context, 80),
        en: cleanText(example?.en),
        vi: cleanText(example?.vi),
      }))
      .filter((example) => {
        const contextKey = example.context.toLowerCase();
        const isValid = contextKey
          && example.en.length >= 8
          && example.vi.length >= 5
          && !seenContexts.has(contextKey);
        if (isValid) seenContexts.add(contextKey);
        return isValid;
      })
      .slice(0, REQUIRED_CONTEXT_EXAMPLES)
    : [];
  const collocations = Array.isArray(data?.collocations)
    ? data.collocations
      .map((item) => ({ phrase: cleanText(item?.phrase, 120), meaning: cleanText(item?.meaning, 240) }))
      .filter((item) => item.phrase && item.meaning)
      .slice(0, 6)
    : [];
  const senses = Array.isArray(data?.senses)
    ? data.senses
      .map((item) => ({
        pos: cleanText(item?.pos, 40),
        meaningVi: cleanText(item?.meaningVi, 240),
        usage: cleanText(item?.usage, 300),
      }))
      .filter((item) => item.meaningVi)
      .slice(0, 5)
    : [];

  return {
    primaryMeaningVi: cleanText(data?.primaryMeaningVi, 240),
    meaningNote: cleanText(data?.meaningNote, 500),
    mnemonicTip: cleanText(data?.mnemonicTip, 500),
    wordFamily: cleanText(data?.wordFamily, 500),
    generatedByModel: cleanText(data?.generatedByModel, 120),
    contextExamples,
    collocations,
    senses,
    isAiGenerated: Boolean(data?.isAiGenerated ?? true),
    persistedOnServer: Boolean(data?.persistedOnServer),
    serverSavedAt: cleanText(data?.serverSavedAt, 40),
  };
}

export function hasCompleteWordEnrichment(data) {
  return normalizeEnrichment(data).contextExamples.length === REQUIRED_CONTEXT_EXAMPLES;
}

export function getCachedWordEnrichment(word) {
  if (!word || typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(`${VOCAB_ENRICHMENT_PREFIX}${word.trim().toLowerCase()}`);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    const value = parsed?.data && parsed?.schemaVersion ? parsed.data : parsed;
    const normalized = normalizeEnrichment(value);
    if (!normalized.contextExamples.length) return null;
    return { ...normalized, savedAt: parsed?.savedAt || value?.savedAt || null };
  } catch {
    return null;
  }
}

function openCacheDatabase() {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = window.indexedDB.open(CACHE_DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(CACHE_STORE)) {
        request.result.createObjectStore(CACHE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function readPersistentEnrichment(word) {
  const database = await openCacheDatabase();
  if (!database) return null;
  return new Promise((resolve) => {
    const transaction = database.transaction(CACHE_STORE, 'readonly');
    const request = transaction.objectStore(CACHE_STORE).get(word.trim().toLowerCase());
    request.onsuccess = () => {
      const stored = request.result;
      const normalized = normalizeEnrichment(stored?.data || stored);
      resolve(normalized.contextExamples.length
        ? { ...normalized, savedAt: stored?.savedAt || null }
        : null);
    };
    request.onerror = () => resolve(null);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
}

async function writePersistentEnrichment(word, payload) {
  const database = await openCacheDatabase();
  if (!database) return;
  await new Promise((resolve) => {
    const transaction = database.transaction(CACHE_STORE, 'readwrite');
    transaction.objectStore(CACHE_STORE).put(payload, word.trim().toLowerCase());
    transaction.oncomplete = resolve;
    transaction.onerror = resolve;
    transaction.onabort = resolve;
  });
  database.close();
}

async function cacheWordEnrichment(word, data) {
  if (!word || typeof window === 'undefined') return data;
  const payload = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    data: normalizeEnrichment(data),
  };
  try {
    localStorage.setItem(`${VOCAB_ENRICHMENT_PREFIX}${word.trim().toLowerCase()}`, JSON.stringify(payload));
  } catch {
    // IndexedDB below remains available when localStorage reaches its quota.
  }
  await writePersistentEnrichment(word, payload);
  return { ...payload.data, savedAt: payload.savedAt };
}

function waitForRetry(delayMs, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The request was aborted.', 'AbortError'));
      return;
    }
    const handleAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('The request was aborted.', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    }, delayMs);
    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

async function createBackendError(response) {
  const fallback = 'Không thể tạo ví dụ đa ngữ cảnh.';
  let payload = null;
  try {
    payload = await readJsonResponse(response, fallback);
  } catch {
    // Status-based retry handling below still works for non-JSON responses.
  }
  const error = new Error(payload?.error?.message || payload?.error || payload?.message || `${fallback} (HTTP ${response.status})`);
  error.code = payload?.code || `HTTP_${response.status}`;
  error.retryable = typeof payload?.retryable === 'boolean'
    ? payload.retryable
    : RETRYABLE_HTTP_STATUSES.has(response.status);
  return error;
}

async function performWordEnrichment(
  word,
  meaning = '',
  topic = '',
  dictionaryDefinitions = [],
  signal,
  options = {},
) {
  let localFallback = null;
  const cached = getCachedWordEnrichment(word);
  if (cached) {
    // Migrate entries created by older releases into the durable two-tier cache.
    const migrated = cached.savedAt ? cached : await cacheWordEnrichment(word, cached);
    if (migrated.persistedOnServer && hasCompleteWordEnrichment(migrated)) {
      return { ...migrated, fromCache: true };
    }
    localFallback = migrated;
  }

  if (!localFallback) {
    const persistent = await readPersistentEnrichment(word);
    if (signal?.aborted) throw new DOMException('The request was aborted.', 'AbortError');
    if (persistent) {
      const restored = await cacheWordEnrichment(word, persistent);
      if (restored.persistedOnServer && hasCompleteWordEnrichment(restored)) {
        return { ...restored, fromCache: true };
      }
      localFallback = restored;
    }
  }

  if (!hasBackendApi()) {
    return localFallback ? { ...localFallback, fromCache: true } : {
      isAiGenerated: false,
      contextExamples: [],
      collocations: [],
      senses: [],
      unavailableReason: 'BACKEND_NOT_CONFIGURED',
    };
  }

  const retryUntilSuccess = Boolean(options.retryUntilSuccess);
  const maxAttempts = retryUntilSuccess ? Number.POSITIVE_INFINITY : Math.max(1, options.maxAttempts || 1);
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const response = await fetch(getBackendUrl('/api/vocabulary/enrich'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal,
        body: JSON.stringify({ word, meaning, topic, dictionaryDefinitions }),
      });
      if (!response.ok) throw await createBackendError(response);

      const payload = await readJsonResponse(response, 'Máy chủ AI trả về dữ liệu trống hoặc không hợp lệ.');
      if (!payload) {
        const error = new Error('Máy chủ AI chưa trả về dữ liệu.');
        error.retryable = true;
        throw error;
      }
      const result = normalizeEnrichment(payload?.data || payload);
      if (!hasCompleteWordEnrichment(result)) {
        const error = new Error(`Backend AI chưa trả về đủ ${REQUIRED_CONTEXT_EXAMPLES} ví dụ thuộc các ngữ cảnh khác nhau.`);
        error.retryable = true;
        throw error;
      }
      return await cacheWordEnrichment(word, result);
    } catch (error) {
      if (error?.name === 'AbortError') throw error;

      const isRetryable = error?.retryable !== false;
      if (isRetryable && attempt < maxAttempts) {
        const delayMs = Math.min(20000, 1000 * (2 ** Math.min(attempt - 1, 4)));
        options.onRetry?.({ attempt, delayMs, message: error?.message || 'Lỗi kết nối AI' });
        await waitForRetry(delayMs, signal);
        continue;
      }

      if (localFallback) {
        return { ...localFallback, fromCache: true, serverSyncPending: true };
      }
      return {
        isAiGenerated: false,
        contextExamples: [],
        collocations: [],
        senses: [],
        unavailableReason: error?.message || 'BACKEND_UNAVAILABLE',
        unavailableCode: error?.code || 'BACKEND_UNAVAILABLE',
      };
    }
  }
}

export function enrichWordWithLLM(
  word,
  meaning = '',
  topic = '',
  dictionaryDefinitions = [],
  signal,
  options = {},
) {
  const keepAlive = Boolean(options.keepAlive || options.retryUntilSuccess);
  if (!keepAlive) {
    return performWordEnrichment(word, meaning, topic, dictionaryDefinitions, signal, options);
  }

  const requestKey = String(word || '').trim().toLowerCase();
  const existingRequest = activeEnrichmentRequests.get(requestKey);
  if (existingRequest) return existingRequest;

  // A keep-alive request intentionally has no component AbortSignal. It keeps
  // running when a modal/list unmounts and persists its result for the next view.
  const request = performWordEnrichment(word, meaning, topic, dictionaryDefinitions, undefined, options)
    .finally(() => activeEnrichmentRequests.delete(requestKey));
  activeEnrichmentRequests.set(requestKey, request);
  return request;
}
