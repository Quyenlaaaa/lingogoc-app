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
    this.recognitionSequence = 0;
    this.recognitionTimer = null;
    this.audioRequestId = 0;
    this.keepAliveTimer = null;
    this.playbackTimer = null;
    this.playbackSequence = 0;
    this.activePlaybackId = null;
    this.lastPlaybackRequest = null;
    this.stateListeners = new Set();
    this.state = {
      playback: { status: 'idle', requestId: null, source: null, text: '', error: null, retryable: false },
      recognition: { status: 'idle', requestId: null, error: null, retryable: false },
    };
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
        else if (status === 'cancelled') {
          this.clearPlaybackTimeout();
          this.updatePlayback(callbacks._playbackId, {
            status: 'cancelled', error: 'audio-interrupted', retryable: true,
          });
          callbacks.onCancel?.({ type: 'cancel', native: true });
        }
        else callbacks.onError?.({ error: 'native-speech-error', native: true });
      };
      window.__lingogocNativeRecognitionEvent = (requestId, status, transcript = '', error = '') => {
        const callbacks = this.nativeRecognitionCallbacks.get(String(requestId));
        if (!callbacks) return;
        if (status === 'partial' || status === 'final') {
          this.updateState('recognition', {
            status: 'listening', requestId: String(requestId), error: null, retryable: false,
          });
          callbacks.onResult?.({
            final: status === 'final' ? String(transcript).trim() : '',
            interim: status === 'partial' ? String(transcript).trim() : '',
            isFinal: status === 'final',
          });
          return;
        }
        if (status === 'error') {
          this.clearRecognitionTimeout();
          this.updateState('recognition', {
            status: 'error', requestId: String(requestId), error: error || 'recognition-error', retryable: true,
          });
          callbacks.onError?.(error || 'recognition-error');
        }
        if (status === 'end') {
          this.clearRecognitionTimeout();
          this.nativeRecognitionCallbacks.delete(String(requestId));
          this.isListening = false;
          if (this.state.recognition.status !== 'error') {
            this.updateState('recognition', {
              status: 'completed', requestId: String(requestId), error: null, retryable: false,
            });
          }
          callbacks.onEnd?.();
        }
      };
      const stopForPageLifecycle = () => {
        this.stopSpeaking('page-hidden');
        this.recognition?.abort?.();
      };
      window.addEventListener?.('pagehide', stopForPageLifecycle);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) stopForPageLifecycle();
        });
      }
    }
  }

  getState() {
    return {
      playback: { ...this.state.playback },
      recognition: { ...this.state.recognition },
    };
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => this.stateListeners.delete(listener);
  }

  updateState(channel, patch) {
    this.state[channel] = { ...this.state[channel], ...patch };
    const snapshot = this.getState();
    this.stateListeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch {
        // A UI observer must never interrupt speech playback or recognition.
      }
    });
  }

  updatePlayback(requestId, patch) {
    if (requestId !== this.activePlaybackId) return;
    this.updateState('playback', patch);
  }

  clearPlaybackTimeout() {
    if (!this.playbackTimer) return;
    clearTimeout(this.playbackTimer);
    this.playbackTimer = null;
  }

  clearRecognitionTimeout() {
    if (!this.recognitionTimer) return;
    clearTimeout(this.recognitionTimer);
    this.recognitionTimer = null;
  }

  armRecognitionTimeout(requestId, abort, timeoutMs = 60000) {
    this.clearRecognitionTimeout();
    this.recognitionTimer = setTimeout(() => {
      this.recognitionTimer = null;
      if (this.state.recognition.requestId !== requestId || this.state.recognition.status !== 'listening') return;
      try {
        abort?.();
      } catch {
        // The state below still exposes a retry action when an engine hangs.
      }
      this.isListening = false;
      this.updateState('recognition', {
        status: 'error', requestId, error: 'recognition-timeout', retryable: true,
      });
    }, timeoutMs);
  }

  armPlaybackTimeout(requestId, onTimeout, timeoutMs = 15000) {
    this.clearPlaybackTimeout();
    this.playbackTimer = setTimeout(() => {
      this.playbackTimer = null;
      if (requestId !== this.activePlaybackId || this.state.playback.status !== 'loading') return;
      onTimeout?.();
    }, timeoutMs);
  }

  retryLastSpeech() {
    if (this.lastPlaybackRequest?.type === 'speech' && this.lastPlaybackRequest.text) {
      return this.speak(this.lastPlaybackRequest.text, { ...this.lastPlaybackRequest.options });
    }
    if (this.lastPlaybackRequest?.type === 'audio' && this.lastPlaybackRequest.audioUrl) {
      this.playAudioUrl(
        this.lastPlaybackRequest.audioUrl,
        this.lastPlaybackRequest.playbackRate,
        { ...this.lastPlaybackRequest.options },
      );
      return true;
    }
    return false;
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

  preloadAudioUrl(audioUrl) {
    const audio = this.getAudio();
    if (!audio || !audioUrl || audio.src === audioUrl) return;
    audio.src = audioUrl;
    try {
      audio.load();
    } catch {
      // Preloading is optional; playAudioUrl reports actual playback failures.
    }
  }

  playAudioUrl(audioUrl, playbackRate = 1, options = {}) {
    const audio = this.getAudio();
    if (!audio || !audioUrl) return Promise.resolve(false);

    this.stopSpeaking('replaced');
    this.lastPlaybackRequest = { type: 'audio', audioUrl, playbackRate, options: { ...options } };
    const playbackId = ++this.playbackSequence;
    const requestId = ++this.audioRequestId;
    this.activePlaybackId = playbackId;
    this.activeAudio = audio;
    this.updateState('playback', {
      status: 'loading', requestId: playbackId, source: 'external-audio', text: '', error: null, retryable: false,
    });

    const fail = (error) => {
      if (this.activePlaybackId !== playbackId || this.audioRequestId !== requestId) return false;
      this.clearPlaybackTimeout();
      this.activeAudio = null;
      this.updatePlayback(playbackId, {
        status: 'error', error: error?.message || error?.error || 'audio-playback-error', retryable: true,
      });
      options.onError?.(error);
      return false;
    };

    audio.onplay = (event) => {
      if (this.activePlaybackId !== playbackId || this.audioRequestId !== requestId) return;
      this.clearPlaybackTimeout();
      this.updatePlayback(playbackId, { status: 'playing' });
      options.onStart?.(event);
    };
    audio.onended = (event) => {
      if (this.activePlaybackId !== playbackId || this.audioRequestId !== requestId) return;
      this.clearPlaybackTimeout();
      this.activeAudio = null;
      this.updatePlayback(playbackId, { status: 'completed', retryable: false });
      this.activePlaybackId = null;
      options.onEnd?.(event);
    };
    audio.onerror = fail;

    try {
      audio.pause();
      if (audio.src !== audioUrl) {
        audio.src = audioUrl;
        audio.load();
      }
      audio.currentTime = 0;
      audio.playbackRate = Math.min(2, Math.max(0.5, playbackRate || 1));
      audio.defaultPlaybackRate = audio.playbackRate;
      const playResult = audio.play();
      this.armPlaybackTimeout(playbackId, () => fail({ error: 'speech-start-timeout' }));
      return Promise.resolve(playResult).then(() => true).catch(fail);
    } catch (error) {
      return Promise.resolve(fail(error));
    }
  }

  speakWithNativeVoice(text, options, profile) {
    const bridge = typeof window !== 'undefined' ? window.LingoGocNative : null;
    if (!bridge || typeof bridge.speak !== 'function') return false;

    const playbackId = options._playbackId;
    this.updatePlayback(playbackId, { status: 'loading', source: 'android-native', error: null, retryable: false });
    const requestId = `speech-${Date.now()}-${++this.nativeSpeechSequence}`;
    this.nativeSpeechCallbacks.set(requestId, {
      ...options,
      onStart: (event) => {
        this.clearPlaybackTimeout();
        this.updatePlayback(playbackId, { status: 'playing' });
        options.onStart?.(event);
      },
      onEnd: (event) => {
        this.clearPlaybackTimeout();
        this.updatePlayback(playbackId, { status: 'completed', retryable: false });
        this.activePlaybackId = null;
        options.onEnd?.(event);
      },
      onError: (event) => {
        if (!this.speakWithBackendAudio(text, { ...options, voicePreset: 'auto', fallbackError: event })) {
          this.clearPlaybackTimeout();
          this.updatePlayback(playbackId, { status: 'error', error: 'native-speech-error', retryable: true });
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
      if (accepted) {
        this.armPlaybackTimeout(playbackId, () => {
          this.nativeSpeechCallbacks.delete(requestId);
          if (this.activeNativeSpeechId === requestId) this.activeNativeSpeechId = null;
          try {
            bridge.stopSpeech?.();
          } catch {
            // Ignore native bridge shutdown races.
          }
          if (!this.speakWithBackendAudio(text, { ...options, voicePreset: 'auto' })) {
            this.updatePlayback(playbackId, { status: 'error', error: 'speech-start-timeout', retryable: true });
            options.onError?.({ error: 'speech-start-timeout' });
          }
        });
        return true;
      }
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

    const playbackId = options._playbackId;
    this.updatePlayback(playbackId, { status: 'loading', source: 'backend-audio', error: null, retryable: false });
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
      this.clearPlaybackTimeout();
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
      if (this.activeAudio !== audio || this.audioRequestId !== requestId) return;
      this.clearPlaybackTimeout();
      this.updatePlayback(playbackId, { status: 'playing' });
      options.onStart?.(event);
    };
    audio.onended = (event) => {
      if (this.activeAudio !== audio || this.audioRequestId !== requestId) return;
      clearAudioCallbacks();
      this.activeAudio = null;
      this.clearPlaybackTimeout();
      this.updatePlayback(playbackId, { status: 'completed', retryable: false });
      this.activePlaybackId = null;
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
      this.armPlaybackTimeout(playbackId, () => fallbackToBrowserVoice({ error: 'speech-start-timeout' }));
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
      this.updateState('playback', {
        status: 'error', requestId: null, source: null, text: '', error: 'empty-speech-text', retryable: false,
      });
      options.onError?.({ error: 'speech-synthesis-not-supported' });
      return false;
    }

    this.stopSpeaking('replaced');
    const playbackId = ++this.playbackSequence;
    const publicOptions = { ...options };
    delete publicOptions._playbackId;
    this.lastPlaybackRequest = { type: 'speech', text: cleanText, options: publicOptions };
    this.activePlaybackId = playbackId;
    this.updateState('playback', {
      status: 'loading', requestId: playbackId, source: null, text: cleanText, error: null, retryable: false,
    });
    const trackedOptions = { ...options, _playbackId: playbackId };
    const preset = normalizeVoicePreset(options.voicePreset ?? this.voicePreset);
    const profile = VOICE_PROFILES[preset];

    // The backend stream is the most reliable option on mobile, but it exposes
    // only one voice. Named presets therefore use the device voice engine.
    if (!options.browserOnly && preset === 'auto' && this.speakWithBackendAudio(cleanText, trackedOptions)) {
      return true;
    }

    if (!options.browserOnly && preset !== 'auto' && this.speakWithNativeVoice(cleanText, trackedOptions, profile)) {
      return true;
    }

    if (!this.synth || typeof SpeechSynthesisUtterance === 'undefined') {
      if (!options.browserOnly && this.speakWithBackendAudio(cleanText, trackedOptions)) return true;
      this.updatePlayback(playbackId, { status: 'error', error: 'speech-synthesis-not-supported', retryable: true });
      options.onError?.(options.fallbackError || { error: 'speech-synthesis-not-supported' });
      return false;
    }

    this.updatePlayback(playbackId, { status: 'loading', source: 'browser-synthesis', error: null, retryable: false });

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
      this.clearPlaybackTimeout();
      this.updatePlayback(playbackId, { status: 'playing' });
      this.startKeepAlive(utterance);
      options.onStart?.(event);
    };

    utterance.onend = (event) => {
      if (this.activeUtterance !== utterance) return;
      this.activeUtterance = null;
      this.clearKeepAlive();
      this.clearPlaybackTimeout();
      this.updatePlayback(playbackId, { status: 'completed', retryable: false });
      this.activePlaybackId = null;
      options.onEnd?.(event);
    };

    utterance.onerror = (event) => {
      if (this.activeUtterance !== utterance) return;
      this.activeUtterance = null;
      this.clearKeepAlive();
      this.clearPlaybackTimeout();
      if (!options.browserOnly && preset !== 'auto' && this.speakWithBackendAudio(cleanText, {
        ...trackedOptions,
        voicePreset: 'auto',
        fallbackError: event,
      })) return;
      this.updatePlayback(playbackId, { status: 'error', error: event?.error || 'speech-synthesis-error', retryable: true });
      options.onError?.(event);
    };

    this.activeUtterance = utterance;
    try {
      if (this.synth.paused) this.synth.resume();
      this.synth.speak(utterance);
      this.armPlaybackTimeout(playbackId, () => {
        if (this.activeUtterance !== utterance) return;
        this.activeUtterance = null;
        this.clearKeepAlive();
        try {
          this.synth.cancel();
        } catch {
          // Ignore engines that throw while cancelling a timed-out utterance.
        }
        this.updatePlayback(playbackId, { status: 'error', error: 'speech-start-timeout', retryable: true });
        options.onError?.({ error: 'speech-start-timeout' });
      });
      return true;
    } catch (error) {
      this.activeUtterance = null;
      this.clearKeepAlive();
      this.clearPlaybackTimeout();
      this.updatePlayback(playbackId, { status: 'error', error: error?.message || 'speech-synthesis-error', retryable: true });
      options.onError?.(error);
      return false;
    }
  }

  stopSpeaking(reason = 'cancelled') {
    this.clearKeepAlive();
    this.clearPlaybackTimeout();
    const stoppedPlaybackId = this.activePlaybackId;
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
    if (this.synth && shouldCancel) {
      try {
        this.synth.cancel();
      } catch {
        // Ignore engines that throw while already idle.
      }
    }
    if (stoppedPlaybackId === this.activePlaybackId && ['loading', 'playing'].includes(this.state.playback.status)) {
      this.updatePlayback(stoppedPlaybackId, { status: 'cancelled', error: reason, retryable: reason !== 'replaced' });
    }
    this.activePlaybackId = null;
  }

  // Speech to Text (Microphone)
  createRecognition(onResult, onError, onEnd) {
    const nativeBridge = typeof window !== 'undefined' ? window.LingoGocNative : null;
    if (nativeBridge && typeof nativeBridge.startListening === 'function') {
      let requestId = null;
      const helper = this;
      const recognition = {
        lang: 'en-US',
        start() {
          requestId = `recognition-${Date.now()}-${++helper.nativeRecognitionSequence}`;
          helper.nativeRecognitionCallbacks.set(requestId, {
            onResult,
            onError,
            onEnd: () => {
              requestId = null;
              if (helper.recognition === recognition) helper.recognition = null;
              onEnd?.();
            },
          });
          try {
            nativeBridge.startListening(requestId, this.lang || 'en-US');
            helper.isListening = true;
            helper.updateState('recognition', {
              status: 'listening', requestId, error: null, retryable: false,
            });
            helper.armRecognitionTimeout(requestId, () => nativeBridge.stopListening?.(requestId));
          } catch (error) {
            helper.nativeRecognitionCallbacks.delete(requestId);
            helper.isListening = false;
            helper.updateState('recognition', {
              status: 'error', requestId, error: error?.message || 'recognition-start-error', retryable: true,
            });
            onError?.(error?.message || 'recognition-start-error');
          }
        },
        abort() {
          if (!requestId) return;
          helper.clearRecognitionTimeout();
          nativeBridge.stopListening?.(requestId);
          helper.nativeRecognitionCallbacks.delete(requestId);
          helper.isListening = false;
          helper.updateState('recognition', {
            status: 'cancelled', requestId, error: 'cancelled', retryable: true,
          });
          requestId = null;
          if (helper.recognition === recognition) helper.recognition = null;
        },
      };
      this.recognition = recognition;
      return recognition;
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
      this.clearRecognitionTimeout();
      this.updateState('recognition', {
        status: 'error', requestId: recognition._lingogocRequestId, error: event.error || 'recognition-error', retryable: true,
      });
      onError?.(event.error);
    };

    recognition.onend = () => {
      this.clearRecognitionTimeout();
      this.isListening = false;
      if (this.recognition === recognition) this.recognition = null;
      if (this.state.recognition.status !== 'error') {
        this.updateState('recognition', {
          status: 'completed', requestId: recognition._lingogocRequestId, error: null, retryable: false,
        });
      }
      onEnd?.();
    };

    const nativeStart = recognition.start.bind(recognition);
    const nativeAbort = recognition.abort?.bind(recognition);
    recognition.start = () => {
      const requestId = `recognition-web-${++this.recognitionSequence}`;
      recognition._lingogocRequestId = requestId;
      try {
        nativeStart();
        this.isListening = true;
        this.updateState('recognition', {
          status: 'listening', requestId, error: null, retryable: false,
        });
        this.armRecognitionTimeout(requestId, nativeAbort);
      } catch (error) {
        this.isListening = false;
        this.updateState('recognition', {
          status: 'error', requestId, error: error?.message || 'recognition-start-error', retryable: true,
        });
        throw error;
      }
    };
    recognition.abort = () => {
      const requestId = recognition._lingogocRequestId;
      this.clearRecognitionTimeout();
      nativeAbort?.();
      this.isListening = false;
      this.updateState('recognition', {
        status: 'cancelled', requestId, error: 'cancelled', retryable: true,
      });
    };

    this.recognition = recognition;
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
