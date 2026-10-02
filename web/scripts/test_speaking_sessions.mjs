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
  markSpeakingTransportReconnecting,
  mergeDurableSpeakingSession,
  retrySpeakingTurn,
} = await import('../src/utils/speakingSessionStore.js');
const {
  DEFAULT_SPEAKING_LEVEL,
  getSpeakingLevel,
  normalizeSpeakingLevel,
  SPEAKING_LEVEL_OPTIONS,
} = await import('../src/utils/speakingLevels.js');
const {
  INITIAL_SPEAKING_CONVERSATION_STATE,
  speakingConversationReducer,
} = await import('../src/utils/speakingConversationState.js');
const {
  createSpeakingSentenceQueue,
  shiftSpeakingSentenceQueue,
  updateSpeakingSentenceQueue,
} = await import('../src/utils/speakingSentenceQueue.js');

assert.deepEqual(SPEAKING_LEVEL_OPTIONS.map((item) => item.id), ['A1', 'A2', 'B1', 'B2', 'C1']);
assert.equal(DEFAULT_SPEAKING_LEVEL, 'A2');
assert.equal(normalizeSpeakingLevel('c1'), 'C1');
assert.equal(normalizeSpeakingLevel('invalid'), 'A2');
assert.ok(getSpeakingLevel('A1').speechRate < getSpeakingLevel('C1').speechRate);

let conversation = speakingConversationReducer(INITIAL_SPEAKING_CONVERSATION_STATE, { type: 'LISTEN_START' });
assert.equal(conversation.status, 'listening');
conversation = speakingConversationReducer(conversation, { type: 'TRANSCRIPT_PARTIAL' });
assert.equal(conversation.status, 'transcribing');
conversation = speakingConversationReducer(conversation, { type: 'TURN_SUBMIT', requestId: 'turn-1', turnSequence: 1 });
assert.equal(conversation.status, 'thinking');
conversation = speakingConversationReducer(conversation, { type: 'STREAM_EVENT', event: { type: 'ack', requestId: 'turn-1', eventSequence: 1 } });
conversation = speakingConversationReducer(conversation, { type: 'STREAM_EVENT', event: { type: 'delta', requestId: 'turn-1', eventSequence: 2 } });
assert.equal(conversation.status, 'streaming');
const staleConversation = speakingConversationReducer(conversation, { type: 'STREAM_EVENT', event: { type: 'error', requestId: 'turn-1', eventSequence: 1 } });
assert.equal(staleConversation, conversation, 'stale stream events must not roll state backward');
conversation = speakingConversationReducer(conversation, { type: 'SPEECH_START' });
assert.equal(conversation.status, 'speaking');
conversation = speakingConversationReducer(conversation, { type: 'SPEECH_END' });
assert.equal(conversation.status, 'streaming', 'transport stays visible when one queued sentence finishes early');
conversation = speakingConversationReducer(conversation, { type: 'SPEECH_START' });
conversation = speakingConversationReducer(conversation, { type: 'INTERRUPT' });
assert.equal(conversation.status, 'interrupted');
conversation = speakingConversationReducer(conversation, { type: 'LISTEN_START' });
conversation = speakingConversationReducer(conversation, { type: 'LISTEN_STOP' });
assert.equal(conversation.status, 'idle');
conversation = speakingConversationReducer(conversation, { type: 'TURN_SUBMIT', requestId: 'turn-2', turnSequence: 2 });
assert.equal(speakingConversationReducer(conversation, { type: 'LISTEN_STOP' }), conversation, 'late recognition end must not override an AI turn');

let sentenceQueue = createSpeakingSentenceQueue('turn-1');
sentenceQueue = updateSpeakingSentenceQueue(sentenceQueue, 'Hello there. How are');
assert.deepEqual(sentenceQueue.sentences, ['Hello there.']);
sentenceQueue = updateSpeakingSentenceQueue(sentenceQueue, 'Hello there. How are you? I am still');
assert.deepEqual(sentenceQueue.sentences, ['Hello there.', 'How are you?']);
let shifted = shiftSpeakingSentenceQueue(sentenceQueue);
assert.equal(shifted.sentence, 'Hello there.');
sentenceQueue = updateSpeakingSentenceQueue(shifted.state, 'Hello there. How are you? I am still here', { final: true });
assert.deepEqual(sentenceQueue.sentences, ['How are you?', 'I am still here'], 'final flush must queue the unpunctuated tail once');
sentenceQueue = updateSpeakingSentenceQueue(sentenceQueue, 'Hello there. How are you? I am still here', { final: true });
assert.deepEqual(sentenceQueue.sentences, ['How are you?', 'I am still here'], 'replayed cumulative text must not duplicate queued speech');

