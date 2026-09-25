import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  FEATURE_STATUS,
  FEATURES,
  getCertificateProgress,
  isFeatureVisible,
} from '../src/config/features.js';

assert.equal(FEATURES.battle.status, FEATURE_STATUS.LOCAL_ONLY);
assert.equal(isFeatureVisible('battle'), true);
assert.equal(isFeatureVisible('leaderboard'), false);
assert.equal(isFeatureVisible('vipPayment'), false);
assert.equal(FEATURES.leaderboard.status, FEATURE_STATUS.MOCK);
assert.equal(FEATURES.vipPayment.status, FEATURE_STATUS.MOCK);

const incompleteCertificate = getCertificateProgress({
  completedIpa: Array(15),
  masteredWords: Array(499),
  completedReflex: Array(49),
  completedScenarios: Array(4),
});
assert.equal(incompleteCertificate.eligible, false);

const completeCertificate = getCertificateProgress({
  completedIpa: Array(16),
  masteredWords: Array(500),
  completedReflex: Array(50),
  completedScenarios: Array(5),
});
assert.equal(completeCertificate.eligible, true);

const navbarSource = await readFile(new URL('../src/components/Navbar.jsx', import.meta.url), 'utf8');
assert.match(navbarSource, /mobileExploreTabs/);
assert.match(navbarSource, /isFeatureVisible\(tab\.id\)/);

const battleSource = await readFile(new URL('../src/components/BattleView.jsx', import.meta.url), 'utf8');
assert.doesNotMatch(battleSource, /OPPONENTS|botScore|Tìm Đối Thủ|ghép cặp/i);
assert.match(battleSource, /Thử Thách Từ Vựng Solo 60 Giây/);

console.log('Feature registry and navigation checks passed.');
