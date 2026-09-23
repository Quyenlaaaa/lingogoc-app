import { vocabData } from '../src/data/vocabData.js';
import {
  isLowQualityExample,
  isLowQualityMeaning,
  sanitizeBundledVocabulary,
} from '../src/utils/vocabularyQuality.js';

const words = sanitizeBundledVocabulary(vocabData);
const report = {
  usableWords: words.length,
  lowQualityMeanings: words.filter((item) => isLowQualityMeaning(item.meaning)).length,
  lowQualityExamples: words.filter((item) => (
    isLowQualityExample(item.example) || isLowQualityExample(item.exampleVi)
  )).length,
  invalidIpa: words.filter((item) => {
    const ipa = String(item.ipa || '').replace(/^\/|\/$/g, '').toLowerCase();
    return !ipa || ipa === item.word.toLowerCase();
  }).length,
};
report.releaseReady = report.usableWords === 3000
  && report.lowQualityMeanings === 0
  && report.lowQualityExamples === 0
  && report.invalidIpa === 0;

console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--strict') && !report.releaseReady) process.exit(1);
