import { getBackendUrl, hasBackendApi, readJsonResponse } from './backendApi';
import { sanitizeBundledVocabulary } from './vocabularyQuality';

const EXPECTED_SYSTEM_WORDS = 3000;

export async function loadBundledSystemVocabulary() {
  const { vocabData } = await import('../data/vocabData');
  return sanitizeBundledVocabulary(vocabData);
}

function normalizeCatalog(payload) {
  const words = sanitizeBundledVocabulary(payload?.data?.words || payload?.words);
  return words.length === EXPECTED_SYSTEM_WORDS ? words : null;
}

async function hashVocabulary(words) {
  if (!globalThis.crypto?.subtle) return '';
  const bytes = new TextEncoder().encode(JSON.stringify(words));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function fetchWithTimeout(path, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(getBackendUrl(path), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function refreshSystemVocabulary(currentWords, timeoutMs = 4000) {
  if (!hasBackendApi() || currentWords.length !== EXPECTED_SYSTEM_WORDS) return null;

  try {
    const manifestResponse = await fetchWithTimeout('/api/vocabulary/manifest', timeoutMs);
    if (!manifestResponse.ok) throw new Error(`SYSTEM_VOCABULARY_MANIFEST_HTTP_${manifestResponse.status}`);
    const manifestPayload = await readJsonResponse(manifestResponse, 'Manifest kho từ hệ thống không hợp lệ.');
    const remoteHash = String(manifestPayload?.data?.contentHash || '');
    if (remoteHash && remoteHash === await hashVocabulary(currentWords)) return null;

    const response = await fetchWithTimeout('/api/vocabulary/catalog', timeoutMs);
    if (!response.ok) throw new Error(`SYSTEM_VOCABULARY_HTTP_${response.status}`);
    const payload = await readJsonResponse(response, 'Kho từ hệ thống trên server không hợp lệ.');
    const words = normalizeCatalog(payload);
    if (!words) throw new Error('SYSTEM_VOCABULARY_INCOMPLETE');
    return words;
  } catch (error) {
    console.warn('System vocabulary background refresh skipped:', error);
    return null;
  }
}