const scenario = { id: 'coffee', title: 'Coffee shop', introMessage: 'Hello!', introMessageVi: 'Xin chào!' };
const created = createSpeakingSession(scenario);
assert.equal(created.messages.length, 1);
assert.equal(created.level, 'A2');
assert.equal(created.nextTurnSequence, 1);
assert.equal(created.transport.state, 'idle');
assert.match(created.resumeToken, /^[a-zA-Z0-9._:-]{32,160}$/);
const pending = beginSpeakingTurn(created, { requestId: 'session-1-turn-1', text: 'One coffee, please.' });
assert.equal(pending.messages.length, 2);
assert.equal(pending.pendingTurn.status, 'pending');
assert.equal(pending.pendingTurn.turnSequence, 1);
assert.equal(pending.messages.at(-1).turnSequence, 1);
assert.equal(pending.nextTurnSequence, 2);
assert.equal(pending.transport.state, 'waiting');
assert.equal(pending.transport.activeTurnSequence, 1);
assert.equal(beginSpeakingTurn(pending, { requestId: 'session-1-turn-1', text: 'One coffee, please.' }).messages.length, 2);
assert.throws(() => beginSpeakingTurn(pending, { requestId: 'different-turn', text: 'Duplicate' }), /SPEAKING_TURN_PENDING/);

const failed = failSpeakingTurn(pending, 'session-1-turn-1', 'network');
assert.equal(failed.pendingTurn.status, 'failed');
assert.equal(failed.transport.state, 'failed');
const retried = retrySpeakingTurn(failed);
assert.equal(retried.pendingTurn.requestId, 'session-1-turn-1', 'retry must preserve the idempotency key');
assert.equal(retried.pendingTurn.attempt, 2);
assert.equal(retried.transport.state, 'reconnecting');
assert.equal(retried.transport.reconnectAttempts, 1);
const reconnecting = markSpeakingTransportReconnecting(retried);
assert.equal(reconnecting.pendingTurn.requestId, 'session-1-turn-1');
assert.equal(reconnecting.transport.reconnectAttempts, 2);

const completed = completeSpeakingTurn(reconnecting, 'session-1-turn-1', {
  replyEn: 'Of course. Anything else?',
  replyVi: 'Tất nhiên. Bạn có gọi thêm gì không?',
  correction: 'Your sentence is correct.',
  encouragement: 'Good job!',
  scores: { grammar: 102, vocabulary: 78.4, fluency: -5 },
  hints: [{ en: 'Could I have the menu?', vi: 'Cho tôi xem thực đơn được không?' }],
}, 91);
assert.equal(completed.pendingTurn, null);
assert.equal(completed.messages.length, 3);
assert.equal(completed.messages.at(-1).turnSequence, 1);
assert.equal(completed.feedback[0].turnSequence, 1);
assert.equal(completed.transport.state, 'idle');
assert.equal(completed.transport.lastAcknowledgedSequence, 1);
assert.deepEqual(completed.feedback[0].scores, { grammar: 100, vocabulary: 78, fluency: 0, taskCompletion: null, pronunciation: null });
assert.equal(completed.feedback[0].scoreEvidence.pronunciation, null, 'a numeric value without speech evidence must not become pronunciation');
assert.equal(completed.feedback[0].hints[0].en, 'Could I have the menu?');
assert.equal(loadActiveSpeakingSession(scenario).id, completed.id, 'reload must resume the active scenario session');
assert.equal(loadCurrentSpeakingSession().id, completed.id);
assert.equal(loadSpeakingSessionState().schemaVersion, 4);

