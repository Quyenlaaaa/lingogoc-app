const LATEST_KEY = 'lingogoc_diagnostic_result';
const HISTORY_KEY = 'lingogoc_diagnostic_history_v1';
const HISTORY_VERSION = 1;
const MAX_RESULTS = 20;

function validResult(value) {
  return value?.version === 2
    && Number.isFinite(value.overallScore)
    && typeof value.level === 'string'
    && Number.isFinite(Date.parse(value.completedAt));
}

export function loadDiagnosticHistory() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || 'null');
    const results = stored?.version === HISTORY_VERSION && Array.isArray(stored.results)
      ? stored.results.filter(validResult)
      : [];
    if (results.length) return results;
    const legacy = JSON.parse(localStorage.getItem(LATEST_KEY) || 'null');
    return validResult(legacy) ? [legacy] : [];
  } catch {
    return [];
  }
}

export function loadLatestDiagnosticResult() {
  return loadDiagnosticHistory().at(-1) || null;
}

export function saveDiagnosticResult(result) {
  if (!validResult(result)) throw new Error('INVALID_DIAGNOSTIC_RESULT');
  const history = loadDiagnosticHistory();
  const deduplicated = history.filter((item) => item.completedAt !== result.completedAt);
  const results = [...deduplicated, result]
    .sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt))
    .slice(-MAX_RESULTS);
  localStorage.setItem(LATEST_KEY, JSON.stringify(result));
  localStorage.setItem(HISTORY_KEY, JSON.stringify({ version: HISTORY_VERSION, results }));
  return results;
}
