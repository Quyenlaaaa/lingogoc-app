import { hasBackendApi } from './backendApi.js';
import { enrichWordWithLLM, getCachedWordEnrichment, hasCompleteWordEnrichment } from './geminiService.js';

const listeners = new Set();
let sourceItems = [];
let restartRequested = false;
let workerPromise = null;
let status = {
  running: false,
  total: 0,
  completed: 0,
  pending: 0,
  currentWord: '',
  consecutiveFailures: 0,
};

function isComplete(item) {
  const cached = getCachedWordEnrichment(item.word);
  return Boolean(cached?.persistedOnServer && hasCompleteWordEnrichment(cached));
}

function publish(patch) {
  status = { ...status, ...patch };
  listeners.forEach((listener) => listener(status));
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function runQueue() {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    publish({ running: true });

    while (sourceItems.length && hasBackendApi()) {
      restartRequested = false;
      const items = [...sourceItems];
      const pending = items.filter((item) => !isComplete(item));
      let completed = items.length - pending.length;
      let consecutiveFailures = 0;
      publish({
        running: pending.length > 0,
        total: items.length,
        completed,
        pending: pending.length,
        currentWord: '',
        consecutiveFailures: 0,
      });
      if (!pending.length) break;

      for (const item of pending) {
        if (restartRequested) break;
        publish({ currentWord: item.word });

        try {
          const result = await enrichWordWithLLM(
            item.word,
            item.meaning,
            item.topic,
            [],
            undefined,
            { keepAlive: true, maxAttempts: 3 },
          );
          const complete = Boolean(result?.persistedOnServer && hasCompleteWordEnrichment(result));
          if (complete) {
            completed += 1;
            consecutiveFailures = 0;
            publish({
              completed,
              pending: Math.max(0, items.length - completed),
              consecutiveFailures: 0,
            });
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('lingogoc:vocabulary-enriched', {
                detail: { word: item.word, data: result },
              }));
            }
          } else {
            consecutiveFailures += 1;
            publish({ consecutiveFailures });
          }
        } catch (error) {
          if (error?.name !== 'AbortError') consecutiveFailures += 1;
          publish({ consecutiveFailures });
        }

        // Avoid provider bursts. After repeated failures, use a circuit-breaker
        // pause but continue with later words instead of blocking the queue.
        await wait(consecutiveFailures >= 3 ? 60000 : 700);
        if (consecutiveFailures >= 3) consecutiveFailures = 0;
      }

      if (restartRequested) continue;

      // Re-scan the cache after a full pass. Failed words return to the next
      // pass, so no item is permanently skipped after a temporary API error.
      const remaining = sourceItems.filter((item) => !isComplete(item)).length;
      if (!remaining) break;
      publish({ pending: remaining, currentWord: '' });
      await wait(15000);
    }

    publish({ running: false, currentWord: '', consecutiveFailures: 0 });
  })().finally(() => {
    workerPromise = null;
    if (restartRequested && sourceItems.length && hasBackendApi()) runQueue();
  });
  return workerPromise;
}

export function startVocabularyEnrichmentQueue(vocabulary) {
  const unique = new Map();
  (vocabulary || []).forEach((item) => {
    const word = String(item?.word || '').trim().toLowerCase();
    if (word && !unique.has(word)) unique.set(word, item);
  });
  sourceItems = [...unique.values()];
  restartRequested = true;
  publish({ total: sourceItems.length });
  if (sourceItems.length && hasBackendApi()) runQueue();
}

export function subscribeVocabularyEnrichmentQueue(listener) {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

export function getVocabularyEnrichmentQueueStatus() {
  return status;
}
