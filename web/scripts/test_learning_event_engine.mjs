import assert from 'node:assert/strict';

const values = new Map();
globalThis.window = {};
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};

const { acknowledgeLearningEvents, createLearningEvent, dispatchLearningEvent, loadPendingLearningEvents, reduceLearningEvent } = await import('../src/utils/learningEventEngine.js');
const { calculateSrsReview } = await import('../src/utils/srsEngine.js');
const today = new Date().toISOString().slice(0, 10);
values.set('lingogoc_user_data_v1', JSON.stringify({ xp: 0, streak: 1, lastActiveDate: today }));

const event = createLearningEvent({
  id: 'review-session-1-word-42',
  type: 'word.reviewed',
  source: 'smart-review',
  occurredAt: `${today}T08:00:00.000Z`,
  payload: { wordId: 42, quality: 3, xp: 10 },
});
const reduced = reduceLearningEvent({ userData: { xp: 0 }, srsRecords: {} }, event);
assert.equal(reduced.userData.xp, 10);
assert.equal(reduced.srsRecords[42].reviewCount, 1);
assert.equal(reduced.srsRecords[42].interval, 1);
const secondReview = calculateSrsReview(42, 3, reduced.srsRecords[42], today);
const thirdReview = calculateSrsReview(42, 3, secondReview, today);
assert.equal(secondReview.interval, 3);
assert.equal(thirdReview.interval, 7);

const first = dispatchLearningEvent(event);
const duplicate = dispatchLearningEvent(event);
assert.equal(first.duplicate, false);
assert.equal(duplicate.duplicate, true);
assert.equal(JSON.parse(values.get('lingogoc_user_data_v1')).xp, 10);
assert.equal(JSON.parse(values.get('lingogoc_srs_records_v1'))[42].reviewCount, 1);
assert.equal(loadPendingLearningEvents().length, 1);

const progressEvent = createLearningEvent({
  id: 'ipa-session-1-i',
  type: 'progress.completed',
  source: 'ipa',
  payload: { collection: 'completedIpa', targetId: '/i:/', xp: 20, rewardKey: 'ipa:/i:/' },
});
dispatchLearningEvent(progressEvent);
dispatchLearningEvent(progressEvent);
const userData = JSON.parse(values.get('lingogoc_user_data_v1'));
assert.equal(userData.xp, 30);
assert.deepEqual(userData.completedIpa, ['/i:/']);
assert.equal(loadPendingLearningEvents().length, 2);

dispatchLearningEvent(createLearningEvent({
  id: 'ipa-session-1-i-off',
  type: 'progress.toggled',
  source: 'ipa',
  payload: { collection: 'completedIpa', targetId: '/i:/', completed: false, xp: 20, rewardKey: 'ipa:/i:/' },
}));
dispatchLearningEvent(createLearningEvent({
  id: 'ipa-session-2-i-on',
  type: 'progress.toggled',
  source: 'ipa',
  payload: { collection: 'completedIpa', targetId: '/i:/', completed: true, xp: 20, rewardKey: 'ipa:/i:/' },
}));
const toggledUserData = JSON.parse(values.get('lingogoc_user_data_v1'));
assert.equal(toggledUserData.xp, 30, 'un-completing and re-completing must not farm XP');
assert.deepEqual(toggledUserData.completedIpa, ['/i:/']);

dispatchLearningEvent(createLearningEvent({
  id: 'trap-7-first-answer',
  type: 'xp.awarded',
  source: 'traps',
  payload: { xp: 15, rewardKey: 'traps:7' },
}));
dispatchLearningEvent(createLearningEvent({
  id: 'trap-7-replayed-answer',
  type: 'xp.awarded',
  source: 'traps',
  payload: { xp: 15, rewardKey: 'traps:7' },
}));
assert.equal(JSON.parse(values.get('lingogoc_user_data_v1')).xp, 45, 'one reward key must be paid only once');
const streakResult = reduceLearningEvent({
  userData: { xp: 0, streak: 2, lastActiveDate: '2026-09-23' },
  srsRecords: {},
}, createLearningEvent({
  id: 'next-day-review',
  type: 'xp.awarded',
  source: 'test',
  occurredAt: '2026-09-24T09:00:00.000Z',
  payload: { xp: 1 },
}));
assert.equal(streakResult.userData.streak, 3);
assert.equal(streakResult.userData.lastActiveDate, '2026-09-24');
const pendingBeforeAck = loadPendingLearningEvents();
assert.equal(acknowledgeLearningEvents([pendingBeforeAck[0].id]), 1);
assert.equal(loadPendingLearningEvents().length, pendingBeforeAck.length - 1);

assert.throws(() => reduceLearningEvent({ userData: {}, srsRecords: {} }, {
  ...event,
  payload: { wordId: 0, quality: 9 },
}), /INVALID_WORD_REVIEW_EVENT/);

console.log('Learning event engine checks passed.');
