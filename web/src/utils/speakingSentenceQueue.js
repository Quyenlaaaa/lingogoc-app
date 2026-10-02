const MAX_QUEUED_SENTENCES = 6;

export function createSpeakingSentenceQueue(requestId = null) {
  return {
    requestId,
    cumulativeText: '',
    consumedLength: 0,
    sentences: [],
    final: false,
  };
}

function appendBounded(sentences, sentence) {
  const clean = String(sentence || '').replace(/\s+/g, ' ').trim();
  if (!clean) return sentences;
  if (sentences.length < MAX_QUEUED_SENTENCES) return [...sentences, clean];
  const next = [...sentences];
  next[next.length - 1] = `${next[next.length - 1]} ${clean}`;
  return next;
}

export function updateSpeakingSentenceQueue(state, cumulativeText, { final = false } = {}) {
  const text = String(cumulativeText || '').replace(/\s+/g, ' ').trim();
  const previousPrefix = state.cumulativeText.slice(0, state.consumedLength);
  const compatible = !previousPrefix || text.startsWith(previousPrefix);
  let consumedLength = compatible ? state.consumedLength : 0;
  let sentences = compatible ? [...state.sentences] : [];
  const boundary = /[.!?]+(?:["')\]]+)?(?=\s|$)/g;
  boundary.lastIndex = consumedLength;
  let match;
  while ((match = boundary.exec(text))) {
    const end = match.index + match[0].length;
    sentences = appendBounded(sentences, text.slice(consumedLength, end));
    consumedLength = end;
    while (text[consumedLength] === ' ') consumedLength += 1;
  }
  if (final && consumedLength < text.length) {
    sentences = appendBounded(sentences, text.slice(consumedLength));
    consumedLength = text.length;
  }
  return {
    ...state,
    cumulativeText: text,
    consumedLength,
    sentences,
    final: Boolean(final),
  };
}

export function shiftSpeakingSentenceQueue(state) {
  if (!state.sentences.length) return { sentence: '', state };
  const [sentence, ...sentences] = state.sentences;
  return { sentence, state: { ...state, sentences } };
}
