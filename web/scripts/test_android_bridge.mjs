import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('../app/app/src/main/java/com/lingogoc/app/MainActivity.kt', 'utf8');

for (const contract of [
  'WebViewAssetLoader',
  '@JavascriptInterface\n        fun speak',
  'requestAudioFocus(speechFocusRequest)',
  'requestAudioFocus(recognitionFocusRequest)',
  'abandonAudioFocusRequest(speechFocusRequest)',
  'abandonAudioFocusRequest(recognitionFocusRequest)',
  'LANG_MISSING_DATA',
  'LANG_NOT_SUPPORTED',
  'fun stopForLifecycle()',
  'override fun onStop()',
  'override fun onPause()',
  'override fun onResume()',
  'speechRecognizer?.cancel()',
  'speechRecognizer?.destroy()',
  'recognizer-busy',
  'ActivityResultContracts.RequestPermission()',
  'PermissionRequest.RESOURCE_AUDIO_CAPTURE',
  'fun getNetworkState(): String',
  'unregisterNetworkCallback(networkCallback)',
  'registerAudioDeviceCallback(audioDeviceCallback, mainHandler)',
  'unregisterAudioDeviceCallback(audioDeviceCallback)',
  'fun getAudioRoute(): String',
  'fun onForeground()',
  'notifyLifecycle("background")',
]) {
  assert.ok(source.includes(contract), `Android bridge contract is missing: ${contract}`);
}

assert.match(source, /change == AudioManager\.AUDIOFOCUS_LOSS[\s\S]+AUDIOFOCUS_LOSS_TRANSIENT[\s\S]+AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK/);
assert.match(source, /if \(activeRecognitionId != null\)[\s\S]+recognizer-busy[\s\S]+return/);
assert.match(source, /override fun onDestroy\(\)[\s\S]+nativeBridge\.destroy\(\)[\s\S]+webView\.destroy\(\)/);
assert.match(source, /fun startListeningWithPermission[\s\S]+interruptSpeech\(\)[\s\S]+requestAudioFocus\(recognitionFocusRequest\)/);
assert.match(source, /fun speak[\s\S]+interruptRecognition\("audio-interrupted"\)[\s\S]+requestAudioFocus\(speechFocusRequest\)/);
assert.match(source, /override fun onPause\(\)[\s\S]+activityStarted = false[\s\S]+nativeBridge\.stopForLifecycle\(\)/);

console.log('Android native bridge lifecycle contracts passed.');
