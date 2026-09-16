const PRIVATE_VOCAB_KEY = 'lingogoc_private_vocabulary_v1';

const REQUIRED_FIELDS = ['word', 'meaning'];

function cleanText(value) {
  return String(value ?? '').trim();
}

function normalizeWord(item, index) {
  const word = cleanText(item.word || item.english || item.en);
  const meaning = cleanText(item.meaning || item.vietnamese || item.vi);

  if (!word || !meaning) return null;

  return {
    id: cleanText(item.id) || `private-${index + 1}-${word.toLowerCase()}`,
    word,
    meaning,
    ipa: cleanText(item.ipa || item.phonetic),
    type: cleanText(item.type || item.pos || item.partOfSpeech),
    pos: cleanText(item.pos || item.type || item.partOfSpeech),
    level: cleanText(item.level).toUpperCase() || 'A1',
    topic: cleanText(item.topic || item.category) || 'Cá nhân',
    example: cleanText(item.example || item.exampleEn),
    exampleVi: cleanText(item.exampleVi || item.example_vi),
  };
}

function parseCsvLine(line, delimiter) {
  const values = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }

  values.push(value.trim());
  return values;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error('Tệp CSV cần có hàng tiêu đề và ít nhất một từ.');

  const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const headers = parseCsvLine(lines[0], delimiter).map((header) => header.toLowerCase().trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] || '';
      return row;
    }, {});
  });
}

export function normalizeVocabulary(input) {
  const source = Array.isArray(input) ? input : input?.words || input?.vocabulary || input?.data;
  if (!Array.isArray(source)) {
    throw new Error('Dữ liệu phải là một mảng từ vựng hoặc có trường "words".');
  }

  const normalized = source.map(normalizeWord).filter(Boolean);
  if (!normalized.length) {
    throw new Error(`Không tìm thấy từ hợp lệ. Mỗi từ cần có: ${REQUIRED_FIELDS.join(', ')}.`);
  }

  const seen = new Set();
  return normalized.filter((item) => {
    const key = item.word.toLocaleLowerCase('en');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseVocabularyFile(text, fileName = '') {
  const raw = fileName.toLowerCase().endsWith('.csv') ? parseCsv(text) : JSON.parse(text);
  return normalizeVocabulary(raw);
}

export function loadPrivateVocabulary() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PRIVATE_VOCAB_KEY);
    return raw ? normalizeVocabulary(JSON.parse(raw)) : null;
  } catch (error) {
    console.warn('Không thể đọc kho từ vựng cá nhân:', error);
    return null;
  }
}

export function savePrivateVocabulary(words) {
  const normalized = normalizeVocabulary(words);
  window.localStorage.setItem(PRIVATE_VOCAB_KEY, JSON.stringify(normalized));
  return normalized;
}

export function clearPrivateVocabulary() {
  window.localStorage.removeItem(PRIVATE_VOCAB_KEY);
}

export function downloadVocabulary(words) {
  const blob = new Blob([JSON.stringify({ version: 1, words }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `lingogoc_private_vocab_${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function getVocabularyMeta(words, isPrivate) {
  return {
    count: words.length,
    topics: new Set(words.map((word) => word.topic).filter(Boolean)).size,
    levels: new Set(words.map((word) => word.level).filter(Boolean)).size,
    isPrivate,
  };
}
