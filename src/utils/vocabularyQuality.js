const LOW_QUALITY_EXAMPLE_PATTERNS = [
  /used the word .+ in (?:her|his|their) sentence/i,
  /i use the word .+ every day/i,
  /practice speaking .+ clearly/i,
  /this is an example of/i,
  /can you explain the meaning of/i,
  /common to hear .+ in (?:real )?(?:american )?english/i,
  /tôi sử dụng từ .+ mỗi ngày/i,
  /đã dùng từ .+ trong câu/i,
  /hãy luyện phát âm từ/i,
  /đây là một ví dụ về/i,
];

const LOW_QUALITY_MEANING_PATTERNS = [
  /^từ(?: vựng)?\s*['"]/i,
  /^của\s+[a-z-]+$/i,
  /^\+\s*/,
  /chưa có nghĩa đã kiểm chứng/i,
];

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizePos(value) {
  const pos = normalizeText(value).toLowerCase();
  if (pos.startsWith('n')) return 'n';
  if (pos.startsWith('v')) return 'v';
  if (pos.startsWith('adj')) return 'adj';
  if (pos.startsWith('adv')) return 'adv';
  if (pos.startsWith('prep')) return 'prep';
  return pos;
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item).toLocaleLowerCase('en');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function isLowQualityExample(example) {
  const text = normalizeText(example);
  if (!text || text.length < 8) return true;
  return LOW_QUALITY_EXAMPLE_PATTERNS.some((pattern) => pattern.test(text));
}

export function isLowQualityMeaning(meaning) {
  const text = normalizeText(meaning);
  if (!text || text.length < 2) return true;
  return LOW_QUALITY_MEANING_PATTERNS.some((pattern) => pattern.test(text));
}

export function getTrustedExamples(word) {
  const candidates = [];

  if (Array.isArray(word?.examples)) {
    word.examples.forEach((example) => {
      if (typeof example === 'string') candidates.push({ en: example, vi: '', source: 'dataset' });
      else candidates.push({ en: example?.en, vi: example?.vi, source: example?.source || 'dataset' });
    });
  }

  if (word?.example) {
    candidates.push({ en: word.example, vi: word.exampleVi || '', source: 'dataset' });
  }

  return uniqueBy(
    candidates
      .map((example) => ({ ...example, en: normalizeText(example.en), vi: normalizeText(example.vi) }))
      .filter((example) => !isLowQualityExample(example.en) && !isLowQualityExample(example.vi || example.en)),
    (example) => example.en,
  );
}

function wordSimilarity(a, b) {
  const left = normalizeText(a).toLowerCase();
  const right = normalizeText(b).toLowerCase();
  if (!left || !right) return 0;

  const lengthScore = 1 - Math.min(1, Math.abs(left.length - right.length) / Math.max(left.length, right.length));
  const prefixScore = left[0] === right[0] ? 0.35 : 0;
  return lengthScore + prefixScore;
}

function distractorScore(target, candidate) {
  let score = 0;
  if (normalizePos(target.pos || target.type) === normalizePos(candidate.pos || candidate.type)) score += 8;
  if (target.topic && target.topic === candidate.topic) score += 5;
  if (target.level && target.level === candidate.level) score += 3;
  score += wordSimilarity(target.word, candidate.word) * 2;
  return score;
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

export function buildQuizOptions(target, vocabulary, answerField = 'meaning', count = 4) {
  const targetAnswer = normalizeText(target?.[answerField]);
  const candidates = uniqueBy(
    vocabulary.filter((candidate) => (
      candidate.id !== target.id
      && normalizeText(candidate?.[answerField])
      && normalizeText(candidate?.[answerField]).toLocaleLowerCase('en') !== targetAnswer.toLocaleLowerCase('en')
    )),
    (candidate) => normalizeText(candidate[answerField]),
  );

  const ranked = candidates
    .map((candidate) => ({ candidate, score: distractorScore(target, candidate) + Math.random() * 1.5 }))
    .sort((left, right) => right.score - left.score);

  const distractors = ranked.slice(0, count - 1).map(({ candidate }) => candidate);
  return shuffle([target, ...distractors]);
}

export function buildClozePrompt(word) {
  const example = getTrustedExamples(word)[0]?.en;
  if (!example) return null;
  const escapedWord = word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\b${escapedWord}\\b`, 'i');
  if (!pattern.test(example)) return null;
  return example.replace(pattern, '_____');
}
