import assert from 'node:assert/strict';
import {
  buildClozePrompt,
  buildQuizOptions,
  getTrustedExamples,
  getDisplayIpa,
  isLowQualityExample,
  isLowQualityMeaning,
  isInvalidBundledVocabularyWord,
  isValidIpa,
  sanitizeBundledVocabulary,
} from '../src/utils/vocabularyQuality.js';
import { ENRICHMENT_RETRY_COOLDOWN_MS, getEnrichmentRetryState } from '../src/utils/geminiService.js';
import { vocabData } from '../src/data/vocabData.js';
import { getCachedVietnameseMeaning } from '../src/utils/vocabularyMeaningService.js';

const vocabulary = [
  { id: 1, word: 'accept', meaning: 'chấp nhận', pos: 'v', topic: 'Giao tiếp', level: 'A2', example: 'I accept your offer.' },
  { id: 2, word: 'agree', meaning: 'đồng ý', pos: 'v', topic: 'Giao tiếp', level: 'A2' },
  { id: 3, word: 'refuse', meaning: 'từ chối', pos: 'v', topic: 'Giao tiếp', level: 'A2' },
  { id: 4, word: 'admit', meaning: 'thừa nhận', pos: 'v', topic: 'Giao tiếp', level: 'B1' },
  { id: 5, word: 'banana', meaning: 'quả chuối', pos: 'n', topic: 'Ăn uống', level: 'A1' },
];

assert.equal(isLowQualityExample("She used the word 'accept' in her sentence."), true);
assert.equal(isLowQualityMeaning("từ 'accept' (v)"), true);
assert.equal(getTrustedExamples({ example: "She used the word 'accept' in her sentence." }).length, 0);
assert.equal(buildClozePrompt(vocabulary[0]), 'I _____ your offer.');
assert.equal(isInvalidBundledVocabularyWord('can1'), true);
assert.equal(isInvalidBundledVocabularyWord('can2'), true);
assert.equal(isInvalidBundledVocabularyWord("can't"), false);
assert.equal(isValidIpa('/fire/', 'fire'), false);
assert.equal(isValidIpa('/ˈfaɪə(r)/', 'fire'), true);
assert.equal(getDisplayIpa('/explore/', 'explore'), 'IPA đang được bổ sung');

const sanitizedBundledVocabulary = sanitizeBundledVocabulary(vocabData);
const sanitizedWords = sanitizedBundledVocabulary.map((item) => item.word.toLocaleLowerCase('en'));
assert.equal(sanitizedWords.includes('can1'), false);
assert.equal(sanitizedWords.includes('can2'), false);
assert.equal(sanitizedWords.includes('oâ€™clock'), false);
assert.equal(new Set(sanitizedWords).size, sanitizedWords.length);
assert.equal(vocabData.length - sanitizedBundledVocabulary.length, 0);
assert.equal(sanitizedBundledVocabulary.length, 3000);
assert.equal(sanitizedWords.includes('absorb'), true);
assert.equal(sanitizedWords.includes('apology'), true);
const fireIpa = sanitizedBundledVocabulary.find((item) => item.word === 'fire')?.ipa;
assert.equal(isValidIpa(fireIpa, 'fire'), true);

const meaningCache = new Map();
globalThis.localStorage = {
  getItem: (key) => meaningCache.get(key) || null,
  setItem: (key, value) => meaningCache.set(key, value),
  removeItem: (key) => meaningCache.delete(key),
};
const retryNow = Date.parse('2026-09-23T00:00:00.000Z');
meaningCache.set('lingogoc_vocab_retry_v1_fire', JSON.stringify({
  nextRetryAt: new Date(retryNow + ENRICHMENT_RETRY_COOLDOWN_MS).toISOString(),
  code: 'AI_PROVIDER_429',
}));
assert.equal(getEnrichmentRetryState('fire', retryNow)?.coolingDown, true);
assert.equal(getEnrichmentRetryState('fire', retryNow)?.remainingMs, ENRICHMENT_RETRY_COOLDOWN_MS);
const fireCacheKey = 'lingogoc_vocabulary_meaning_v1_fire::n';
meaningCache.set(fireCacheKey, JSON.stringify({ meaningVi: "từ 'fire' (n)" }));
assert.equal(getCachedVietnameseMeaning({ word: 'fire', pos: 'n' }), null);
assert.equal(meaningCache.has(fireCacheKey), false);
meaningCache.set(fireCacheKey, JSON.stringify({ meaningVi: 'lửa; đám cháy' }));
assert.equal(getCachedVietnameseMeaning({ word: 'fire', pos: 'n' })?.meaningVi, 'lửa; đám cháy');
delete globalThis.localStorage;

for (let attempt = 0; attempt < 20; attempt += 1) {
  const options = buildQuizOptions(vocabulary[0], vocabulary, 'meaning', 4);
  assert.equal(options.length, 4);
  assert.equal(options.some((option) => option.word === 'banana'), false);
}

console.log('Vocabulary quality checks passed.');
