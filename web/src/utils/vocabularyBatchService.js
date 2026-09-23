import { getBackendUrl, hasBackendApi, readJsonResponse } from './backendApi.js';
import { cacheWordEnrichment, getCachedWordEnrichment } from './geminiService.js';
import {
  cacheVietnameseMeaning,
  getCachedVietnameseMeaning,
  getMeaningCacheKey,
} from './vocabularyMeaningService.js';

const BATCH_CACHE_TTL_MS = 30 * 60 * 1000;
const batchResponseCache = new Map();
const batchFailureCooldown = new Map();

function batchKey(items) {
  return items
    .map((item) => `${String(item.word).toLowerCase()}::${String(item.pos || item.type || '').toLowerCase()}`)
    .sort()
    .join('|');
}

export async function fetchVocabularyBatch(items, signal) {
  const unique = [];
  const seen = new Set();
  (items || []).slice(0, 24).forEach((item) => {
    const word = String(item?.word || '').trim().toLowerCase();
    if (!word || seen.has(word)) return;
    seen.add(word);
    unique.push(item);
  });

  const results = {};
  unique.forEach((item) => {
    const meaning = getCachedVietnameseMeaning(item);
    const enrichment = getCachedWordEnrichment(item.word);
    if (meaning || enrichment) {
      results[item.word.toLowerCase()] = { meaning, enrichment, fromLocalCache: true };
    }
  });
  if (!unique.length || !hasBackendApi()) return results;

  const requestKey = batchKey(unique);
  const now = Date.now();
  const cachedBatch = batchResponseCache.get(requestKey);
  if (cachedBatch && now - cachedBatch.savedAt < BATCH_CACHE_TTL_MS) {
    return { ...results, ...cachedBatch.results };
  }
  const failedAt = batchFailureCooldown.get(requestKey) || 0;
  if (now - failedAt < BATCH_CACHE_TTL_MS) return results;

  let response;
  try {
    response = await fetch(getBackendUrl('/api/vocabulary/batch'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal,
      body: JSON.stringify({
        items: unique.map((item) => ({ word: item.word, pos: item.pos || item.type || '' })),
      }),
    });
    if (!response.ok) throw new Error(`VOCABULARY_BATCH_HTTP_${response.status}`);
  } catch (error) {
    if (error?.name !== 'AbortError') batchFailureCooldown.set(requestKey, Date.now());
    throw error;
  }
  const payload = await readJsonResponse(response, 'Dữ liệu từ vựng theo lô không hợp lệ.');
  const records = Array.isArray(payload?.data?.items) ? payload.data.items : [];

  await Promise.all(records.map(async (record) => {
    const item = unique.find((candidate) => candidate.word.toLowerCase() === record.word);
    if (!item) return;
    const meaning = record.meaningVi
      ? cacheVietnameseMeaning(item, { meaningVi: record.meaningVi, source: 'server-kv' })
      : getCachedVietnameseMeaning(item);
    const enrichment = record.enrichment
      ? await cacheWordEnrichment(item.word, record.enrichment)
      : getCachedWordEnrichment(item.word);
    results[record.word] = { meaning, enrichment, fromServer: true };
  }));

  (payload?.data?.needsEnrichment || payload?.data?.missing || []).forEach((word) => {
    results[word] = { ...(results[word] || {}), pending: true };
  });
  batchFailureCooldown.delete(requestKey);
  batchResponseCache.set(requestKey, { savedAt: Date.now(), results: { ...results } });
  return results;
}

export function toMeaningResultMap(items, batchResults) {
  const meanings = {};
  (items || []).forEach((item) => {
    const result = batchResults[item.word.toLowerCase()];
    const meaning = result?.meaning || (result?.enrichment?.primaryMeaningVi
      ? { meaningVi: result.enrichment.primaryMeaningVi, source: 'enrichment-cache' }
      : null);
    if (meaning) meanings[getMeaningCacheKey(item)] = meaning;
  });
  return meanings;
}
