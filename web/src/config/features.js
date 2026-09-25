export const FEATURE_STATUS = Object.freeze({
  REAL: 'REAL',
  BETA: 'BETA',
  LOCAL_ONLY: 'LOCAL_ONLY',
  MOCK: 'MOCK',
});

export const FEATURES = Object.freeze({
  roadmap: { status: FEATURE_STATUS.REAL, visible: true },
  ipa: { status: FEATURE_STATUS.REAL, visible: true },
  vocab: { status: FEATURE_STATUS.REAL, visible: true },
  srs: { status: FEATURE_STATUS.REAL, visible: true },
  reflex: { status: FEATURE_STATUS.LOCAL_ONLY, visible: true },
  speaking: { status: FEATURE_STATUS.BETA, visible: true, badge: 'Beta' },
  progress: { status: FEATURE_STATUS.LOCAL_ONLY, visible: true },
  diagnostic: { status: FEATURE_STATUS.BETA, visible: true, badge: 'Beta' },
  'it-career': { status: FEATURE_STATUS.LOCAL_ONLY, visible: true },
  battle: { status: FEATURE_STATUS.LOCAL_ONLY, visible: true, badge: 'Solo' },
  leaderboard: { status: FEATURE_STATUS.MOCK, visible: false },
  dictation: { status: FEATURE_STATUS.LOCAL_ONLY, visible: true },
  traps: { status: FEATURE_STATUS.LOCAL_ONLY, visible: true },
  certificate: { status: FEATURE_STATUS.LOCAL_ONLY, visible: true, badge: 'Cục bộ' },
  audioPod: { status: FEATURE_STATUS.LOCAL_ONLY, visible: false },
  vipPayment: { status: FEATURE_STATUS.MOCK, visible: false },
});

export function getFeature(featureId) {
  return FEATURES[featureId] || null;
}

export function isFeatureVisible(featureId) {
  return Boolean(getFeature(featureId)?.visible);
}

export function getFeatureBadge(featureId, fallback = null) {
  return getFeature(featureId)?.badge || fallback;
}

export const CERTIFICATE_REQUIREMENTS = Object.freeze({
  completedIpa: 16,
  masteredWords: 500,
  completedReflex: 50,
  completedScenarios: 5,
});

export function getCertificateProgress(userData = {}) {
  const requirements = [
    {
      id: 'ipa',
      label: 'Hoàn thành âm IPA cốt lõi',
      current: userData.completedIpa?.length || 0,
      target: CERTIFICATE_REQUIREMENTS.completedIpa,
    },
    {
      id: 'vocabulary',
      label: 'Từ vựng đã đánh dấu thuộc',
      current: userData.masteredWords?.length || 0,
      target: CERTIFICATE_REQUIREMENTS.masteredWords,
    },
    {
      id: 'reflex',
      label: 'Mẫu câu phản xạ đã hoàn thành',
      current: userData.completedReflex?.length || 0,
      target: CERTIFICATE_REQUIREMENTS.completedReflex,
    },
    {
      id: 'speaking',
      label: 'Kịch bản luyện nói đã hoàn thành',
      current: userData.completedScenarios?.length || 0,
      target: CERTIFICATE_REQUIREMENTS.completedScenarios,
    },
  ].map((item) => ({ ...item, complete: item.current >= item.target }));

  return {
    eligible: requirements.every((item) => item.complete),
    requirements,
  };
}
