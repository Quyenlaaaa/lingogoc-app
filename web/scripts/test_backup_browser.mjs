import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(webRoot, 'dist');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    const filePath = path.resolve(distRoot, relative);
    if (!filePath.startsWith(distRoot)) throw new Error('INVALID_PATH');
    const body = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

const browser = await chromium.launch({ executablePath: edgePath, headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36',
    isMobile: true,
    hasTouch: true,
    acceptDownloads: true,
  });
  await page.route('https://lingogoc-api.lingogoc-api.workers.dev/**', (route) => route.abort());
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.evaluate(() => {
    localStorage.setItem('lingogoc_user_data_v1', JSON.stringify({ xp: 50, streak: 2, masteredWords: [1], settings: { theme: 'dark', voicePreset: 'auto' } }));
    localStorage.setItem('lingogoc_srs_records_v1', JSON.stringify({ 1: { wordId: 1, reviewCount: 2, lastReviewed: '2026-09-20' } }));
    localStorage.setItem('lingogoc_learning_events_v1', JSON.stringify({ processedEventIds: ['event-1'], pendingEvents: [{ id: 'event-1' }] }));
    localStorage.setItem('lingogoc_speaking_sessions_v1', JSON.stringify({ schemaVersion: 1, activeSessionId: 'session-1', sessions: [{ id: 'session-1', updatedAt: '2026-09-20T00:00:00.000Z' }] }));
  });
  await page.reload();
  await page.getByTitle('Cài đặt tài khoản & sao lưu dữ liệu').click();
  const modal = page.getByText('Cài Đặt & Quản Lý Dữ Liệu').locator('..').locator('..');
  await modal.waitFor();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Xuất Tệp Sao Lưu/ }).click();
  const download = await downloadPromise;
  const backupText = await readFile(await download.path(), 'utf8');
  const backup = JSON.parse(backupText);
  assert.equal(backup.format, 'lingogoc-local-backup');
  assert.equal(backup.version, 1);
  assert.equal(backup.data.userData.xp, 50);
  assert.equal(backup.data.srsRecords[1].reviewCount, 2);
  assert.equal(backup.data.learningEvents.pendingEvents[0].id, 'event-1');
  assert.equal(backup.data.speakingSessions.sessions[0].id, 'session-1');

  await page.evaluate(() => {
    const current = JSON.parse(localStorage.getItem('lingogoc_user_data_v1'));
    localStorage.setItem('lingogoc_user_data_v1', JSON.stringify({ ...current, xp: 200, masteredWords: [2] }));
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: 'lingogoc-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backupText),
  });
  await page.getByText(/Đã hợp nhất bản sao lưu đầy đủ/).waitFor();
  const merged = await page.evaluate(() => JSON.parse(localStorage.getItem('lingogoc_user_data_v1')));
  assert.equal(merged.xp, 200, 'import must not lower current XP');
  assert.deepEqual(merged.masteredWords, [2, 1]);

  await page.locator('input[type="file"]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{broken'),
  });
  await page.getByText(/Tệp sao lưu không hợp lệ/).waitFor();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    false,
    'backup controls must not create horizontal overflow on mobile',
  );
  console.log('Mobile full-backup export, safe merge, and invalid-file checks passed.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
