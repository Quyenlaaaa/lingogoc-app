const STORAGE_KEY = 'lingogoc_learning_module_sessions_v1';
const SCHEMA_VERSION = 1;
const MODULE_IDS = new Set(['reflex', 'dictation', 'traps', 'it-career', 'audio-pod']);

function cleanValue(value, depth = 0) {
  if (depth > 8 || value == null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return value.slice(0, 1000);
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => cleanValue(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 50).map(([key, item]) => [
      String(key).slice(0, 120),
      cleanValue(item, depth + 1),
    ]));
  }
  return null;
}

function emptyState() {
  return { schemaVersion: SCHEMA_VERSION, modules: {} };
}

export function loadLearningModuleState() {
  if (typeof localStorage === 'undefined') return emptyState();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return {
      schemaVersion: SCHEMA_VERSION,
      modules: parsed?.modules && typeof parsed.modules === 'object' ? cleanValue(parsed.modules) : {},
    };
  } catch {
    return emptyState();
  }
}

export function loadLearningModuleSession(moduleId, fallback = {}) {
  if (!MODULE_IDS.has(moduleId)) throw new Error('INVALID_LEARNING_MODULE');
  const saved = loadLearningModuleState().modules[moduleId];
  return saved && typeof saved === 'object' && !Array.isArray(saved)
    ? { ...fallback, ...saved }
    : { ...fallback };
}

export function saveLearningModuleSession(moduleId, session) {
  if (!MODULE_IDS.has(moduleId)) throw new Error('INVALID_LEARNING_MODULE');
  const state = loadLearningModuleState();
  const saved = { ...cleanValue(session), updatedAt: new Date().toISOString() };
  const next = { schemaVersion: SCHEMA_VERSION, modules: { ...state.modules, [moduleId]: saved } };
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return saved;
}

export function clearLearningModuleSessions() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
}
