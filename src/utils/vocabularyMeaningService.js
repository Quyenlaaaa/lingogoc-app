import { getBackendUrl, hasBackendApi, readBackendError, readJsonResponse } from './backendApi.js';
import { isLowQualityMeaning } from './vocabularyQuality.js';

const MEANING_CACHE_PREFIX = 'lingogoc_vocabulary_meaning_v1_';

export function getMeaningCacheKey(item) {
  const word = String(item?.word || '').trim().toLowerCase();
  const pos = String(item?.pos || item?.type || '').trim().toLowerCase();
  return `${word}::${pos}`;
}

export function getCachedVietnameseMeaning(item) {
  if (!item?.word || typeof localStorage === 'undefined') return null;
  const storageKey = `${MEANING_CACHE_PREFIX}${getMeaningCacheKey(item)}`;
  try {
    const cached = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (typeof cached?.meaningVi !== 'string' || isLowQualityMeaning(cached.meaningVi)) {
      localStorage.removeItem(storageKey);
      return null;
    }
    return cached;
  } catch {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Storage can be blocked in private browsing; the server result is still usable in memory.
    }
    return null;
  }
}

function cacheMeaning(item, result) {
  const normalized = {
    word: String(item.word || '').trim().toLowerCase(),
    meaningVi: String(result?.meaningVi || '').replace(/\s+/g, ' ').trim().slice(0, 240),
    source: result?.source || 'ai',
    savedAt: new Date().toISOString(),
  };
  if (!normalized.meaningVi || isLowQualityMeaning(normalized.meaningVi)) return null;
  try {
    localStorage.setItem(`${MEANING_CACHE_PREFIX}${getMeaningCacheKey(item)}`, JSON.stringify(normalized));
  } catch {
    // The in-memory React state still displays the result when storage is full.
  }
  return normalized;
}

export async function fetchVietnameseMeanings(items, signal) {
  const unique = [];
  const seen = new Set();
  for (const item of items || []) {
    const key = getMeaningCacheKey(item);
    if (!item?.word || seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  const results = {};
  const missing = [];
  unique.forEach((item) => {
    const cached = getCachedVietnameseMeaning(item);
    if (cached) results[getMeaningCacheKey(item)] = cached;
    else missing.push(item);
  });
  if (!missing.length || !hasBackendApi()) return results;

  const response = await fetch(getBackendUrl('/api/vocabulary/meanings'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    signal,
    body: JSON.stringify({
      items: missing.slice(0, 30).map((item) => ({
        word: item.word,
        pos: item.pos || item.type || '',
        meaning: item.meaning || '',
      })),
    }),
  });
  if (!response.ok) throw new Error(await readBackendError(response, 'Không thể chuẩn hóa nghĩa tiếng Việt.'));
  const payload = await readJsonResponse(response, 'Máy chủ dịch nghĩa trả về dữ liệu không hợp lệ.');
  const translated = Array.isArray(payload?.data?.meanings) ? payload.data.meanings : [];
  translated.forEach((result) => {
    const item = missing.find((candidate) => candidate.word.toLowerCase() === String(result?.word || '').toLowerCase());
    if (!item) return;
    const cached = cacheMeaning(item, result);
    if (cached) results[getMeaningCacheKey(item)] = cached;
  });
  return results;
}
