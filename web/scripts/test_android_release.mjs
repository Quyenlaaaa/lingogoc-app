import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [gradle, workflow, privacy, notes, checklist, gitignore] = await Promise.all([
  readFile('../app/app/build.gradle.kts', 'utf8'),
  readFile('../.github/workflows/android-release.yml', 'utf8'),
  readFile('../app/PRIVACY.md', 'utf8'),
  readFile('../app/RELEASE_NOTES.md', 'utf8'),
  readFile('../app/RELEASE_CHECKLIST.md', 'utf8'),
  readFile('../.gitignore', 'utf8'),
]);

for (const variable of [
  'LINGOGOC_VERSION_CODE',
  'LINGOGOC_VERSION_NAME',
  'LINGOGOC_KEYSTORE_PATH',
  'LINGOGOC_KEYSTORE_PASSWORD',
  'LINGOGOC_KEY_ALIAS',
  'LINGOGOC_KEY_PASSWORD',
]) assert.ok(gradle.includes(variable), `Gradle release input missing: ${variable}`);

assert.match(gradle, /configuredSigningValues !in listOf\(0, signingValues\.size\)/);
assert.match(workflow, /environment: production/);
assert.match(workflow, /bundleRelease assembleRelease/);
assert.match(workflow, /base64 --decode/);
assert.match(workflow, /sha256sum/);
assert.match(gitignore, /\*\.jks/);
assert.match(gitignore, /\*\.keystore/);
assert.match(privacy, /microphone permission/i);
assert.match(privacy, /no advertising SDK/i);
assert.match(notes, /Known release gates/);
assert.match(checklist, /Play internal testing/);
assert.ok(!workflow.includes('storePassword ='), 'signing passwords must not be embedded in workflow source');

console.log('Android release configuration checks passed.');
