import { loadOrCreateGuestIdentity, mergeGuestUserData } from './guestIdentity.js';

const BACKUP_FORMAT = 'lingogoc-local-backup';
const BACKUP_VERSION = 1;
const MAX_BACKUP_BYTES = 2_000_000;
const MAX_EVENTS = 2000;
const MAX_DIAGNOSTIC_RESULTS = 20;

export const PERSONAL_STORAGE_KEYS = Object.freeze({
  userData: 'lingogoc_user_data_v1',
  srsRecords: 'lingogoc_srs_records_v1',
  learningEvents: 'lingogoc_learning_events_v1',
  diagnosticLatest: 'lingogoc_diagnostic_result',
  diagnosticHistory: 'lingogoc_diagnostic_history_v1',
  speakingSessions: 'lingogoc_speaking_sessions_v1',
  moduleSessions: 'lingogoc_learning_module_sessions_v1',
});

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readStoredJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function validUserData(value) {
  return isObject(value) && Number.isFinite(Number(value.xp));
}

function normalizeEnvelope(value) {
  if (validUserData(value) && value.format !== BACKUP_FORMAT) {
    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      source: { type: 'legacy-user-data' },
      data: { userData: value },
    };
  }
  if (!isObject(value)
    || value.format !== BACKUP_FORMAT
    || value.version !== BACKUP_VERSION
    || !Number.isFinite(Date.parse(value.exportedAt || ''))
    || !isObject(value.data)
    || !validUserData(value.data.userData)) {
    throw new Error('INVALID_BACKUP_FILE');
  }
  return value;
}

export function createLocalBackup() {
  const identity = loadOrCreateGuestIdentity();
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    source: { type: 'guest', guestId: identity.guestId },
    data: Object.fromEntries(Object.entries(PERSONAL_STORAGE_KEYS).map(([section, key]) => [
      section,
      readStoredJson(key, section === 'userData' ? { xp: 0 } : null),
    ])),
  };
}

export function serializeLocalBackup(backup = createLocalBackup()) {
  return JSON.stringify(normalizeEnvelope(backup), null, 2);
}

export function parseLocalBackup(text) {
  const raw = String(text || '');
  if (!raw.trim() || new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) {
    throw new Error('INVALID_BACKUP_SIZE');
  }
  return normalizeEnvelope(JSON.parse(raw));
}

function mergeSrsRecords(current, incoming) {
  const result = { ...(isObject(current) ? current : {}) };
  Object.entries(isObject(incoming) ? incoming : {}).forEach(([wordId, record]) => {
    if (!isObject(record)) return;
    const existing = result[wordId];
    const incomingTime = Date.parse(record.lastReviewed || record.nextReview || '') || 0;
    const existingTime = Date.parse(existing?.lastReviewed || existing?.nextReview || '') || 0;
    if (!existing || incomingTime > existingTime
      || (incomingTime === existingTime && Number(record.reviewCount) > Number(existing.reviewCount))) {
      result[wordId] = record;
    }
  });
  return result;
}

function mergeLearningEvents(current, incoming) {
  const currentState = isObject(current) ? current : {};
  const incomingState = isObject(incoming) ? incoming : {};
  const processedEventIds = [...new Set([
    ...(Array.isArray(currentState.processedEventIds) ? currentState.processedEventIds : []),
    ...(Array.isArray(incomingState.processedEventIds) ? incomingState.processedEventIds : []),
  ].map(String))].slice(-MAX_EVENTS);
  const pendingById = new Map();
  [
    ...(Array.isArray(currentState.pendingEvents) ? currentState.pendingEvents : []),
    ...(Array.isArray(incomingState.pendingEvents) ? incomingState.pendingEvents : []),
  ].forEach((event) => {
    if (isObject(event) && event.id) pendingById.set(String(event.id), event);
  });
  return { processedEventIds, pendingEvents: [...pendingById.values()].slice(-MAX_EVENTS) };
}

