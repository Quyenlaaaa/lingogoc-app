// speechHelper.js - Web Speech API utilities for TTS and STT.
// Mobile browsers are deliberately kept on the native speech engine. Unlike an
// HTMLAudioElement, speechSynthesis does not need a delayed, cross-origin audio
// request that can lose the user-activation token before playback starts.

export class SpeechHelper {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voices = [];
    this.recognition = null;
    this.isListening = false;
    this.defaultRate = 0.85;
    this.activeUtterance = null;
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
    if (!cleanText || !this.synth || typeof SpeechSynthesisUtterance === 'undefined') {
      options.onError?.({ error: 'speech-synthesis-not-supported' });
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
