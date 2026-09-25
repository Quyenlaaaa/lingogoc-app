const STORAGE_KEY = 'lingogoc_speaking_sessions_v1';
const SCHEMA_VERSION = 1;
const MAX_SESSIONS = 12;
const MAX_MESSAGES = 60;

function isoNow() {
  return new Date().toISOString();
}

function cleanText(value, maxLength = 4000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeMessage(message) {
  const sender = message?.sender === 'user' ? 'user' : 'ai';
  const text = cleanText(message?.text);
  if (!text) return null;
  return {
    id: cleanText(message?.id, 120) || crypto.randomUUID(),
    sender,
    text,
    textVi: cleanText(message?.textVi),
    createdAt: cleanText(message?.createdAt, 40) || isoNow(),
  };
}

function normalizeScores(scores) {
  const normalized = {};
  ['grammar', 'vocabulary', 'fluency', 'pronunciation'].forEach((key) => {
    const value = Number(scores?.[key]);
    normalized[key] = Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : null;
  });
  return normalized;
}

function normalizeFeedback(item) {
  const requestId = cleanText(item?.requestId, 160);
  if (!requestId) return null;
  return {
    requestId,
    correction: cleanText(item?.correction, 1000),
    encouragement: cleanText(item?.encouragement, 1000),
    scores: normalizeScores(item?.scores),
    hints: (Array.isArray(item?.hints) ? item.hints : []).slice(0, 3).map((hint) => ({
      en: cleanText(hint?.en, 500),
      vi: cleanText(hint?.vi, 500),
    })).filter((hint) => hint.en),
    createdAt: cleanText(item?.createdAt, 40) || isoNow(),
  };
}

function normalizeSession(session) {
  if (!session?.id || !session?.scenarioId) return null;
  const messages = (Array.isArray(session.messages) ? session.messages : [])
    .map(normalizeMessage)
    .filter(Boolean)
    .slice(-MAX_MESSAGES);
  return {
    id: cleanText(session.id, 120),
    scenarioId: cleanText(session.scenarioId, 120),
    scenarioTitle: cleanText(session.scenarioTitle, 240),
    status: session.status === 'archived' ? 'archived' : 'active',
    createdAt: cleanText(session.createdAt, 40) || isoNow(),
    updatedAt: cleanText(session.updatedAt, 40) || isoNow(),
    messages,
    feedback: (Array.isArray(session.feedback) ? session.feedback : [])
      .map(normalizeFeedback)
      .filter(Boolean)
      .slice(-30),
    pendingTurn: session.pendingTurn?.requestId ? {
      requestId: cleanText(session.pendingTurn.requestId, 160),
      text: cleanText(session.pendingTurn.text),
      status: session.pendingTurn.status === 'failed' ? 'failed' : 'pending',
      attempt: Math.max(1, Number(session.pendingTurn.attempt) || 1),
      startedAt: cleanText(session.pendingTurn.startedAt, 40) || isoNow(),
      error: cleanText(session.pendingTurn.error, 500),
    } : null,
  };
}

export function loadSpeakingSessionState() {
  if (typeof localStorage === 'undefined') return { schemaVersion: SCHEMA_VERSION, activeSessionId: null, sessions: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const sessions = (Array.isArray(parsed?.sessions) ? parsed.sessions : [])
      .map(normalizeSession)
      .filter(Boolean)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, MAX_SESSIONS);
    return {
      schemaVersion: SCHEMA_VERSION,
      activeSessionId: sessions.some((session) => session.id === parsed?.activeSessionId) ? parsed.activeSessionId : sessions[0]?.id || null,
      sessions,
    };
  } catch {
    return { schemaVersion: SCHEMA_VERSION, activeSessionId: null, sessions: [] };
  }
}

