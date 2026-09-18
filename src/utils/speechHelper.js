// speechHelper.js - Web Speech API utilities for TTS and STT.
// Browsers expose different synthesis voices. Use one backend audio stream on
// every device and keep speechSynthesis only as an availability fallback.
import { getBackendUrl, hasBackendApi } from './backendApi.js';

export const VOICE_PRESETS = [
  { id: 'auto', label: 'Tự động · ổn định', description: 'Giọng máy chủ đồng nhất, phù hợp nhất trên điện thoại.' },
  { id: 'female_young', label: 'Nữ trẻ', description: 'Giọng sáng, rõ và tốc độ tự nhiên.' },
  { id: 'female_mature', label: 'Nữ trung niên', description: 'Giọng nữ ấm, chậm và điềm tĩnh hơn.' },
  { id: 'male_young', label: 'Nam trẻ', description: 'Giọng nam rõ, năng động.' },
  { id: 'male_mature', label: 'Nam trung niên', description: 'Giọng nam trầm, chậm và chắc.' },
  { id: 'child', label: 'Trẻ em · mô phỏng', description: 'Giọng cao và sáng hơn để mô phỏng trẻ em.' },
  { id: 'senior', label: 'Người lớn tuổi · mô phỏng', description: 'Giọng trầm và chậm hơn để dễ nghe.' },
];

const VOICE_PROFILES = {
  auto: { pitch: 1, rateMultiplier: 1, names: /natural|samantha|karen|daniel|alex|moira|google/i },
  female_young: { pitch: 1.08, rateMultiplier: 1.02, names: /aria|jenny|ava|samantha|zira|\bfemale\b|\bwoman\b/i },
  female_mature: { pitch: 0.95, rateMultiplier: 0.94, names: /karen|victoria|susan|hazel|moira|\bfemale\b|\bwoman\b/i },
  male_young: { pitch: 1.02, rateMultiplier: 1, names: /guy|ryan|alex|\bmale\b|\bman\b/i },
  male_mature: { pitch: 0.88, rateMultiplier: 0.92, names: /david|mark|george|daniel|fred|\bmale\b|\bman\b/i },
  child: { pitch: 1.25, rateMultiplier: 1.02, names: /aria|jenny|ava|samantha|zira|\bfemale\b|\bwoman\b/i },
  senior: { pitch: 0.82, rateMultiplier: 0.84, names: /david|mark|george|daniel|fred|\bmale\b|\bman\b/i },
};

const normalizeVoicePreset = (preset) => (
  Object.prototype.hasOwnProperty.call(VOICE_PROFILES, preset) ? preset : 'auto'
);

export class SpeechHelper {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voices = [];
    this.recognition = null;
    this.isListening = false;
    this.defaultRate = 0.85;
    this.voicePreset = 'auto';
    this.activeUtterance = null;
    this.audio = null;
    this.activeAudio = null;
    this.activeNativeSpeechId = null;
    this.nativeSpeechCallbacks = new Map();
    this.nativeSpeechSequence = 0;
    this.nativeRecognitionCallbacks = new Map();
    this.nativeRecognitionSequence = 0;
    this.audioRequestId = 0;
    this.keepAliveTimer = null;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    this.mobileDevice = typeof navigator !== 'undefined' && (
      /iPhone|iPad|iPod|Android|Mobile|webOS/i.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
    this.needsSpeechKeepAlive = /(?:Chrome|Chromium|Edg)\//i.test(userAgent) && !/iPhone|iPad|iPod/i.test(userAgent);

    this.initVoices();

    if (typeof window !== 'undefined') {
      window.__lingogocNativeSpeechEvent = (requestId, status) => {
        const callbacks = this.nativeSpeechCallbacks.get(String(requestId));
        if (!callbacks) return;
        if (status === 'start') {
          callbacks.onStart?.({ type: 'start', native: true });
          return;
        }
        this.nativeSpeechCallbacks.delete(String(requestId));
        if (this.activeNativeSpeechId === String(requestId)) this.activeNativeSpeechId = null;
        if (status === 'done') callbacks.onEnd?.({ type: 'end', native: true });
        else callbacks.onError?.({ error: 'native-speech-error', native: true });
      };
      window.__lingogocNativeRecognitionEvent = (requestId, status, transcript = '', error = '') => {
        const callbacks = this.nativeRecognitionCallbacks.get(String(requestId));
        if (!callbacks) return;
        if (status === 'partial' || status === 'final') {
          callbacks.onResult?.({
            final: status === 'final' ? String(transcript).trim() : '',
            interim: status === 'partial' ? String(transcript).trim() : '',
            isFinal: status === 'final',
          });
          return;
        }
        if (status === 'error') callbacks.onError?.(error || 'recognition-error');
        if (status === 'end') {
          this.nativeRecognitionCallbacks.delete(String(requestId));
          this.isListening = false;
          callbacks.onEnd?.();
        }
      };
    }
  }

