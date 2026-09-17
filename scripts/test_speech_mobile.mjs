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

let audioInstances = 0;
class MockAudio {
  static rejectNext = false;
  constructor() {
    audioInstances += 1;
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

MockAudio.rejectNext = true;
const originalWarn = console.warn;
console.warn = () => {};
assert.equal(await dictionary.playNativeAudio('https://example.com/hello.mp3'), false, 'blocked playback must be reported');
console.warn = originalWarn;

console.log('Mobile speech checks passed.');
