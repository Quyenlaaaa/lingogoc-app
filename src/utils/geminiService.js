// Vocabulary enrichment is performed by the LingoGoc backend. Provider keys
// never enter localStorage or the public browser bundle.
import { getBackendUrl, hasBackendApi, readBackendError } from './backendApi';

const VOCAB_ENRICHMENT_PREFIX = 'lingogoc_vocab_enrichment_v3_';
const CACHE_SCHEMA_VERSION = 1;
const CACHE_DATABASE = 'lingogoc_learning_cache';
const CACHE_STORE = 'vocabulary_enrichment';

function cleanText(value, maxLength = 500) {
  return typeof value === 'string'
    ? value.replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function normalizeEnrichment(data) {
  const contextExamples = Array.isArray(data?.contextExamples)
    ? data.contextExamples
      .map((example) => ({
        context: cleanText(example?.context, 80),
        en: cleanText(example?.en),
        vi: cleanText(example?.vi),
      }))
      .filter((example) => example.en.length >= 8 && example.vi.length >= 5)
      .slice(0, 5)
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
    contextExamples,
    collocations,
    senses,
    isAiGenerated: Boolean(data?.isAiGenerated ?? true),
    persistedOnServer: Boolean(data?.persistedOnServer),
    serverSavedAt: cleanText(data?.serverSavedAt, 40),
  };
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

export async function enrichWordWithLLM(word, meaning = '', topic = '', dictionaryDefinitions = [], signal) {
  let localFallback = null;
  const cached = getCachedWordEnrichment(word);
  if (cached) {
    // Migrate entries created by older releases into the durable two-tier cache.
    const migrated = cached.savedAt ? cached : await cacheWordEnrichment(word, cached);
    if (migrated.persistedOnServer) return { ...migrated, fromCache: true };
    localFallback = migrated;
  }

  if (!localFallback) {
    const persistent = await readPersistentEnrichment(word);
    if (signal?.aborted) throw new DOMException('The request was aborted.', 'AbortError');
    if (persistent) {
      const restored = await cacheWordEnrichment(word, persistent);
      if (restored.persistedOnServer) return { ...restored, fromCache: true };
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

  try {
    const response = await fetch(getBackendUrl('/api/vocabulary/enrich'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal,
      body: JSON.stringify({ word, meaning, topic, dictionaryDefinitions }),
    });
    if (!response.ok) {
      throw new Error(await readBackendError(response, 'Không thể tạo ví dụ đa ngữ cảnh.'));
    }

    const payload = await response.json();
    const data = payload?.data || payload;
    const result = normalizeEnrichment(data);
    if (!result.contextExamples.length) throw new Error('Backend AI không trả về ví dụ song ngữ hợp lệ.');
    return await cacheWordEnrichment(word, result);
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    if (localFallback) {
      return { ...localFallback, fromCache: true, serverSyncPending: true };
    }
    return {
      isAiGenerated: false,
      contextExamples: [],
      collocations: [],
      senses: [],
      unavailableReason: error?.message || 'BACKEND_UNAVAILABLE',
    };
  }
}
