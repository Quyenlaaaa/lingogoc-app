import assert from 'node:assert/strict';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};

const { loadOrCreateGuestIdentity, mergeGuestUserData } = await import('../src/utils/guestIdentity.js');
const guest = loadOrCreateGuestIdentity();
assert.equal(guest.type, 'guest');
assert.match(guest.guestId, /^guest:[a-f0-9-]{36}$/);
assert.equal(loadOrCreateGuestIdentity().guestId, guest.guestId, 'guest identity must survive reload');

const merged = mergeGuestUserData(
  { xp: 80, streak: 2, lastActiveDate: '2026-09-24', masteredWords: [1, 2], settings: { theme: 'dark' } },
  { xp: 120, streak: 5, lastActiveDate: '2026-09-23', masteredWords: [2, 3], settings: { theme: 'light', voicePreset: 'male' } },
);
assert.equal(merged.xp, 120, 'first-login merge must not add duplicated XP totals');
assert.equal(merged.streak, 5);
assert.equal(merged.lastActiveDate, '2026-09-24');
assert.deepEqual(merged.masteredWords, [2, 3, 1]);
assert.deepEqual(merged.settings, { theme: 'dark', voicePreset: 'male' });

localStorage.setItem('lingogoc_identity_v1', '{broken');
assert.notEqual(loadOrCreateGuestIdentity().guestId, guest.guestId);
console.log('Guest identity and first-login merge checks passed.');
