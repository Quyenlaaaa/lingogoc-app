import assert from 'node:assert/strict';

const spoken = [];
const synth = {
  paused: false,
  pending: false,
  speaking: false,
  cancelCalls: 0,
  cancel() { this.cancelCalls += 1; },
  speak(utterance) { spoken.push(utterance); },
  pause() {},
  resume() {},
  getVoices() {
    return [
      { name: 'Vietnamese', lang: 'vi-VN' },
      { name: 'Samantha', lang: 'en-US' },
      { name: 'Daniel', lang: 'en-GB' },
    ];
  },
  addEventListener() {},
};

Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 },
});
globalThis.window = { speechSynthesis: synth };
globalThis.SpeechSynthesisUtterance = class {
  constructor(text) { this.text = text; }
};

const { SpeechHelper } = await import(`../src/utils/speechHelper.js?test=${Date.now()}`);
const helper = new SpeechHelper();

assert.equal(helper.isMobileDevice(), true, 'iPhone must be recognized as mobile');
assert.equal(helper.speak('hello', { rate: 0.75 }), true, 'speech must be submitted');
assert.equal(spoken.length, 1, 'speech must be submitted synchronously without a timeout');
assert.equal(spoken[0].text, 'hello');
assert.equal(spoken[0].lang, 'en-US');
assert.equal(spoken[0].rate, 0.75);
assert.equal(spoken[0].voice.name, 'Samantha', 'an English voice must be selected');
spoken[0].onstart?.({ type: 'start' });
spoken[0].onend?.({ type: 'end' });
assert.equal(helper.activeUtterance, null, 'finished utterances must be released');

helper.setVoicePreset('male_mature');
assert.equal(helper.getVoicePreset(), 'male_mature');
assert.equal(helper.speak('Good morning', { rate: 1 }), true);
assert.equal(spoken.length, 2, 'a selected preset must use the device voice synchronously');
assert.equal(spoken[1].voice.name, 'Daniel', 'the mature male preset must prefer a matching male voice');
assert.equal(spoken[1].pitch, 0.88, 'the selected profile must set its pitch');
assert.equal(spoken[1].rate, 0.92, 'the selected profile must adjust its speaking rate');
spoken[1].onend?.({ type: 'end' });

helper.setVoicePreset('unknown-preset');
assert.equal(helper.getVoicePreset(), 'auto', 'unknown presets must safely fall back to automatic');

let nativeSpeech = null;
let nativeStarted = false;
let nativeEnded = false;
window.LingoGocNative = {
  speak(...args) {
    nativeSpeech = args;
    return true;
  },
  stopSpeech() {},
  startListening(requestId, language) {
    this.recognitionRequest = { requestId, language };
  },
  stopListening() {},
};
helper.setVoicePreset('female_young');
assert.equal(helper.speak('Native hello', {
  rate: 1,
  onStart: () => { nativeStarted = true; },
  onEnd: () => { nativeEnded = true; },
}), true);
assert.equal(spoken.length, 2, 'the Android native bridge must take precedence over browser speech');
assert.equal(nativeSpeech[0], 'Native hello');
assert.equal(nativeSpeech[1], 'en-US');
assert.equal(nativeSpeech[2], 1.02);
assert.equal(nativeSpeech[3], 1.08);
window.__lingogocNativeSpeechEvent(nativeSpeech[4], 'start');
window.__lingogocNativeSpeechEvent(nativeSpeech[4], 'done');
assert.equal(nativeStarted, true, 'native start events must reach the caller');
assert.equal(nativeEnded, true, 'native completion events must reach the caller');

let nativeRecognition = null;
let nativeRecognitionEnded = false;
const recognition = helper.createRecognition(
  (result) => { nativeRecognition = result; },
  () => {},
  () => { nativeRecognitionEnded = true; },
);
recognition.start();
assert.equal(helper.isSpeechRecognitionSupported(), true);
assert.equal(window.LingoGocNative.recognitionRequest.language, 'en-US');
window.__lingogocNativeRecognitionEvent(
  window.LingoGocNative.recognitionRequest.requestId,
  'final',
  'hello native',
  '',
);
window.__lingogocNativeRecognitionEvent(window.LingoGocNative.recognitionRequest.requestId, 'end', '', '');
assert.equal(nativeRecognition.final, 'hello native');
assert.equal(nativeRecognition.isFinal, true);
assert.equal(nativeRecognitionEnded, true);
delete window.LingoGocNative;

let audioInstances = 0;
class MockAudio {
  static rejectNext = false;
  static lastInstance = null;
  constructor() {
    audioInstances += 1;
    MockAudio.lastInstance = this;
    this.src = '';
    this.currentTime = 0;
  }
  load() {}
  pause() {}
  play() {
    if (MockAudio.rejectNext) {
      MockAudio.rejectNext = false;
      return Promise.reject(new Error('blocked'));
    }
    return Promise.resolve();
  }
}
globalThis.Audio = MockAudio;

const dictionary = await import(`../src/utils/realDictionaryService.js?test=${Date.now()}`);
dictionary.preloadNativeAudio('https://example.com/hello.mp3');
assert.equal(await dictionary.playNativeAudio('https://example.com/hello.mp3'), true);
assert.equal(audioInstances, 1, 'native pronunciation must reuse one audio element');
assert.equal(await dictionary.playNativeAudio('https://example.com/hello.mp3', 0.75), true);
assert.equal(MockAudio.lastInstance.playbackRate, 0.75, 'native audio must respect slow playback rate');

MockAudio.rejectNext = true;
const originalWarn = console.warn;
console.warn = () => {};
assert.equal(await dictionary.playNativeAudio('https://example.com/hello.mp3'), false, 'blocked playback must be reported');
console.warn = originalWarn;

console.log('Mobile speech checks passed.');
