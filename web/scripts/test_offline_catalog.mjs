import assert from 'node:assert/strict';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};
globalThis.window = {};

const {
  loadBestAvailableSystemVocabulary,
  loadBundledSystemVocabulary,
  loadCachedSystemVocabulary,
  saveSystemVocabularyCache,
} = await import('../src/utils/systemVocabularyService.js');

const bundled = await loadBundledSystemVocabulary();
assert.equal(bundled.length, 3000, 'the APK fallback catalog must contain exactly 3,000 words');
const remote = bundled.map((item, index) => index === 0 ? { ...item, meaning: 'cached update' } : item);
const remoteBytes = new TextEncoder().encode(JSON.stringify(remote));
const remoteDigest = await crypto.subtle.digest('SHA-256', remoteBytes);
const remoteHash = [...new Uint8Array(remoteDigest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
saveSystemVocabularyCache(remote, { schemaVersion: 1, contentHash: remoteHash, updatedAt: '2026-09-24T00:00:00.000Z' });

const cached = loadCachedSystemVocabulary(bundled);
assert.equal(cached.contentHash, remoteHash);
assert.equal(cached.words[0].meaning, 'cached update');
assert.equal((await loadBestAvailableSystemVocabulary()).source, 'cache');

const tampered = JSON.parse(values.get('lingogoc_system_vocabulary_v1'));
tampered.words[0].meaning = 'tampered after download';
values.set('lingogoc_system_vocabulary_v1', JSON.stringify(tampered));
assert.equal((await loadBestAvailableSystemVocabulary()).source, 'bundled', 'a hash mismatch must fall back to the APK catalog');

values.set('lingogoc_system_vocabulary_v1', '{broken json');
assert.equal(loadCachedSystemVocabulary(bundled), null, 'a corrupt download must never replace the APK catalog');
const fallback = await loadBestAvailableSystemVocabulary();
assert.equal(fallback.source, 'bundled');
assert.equal(fallback.words.length, 3000);

saveSystemVocabularyCache(remote.slice(1), { contentHash: 'incomplete' });
assert.equal(loadCachedSystemVocabulary(bundled), null, 'an incomplete download must never replace the APK catalog');

console.log('Offline catalog checks passed.');
