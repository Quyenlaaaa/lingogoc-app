import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vocabData } from '../src/data/vocabData.js';
import {
  isInvalidBundledVocabularyWord,
  isLowQualityExample,
  isLowQualityMeaning,
  isValidIpa,
  sanitizeBundledVocabulary,
} from '../src/utils/vocabularyQuality.js';

const args = new Set(process.argv.slice(2));
const words = sanitizeBundledVocabulary(vocabData);
const sampleLimit = 25;

function sample(items, select = (item) => item) {
  return items.slice(0, sampleLimit).map(select);
}

const rawInvalidWords = vocabData.filter(isInvalidBundledVocabularyWord);
const normalizedKeys = vocabData
  .filter((item) => !isInvalidBundledVocabularyWord(item))
  .map((item) => String(item.word || '').trim().toLocaleLowerCase('en'));
const duplicateWords = normalizedKeys.filter((word, index) => normalizedKeys.indexOf(word) !== index);
const headwords = new Set(normalizedKeys);
const missingMeanings = words.filter((item) => !String(item.meaning || '').trim());
const lowQualityMeanings = words.filter((item) => isLowQualityMeaning(item.meaning));
const likelyEnglishMeanings = words.filter((item) => {
  const meaning = String(item.meaning || '').trim().toLocaleLowerCase('en');
  return meaning !== item.word.toLocaleLowerCase('en') && headwords.has(meaning);
});
const missingExamples = words.filter((item) => !String(item.example || '').trim() || !String(item.exampleVi || '').trim());
const lowQualityExamples = words.filter((item) => (
  isLowQualityExample(item.example) || isLowQualityExample(item.exampleVi)
));
const invalidIpaWords = words.filter((item) => !isValidIpa(item.ipa, item.word));

const report = {
  checkedAt: new Date().toISOString(),
  source: 'bundled-catalog',
  counts: {
    rawRecords: vocabData.length,
    usableWords: words.length,
    uniqueWords: new Set(words.map((item) => item.word.toLocaleLowerCase('en'))).size,
    invalidHeadwords: rawInvalidWords.length,
    duplicateWords: duplicateWords.length,
    missingMeanings: missingMeanings.length,
    lowQualityMeanings: lowQualityMeanings.length,
    likelyEnglishMeanings: likelyEnglishMeanings.length,
    missingBilingualExamples: missingExamples.length,
    lowQualityExamples: lowQualityExamples.length,
    invalidIpa: invalidIpaWords.length,
  },
  samples: {
    invalidHeadwords: sample(rawInvalidWords, (item) => item.word),
    duplicateWords: sample(duplicateWords),
    missingMeanings: sample(missingMeanings, (item) => item.word),
    lowQualityMeanings: sample(lowQualityMeanings, (item) => ({ word: item.word, meaning: item.meaning })),
    likelyEnglishMeanings: sample(likelyEnglishMeanings, (item) => ({ word: item.word, meaning: item.meaning })),
    missingBilingualExamples: sample(missingExamples, (item) => item.word),
    lowQualityExamples: sample(lowQualityExamples, (item) => ({ word: item.word, example: item.example })),
    invalidIpa: sample(invalidIpaWords, (item) => ({ word: item.word, ipa: item.ipa })),
  },
};

report.releaseReady = report.counts.usableWords === 3000
  && report.counts.uniqueWords === 3000
  && report.counts.invalidHeadwords === 0
  && report.counts.duplicateWords === 0
  && report.counts.lowQualityMeanings === 0
  && report.counts.likelyEnglishMeanings === 0
  && report.counts.missingBilingualExamples === 0
  && report.counts.lowQualityExamples === 0
  && report.counts.invalidIpa === 0;

if (args.has('--write-report')) {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const reportDirectory = path.resolve(scriptDirectory, '..', 'reports');
  const reportPath = path.join(reportDirectory, 'vocabulary-bundled-baseline.json');
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.error(`Saved ${reportPath}`);
}

console.log(JSON.stringify(report, null, 2));
if (args.has('--strict') && !report.releaseReady) process.exitCode = 1;
