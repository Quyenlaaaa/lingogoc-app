const IDENTITY_KEY = 'lingogoc_identity_v1';
const IDENTITY_VERSION = 1;
const MERGED_ARRAY_FIELDS = [
  'masteredWords',
  'bookmarkedWords',
  'completedIpa',
  'completedReflex',
  'completedScenarios',
  'completedItTerms',
  'completedDictation',
  'completedTraps',
  'completedAudioWords',
  'learningRewardKeys',
];

function validId(value) {
  const id = String(value || '');
  return /^[a-zA-Z0-9._:-]{8,160}$/.test(id) ? id : '';
}

function createGuestIdentity() {
  const now = new Date().toISOString();
  return {
    version: IDENTITY_VERSION,
    type: 'guest',
    guestId: `guest:${crypto.randomUUID()}`,
    createdAt: now,
    updatedAt: now,
  };
}

export function loadOrCreateGuestIdentity() {
  if (typeof localStorage === 'undefined') return createGuestIdentity();
  try {
    const parsed = JSON.parse(localStorage.getItem(IDENTITY_KEY) || 'null');
    if (parsed?.type === 'guest' && validId(parsed.guestId)) {
      return {
        version: IDENTITY_VERSION,
        type: 'guest',
        guestId: parsed.guestId,
        createdAt: parsed.createdAt || new Date().toISOString(),
        updatedAt: parsed.updatedAt || parsed.createdAt || new Date().toISOString(),
      };
    }
  } catch {
    // Replace corrupted identity data with a fresh anonymous identity.
  }
  const identity = createGuestIdentity();
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

export function mergeGuestUserData(guestData = {}, accountData = {}) {
  const guest = guestData && typeof guestData === 'object' ? guestData : {};
  const account = accountData && typeof accountData === 'object' ? accountData : {};
  const merged = {
    ...account,
    ...guest,
    xp: Math.max(0, Number(guest.xp) || 0, Number(account.xp) || 0),
    streak: Math.max(1, Number(guest.streak) || 1, Number(account.streak) || 1),
    lastActiveDate: [guest.lastActiveDate, account.lastActiveDate].filter(Boolean).sort().at(-1),
    settings: { ...(account.settings || {}), ...(guest.settings || {}) },
  };
  MERGED_ARRAY_FIELDS.forEach((field) => {
    merged[field] = [...new Set([
      ...(Array.isArray(account[field]) ? account[field] : []),
      ...(Array.isArray(guest[field]) ? guest[field] : []),
    ])];
  });
  return merged;
}

export function getGuestIdentityStorageKey() {
  return IDENTITY_KEY;
}
