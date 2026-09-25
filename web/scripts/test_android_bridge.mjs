import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('../app/app/src/main/java/com/lingogoc/app/MainActivity.kt', 'utf8');

for (const contract of [
  'WebViewAssetLoader',
  '@JavascriptInterface\n        fun speak',
  'requestAudioFocus(audioFocusRequest)',
  'abandonAudioFocusRequest(audioFocusRequest)',
  'LANG_MISSING_DATA',
  'LANG_NOT_SUPPORTED',
  'fun stopForLifecycle()',
  'override fun onStop()',
  'speechRecognizer?.cancel()',
  'speechRecognizer?.destroy()',
  'recognizer-busy',
  'ActivityResultContracts.RequestPermission()',
  'PermissionRequest.RESOURCE_AUDIO_CAPTURE',
  'fun getNetworkState(): String',
  'unregisterNetworkCallback(networkCallback)',
]) {
  assert.ok(source.includes(contract), `Android bridge contract is missing: ${contract}`);
}

assert.match(source, /change == AudioManager\.AUDIOFOCUS_LOSS[\s\S]+AUDIOFOCUS_LOSS_TRANSIENT[\s\S]+AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK/);
assert.match(source, /if \(activeRecognitionId != null\)[\s\S]+recognizer-busy[\s\S]+return/);
assert.match(source, /override fun onDestroy\(\)[\s\S]+nativeBridge\.destroy\(\)[\s\S]+webView\.destroy\(\)/);

console.log('Android native bridge lifecycle contracts passed.');
