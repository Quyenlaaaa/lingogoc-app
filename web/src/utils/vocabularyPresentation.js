import { getCachedWordEnrichment, hasCompleteWordEnrichment } from './geminiService.js';
import { getCachedVietnameseMeaning } from './vocabularyMeaningService.js';
import { getDisplayIpa, getTrustedExamples, isLowQualityExample, isLowQualityMeaning } from './vocabularyQuality.js';

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function uniqueExamples(examples) {
  const seen = new Set();
  return examples.filter((example) => {
    const key = cleanText(example.en).toLocaleLowerCase('en');
    if (!key || seen.has(key) || isLowQualityExample(example.en)) return false;
    seen.add(key);
    return true;
  });
}

export function getVocabularyPresentation(word, overrides = {}) {
  if (!word) return null;
  const enrichment = overrides.enrichment === undefined
    ? getCachedWordEnrichment(word.word)
    : overrides.enrichment;
  const translated = overrides.meaning === undefined
    ? getCachedVietnameseMeaning(word)
    : overrides.meaning;
  const meaningCandidates = [
    { value: enrichment?.primaryMeaningVi, source: 'enrichment' },
    { value: translated?.meaningVi, source: 'translation' },
    { value: word.meaning, source: 'dataset' },
  ];
  const selectedMeaning = meaningCandidates
    .map((candidate) => ({ ...candidate, value: cleanText(candidate.value) }))
    .find((candidate) => !isLowQualityMeaning(candidate.value));
  const enrichedExamples = Array.isArray(enrichment?.contextExamples)
    ? enrichment.contextExamples.map((example) => ({
      context: cleanText(example?.context),
      en: cleanText(example?.en),
      vi: cleanText(example?.vi),
      source: 'enrichment',
    }))
    : [];
  const externalExamples = Array.isArray(overrides.examples)
    ? overrides.examples.map((example) => ({
      context: cleanText(example?.context),
      en: cleanText(example?.en),
      vi: cleanText(example?.vi),
      source: cleanText(example?.source) || 'external',
    }))
    : [];
  const examples = uniqueExamples([
    ...enrichedExamples,
    ...externalExamples,
    ...getTrustedExamples(word),
  ]).slice(0, 5);

  return {
    word: cleanText(word.word),
    meaning: selectedMeaning?.value || 'Nghĩa tiếng Việt đang được bổ sung',
    meaningSource: selectedMeaning?.source || 'pending',
    ipa: getDisplayIpa(overrides.ipa || enrichment?.ipa || word.ipa, word.word),
    examples,
    primaryExample: examples[0] || null,
    enrichment,
    hasCompleteContexts: hasCompleteWordEnrichment(enrichment),
  };
}
