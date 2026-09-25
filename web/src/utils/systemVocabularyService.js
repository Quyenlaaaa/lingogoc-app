import { getBackendUrl, hasBackendApi, readJsonResponse } from './backendApi.js';
import { sanitizeBundledVocabulary } from './vocabularyQuality.js';

const EXPECTED_SYSTEM_WORDS = 3000;
const CATALOG_CACHE_KEY = 'lingogoc_system_vocabulary_v1';
const CATALOG_CACHE_VERSION = 1;

export async function loadBundledSystemVocabulary() {
  const { vocabData } = await import('../data/vocabData.js');
  return sanitizeBundledVocabulary(vocabData);
}

function normalizeCatalog(payload, fallbackWords = []) {
  const words = sanitizeBundledVocabulary(payload?.data?.words || payload?.words);
  if (words.length !== EXPECTED_SYSTEM_WORDS) return null;

  // The bundled catalog can carry a newer IPA correction than the remote KV
  // catalog. Preserve that verified pronunciation until the next DB sync.
  const fallbackIpa = new Map(fallbackWords.map((item) => [item.word.toLowerCase(), item.ipa]));
  return words.map((item) => ({
    ...item,
    ipa: item.ipa || fallbackIpa.get(item.word.toLowerCase()) || '',
  }));
}

export function loadCachedSystemVocabulary(fallbackWords = []) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const cached = JSON.parse(localStorage.getItem(CATALOG_CACHE_KEY) || 'null');
    if (cached?.version !== CATALOG_CACHE_VERSION || !cached.contentHash) return null;
    const words = normalizeCatalog(cached, fallbackWords);
    return words ? { words, contentHash: String(cached.contentHash), source: 'cache' } : null;
  } catch {
    return null;
  }
}

export function saveSystemVocabularyCache(words, manifest) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({
      version: CATALOG_CACHE_VERSION,
      schemaVersion: manifest?.schemaVersion || 1,
      contentHash: String(manifest?.contentHash || ''),
      updatedAt: manifest?.updatedAt || new Date().toISOString(),
      words,
    }));
  } catch (error) {
    console.warn('System vocabulary cache write skipped:', error);
  }
}

export async function loadBestAvailableSystemVocabulary() {
  const bundledWords = await loadBundledSystemVocabulary();
  const cached = loadCachedSystemVocabulary(bundledWords);
  if (cached && await hashVocabulary(cached.words) === cached.contentHash) return cached;
  if (cached && typeof localStorage !== 'undefined') localStorage.removeItem(CATALOG_CACHE_KEY);
  return { words: bundledWords, contentHash: '', source: 'bundled' };
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

export async function refreshSystemVocabulary(currentWords, timeoutMs = 4000, currentContentHash = '') {
  if (!hasBackendApi() || currentWords.length !== EXPECTED_SYSTEM_WORDS) return null;

  try {
    const manifestResponse = await fetchWithTimeout('/api/vocabulary/manifest', timeoutMs);
    if (!manifestResponse.ok) throw new Error(`SYSTEM_VOCABULARY_MANIFEST_HTTP_${manifestResponse.status}`);
    const manifestPayload = await readJsonResponse(manifestResponse, 'Manifest kho từ hệ thống không hợp lệ.');
    const manifest = manifestPayload?.data || manifestPayload;
    const remoteHash = String(manifest?.contentHash || '');
    if (!remoteHash) throw new Error('SYSTEM_VOCABULARY_MANIFEST_HASH_MISSING');
    if (remoteHash && (remoteHash === currentContentHash || remoteHash === await hashVocabulary(currentWords))) return null;

    const response = await fetchWithTimeout('/api/vocabulary/catalog', timeoutMs);
    if (!response.ok) throw new Error(`SYSTEM_VOCABULARY_HTTP_${response.status}`);
    const payload = await readJsonResponse(response, 'Kho từ hệ thống trên server không hợp lệ.');
    const words = normalizeCatalog(payload, currentWords);
    if (!words) throw new Error('SYSTEM_VOCABULARY_INCOMPLETE');
    if (await hashVocabulary(words) !== remoteHash) throw new Error('SYSTEM_VOCABULARY_HASH_MISMATCH');
    saveSystemVocabularyCache(words, manifest);
    return words;
  } catch (error) {
    console.warn('System vocabulary background refresh skipped:', error);
    return null;
  }
}
