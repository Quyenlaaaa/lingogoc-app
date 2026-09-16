// Vocabulary enrichment is performed by the LingoGoc backend. Provider keys
// never enter localStorage or the public browser bundle.
import { getBackendUrl, hasBackendApi, readBackendError } from './backendApi';

const VOCAB_ENRICHMENT_PREFIX = 'lingogoc_vocab_enrichment_v2_';

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
    const result = {
      ...data,
      isAiGenerated: Boolean(data?.isAiGenerated ?? true),
      contextExamples: Array.isArray(data?.contextExamples) ? data.contextExamples : [],
      collocations: Array.isArray(data?.collocations) ? data.collocations : [],
      senses: Array.isArray(data?.senses) ? data.senses : [],
    };
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