  initVoices() {
    if (!this.synth) return;

    const loadVoices = () => {
      const voices = this.synth.getVoices();
      if (voices?.length) this.voices = voices;
    };

    loadVoices();
    if (typeof this.synth.addEventListener === 'function') {
      this.synth.addEventListener('voiceschanged', loadVoices);
    } else if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  isMobileDevice() {
    return this.mobileDevice;
  }

  setVoicePreset(preset) {
    this.voicePreset = normalizeVoicePreset(preset);
    return this.voicePreset;
  }

  getVoicePreset() {
    return this.voicePreset;
  }

  getPreferredVoice(language = 'en-US', preset = this.voicePreset) {
    if (!this.voices.length && this.synth) {
      this.voices = this.synth.getVoices() || [];
    }

    const normalizedLanguage = language.toLowerCase().replace('_', '-');
    const languagePrefix = normalizedLanguage.split('-')[0];
    const matchingVoices = this.voices.filter((voice) => {
      const voiceLanguage = (voice.lang || '').toLowerCase().replace('_', '-');
      return voiceLanguage === normalizedLanguage || voiceLanguage.startsWith(`${languagePrefix}-`);
    });

    const profile = VOICE_PROFILES[normalizeVoicePreset(preset)];

    return (
      matchingVoices.find((voice) => voice.localService && profile.names.test(voice.name)) ||
      matchingVoices.find((voice) => profile.names.test(voice.name)) ||
      matchingVoices.find((voice) => voice.localService && (voice.lang || '').toLowerCase().replace('_', '-') === normalizedLanguage) ||
      matchingVoices.find((voice) => (voice.lang || '').toLowerCase().replace('_', '-') === normalizedLanguage) ||
      matchingVoices[0] ||
      null
    );
  }

  clearKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  getAudio() {
    if (typeof Audio === 'undefined') return null;
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.playsInline = true;
    }
    return this.audio;
  }

  speakWithNativeVoice(text, options, profile) {
    const bridge = typeof window !== 'undefined' ? window.LingoGocNative : null;
    if (!bridge || typeof bridge.speak !== 'function') return false;

    this.stopSpeaking();
    const requestId = `speech-${Date.now()}-${++this.nativeSpeechSequence}`;
    this.nativeSpeechCallbacks.set(requestId, {
      ...options,
      onError: (event) => {
        if (!this.speakWithBackendAudio(text, { ...options, voicePreset: 'auto', fallbackError: event })) {
          options.onError?.(event);
        }
      },
    });
    this.activeNativeSpeechId = requestId;

    try {
      const accepted = bridge.speak(
        text,
        options.lang || 'en-US',
        Math.min(2, Math.max(0.5, (options.rate ?? this.defaultRate) * profile.rateMultiplier)),
        options.pitch ?? profile.pitch,
        requestId,
      );
      if (accepted) return true;
    } catch {
      // Continue with the browser speech engine below.
    }

    this.nativeSpeechCallbacks.delete(requestId);
    this.activeNativeSpeechId = null;
    return false;
  }

