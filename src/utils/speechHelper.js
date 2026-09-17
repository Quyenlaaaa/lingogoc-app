// speechHelper.js - Web Speech API utilities for TTS and STT.
// Browsers expose different synthesis voices. Use one backend audio stream on
// every device and keep speechSynthesis only as an availability fallback.
import { getBackendUrl, hasBackendApi } from './backendApi.js';

export class SpeechHelper {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voices = [];
    this.recognition = null;
    this.isListening = false;
    this.defaultRate = 0.85;
    this.activeUtterance = null;
    this.audio = null;
    this.activeAudio = null;
    this.audioRequestId = 0;
    this.keepAliveTimer = null;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    this.mobileDevice = typeof navigator !== 'undefined' && (
      /iPhone|iPad|iPod|Android|Mobile|webOS/i.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
    this.needsSpeechKeepAlive = /(?:Chrome|Chromium|Edg)\//i.test(userAgent) && !/iPhone|iPad|iPod/i.test(userAgent);

    this.initVoices();
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

  getPreferredVoice(language = 'en-US') {
    if (!this.voices.length && this.synth) {
      this.voices = this.synth.getVoices() || [];
    }

    const normalizedLanguage = language.toLowerCase().replace('_', '-');
    const languagePrefix = normalizedLanguage.split('-')[0];
    const matchingVoices = this.voices.filter((voice) => {
      const voiceLanguage = (voice.lang || '').toLowerCase().replace('_', '-');
      return voiceLanguage === normalizedLanguage || voiceLanguage.startsWith(`${languagePrefix}-`);
    });

    return (
      matchingVoices.find((voice) => voice.localService && /natural|samantha|karen|daniel|alex|moira|google/i.test(voice.name)) ||
      matchingVoices.find((voice) => voice.localService && (voice.lang || '').toLowerCase().replace('_', '-') === normalizedLanguage) ||
      matchingVoices.find((voice) => /natural|samantha|karen|daniel|alex|moira|google/i.test(voice.name)) ||
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

    if (!options.browserOnly && this.speakWithBackendAudio(cleanText, options)) {
      return true;
    }

    if (!this.synth || typeof SpeechSynthesisUtterance === 'undefined') {
      options.onError?.(options.fallbackError || { error: 'speech-synthesis-not-supported' });
      return false;
    }

    this.stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = options.lang || 'en-US';
    utterance.rate = options.rate ?? this.defaultRate;
    utterance.pitch = options.pitch ?? 1;
    utterance.volume = options.volume ?? 1;

    const preferredVoice = this.getPreferredVoice(utterance.lang);
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
    return typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
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
