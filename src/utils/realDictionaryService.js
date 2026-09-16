// realDictionaryService.js - Dịch vụ tích hợp dữ liệu từ điển thật 100% từ Free Dictionary API
// Cung cấp audio, định nghĩa tiếng Anh, từ đồng nghĩa và ví dụ từ dictionaryapi.dev.

const DICT_CACHE_PREFIX = 'lingogoc_real_dict_';

export async function fetchRealWordData(word) {
  if (!word) return null;
  const cleanWord = word.trim().toLowerCase();

  // 1. Kiểm tra cache trong localStorage
  try {
    const cached = localStorage.getItem(`${DICT_CACHE_PREFIX}${cleanWord}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {}

  // 2. Gọi Free Dictionary API. Không gắn nhãn Oxford/Cambridge vì API không
  // đảm bảo mọi mục từ đến từ các nhà xuất bản đó.
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const entry = data[0];

    // Tìm file âm thanh MP3 người bản xứ đọc thật
    let audioUrl = null;
    if (entry.phonetics && Array.isArray(entry.phonetics)) {
      for (const p of entry.phonetics) {
        if (p.audio && p.audio.endsWith('.mp3')) {
          audioUrl = p.audio.startsWith('//') ? `https:${p.audio}` : p.audio;
          break;
        }
      }
    }

    // Thu thập các câu ví dụ thật và định nghĩa
    const realExamples = [];
    const synonyms = new Set();
    const antonyms = new Set();
    const definitions = [];

    if (entry.meanings && Array.isArray(entry.meanings)) {
      for (const m of entry.meanings) {
        const partOfSpeech = m.partOfSpeech || '';
        if (m.definitions && Array.isArray(m.definitions)) {
          for (const d of m.definitions) {
            if (d.definition && definitions.length < 5) {
              definitions.push({ partOfSpeech, text: d.definition });
            }
            if (d.example && realExamples.length < 6) {
              realExamples.push(d.example);
            }
            if (d.synonyms && Array.isArray(d.synonyms)) {
              d.synonyms.forEach(s => synonyms.add(s));
            }
            if (d.antonyms && Array.isArray(d.antonyms)) {
              d.antonyms.forEach(a => antonyms.add(a));
            }
          }
        }
        if (m.synonyms && Array.isArray(m.synonyms)) {
          m.synonyms.forEach(s => synonyms.add(s));
        }
      }
    }

    const result = {
      word: entry.word || cleanWord,
      phonetic: entry.phonetic || (entry.phonetics?.[0]?.text || ''),
      audioUrl: audioUrl,
      definitions: definitions,
      examples: realExamples,
      synonyms: Array.from(synonyms).slice(0, 6),
      antonyms: Array.from(antonyms).slice(0, 6),
      sourceUrls: entry.sourceUrls || []
    };

    // Lưu vào cache
    try {
      localStorage.setItem(`${DICT_CACHE_PREFIX}${cleanWord}`, JSON.stringify(result));
    } catch (e) {}

    return result;
  } catch (err) {
    console.warn(`Could not fetch real dictionary data for ${cleanWord}:`, err);
    return null;
  }
}

/**
 * Phát âm thanh người bản xứ thật từ URL MP3
 */
export function playNativeAudio(audioUrl) {
  if (!audioUrl) return false;
  try {
    const audio = new Audio(audioUrl);
    audio.play().catch(e => console.warn('Audio play error:', e));
    return true;
  } catch (e) {
    return false;
  }
}