function mergeDiagnosticHistory(current, incoming) {
  const byCompletedAt = new Map();
  const add = (history) => {
    const results = isObject(history) && Array.isArray(history.results) ? history.results : [];
    results.forEach((result) => {
      if (isObject(result) && Number.isFinite(Date.parse(result.completedAt || ''))) {
        byCompletedAt.set(result.completedAt, result);
      }
    });
  };
  add(current);
  add(incoming);
  return {
    version: 1,
    results: [...byCompletedAt.values()]
      .sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt))
      .slice(-MAX_DIAGNOSTIC_RESULTS),
  };
}

function mergeSpeakingSessions(current, incoming) {
  const currentState = isObject(current) ? current : {};
  const incomingState = isObject(incoming) ? incoming : {};
  const sessionsById = new Map();
  [
    ...(Array.isArray(currentState.sessions) ? currentState.sessions : []),
    ...(Array.isArray(incomingState.sessions) ? incomingState.sessions : []),
  ].forEach((session) => {
    if (!isObject(session) || !session.id) return;
    const existing = sessionsById.get(session.id);
    if (!existing || String(session.updatedAt || '') >= String(existing.updatedAt || '')) {
      sessionsById.set(session.id, session);
    }
  });
  const sessions = [...sessionsById.values()]
    .sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')))
    .slice(0, 12);
  const preferredActiveId = incomingState.activeSessionId || currentState.activeSessionId;
  return {
    schemaVersion: 1,
    activeSessionId: sessions.some((session) => session.id === preferredActiveId)
      ? preferredActiveId
      : sessions[0]?.id || null,
    sessions,
  };
}

function mergeModuleSessions(current, incoming) {
  const currentModules = isObject(current?.modules) ? current.modules : {};
  const incomingModules = isObject(incoming?.modules) ? incoming.modules : {};
  const modules = { ...currentModules };
  Object.entries(incomingModules).forEach(([moduleId, session]) => {
    const existing = modules[moduleId];
    if (!existing || String(session?.updatedAt || '') >= String(existing?.updatedAt || '')) modules[moduleId] = session;
  });
  return { schemaVersion: 1, modules };
}

function selectLatestDiagnostic(history, currentLatest, incomingLatest) {
  const candidates = [currentLatest, incomingLatest, ...(history?.results || [])]
    .filter((item) => isObject(item) && Number.isFinite(Date.parse(item.completedAt || '')));
  return candidates.sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt)).at(-1) || null;
}

function buildRestoredData(envelope, mode) {
  const incoming = envelope.data;
  if (mode === 'replace') return { ...incoming, userData: incoming.userData };
  const current = Object.fromEntries(Object.entries(PERSONAL_STORAGE_KEYS).map(([section, key]) => [
    section,
    readStoredJson(key, null),
  ]));
  const diagnosticHistory = mergeDiagnosticHistory(current.diagnosticHistory, incoming.diagnosticHistory);
  return {
    userData: mergeGuestUserData(incoming.userData, current.userData),
    srsRecords: mergeSrsRecords(current.srsRecords, incoming.srsRecords),
    learningEvents: mergeLearningEvents(current.learningEvents, incoming.learningEvents),
    diagnosticHistory,
    diagnosticLatest: selectLatestDiagnostic(diagnosticHistory, current.diagnosticLatest, incoming.diagnosticLatest),
    speakingSessions: mergeSpeakingSessions(current.speakingSessions, incoming.speakingSessions),
    moduleSessions: mergeModuleSessions(current.moduleSessions, incoming.moduleSessions),
  };
}

export function restoreLocalBackup(backup, { mode = 'merge' } = {}) {
  if (!['merge', 'replace'].includes(mode)) throw new Error('INVALID_RESTORE_MODE');
  const envelope = normalizeEnvelope(backup);
  const restored = buildRestoredData(envelope, mode);
  const originals = new Map(Object.values(PERSONAL_STORAGE_KEYS).map((key) => [key, localStorage.getItem(key)]));
  try {
    Object.entries(PERSONAL_STORAGE_KEYS).forEach(([section, key]) => {
      const value = restored[section];
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    });
  } catch (error) {
    originals.forEach((value, key) => {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    });
    throw error;
  }
  return restored;
}