function persistState(state) {
  const normalized = {
    schemaVersion: SCHEMA_VERSION,
    activeSessionId: state.activeSessionId || null,
    sessions: state.sessions.map(normalizeSession).filter(Boolean).slice(0, MAX_SESSIONS),
  };
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function saveSpeakingSession(session, { activate = true } = {}) {
  const normalized = normalizeSession({ ...session, updatedAt: isoNow() });
  if (!normalized) throw new Error('INVALID_SPEAKING_SESSION');
  const state = loadSpeakingSessionState();
  const sessions = [normalized, ...state.sessions.filter((item) => item.id !== normalized.id)]
    .slice(0, MAX_SESSIONS);
  persistState({ ...state, activeSessionId: activate ? normalized.id : state.activeSessionId, sessions });
  return normalized;
}

export function createSpeakingSession(scenario) {
  const createdAt = isoNow();
  const session = {
    id: crypto.randomUUID(),
    scenarioId: cleanText(scenario?.id, 120) || 'default',
    scenarioTitle: cleanText(scenario?.title || scenario?.titleEn, 240),
    status: 'active',
    createdAt,
    updatedAt: createdAt,
    messages: [{
      id: crypto.randomUUID(),
      sender: 'ai',
      text: cleanText(scenario?.introMessage),
      textVi: cleanText(scenario?.introMessageVi),
      createdAt,
    }].filter((message) => message.text),
    feedback: [],
    pendingTurn: null,
  };
  return saveSpeakingSession(session);
}

export function loadActiveSpeakingSession(scenario) {
  const state = loadSpeakingSessionState();
  const matching = state.sessions.find((session) => (
    session.id === state.activeSessionId
    && session.status === 'active'
    && session.scenarioId === String(scenario?.id || 'default')
  ));
  return matching || createSpeakingSession(scenario);
}

export function loadCurrentSpeakingSession() {
  const state = loadSpeakingSessionState();
  return state.sessions.find((session) => session.id === state.activeSessionId && session.status === 'active') || null;
}

export function beginSpeakingTurn(session, { requestId, text }) {
  const cleanRequestId = cleanText(requestId, 160);
  const cleanTurnText = cleanText(text);
  if (!cleanRequestId || !cleanTurnText) throw new Error('INVALID_SPEAKING_TURN');
  if (session.pendingTurn?.requestId === cleanRequestId) return session;
  const createdAt = isoNow();
  return saveSpeakingSession({
    ...session,
    messages: [...session.messages, {
      id: `${cleanRequestId}:user`, sender: 'user', text: cleanTurnText, textVi: '', createdAt,
    }],
    pendingTurn: { requestId: cleanRequestId, text: cleanTurnText, status: 'pending', attempt: 1, startedAt: createdAt, error: '' },
  });
}

export function failSpeakingTurn(session, requestId, error) {
  if (session.pendingTurn?.requestId !== requestId) return session;
  const activate = loadSpeakingSessionState().activeSessionId === session.id;
  return saveSpeakingSession({
    ...session,
    pendingTurn: { ...session.pendingTurn, status: 'failed', error: cleanText(error, 500) || 'SPEAKING_REQUEST_FAILED' },
  }, { activate });
}

export function retrySpeakingTurn(session) {
  if (!session.pendingTurn?.requestId) return session;
  return saveSpeakingSession({
    ...session,
    pendingTurn: {
      ...session.pendingTurn,
      status: 'pending',
      attempt: session.pendingTurn.attempt + 1,
      startedAt: isoNow(),
      error: '',
    },
  });
}

export function completeSpeakingTurn(session, requestId, result, pronunciationScore = null) {
  if (session.pendingTurn?.requestId !== requestId) return session;
  const createdAt = isoNow();
  const scores = normalizeScores({ ...result?.scores, pronunciation: pronunciationScore ?? result?.scores?.pronunciation });
  const activate = loadSpeakingSessionState().activeSessionId === session.id;
  return saveSpeakingSession({
    ...session,
    messages: [...session.messages, {
      id: `${requestId}:ai`, sender: 'ai', text: result?.replyEn, textVi: result?.replyVi, createdAt,
    }],
    feedback: [...session.feedback, {
      requestId,
      correction: cleanText(result?.correction, 1000),
      encouragement: cleanText(result?.encouragement, 1000),
      scores,
      hints: Array.isArray(result?.hints) ? result.hints.slice(0, 3).map((hint) => ({
        en: cleanText(hint?.en, 500),
        vi: cleanText(hint?.vi, 500),
      })).filter((hint) => hint.en) : [],
      createdAt,
    }],
    pendingTurn: null,
  }, { activate });
}

export function clearSpeakingSessions() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
}
