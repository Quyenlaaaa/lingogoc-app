export const DEFAULT_SPEAKING_LEVEL = 'A2';

export const SPEAKING_LEVELS = Object.freeze({
  A1: Object.freeze({
    id: 'A1',
    label: 'A1',
    title: 'Mới bắt đầu',
    description: 'Câu rất ngắn, từ quen thuộc và có hỗ trợ tiếng Việt.',
    speechRate: 0.85,
    prompt: 'Use very common words and one simple sentence of 5-10 words. Speak slowly in a supportive tone. Use present simple where possible. Ask one direct, familiar question. Give Vietnamese hints and a Vietnamese translation. Correct at most one essential error.',
  }),
  A2: Object.freeze({
    id: 'A2',
    label: 'A2',
    title: 'Cơ bản',
    description: 'Tình huống hằng ngày, câu ngắn và sửa lỗi nhẹ.',
    speechRate: 0.95,
    prompt: 'Use common everyday vocabulary and 1-2 short sentences totaling 8-18 words. Ask one clear follow-up question. Give a Vietnamese translation and bilingual hints. Correct at most two useful errors.',
  }),
  B1: Object.freeze({
    id: 'B1',
    label: 'B1',
    title: 'Trung cấp',
    description: 'Hội thoại tự nhiên, giải thích ý kiến và trải nghiệm.',
    speechRate: 1,
    prompt: 'Use natural intermediate English in 1-3 sentences totaling 15-35 words. Encourage reasons, details, and personal experience. Use Vietnamese only for the translation and difficult hints. Prioritize the two corrections that most improve clarity.',
  }),
  B2: Object.freeze({
    id: 'B2',
    label: 'B2',
    title: 'Trung cao cấp',
    description: 'Thảo luận sâu hơn, collocation và cách diễn đạt tự nhiên.',
    speechRate: 1.05,
    prompt: 'Use fluent upper-intermediate English in 2-3 sentences totaling 25-50 words. Introduce useful collocations, invite comparison or justification, and offer a natural reformulation. Keep Vietnamese translation concise and use hints only when valuable.',
  }),
  C1: Object.freeze({
    id: 'C1',
    label: 'C1',
    title: 'Nâng cao',
    description: 'Chủ đề phức tạp, sắc thái và tốc độ nói tự nhiên.',
    speechRate: 1.1,
    prompt: 'Use natural advanced English in 2-4 sentences totaling 35-70 words. Explore nuance, register, implications, and abstract or professional ideas. Ask a thought-provoking follow-up question. Keep Vietnamese support minimal and focus corrections on precision and style.',
  }),
});

export const SPEAKING_LEVEL_OPTIONS = Object.freeze(Object.values(SPEAKING_LEVELS));

export function normalizeSpeakingLevel(value) {
  const level = String(value || '').trim().toUpperCase();
  return SPEAKING_LEVELS[level] ? level : DEFAULT_SPEAKING_LEVEL;
}

export function getSpeakingLevel(value) {
  return SPEAKING_LEVELS[normalizeSpeakingLevel(value)];
}
