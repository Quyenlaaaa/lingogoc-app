import assert from 'node:assert/strict';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};

const {
  beginSpeakingTurn,
  completeSpeakingTurn,
  createSpeakingSession,
  failSpeakingTurn,
  loadActiveSpeakingSession,
  loadCurrentSpeakingSession,
  loadSpeakingSessionState,
  retrySpeakingTurn,
} = await import('../src/utils/speakingSessionStore.js');

const scenario = { id: 'coffee', title: 'Coffee shop', introMessage: 'Hello!', introMessageVi: 'Xin chào!' };
const created = createSpeakingSession(scenario);
assert.equal(created.messages.length, 1);
const pending = beginSpeakingTurn(created, { requestId: 'session-1-turn-1', text: 'One coffee, please.' });
assert.equal(pending.messages.length, 2);
assert.equal(pending.pendingTurn.status, 'pending');
assert.equal(beginSpeakingTurn(pending, { requestId: 'session-1-turn-1', text: 'One coffee, please.' }).messages.length, 2);

const failed = failSpeakingTurn(pending, 'session-1-turn-1', 'network');
assert.equal(failed.pendingTurn.status, 'failed');
const retried = retrySpeakingTurn(failed);
assert.equal(retried.pendingTurn.requestId, 'session-1-turn-1', 'retry must preserve the idempotency key');
assert.equal(retried.pendingTurn.attempt, 2);

const completed = completeSpeakingTurn(retried, 'session-1-turn-1', {
  replyEn: 'Of course. Anything else?',
  replyVi: 'Tất nhiên. Bạn có gọi thêm gì không?',
  correction: 'Your sentence is correct.',
  encouragement: 'Good job!',
  scores: { grammar: 102, vocabulary: 78.4, fluency: -5 },
  hints: [{ en: 'Could I have the menu?', vi: 'Cho tôi xem thực đơn được không?' }],
}, 91);
assert.equal(completed.pendingTurn, null);
assert.equal(completed.messages.length, 3);
assert.deepEqual(completed.feedback[0].scores, { grammar: 100, vocabulary: 78, fluency: 0, pronunciation: 91 });
assert.equal(completed.feedback[0].hints[0].en, 'Could I have the menu?');
assert.equal(loadActiveSpeakingSession(scenario).id, completed.id, 'reload must resume the active scenario session');
assert.equal(loadCurrentSpeakingSession().id, completed.id);
assert.equal(loadSpeakingSessionState().schemaVersion, 1);

const secondScenario = { id: 'airport', title: 'Airport', introMessage: 'May I see your passport?' };
const oldPending = beginSpeakingTurn(completed, { requestId: 'session-1-turn-2', text: 'Here it is.' });
const newer = createSpeakingSession(secondScenario);
completeSpeakingTurn(oldPending, 'session-1-turn-2', { replyEn: 'Thank you.', scores: {} });
assert.equal(loadCurrentSpeakingSession().id, newer.id, 'a background completion must not steal the active session');

console.log('Speaking session persistence checks passed.');