  speakWithBackendAudio(text, options) {
    const audio = this.getAudio();
    if (!audio || !hasBackendApi()) return false;

    this.stopSpeaking();
    const requestId = ++this.audioRequestId;
    this.activeAudio = audio;
    let fallbackStarted = false;
    const clearAudioCallbacks = () => {
      audio.onplay = null;
      audio.onended = null;
      audio.onerror = null;
    };
    const fallbackToBrowserVoice = (error) => {
      if (fallbackStarted || this.activeAudio !== audio || this.audioRequestId !== requestId) return;
      fallbackStarted = true;
      clearAudioCallbacks();
      this.activeAudio = null;
      try {
        audio.pause();
      } catch {
        // Ignore media engines that throw while changing source.
      }
      this.speak(text, { ...options, browserOnly: true, fallbackError: error });
    };

    audio.onplay = (event) => {
      if (this.activeAudio === audio && this.audioRequestId === requestId) options.onStart?.(event);
    };
    audio.onended = (event) => {
      if (this.activeAudio !== audio || this.audioRequestId !== requestId) return;
      clearAudioCallbacks();
      this.activeAudio = null;
      options.onEnd?.(event);
    };
    audio.onerror = (event) => fallbackToBrowserVoice(event);

    try {
      const language = String(options.lang || 'en-US').slice(0, 12);
      audio.src = getBackendUrl(`/api/speech/audio?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(language)}`);
      audio.currentTime = 0;
      audio.playbackRate = Math.min(2, Math.max(0.5, options.rate ?? this.defaultRate));
      audio.defaultPlaybackRate = audio.playbackRate;
      audio.load();

      // Calling play() before leaving the click handler preserves the mobile
      // user-activation token while the browser downloads the audio stream.
      const playResult = audio.play();
      Promise.resolve(playResult).catch(fallbackToBrowserVoice);
      return true;
    } catch (error) {
      fallbackToBrowserVoice(error);
      return true;
    }
  }

  // Keep long speech alive on mobile Chromium, which can otherwise pause a
  // long utterance when the page has been speaking continuously for a while.
  startKeepAlive(utterance) {
    this.clearKeepAlive();
    if (!this.needsSpeechKeepAlive) return;
    this.keepAliveTimer = setInterval(() => {
      if (this.activeUtterance !== utterance || !this.synth?.speaking) return;
      try {
        this.synth.pause();
        this.synth.resume();
      } catch {
        // Some engines expose pause/resume but do not implement them fully.
      }
    }, 10000);
  }

  // Returns true when the utterance was synchronously submitted to the native
  // engine. Keeping synth.speak() in this call stack is important on iOS.
  speak(text, options = {}) {
    const cleanText = String(text || '').trim();
    if (!cleanText) {
      options.onError?.({ error: 'speech-synthesis-not-supported' });
      return false;
    }

    const preset = normalizeVoicePreset(options.voicePreset ?? this.voicePreset);
    const profile = VOICE_PROFILES[preset];

    // The backend stream is the most reliable option on mobile, but it exposes
    // only one voice. Named presets therefore use the device voice engine.
    if (!options.browserOnly && preset === 'auto' && this.speakWithBackendAudio(cleanText, options)) {
      return true;
    }

    if (!options.browserOnly && preset !== 'auto' && this.speakWithNativeVoice(cleanText, options, profile)) {
      return true;
    }

    if (!this.synth || typeof SpeechSynthesisUtterance === 'undefined') {
      if (!options.browserOnly && this.speakWithBackendAudio(cleanText, options)) return true;
      options.onError?.(options.fallbackError || { error: 'speech-synthesis-not-supported' });
      return false;
    }

    this.stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = options.lang || 'en-US';
    const baseRate = options.rate ?? this.defaultRate;
    utterance.rate = Math.min(2, Math.max(0.5, baseRate * profile.rateMultiplier));
    utterance.pitch = options.pitch ?? profile.pitch;
    utterance.volume = options.volume ?? 1;

    const preferredVoice = this.getPreferredVoice(utterance.lang, preset);
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = (event) => {
      if (this.activeUtterance !== utterance) return;
      this.startKeepAlive(utterance);
      options.onStart?.(event);
    };

    utterance.onend = (event) => {
      if (this.activeUtterance !== utterance) return;
      this.activeUtterance = null;
      this.clearKeepAlive();
      options.onEnd?.(event);
    };

    utterance.onerror = (event) => {
      if (this.activeUtterance !== utterance) return;
      this.activeUtterance = null;
      this.clearKeepAlive();
      if (!options.browserOnly && preset !== 'auto' && this.speakWithBackendAudio(cleanText, {
        ...options,
        voicePreset: 'auto',
        fallbackError: event,
      })) return;
      options.onError?.(event);
    };

    this.activeUtterance = utterance;
    try {
      if (this.synth.paused) this.synth.resume();
      this.synth.speak(utterance);
      return true;
    } catch (error) {
      this.activeUtterance = null;
      this.clearKeepAlive();
      options.onError?.(error);
      return false;
    }
  }

