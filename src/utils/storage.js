// storage.js - LocalStorage management for progress, streak, XP, bookmarks

const STORAGE_KEY = 'lingogoc_user_data_v1';

const defaultData = {
  xp: 120,
  streak: 3,
  lastActiveDate: new Date().toISOString().split('T')[0],
  masteredWords: [1, 2, 3, 4, 5], // default some completed
  bookmarkedWords: [6, 12],
  completedIpa: ['/i:/', '/s/', '/z/'],
  completedReflex: [1, 2],
  completedScenarios: [],
  settings: {
    voiceSpeed: 0.85, // 0.75 or 1.0
    theme: 'dark',
    soundEffects: true,
    showVietnamese: true,
  }
};

export function loadUserData() {
  if (typeof window === 'undefined') return defaultData;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveUserData(defaultData);
      return defaultData;
    }
    const data = JSON.parse(raw);
    // Check streak update
    const today = new Date().toISOString().split('T')[0];
    if (data.lastActiveDate !== today) {
      const lastDate = new Date(data.lastActiveDate);
      const currentDate = new Date(today);
      const diffDays = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        data.streak += 1;
      } else if (diffDays > 1) {
        data.streak = 1;
      }
      data.lastActiveDate = today;
      saveUserData(data);
    }
    return { ...defaultData, ...data };
  } catch (e) {
    console.error('Failed to load user data', e);
    return defaultData;
  }
}

export function saveUserData(data) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save user data', e);
  }
}

export function resetUserData() {
  if (typeof window === 'undefined') return defaultData;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('lingogoc_srs_records_v1');
  localStorage.removeItem('lingogoc_diagnostic_result');
  const freshData = {
    ...defaultData,
    lastActiveDate: new Date().toISOString().split('T')[0],
    masteredWords: [],
    bookmarkedWords: [],
    completedIpa: [],
    completedReflex: [],
    completedScenarios: [],
    xp: 0,
    streak: 1,
  };
  saveUserData(freshData);
  return freshData;
}

export function addXP(amount) {
  const data = loadUserData();
  data.xp = (data.xp || 0) + amount;
  saveUserData(data);
  return data.xp;
}

export function toggleWordMastered(wordId) {
  const data = loadUserData();
  const set = new Set(data.masteredWords || []);
  if (set.has(wordId)) {
    set.delete(wordId);
  } else {
    set.add(wordId);
    data.xp = (data.xp || 0) + 15; // 15 XP per mastered word
  }
  data.masteredWords = Array.from(set);
  saveUserData(data);
  return data;
}

export function toggleWordBookmark(wordId) {
  const data = loadUserData();
  const set = new Set(data.bookmarkedWords || []);
  if (set.has(wordId)) {
    set.delete(wordId);
  } else {
    set.add(wordId);
  }
  data.bookmarkedWords = Array.from(set);
  saveUserData(data);
  return data;
}