const secondScenario = { id: 'airport', title: 'Airport', introMessage: 'May I see your passport?' };
const oldPending = beginSpeakingTurn(completed, { requestId: 'session-1-turn-2', text: 'Here it is.' });
const newer = createSpeakingSession(secondScenario, { level: 'B2' });
assert.equal(newer.level, 'B2');
completeSpeakingTurn(oldPending, 'session-1-turn-2', { replyEn: 'Thank you.', scores: {} });
assert.equal(loadCurrentSpeakingSession().id, newer.id, 'a background completion must not steal the active session');

const generated = beginSpeakingTurn(newer, { text: 'This request ID is deterministic.' });
assert.equal(generated.pendingTurn.requestId, `speaking:${newer.id}:turn:1`);
const evidenceCompleted = completeSpeakingTurn(generated, generated.pendingTurn.requestId, {
  replyEn: 'Evidence-safe reply.',
  scores: { grammar: 80, vocabulary: 81, fluency: 82, taskCompletion: 83, pronunciation: 100 },
}, 91, 'speech-recognition-transcript-alignment');
assert.deepEqual(evidenceCompleted.feedback[0].scores, {
  grammar: 80, vocabulary: 81, fluency: 82, taskCompletion: 83, pronunciation: 91,
});
assert.equal(evidenceCompleted.feedback[0].scoreEvidence.pronunciation, 'speech-recognition-transcript-alignment');
const durablePayload = {
  session: { id: newer.id, level: 'B2' },
  turns: [{
    turnSequence: 1,
    requestId: generated.pendingTurn.requestId,
    userText: generated.pendingTurn.text,
    replyEn: 'Your durable reply is ready.',
    replyVi: 'CÃ¢u tráº£ lá»i Ä‘Ã£ Ä‘Æ°á»£c lÆ°u.',
    correction: '',
    encouragement: 'Well done!',
    hints: [],
    scores: { grammar: 90, vocabulary: 88, fluency: 86 },
    createdAt: new Date().toISOString(),
  }],
};
const merged = mergeDurableSpeakingSession(evidenceCompleted, durablePayload);
assert.equal(merged.pendingTurn, null, 'durable completion must resolve the matching local pending turn');
assert.equal(merged.messages.filter((message) => message.turnSequence === 1).length, 2);
assert.equal(merged.feedback.length, 1);
assert.equal(merged.transport.lastAcknowledgedSequence, 1);
const mergedAgain = mergeDurableSpeakingSession(merged, durablePayload);
assert.equal(mergedAgain.messages.filter((message) => message.turnSequence === 1).length, 2, 'durable merge must be idempotent');
assert.equal(mergedAgain.feedback.length, 1);

values.set('lingogoc_speaking_sessions_v1', JSON.stringify({
  schemaVersion: 1,
  activeSessionId: 'legacy-session',
  sessions: [{
    id: 'legacy-session',
    scenarioId: 'legacy',
    scenarioTitle: 'Legacy session',
    messages: [
      { id: 'intro', sender: 'ai', text: 'Hello.' },
      { id: 'legacy-turn:user', sender: 'user', text: 'Hello back.' },
      { id: 'legacy-turn:ai', sender: 'ai', text: 'How are you?' },
      { id: 'legacy-pending:user', sender: 'user', text: 'I am well.' },
    ],
    feedback: [{ requestId: 'legacy-turn', scores: {} }],
    pendingTurn: { requestId: 'legacy-pending', text: 'I am well.', status: 'failed', attempt: 1 },
  }],
}));
const migrated = loadSpeakingSessionState();
assert.equal(migrated.schemaVersion, 4);
assert.match(migrated.sessions[0].resumeToken, /^[a-zA-Z0-9._:-]{32,160}$/);
assert.equal(loadSpeakingSessionState().sessions[0].resumeToken, migrated.sessions[0].resumeToken, 'legacy resume token migration must persist once');
assert.equal(migrated.sessions[0].level, 'A2');
assert.deepEqual(migrated.sessions[0].messages.map((message) => message.turnSequence), [0, 1, 1, 2]);
assert.equal(migrated.sessions[0].pendingTurn.turnSequence, 2, 'legacy pending turns must reuse their saved user-message sequence');
assert.equal(migrated.sessions[0].nextTurnSequence, 3);
assert.equal(migrated.sessions[0].transport.state, 'failed');
assert.equal(migrated.sessions[0].transport.activeRequestId, 'legacy-pending');

console.log('Speaking session persistence checks passed.');