  stopSpeaking() {
    this.clearKeepAlive();
    if (this.activeNativeSpeechId) {
      this.nativeSpeechCallbacks.delete(this.activeNativeSpeechId);
      this.activeNativeSpeechId = null;
      try {
        window.LingoGocNative?.stopSpeech?.();
      } catch {
        // Ignore native bridge shutdown races.
      }
    }
    this.audioRequestId += 1;
    if (this.activeAudio) {
      const audio = this.activeAudio;
      this.activeAudio = null;
      audio.onplay = null;
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // Ignore media engines that throw while already idle.
      }
    }
    const shouldCancel = Boolean(this.activeUtterance || this.synth?.speaking || this.synth?.pending);
    this.activeUtterance = null;
    if (!this.synth || !shouldCancel) return;
    try {
      this.synth.cancel();
    } catch {
      // Ignore engines that throw while already idle.
    }
  }

  // Speech to Text (Microphone)
  createRecognition(onResult, onError, onEnd) {
    const nativeBridge = typeof window !== 'undefined' ? window.LingoGocNative : null;
    if (nativeBridge && typeof nativeBridge.startListening === 'function') {
      let requestId = null;
      const helper = this;
      return {
        lang: 'en-US',
        start() {
          requestId = `recognition-${Date.now()}-${++helper.nativeRecognitionSequence}`;
          helper.nativeRecognitionCallbacks.set(requestId, { onResult, onError, onEnd });
          nativeBridge.startListening(requestId, this.lang || 'en-US');
          helper.isListening = true;
        },
        abort() {
          if (!requestId) return;
          nativeBridge.stopListening?.(requestId);
          helper.nativeRecognitionCallbacks.delete(requestId);
          helper.isListening = false;
          requestId = null;
        },
      };
    }

    const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      onResult({
        final: finalTranscript.trim(),
        interim: interimTranscript.trim(),
        isFinal: finalTranscript.length > 0,
      });
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      onError?.(event.error);
    };

    recognition.onend = () => {
      this.isListening = false;
      onEnd?.();
    };

    return recognition;
  }

  isSpeechRecognitionSupported() {
    return typeof window !== 'undefined' && Boolean(
      window.LingoGocNative?.startListening || window.SpeechRecognition || window.webkitSpeechRecognition,
    );
  }
}

export const speechHelper = new SpeechHelper();

export function speakText(text, rate = 0.85) {
  return speechHelper.speak(text, { rate });
}

export function startSpeechRecognition(onResult, onError, onEnd) {
  const rec = speechHelper.createRecognition(
    (result) => {
      if (result.isFinal) onResult?.(result.final);
    },
    onError,
    onEnd,
  );
  if (rec) {
    try {
      rec.start();
    } catch (error) {
      console.warn('Recognition already started', error);
    }
  }
  return rec;
}

export default speechHelper;
