// Vocabulary enrichment is performed by the LingoGoc backend. Provider keys
// never enter localStorage or the public browser bundle.
import { getBackendUrl, hasBackendApi, readBackendError } from './backendApi';

const VOCAB_ENRICHMENT_PREFIX = 'lingogoc_vocab_enrichment_v3_';

function cleanText(value, maxLength = 500) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
}

function normalizeEnrichment(data) {
  const contextExamples = Array.isArray(data?.contextExamples)
    ? data.contextExamples
      .map((example) => ({
        context: cleanText(example?.context, 80),
        en: cleanText(example?.en),
        vi: cleanText(example?.vi),
      }))
      .filter((example) => example.en.length >= 8 && example.vi.length >= 5)
      .slice(0, 5)
    : [];
  const collocations = Array.isArray(data?.collocations)
    ? data.collocations
      .map((item) => ({ phrase: cleanText(item?.phrase, 120), meaning: cleanText(item?.meaning, 240) }))
      .filter((item) => item.phrase && item.meaning)
      .slice(0, 6)
    : [];
  const senses = Array.isArray(data?.senses)
    ? data.senses
      .map((item) => ({
        pos: cleanText(item?.pos, 40),
        meaningVi: cleanText(item?.meaningVi, 240),
        usage: cleanText(item?.usage, 300),
      }))
      .filter((item) => item.meaningVi)
      .slice(0, 5)
    : [];

  return {
    primaryMeaningVi: cleanText(data?.primaryMeaningVi, 240),
    meaningNote: cleanText(data?.meaningNote, 500),
    mnemonicTip: cleanText(data?.mnemonicTip, 500),
    wordFamily: cleanText(data?.wordFamily, 500),
    contextExamples,
    collocations,
    senses,
    isAiGenerated: Boolean(data?.isAiGenerated ?? true),
  };
}

export function getCachedWordEnrichment(word) {
  if (!word || typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(`${VOCAB_ENRICHMENT_PREFIX}${word.trim().toLowerCase()}`);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function cacheWordEnrichment(word, data) {
  if (!word || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${VOCAB_ENRICHMENT_PREFIX}${word.trim().toLowerCase()}`, JSON.stringify(data));
  } catch {
    // Cache failure must not block dictionary lookup.
  }
}

export async function enrichWordWithLLM(word, meaning = '', topic = '', dictionaryDefinitions = [], signal) {
  const cached = getCachedWordEnrichment(word);
  if (cached) return { ...cached, fromCache: true };
  if (!hasBackendApi()) {
    return {
      isAiGenerated: false,
      contextExamples: [],
      collocations: [],
      senses: [],
      unavailableReason: 'BACKEND_NOT_CONFIGURED',
    };
  }

  try {
    const response = await fetch(getBackendUrl('/api/vocabulary/enrich'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      signal,
      body: JSON.stringify({ word, meaning, topic, dictionaryDefinitions }),
    });
    if (!response.ok) {
      throw new Error(await readBackendError(response, 'Không thể tạo ví dụ đa ngữ cảnh.'));
    }

    const payload = await response.json();
    const data = payload?.data || payload;
    const result = normalizeEnrichment(data);
    if (!result.contextExamples.length) throw new Error('Backend AI không trả về ví dụ song ngữ hợp lệ.');
    cacheWordEnrichment(word, result);
    return result;
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return {
      isAiGenerated: false,
      contextExamples: [],
      collocations: [],
      senses: [],
      unavailableReason: error?.message || 'BACKEND_UNAVAILABLE',
    };
  }
}
