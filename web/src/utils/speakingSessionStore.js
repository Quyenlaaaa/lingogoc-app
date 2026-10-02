const STORAGE_KEY = 'lingogoc_speaking_sessions_v1';
import { DEFAULT_SPEAKING_LEVEL, normalizeSpeakingLevel } from './speakingLevels.js';

const SCHEMA_VERSION = 4;
const MAX_SESSIONS = 12;
const MAX_MESSAGES = 60;

function isoNow() {
  return new Date().toISOString();
}

function cleanText(value, maxLength = 4000) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeSequence(value, fallback = null) {
  const sequence = Number(value);
  return Number.isInteger(sequence) && sequence >= 0 ? sequence : fallback;
}

function createResumeToken() {
  return `${crypto.randomUUID()}.${crypto.randomUUID()}`;
}

function normalizeResumeToken(value) {
  const token = cleanText(value, 160);
  return /^[a-zA-Z0-9._:-]{32,160}$/.test(token) ? token : createResumeToken();
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
    turnSequence: normalizeSequence(message?.turnSequence),
    createdAt: cleanText(message?.createdAt, 40) || isoNow(),
  };
}

function normalizeScores(scores) {
  const normalized = {};
  ['grammar', 'vocabulary', 'fluency', 'taskCompletion', 'pronunciation'].forEach((key) => {
    if (scores?.[key] == null || scores[key] === '') {
      normalized[key] = null;
      return;
    }
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
    turnSequence: normalizeSequence(item?.turnSequence),
    correction: cleanText(item?.correction, 1000),
    encouragement: cleanText(item?.encouragement, 1000),
    scores: normalizeScores(item?.scores),
    scoreEvidence: {
      text: cleanText(item?.scoreEvidence?.text, 80) || 'ai-text-rubric-v1',
      pronunciation: item?.scoreEvidence?.pronunciation === 'speech-recognition-transcript-alignment'
        ? 'speech-recognition-transcript-alignment'
        : null,
    },
    hints: (Array.isArray(item?.hints) ? item.hints : []).slice(0, 3).map((hint) => ({
      en: cleanText(hint?.en, 500),
      vi: cleanText(hint?.vi, 500),
    })).filter((hint) => hint.en),
    createdAt: cleanText(item?.createdAt, 40) || isoNow(),
  };
}

function normalizeSession(session) {
  if (!session?.id || !session?.scenarioId) return null;
  let inferredTurnSequence = 0;
  const messages = (Array.isArray(session.messages) ? session.messages : [])
    .map(normalizeMessage)
    .filter(Boolean)
    .map((message) => {
      if (message.turnSequence == null) {
        if (message.sender === 'user') inferredTurnSequence += 1;
        return { ...message, turnSequence: inferredTurnSequence };
      }
      inferredTurnSequence = Math.max(inferredTurnSequence, message.turnSequence);
      return message;
    })
    .slice(-MAX_MESSAGES);
  const feedback = (Array.isArray(session.feedback) ? session.feedback : [])
    .map(normalizeFeedback)
    .filter(Boolean)
    .map((item) => ({
      ...item,
      turnSequence: item.turnSequence ?? messages.find((message) => message.id === `${item.requestId}:ai`)?.turnSequence ?? null,
    }))
    .slice(-30);
  const completedSequence = Math.max(
    0,
    ...messages.filter((message) => message.sender === 'ai').map((message) => message.turnSequence || 0),
    ...feedback.map((item) => item.turnSequence || 0),
  );
  const pendingRequestId = cleanText(session.pendingTurn?.requestId, 160);
  const pendingMessageSequence = messages.find((message) => message.id === `${pendingRequestId}:user`)?.turnSequence;
  const rawPending = pendingRequestId ? {
    requestId: pendingRequestId,
    text: cleanText(session.pendingTurn.text),
    turnSequence: normalizeSequence(
      session.pendingTurn.turnSequence,
      pendingMessageSequence ?? Math.max(inferredTurnSequence, completedSequence) + 1,
    ),
    status: session.pendingTurn.status === 'failed' ? 'failed' : 'pending',
    attempt: Math.max(1, Number(session.pendingTurn.attempt) || 1),
    startedAt: cleanText(session.pendingTurn.startedAt, 40) || isoNow(),
    error: cleanText(session.pendingTurn.error, 500),
  } : null;
  const maxKnownSequence = Math.max(inferredTurnSequence, completedSequence, rawPending?.turnSequence || 0);
  const nextTurnSequence = Math.max(maxKnownSequence + 1, normalizeSequence(session.nextTurnSequence, 1));
  const requestedTransportState = cleanText(session.transport?.state, 20);
  const transportState = rawPending
    ? (['waiting', 'reconnecting', 'failed'].includes(requestedTransportState)
      ? requestedTransportState
      : rawPending.status === 'failed' ? 'failed' : 'waiting')
    : 'idle';
  return {
    id: cleanText(session.id, 120),
    resumeToken: normalizeResumeToken(session.resumeToken),
    scenarioId: cleanText(session.scenarioId, 120),
    scenarioTitle: cleanText(session.scenarioTitle, 240),
    level: normalizeSpeakingLevel(session.level),
    status: session.status === 'archived' ? 'archived' : 'active',
    createdAt: cleanText(session.createdAt, 40) || isoNow(),
    updatedAt: cleanText(session.updatedAt, 40) || isoNow(),
    nextTurnSequence,
    messages,
    feedback,
    pendingTurn: rawPending,
    transport: {
      state: transportState,
      activeRequestId: rawPending?.requestId || null,
      activeTurnSequence: rawPending?.turnSequence ?? null,
      lastAcknowledgedSequence: Math.min(
        completedSequence,
        normalizeSequence(session.transport?.lastAcknowledgedSequence, completedSequence),
      ),
      reconnectAttempts: rawPending
        ? Math.max(0, Number(session.transport?.reconnectAttempts) || 0)
        : 0,
      updatedAt: cleanText(session.transport?.updatedAt, 40) || cleanText(session.updatedAt, 40) || isoNow(),
    },
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
    const state = {
      schemaVersion: SCHEMA_VERSION,
      activeSessionId: sessions.some((session) => session.id === parsed?.activeSessionId) ? parsed.activeSessionId : sessions[0]?.id || null,
      sessions,
    };
    if (parsed?.schemaVersion !== SCHEMA_VERSION || sessions.some((session) => (
      session.resumeToken !== parsed?.sessions?.find((item) => item?.id === session.id)?.resumeToken
    ))) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    return state;
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

export function createSpeakingSession(scenario, { level = DEFAULT_SPEAKING_LEVEL } = {}) {
  const createdAt = isoNow();
  const session = {
    id: crypto.randomUUID(),
    resumeToken: createResumeToken(),
    scenarioId: cleanText(scenario?.id, 120) || 'default',
    scenarioTitle: cleanText(scenario?.title || scenario?.titleEn, 240),
    level: normalizeSpeakingLevel(level),
    status: 'active',
    createdAt,
    updatedAt: createdAt,
    nextTurnSequence: 1,
    messages: [{
      id: crypto.randomUUID(),
      sender: 'ai',
      text: cleanText(scenario?.introMessage),
      textVi: cleanText(scenario?.introMessageVi),
      turnSequence: 0,
      createdAt,
    }].filter((message) => message.text),
    feedback: [],
    pendingTurn: null,
    transport: {
      state: 'idle',
      activeRequestId: null,
      activeTurnSequence: null,
      lastAcknowledgedSequence: 0,
      reconnectAttempts: 0,
      updatedAt: createdAt,
    },
  };
  return saveSpeakingSession(session);
}

export function loadActiveSpeakingSession(scenario, options = {}) {
  const state = loadSpeakingSessionState();
  const matching = state.sessions.find((session) => (
    session.id === state.activeSessionId
    && session.status === 'active'
    && session.scenarioId === String(scenario?.id || 'default')
  ));
  return matching || createSpeakingSession(scenario, options);
}

export function loadCurrentSpeakingSession() {
  const state = loadSpeakingSessionState();
  return state.sessions.find((session) => session.id === state.activeSessionId && session.status === 'active') || null;
}

export function beginSpeakingTurn(session, { requestId, text }) {
  const cleanTurnText = cleanText(text);
  if (!cleanTurnText) throw new Error('INVALID_SPEAKING_TURN');
  if (session.pendingTurn?.requestId) {
    if (requestId && session.pendingTurn.requestId === cleanText(requestId, 160)) return session;
    throw new Error('SPEAKING_TURN_PENDING');
  }
  const turnSequence = Math.max(1, normalizeSequence(session.nextTurnSequence, 1));
  const cleanRequestId = cleanText(requestId, 160) || `speaking:${session.id}:turn:${turnSequence}`;
  if (!/^[a-zA-Z0-9._:-]+$/.test(cleanRequestId)) throw new Error('INVALID_SPEAKING_TURN');
  if (session.pendingTurn?.requestId === cleanRequestId) return session;
  const createdAt = isoNow();
  return saveSpeakingSession({
    ...session,
    nextTurnSequence: turnSequence + 1,
    messages: [...session.messages, {
      id: `${cleanRequestId}:user`, sender: 'user', text: cleanTurnText, textVi: '', turnSequence, createdAt,
    }],
    pendingTurn: { requestId: cleanRequestId, text: cleanTurnText, turnSequence, status: 'pending', attempt: 1, startedAt: createdAt, error: '' },
    transport: {
      ...session.transport,
      state: 'waiting',
      activeRequestId: cleanRequestId,
      activeTurnSequence: turnSequence,
      reconnectAttempts: 0,
      updatedAt: createdAt,
    },
  });
}

export function failSpeakingTurn(session, requestId, error) {
  if (session.pendingTurn?.requestId !== requestId) return session;
  const activate = loadSpeakingSessionState().activeSessionId === session.id;
  return saveSpeakingSession({
    ...session,
    pendingTurn: { ...session.pendingTurn, status: 'failed', error: cleanText(error, 500) || 'SPEAKING_REQUEST_FAILED' },
    transport: { ...session.transport, state: 'failed', updatedAt: isoNow() },
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
    transport: {
      ...session.transport,
      state: 'reconnecting',
      reconnectAttempts: Math.max(0, Number(session.transport?.reconnectAttempts) || 0) + 1,
      updatedAt: isoNow(),
    },
  });
}

export function markSpeakingTransportReconnecting(session) {
  if (!session.pendingTurn?.requestId) return session;
  return saveSpeakingSession({
    ...session,
    transport: {
      ...session.transport,
      state: 'reconnecting',
      reconnectAttempts: Math.max(0, Number(session.transport?.reconnectAttempts) || 0) + 1,
      updatedAt: isoNow(),
    },
  });
}

export function completeSpeakingTurn(session, requestId, result, pronunciationScore = null, pronunciationEvidence = null) {
  if (session.pendingTurn?.requestId !== requestId) return session;
  const createdAt = isoNow();
  const turnSequence = session.pendingTurn.turnSequence;
  const hasPronunciationEvidence = pronunciationEvidence === 'speech-recognition-transcript-alignment';
  const scores = normalizeScores({
    ...result?.scores,
    pronunciation: hasPronunciationEvidence ? pronunciationScore : null,
  });
  const activate = loadSpeakingSessionState().activeSessionId === session.id;
  return saveSpeakingSession({
    ...session,
    messages: [...session.messages, {
      id: `${requestId}:ai`, sender: 'ai', text: result?.replyEn, textVi: result?.replyVi, turnSequence, createdAt,
    }],
    feedback: [...session.feedback, {
      requestId,
      turnSequence,
      correction: cleanText(result?.correction, 1000),
      encouragement: cleanText(result?.encouragement, 1000),
      scores,
      scoreEvidence: {
        text: `ai-text-rubric-v${Number(result?.scoringVersion) || 1}`,
        pronunciation: hasPronunciationEvidence ? pronunciationEvidence : null,
      },
      hints: Array.isArray(result?.hints) ? result.hints.slice(0, 3).map((hint) => ({
        en: cleanText(hint?.en, 500),
        vi: cleanText(hint?.vi, 500),
      })).filter((hint) => hint.en) : [],
      createdAt,
    }],
    pendingTurn: null,
    transport: {
      state: 'idle',
      activeRequestId: null,
      activeTurnSequence: null,
      lastAcknowledgedSequence: Math.max(session.transport?.lastAcknowledgedSequence || 0, turnSequence),
      reconnectAttempts: 0,
      updatedAt: createdAt,
    },
  }, { activate });
}

export function mergeDurableSpeakingSession(session, durablePayload) {
  const turns = Array.isArray(durablePayload?.turns) ? durablePayload.turns : [];
  if (!session?.id || durablePayload?.session?.id !== session.id || !turns.length) return session;
  const messages = new Map(session.messages.map((message) => [`${message.sender}:${message.turnSequence}`, message]));
  const feedback = new Map(session.feedback.map((item) => [item.requestId, item]));
  let lastTurnSequence = session.transport?.lastAcknowledgedSequence || 0;
  turns.forEach((turn) => {
    const turnSequence = normalizeSequence(turn?.turnSequence);
    const requestId = cleanText(turn?.requestId, 160);
    const userText = cleanText(turn?.userText);
    const replyEn = cleanText(turn?.replyEn);
    if (!turnSequence || !requestId || !userText || !replyEn) return;
    const createdAt = cleanText(turn?.createdAt, 40) || isoNow();
    messages.set(`user:${turnSequence}`, {
      id: `${requestId}:user`, sender: 'user', text: userText, textVi: '', turnSequence, createdAt,
    });
    messages.set(`ai:${turnSequence}`, {
      id: `${requestId}:ai`, sender: 'ai', text: replyEn, textVi: cleanText(turn?.replyVi), turnSequence, createdAt,
    });
    const existingFeedback = feedback.get(requestId);
    feedback.set(requestId, normalizeFeedback({
      requestId,
      turnSequence,
      correction: turn?.correction,
      encouragement: turn?.encouragement,
      hints: turn?.hints,
      scores: {
        ...turn?.scores,
        pronunciation: existingFeedback?.scores?.pronunciation,
      },
      scoreEvidence: existingFeedback?.scoreEvidence,
      createdAt,
    }));
    lastTurnSequence = Math.max(lastTurnSequence, turnSequence);
  });
  const pendingCompleted = session.pendingTurn && feedback.has(session.pendingTurn.requestId);
  return saveSpeakingSession({
    ...session,
    level: normalizeSpeakingLevel(durablePayload?.session?.level || session.level),
    nextTurnSequence: Math.max(session.nextTurnSequence, lastTurnSequence + 1),
    messages: [...messages.values()].sort((left, right) => (
      left.turnSequence - right.turnSequence || (left.sender === 'user' ? -1 : 1)
    )),
    feedback: [...feedback.values()].filter(Boolean).sort((left, right) => left.turnSequence - right.turnSequence),
    pendingTurn: pendingCompleted ? null : session.pendingTurn,
    transport: {
      ...session.transport,
      state: pendingCompleted ? 'idle' : session.transport.state,
      activeRequestId: pendingCompleted ? null : session.transport.activeRequestId,
      activeTurnSequence: pendingCompleted ? null : session.transport.activeTurnSequence,
      lastAcknowledgedSequence: lastTurnSequence,
      reconnectAttempts: pendingCompleted ? 0 : session.transport.reconnectAttempts,
      updatedAt: isoNow(),
    },
  }, { activate: loadSpeakingSessionState().activeSessionId === session.id });
}

export function clearSpeakingSessions() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
}
