// storage.js - LocalStorage management for progress, streak, XP, bookmarks

const STORAGE_KEY = 'lingogoc_user_data_v1';

const defaultData = {
  xp: 0,
  streak: 1,
  lastActiveDate: new Date().toISOString().split('T')[0],
  masteredWords: [],
  bookmarkedWords: [],
  completedIpa: [],
  completedReflex: [],
  completedScenarios: [],
  completedItTerms: [],
  completedDictation: [],
  completedTraps: [],
  completedAudioWords: [],
  settings: {
    voiceSpeed: 0.85, // 0.75 or 1.0
    voicePreset: 'auto',
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
    return {
      ...defaultData,
      ...data,
      settings: {
        ...defaultData.settings,
        ...(data.settings || {}),
      },
    };
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

export function resetUserData(settings = null) {
  if (typeof window === 'undefined') return defaultData;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('lingogoc_srs_records_v1');
  localStorage.removeItem('lingogoc_learning_events_v1');
  localStorage.removeItem('lingogoc_diagnostic_result');
  localStorage.removeItem('lingogoc_diagnostic_history_v1');
  localStorage.removeItem('lingogoc_speaking_sessions_v1');
  localStorage.removeItem('lingogoc_learning_module_sessions_v1');
  const freshData = {
    ...defaultData,
    settings: { ...defaultData.settings, ...(settings || {}) },
    lastActiveDate: new Date().toISOString().split('T')[0],
    masteredWords: [],
    bookmarkedWords: [],
    completedIpa: [],
    completedReflex: [],
    completedScenarios: [],
    completedItTerms: [],
    completedDictation: [],
    completedTraps: [],
    completedAudioWords: [],
    xp: 0,
    streak: 1,
  };
  saveUserData(freshData);
  return freshData;
}
