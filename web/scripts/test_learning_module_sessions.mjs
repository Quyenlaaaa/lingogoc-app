import assert from 'node:assert/strict';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};

const {
  clearLearningModuleSessions,
  loadLearningModuleSession,
  loadLearningModuleState,
  saveLearningModuleSession,
} = await import('../src/utils/learningModuleSessionStore.js');

assert.deepEqual(loadLearningModuleSession('dictation', { lessonId: 'first' }), { lessonId: 'first' });
saveLearningModuleSession('dictation', {
  lessonId: 'lesson-2',
  inputMode: 'type',
  typedText: 'A durable answer',
  selectedWords: ['one', 'two'],
  isEvaluated: true,
});
assert.equal(loadLearningModuleSession('dictation').typedText, 'A durable answer');
saveLearningModuleSession('traps', { activeTrapId: 'trap-3', quizAnswers: { 'trap-3': 1 } });
assert.equal(loadLearningModuleSession('dictation').lessonId, 'lesson-2', 'saving another module must preserve dictation');
saveLearningModuleSession('reflex', { evalResult: { score: 90, words: [{ word: 'hello', status: 'correct' }] } });
assert.equal(loadLearningModuleSession('reflex').evalResult.words[0].status, 'correct');
assert.equal(loadLearningModuleState().schemaVersion, 1);
assert.throws(() => saveLearningModuleSession('unknown', {}), /INVALID_LEARNING_MODULE/);
localStorage.setItem('lingogoc_learning_module_sessions_v1', '{broken');
assert.deepEqual(loadLearningModuleSession('reflex', { activePatternId: 'first' }), { activePatternId: 'first' });
clearLearningModuleSessions();
assert.equal(values.size, 0);

console.log('Supporting learning-module session checks passed.');
