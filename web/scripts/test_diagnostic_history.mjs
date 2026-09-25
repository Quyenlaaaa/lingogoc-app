import assert from 'node:assert/strict';
import { diagnosticQuestions, evaluateDiagnosticResults } from '../src/data/diagnosticData.js';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
};
const { loadDiagnosticHistory, loadLatestDiagnosticResult, saveDiagnosticResult } = await import('../src/utils/diagnosticHistory.js');

const answers = Object.fromEntries(
  diagnosticQuestions.filter((question) => question.correctId).map((question) => [question.id, question.correctId]),
);
const first = { ...evaluateDiagnosticResults(answers, {}), completedAt: '2026-09-23T08:00:00.000Z' };
assert.equal(first.overallScore, 100);
assert.equal(first.level, 'B2');
values.set('lingogoc_diagnostic_result', JSON.stringify(first));
assert.deepEqual(loadDiagnosticHistory(), [first], 'legacy latest result must migrate into history reads');

const second = { ...first, overallScore: 80, level: 'B1', completedAt: '2026-09-24T08:00:00.000Z' };
saveDiagnosticResult(second);
saveDiagnosticResult(second);
assert.equal(loadDiagnosticHistory().length, 2, 'saving the same completed result must be idempotent');
assert.equal(loadLatestDiagnosticResult().completedAt, second.completedAt);

for (let index = 0; index < 25; index += 1) {
  saveDiagnosticResult({
    ...second,
    completedAt: new Date(Date.UTC(2026, 9, index + 1)).toISOString(),
  });
}
assert.equal(loadDiagnosticHistory().length, 20, 'history must remain bounded');

console.log('Diagnostic scoring and history checks passed.');
