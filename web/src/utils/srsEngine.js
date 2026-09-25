const SRS_STORAGE_KEY = 'lingogoc_srs_records_v1';

export function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

export function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

export function loadSrsRecords() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SRS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.error('Failed to load SRS records', error);
    return {};
  }
}

export function saveSrsRecords(records) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.error('Failed to save SRS records', error);
  }
}

export function calculateSrsReview(wordId, quality, existingRecord, today = getTodayString()) {
  const safeQuality = Math.max(1, Math.min(4, Number(quality) || 1));
  const current = existingRecord || {
    wordId,
    repetition: 0,
    interval: 0,
    easeFactor: 2.5,
    lastReviewed: null,
    nextReview: today,
    reviewCount: 0,
  };
  let repetition = current.repetition;
  let interval = current.interval;
  let easeFactor = current.easeFactor;
  if (safeQuality < 3) {
    repetition = 0;
    interval = 1;
  } else {
    if (repetition === 0) interval = 1;
    else if (repetition === 1) interval = 3;
    else if (repetition === 2) interval = 7;
    else interval = Math.round(interval * easeFactor);
    repetition += 1;
  }
  const sm2Quality = safeQuality + 1;
  easeFactor += 0.1 - (5 - sm2Quality) * (0.08 + (5 - sm2Quality) * 0.02);
  easeFactor = Math.max(1.3, easeFactor);
  if (safeQuality === 4) interval = Math.max(interval + 1, Math.round(interval * 1.25));
  return {
    wordId,
    repetition,
    interval,
    easeFactor: Number(easeFactor.toFixed(2)),
    lastReviewed: today,
    nextReview: addDays(today, interval),
    reviewCount: (current.reviewCount || 0) + 1,
  };
}

export function getSrsGradeOptions(existingRecord, today = getTodayString()) {
  return [
    { quality: 1, label: 'Quên', tone: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' },
    { quality: 2, label: 'Khó', tone: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' },
    { quality: 3, label: 'Tốt', tone: '#10b981', background: 'rgba(16, 185, 129, 0.1)' },
    { quality: 4, label: 'Dễ', tone: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)' },
  ].map((option) => ({
    ...option,
    nextRecord: calculateSrsReview(existingRecord?.wordId || 1, option.quality, existingRecord, today),
  }));
}

export function recordWordReview(wordId, quality) {
  const records = loadSrsRecords();
  const updatedRecord = calculateSrsReview(wordId, quality, records[wordId]);
  records[wordId] = updatedRecord;
  saveSrsRecords(records);
  return updatedRecord;
}

export function getDueWords(allWords = [], maxNewWordsPerSession = 15) {
  const records = loadSrsRecords();
  const today = getTodayString();
  const dueList = [];
  const reviewedIds = new Set(Object.keys(records).map(Number));
  allWords.forEach((word) => {
    const record = records[word.id];
    if (record && record.nextReview <= today) {
      dueList.push({ ...word, srsRecord: record, isNew: false });
    }
  });
  for (let index = 0; index < allWords.length && dueList.length < maxNewWordsPerSession; index += 1) {
    const word = allWords[index];
    if (!reviewedIds.has(word.id)) dueList.push({ ...word, srsRecord: null, isNew: true });
  }
  return dueList;
}

export function getSrsStats(allWords = []) {
  const records = loadSrsRecords();
  const today = getTodayString();
  let dueCount = 0;
  let learningCount = 0;
  let matureCount = 0;
  allWords.forEach((word) => {
    const record = records[word.id];
    if (!record) return;
    if (record.nextReview <= today) dueCount += 1;
    if (record.interval >= 21) matureCount += 1;
    else learningCount += 1;
  });
  return {
    dueCount,
    learningCount,
    matureCount,
    totalTracked: Object.keys(records).length,
    totalWords: allWords.length,
  };
}
