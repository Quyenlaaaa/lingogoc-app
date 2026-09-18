// realDictionaryService.js - Dịch vụ tích hợp dữ liệu từ điển thật 100% từ Free Dictionary API
// Cung cấp audio, định nghĩa tiếng Anh, từ đồng nghĩa và ví dụ từ dictionaryapi.dev.
import { getBackendUrl, hasBackendApi, readJsonResponse } from './backendApi.js';

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

export async function fetchRealWordData(word, signal) {
  if (!word) return null;
  const cleanWord = word.trim().toLowerCase();

  // 1. Kiểm tra cache trong localStorage
  try {
    const cached = localStorage.getItem(`${DICT_CACHE_PREFIX}${cleanWord}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {}

  if (!hasBackendApi()) return null;
  try {
    const response = await fetch(
      getBackendUrl(`/api/vocabulary/dictionary?word=${encodeURIComponent(cleanWord)}`),
      { headers: { Accept: 'application/json' }, signal },
    );
    if (response.status === 204 || !response.ok) return null;
    const payload = await readJsonResponse(response, 'Dữ liệu từ điển không hợp lệ.');
    const result = payload?.data || null;
    if (!result) return null;
    try {
      localStorage.setItem(`${DICT_CACHE_PREFIX}${cleanWord}`, JSON.stringify(result));
    } catch {
      // Edge cache remains available when browser storage is unavailable.
    }
    return result;
  } catch (error) {
    if (error?.name !== 'AbortError') console.warn(`Could not fetch dictionary data for ${cleanWord}:`, error);
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
