// realDictionaryService.js - Dịch vụ tích hợp dữ liệu từ điển thật 100% từ Free Dictionary API
// Cung cấp audio, định nghĩa tiếng Anh, từ đồng nghĩa và ví dụ từ dictionaryapi.dev.
import { getBackendUrl, hasBackendApi } from './backendApi.js';

const DICT_CACHE_PREFIX = 'lingogoc_real_dict_';
let nativeAudio = null;

function getNativeAudio() {
  if (typeof Audio === 'undefined') return null;
  if (!nativeAudio) {
    nativeAudio = new Audio();
    nativeAudio.preload = 'auto';
    nativeAudio.playsInline = true;
  }
  return nativeAudio;
}

export function getCachedNativeAudioUrl(word) {
  if (!word || typeof localStorage === 'undefined') return null;
  try {
    const cached = JSON.parse(localStorage.getItem(`${DICT_CACHE_PREFIX}${word.trim().toLowerCase()}`) || 'null');
    return typeof cached?.audioUrl === 'string' && cached.audioUrl ? cached.audioUrl : null;
  } catch {
    return null;
  }
}

export function getPronunciationAudioUrl(word) {
  if (!word || !hasBackendApi()) return null;
  return getBackendUrl(`/api/vocabulary/pronunciation?word=${encodeURIComponent(word.trim().toLowerCase())}`);
}

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
 * Trả về Promise<boolean>: true nếu phát thành công, false nếu lỗi/bị chặn trên thiết bị di động
 */
export function preloadNativeAudio(audioUrl) {
  const audio = getNativeAudio();
  if (!audio || !audioUrl || audio.src === audioUrl) return;
  audio.src = audioUrl;
  try {
    audio.load();
  } catch {
    // Preloading is optional; playNativeAudio will report an actual failure.
  }
}

export function playNativeAudio(audioUrl, playbackRate = 1) {
  const audio = getNativeAudio();
  if (!audio || !audioUrl) return Promise.resolve(false);

  try {
    audio.pause();
    if (audio.src !== audioUrl) {
      audio.src = audioUrl;
      audio.load();
    }
    audio.currentTime = 0;
    audio.playbackRate = Math.min(2, Math.max(0.5, playbackRate || 1));
    audio.defaultPlaybackRate = audio.playbackRate;

    // Do not await before play(): mobile browsers require this call to remain
    // in the original pointer/click event stack.
    const playResult = audio.play();
    return Promise.resolve(playResult)
      .then(() => true)
      .catch((error) => {
        console.warn('Native audio play failed or blocked:', error);
        return false;
      });
  } catch (error) {
    console.warn('Native audio play failed or blocked:', error);
    return Promise.resolve(false);
  }
}
