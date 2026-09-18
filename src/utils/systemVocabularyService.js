import { getBackendUrl, hasBackendApi, readJsonResponse } from './backendApi';
import { sanitizeBundledVocabulary } from './vocabularyQuality';

const EXPECTED_SYSTEM_WORDS = 3000;

async function loadBundledVocabulary() {
  const { vocabData } = await import('../data/vocabData');
  return sanitizeBundledVocabulary(vocabData);
}

function normalizeCatalog(payload) {
  const words = sanitizeBundledVocabulary(payload?.data?.words || payload?.words);
  return words.length === EXPECTED_SYSTEM_WORDS ? words : null;
}

export async function loadSystemVocabulary(timeoutMs = 10000) {
  if (!hasBackendApi()) return loadBundledVocabulary();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(getBackendUrl('/api/vocabulary/catalog'), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`SYSTEM_VOCABULARY_HTTP_${response.status}`);
    const payload = await readJsonResponse(response, 'Kho từ hệ thống trên server không hợp lệ.');
    const words = normalizeCatalog(payload);
    if (!words) throw new Error('SYSTEM_VOCABULARY_INCOMPLETE');
    return words;
  } catch (error) {
    console.warn('Using bundled system vocabulary because server catalog is unavailable:', error);
    return loadBundledVocabulary();
  } finally {
    clearTimeout(timeout);
  }
}
