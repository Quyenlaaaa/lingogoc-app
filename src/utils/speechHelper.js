// speechHelper.js - Web Speech API utilities for TTS and STT

class SpeechHelper {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.voices = [];
    this.recognition = null;
    this.isListening = false;
    this.defaultRate = 0.85; // Default slightly slower for beginners
    this.initVoices();
  }

  initVoices() {
    if (!this.synth) return;
    const loadVoices = () => {
      this.voices = this.synth.getVoices();
    };
    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  // Speak text with options
  speak(text, options = {}) {
    if (!this.synth) {
      console.warn('SpeechSynthesis not supported in this browser.');
      return;
    }

    // Cancel current speech if any
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate || this.defaultRate; // 0.75x or 1.0x
    utterance.pitch = options.pitch || 1.0;
    utterance.volume = options.volume || 1.0;

    // Pick best English voice (prefer US, then UK)
    const englishVoices = this.voices.filter(v => v.lang.startsWith('en'));
    const preferredVoice = 
      englishVoices.find(v => v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('David')) ||
      englishVoices.find(v => v.lang === 'en-US') ||
      englishVoices[0];

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    if (options.onStart) utterance.onstart = options.onStart;
    if (options.onEnd) utterance.onend = options.onEnd;
    if (options.onError) utterance.onerror = options.onError;

    this.synth.speak(utterance);
  }

  stopSpeaking() {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  // Speech to Text (Microphone)
  createRecognition(onResult, onError, onEnd) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return null;
    }

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
        isFinal: finalTranscript.length > 0
      });
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      if (onError) onError(event.error);
    };

    recognition.onend = () => {
      this.isListening = false;
      if (onEnd) onEnd();
    };

    return recognition;
  }

  isSpeechRecognitionSupported() {
    return typeof window !== 'undefined' && (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);
  }
}

export const speechHelper = new SpeechHelper();

export function speakText(text, rate = 0.85) {
  speechHelper.speak(text, { rate });
}

export function startSpeechRecognition(onResult, onError, onEnd) {
  const rec = speechHelper.createRecognition(
    (result) => {
      if (result.isFinal && onResult) {
        onResult(result.final);
      }
    },
    onError,
    onEnd
  );
  if (rec) {
    try {
      rec.start();
    } catch (e) {
      console.warn('Recognition already started', e);
    }
  }
  return rec;
}

export default speechHelper;
