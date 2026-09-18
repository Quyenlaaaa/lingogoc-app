import { getBackendUrl, hasBackendApi, readJsonResponse } from './backendApi.js';
import { cacheWordEnrichment, getCachedWordEnrichment } from './geminiService.js';
import {
  cacheVietnameseMeaning,
  getCachedVietnameseMeaning,
  getMeaningCacheKey,
} from './vocabularyMeaningService.js';

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

  const response = await fetch(getBackendUrl('/api/vocabulary/batch'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    signal,
    body: JSON.stringify({
      items: unique.map((item) => ({ word: item.word, pos: item.pos || item.type || '' })),
    }),
  });
  if (!response.ok) throw new Error(`VOCABULARY_BATCH_HTTP_${response.status}`);
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
