import assert from 'node:assert/strict';

const values = new Map();
let failNextKey = null;
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => {
    if (key === failNextKey) {
      failNextKey = null;
      throw new Error('QUOTA_EXCEEDED');
    }
    values.set(key, String(value));
  },
  removeItem: (key) => values.delete(key),
};

const {
  PERSONAL_STORAGE_KEYS,
  createLocalBackup,
  parseLocalBackup,
  restoreLocalBackup,
  serializeLocalBackup,
} = await import('../src/utils/localBackupService.js');
const { loadOrCreateGuestIdentity } = await import('../src/utils/guestIdentity.js');

const identity = loadOrCreateGuestIdentity();
const diagnosticOld = { version: 2, overallScore: 40, level: 'A1', completedAt: '2026-09-20T08:00:00.000Z' };
const diagnosticNew = { version: 2, overallScore: 55, level: 'A2', completedAt: '2026-09-24T08:00:00.000Z' };
values.set(PERSONAL_STORAGE_KEYS.userData, JSON.stringify({ xp: 100, streak: 2, masteredWords: [1], settings: { theme: 'dark' } }));
values.set(PERSONAL_STORAGE_KEYS.srsRecords, JSON.stringify({ 1: { wordId: 1, lastReviewed: '2026-09-20', reviewCount: 2 } }));
values.set(PERSONAL_STORAGE_KEYS.learningEvents, JSON.stringify({ processedEventIds: ['old'], pendingEvents: [{ id: 'old' }] }));
values.set(PERSONAL_STORAGE_KEYS.diagnosticLatest, JSON.stringify(diagnosticOld));
values.set(PERSONAL_STORAGE_KEYS.diagnosticHistory, JSON.stringify({ version: 1, results: [diagnosticOld] }));
values.set(PERSONAL_STORAGE_KEYS.speakingSessions, JSON.stringify({ schemaVersion: 1, activeSessionId: 'old', sessions: [{ id: 'old', updatedAt: '2026-09-20T00:00:00.000Z' }] }));
values.set(PERSONAL_STORAGE_KEYS.moduleSessions, JSON.stringify({ schemaVersion: 1, modules: { dictation: { lessonId: 2, updatedAt: '2026-09-20T00:00:00.000Z' } } }));

const serialized = serializeLocalBackup(createLocalBackup());
const backup = parseLocalBackup(serialized);
assert.equal(backup.version, 1);
assert.equal(backup.source.guestId, identity.guestId);
assert.equal(backup.data.srsRecords[1].reviewCount, 2);
assert.equal(backup.data.speakingSessions.sessions[0].id, 'old');

values.set(PERSONAL_STORAGE_KEYS.userData, JSON.stringify({ xp: 150, streak: 4, masteredWords: [2], settings: { voicePreset: 'female' } }));
values.set(PERSONAL_STORAGE_KEYS.srsRecords, JSON.stringify({ 1: { wordId: 1, lastReviewed: '2026-09-23', reviewCount: 5 }, 2: { wordId: 2, lastReviewed: '2026-09-22', reviewCount: 1 } }));
values.set(PERSONAL_STORAGE_KEYS.learningEvents, JSON.stringify({ processedEventIds: ['new'], pendingEvents: [{ id: 'new' }] }));
values.set(PERSONAL_STORAGE_KEYS.diagnosticLatest, JSON.stringify(diagnosticNew));
values.set(PERSONAL_STORAGE_KEYS.diagnosticHistory, JSON.stringify({ version: 1, results: [diagnosticNew] }));
values.set(PERSONAL_STORAGE_KEYS.speakingSessions, JSON.stringify({ schemaVersion: 1, activeSessionId: 'new', sessions: [{ id: 'new', updatedAt: '2026-09-24T00:00:00.000Z' }] }));
values.set(PERSONAL_STORAGE_KEYS.moduleSessions, JSON.stringify({ schemaVersion: 1, modules: { dictation: { lessonId: 4, updatedAt: '2026-09-24T00:00:00.000Z' } } }));

const restored = restoreLocalBackup(backup, { mode: 'merge' });
assert.equal(restored.userData.xp, 150, 'merge must not double or lower XP');
assert.equal(restored.userData.streak, 4);
assert.deepEqual(restored.userData.masteredWords, [2, 1]);
assert.equal(restored.srsRecords[1].reviewCount, 5, 'newer local SRS must win');
assert.equal(restored.srsRecords[2].reviewCount, 1);
assert.deepEqual(restored.learningEvents.processedEventIds, ['new', 'old']);
assert.equal(restored.diagnosticHistory.results.length, 2);
assert.equal(restored.diagnosticLatest.completedAt, diagnosticNew.completedAt);
assert.deepEqual(restored.speakingSessions.sessions.map((item) => item.id), ['new', 'old']);
assert.equal(restored.moduleSessions.modules.dictation.lessonId, 4);
assert.equal(loadOrCreateGuestIdentity().guestId, identity.guestId, 'restore must never clone the source device identity');

const legacy = parseLocalBackup(JSON.stringify({ xp: 25, streak: 1, masteredWords: [7] }));
assert.equal(legacy.source.type, 'legacy-user-data');
assert.equal(restoreLocalBackup(legacy).userData.xp, 150);
assert.throws(() => parseLocalBackup('{"format":"wrong"}'), /INVALID_BACKUP_FILE/);
assert.throws(() => parseLocalBackup('x'.repeat(2_000_001)), /INVALID_BACKUP_SIZE/);
assert.throws(() => restoreLocalBackup(backup, { mode: 'invalid' }), /INVALID_RESTORE_MODE/);

const beforeFailure = new Map(values);
failNextKey = PERSONAL_STORAGE_KEYS.srsRecords;
assert.throws(() => restoreLocalBackup(backup, { mode: 'replace' }), /QUOTA_EXCEEDED/);
assert.deepEqual(values, beforeFailure, 'a partial restore must roll back every personal-data key');

console.log('Versioned full backup, merge, legacy import, and rollback checks passed.');
