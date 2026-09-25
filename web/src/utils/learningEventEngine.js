import { loadUserData, saveUserData } from './storage.js';
import { calculateSrsReview, loadSrsRecords, saveSrsRecords } from './srsEngine.js';

const EVENT_STORAGE_KEY = 'lingogoc_learning_events_v1';
const EVENT_VERSION = 1;
const MAX_EVENTS = 2000;

function cleanId(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

function recordLearningDay(userData, activityDate) {
  const previousDate = cleanId(userData.lastActiveDate, 10);
  if (previousDate === activityDate) return;
  const previous = Date.parse(`${previousDate}T00:00:00.000Z`);
  const current = Date.parse(`${activityDate}T00:00:00.000Z`);
  const consecutive = Number.isFinite(previous) && current - previous === 24 * 60 * 60 * 1000;
  userData.streak = consecutive ? Math.max(1, Number(userData.streak) || 1) + 1 : 1;
  userData.lastActiveDate = activityDate;
}

export function createLearningEvent({ id, type, source, payload = {}, occurredAt = new Date().toISOString() }) {
  const event = {
    id: cleanId(id || crypto.randomUUID()),
    version: EVENT_VERSION,
    type: cleanId(type, 80),
    source: cleanId(source, 80),
    occurredAt,
    payload,
  };
  if (!event.id || !event.type || !event.source || !Number.isFinite(Date.parse(event.occurredAt))) {
    throw new Error('INVALID_LEARNING_EVENT');
  }
  return event;
}

export function reduceLearningEvent(snapshot, event) {
  if (event?.version !== EVENT_VERSION) throw new Error('UNSUPPORTED_LEARNING_EVENT_VERSION');
  const userData = { ...(snapshot?.userData || {}) };
  const srsRecords = { ...(snapshot?.srsRecords || {}) };
  let awardedXp = 0;
  if (event.type === 'word.reviewed') {
    const wordId = Number(event.payload?.wordId);
    const quality = Number(event.payload?.quality);
    if (!Number.isInteger(wordId) || wordId <= 0 || quality < 1 || quality > 4) {
      throw new Error('INVALID_WORD_REVIEW_EVENT');
    }
    srsRecords[wordId] = calculateSrsReview(wordId, quality, srsRecords[wordId], event.occurredAt.slice(0, 10));
    awardedXp = Math.max(0, Number(event.payload?.xp) || 0);
    userData.xp = Math.max(0, Number(userData.xp) || 0) + awardedXp;
  } else if (event.type === 'progress.completed' || event.type === 'progress.toggled') {
    const collection = cleanId(event.payload?.collection, 60);
    const targetId = event.payload?.targetId;
    if (!collection || targetId == null) throw new Error('INVALID_PROGRESS_EVENT');
    const values = new Set(Array.isArray(userData[collection]) ? userData[collection] : []);
    const wasComplete = values.has(targetId);
    const shouldComplete = event.type === 'progress.completed' ? true : Boolean(event.payload?.completed);
    if (shouldComplete) values.add(targetId);
    else values.delete(targetId);
    userData[collection] = [...values];
    const rewardKey = cleanId(event.payload?.rewardKey || `${collection}:${targetId}`, 160);
    const rewardKeys = new Set(Array.isArray(userData.learningRewardKeys) ? userData.learningRewardKeys : []);
    if (shouldComplete && !wasComplete && !rewardKeys.has(rewardKey)) {
      awardedXp = Math.max(0, Number(event.payload?.xp) || 0);
      userData.xp = Math.max(0, Number(userData.xp) || 0) + awardedXp;
      rewardKeys.add(rewardKey);
    }
    userData.learningRewardKeys = [...rewardKeys];
  } else if (event.type === 'xp.awarded') {
    const rewardKey = cleanId(event.payload?.rewardKey, 160);
    const rewardKeys = new Set(Array.isArray(userData.learningRewardKeys) ? userData.learningRewardKeys : []);
    if (!rewardKey || !rewardKeys.has(rewardKey)) {
      awardedXp = Math.max(0, Number(event.payload?.xp) || 0);
      userData.xp = Math.max(0, Number(userData.xp) || 0) + awardedXp;
      if (rewardKey) rewardKeys.add(rewardKey);
    }
    userData.learningRewardKeys = [...rewardKeys];
  } else {
    throw new Error('UNKNOWN_LEARNING_EVENT_TYPE');
  }
  if (awardedXp > 0) recordLearningDay(userData, event.occurredAt.slice(0, 10));
  return { userData, srsRecords, awardedXp };
}

function loadEventState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(EVENT_STORAGE_KEY) || 'null');
    return {
      processedEventIds: Array.isArray(parsed?.processedEventIds) ? parsed.processedEventIds : [],
      pendingEvents: Array.isArray(parsed?.pendingEvents) ? parsed.pendingEvents : [],
    };
  } catch {
    return { processedEventIds: [], pendingEvents: [] };
  }
}

export function dispatchLearningEvent(input) {
  if (typeof localStorage === 'undefined') throw new Error('LEARNING_STORAGE_UNAVAILABLE');
  const event = createLearningEvent(input);
  const state = loadEventState();
  if (state.processedEventIds.includes(event.id)) {
    return { duplicate: true, event, userData: loadUserData(), srsRecords: loadSrsRecords(), awardedXp: 0 };
  }
  const next = reduceLearningEvent({ userData: loadUserData(), srsRecords: loadSrsRecords() }, event);
  saveUserData(next.userData);
  saveSrsRecords(next.srsRecords);
  const processedEventIds = [...state.processedEventIds, event.id].slice(-MAX_EVENTS);
  const pendingEvents = [...state.pendingEvents, event].slice(-MAX_EVENTS);
  localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify({ processedEventIds, pendingEvents }));
  return { duplicate: false, event, ...next };
}

export function loadPendingLearningEvents() {
  if (typeof localStorage === 'undefined') return [];
  return loadEventState().pendingEvents;
}

export function acknowledgeLearningEvents(eventIds) {
  if (typeof localStorage === 'undefined') return 0;
  const acknowledged = new Set((Array.isArray(eventIds) ? eventIds : []).map((id) => cleanId(id)).filter(Boolean));
  const state = loadEventState();
  const pendingEvents = state.pendingEvents.filter((event) => !acknowledged.has(event.id));
  localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify({
    processedEventIds: state.processedEventIds,
    pendingEvents,
  }));
  return state.pendingEvents.length - pendingEvents.length;
}
