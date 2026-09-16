// Cambridge credentials live exclusively on the backend. The browser only
// sends the requested word to LingoGoc's public backend endpoint.
import { getBackendUrl, hasBackendApi, readBackendError } from './backendApi';

const CACHE_PREFIX = 'lingogoc_cambridge_entry_v2_';

export async function fetchCambridgeWordData(word, signal) {
  if (!word || !hasBackendApi()) return null;
  const cleanWord = word.trim().toLowerCase();
  const cacheKey = `${CACHE_PREFIX}${cleanWord}`;

  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return { ...JSON.parse(cached), fromCache: true };
  } catch {
    // A disabled cache must not block dictionary lookup.
  }

  const response = await fetch(
    getBackendUrl(`/api/vocabulary/cambridge?word=${encodeURIComponent(cleanWord)}`),
    { headers: { Accept: 'application/json' }, signal },
  );
  if (!response.ok) {
    throw new Error(await readBackendError(response, 'Không thể tải dữ liệu Cambridge.'));
  }

  const payload = await response.json();
  const result = payload?.data || payload;
  if (!result || typeof result !== 'object') return null;

  try {
    localStorage.setItem(cacheKey, JSON.stringify(result));
  } catch {
    // Cache is an optimization only.
  }
  return result;
}
