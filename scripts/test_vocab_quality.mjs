import assert from 'node:assert/strict';
import {
  buildClozePrompt,
  buildQuizOptions,
  getTrustedExamples,
  isLowQualityExample,
  isLowQualityMeaning,
} from '../src/utils/vocabularyQuality.js';

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

for (let attempt = 0; attempt < 20; attempt += 1) {
  const options = buildQuizOptions(vocabulary[0], vocabulary, 'meaning', 4);
  assert.equal(options.length, 4);
  assert.equal(options.some((option) => option.word === 'banana'), false);
}

console.log('Vocabulary quality checks passed.');
