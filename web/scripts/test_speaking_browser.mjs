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
  });
  const requestIds = [];
  let retryFailures = 0;
  const inFlight = new Map();
  await page.route('**/api/speaking/chat', async (route) => {
    const body = route.request().postDataJSON();
    const requestId = route.request().headers()['x-idempotency-key'];
    requestIds.push(requestId);
    const userText = body.messages.at(-1)?.content || '';
    if (userText.includes('retry') && retryFailures === 0) {
      retryFailures += 1;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary failure' }) });
      return;
    }
    if (!inFlight.has(requestId)) {
      inFlight.set(requestId, new Promise((resolve) => setTimeout(() => resolve({
        replyEn: userText.includes('retry') ? 'The safe retry worked.' : 'Your background reply is ready.',
        replyVi: userText.includes('retry') ? 'Lần thử lại an toàn đã thành công.' : 'Câu trả lời nền đã sẵn sàng.',
        correction: 'Your sentence is clear.',
        encouragement: 'Keep speaking!',
        hints: [{ en: 'Tell me more, please.', vi: 'Hãy kể thêm cho tôi.' }],
        scores: { grammar: 90, vocabulary: 85, fluency: 80 },
      }), 450)));
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(await inFlight.get(requestId)) });
  });

  await page.goto(`http://127.0.0.1:${port}/`);
  await page.evaluate(() => localStorage.removeItem('lingogoc_speaking_sessions_v1'));
  await page.reload();
  const openSpeaking = () => page.locator('.mobile-bottom-nav button').filter({ hasText: 'Luyện nói' }).click();
  await openSpeaking();
  await page.locator('.speaking-ai-v2').waitFor();
  const input = page.locator('.speaking-composer-v2 input');
  await input.fill('Please answer in the background.');
  await page.getByTitle('Gửi').click();
  await page.locator('.speaking-thinking').waitFor();
  await page.locator('.mobile-bottom-nav button').filter({ hasText: 'Hôm nay' }).click();
  await page.waitForTimeout(650);
  await openSpeaking();
  await page.getByText('Your background reply is ready.', { exact: true }).waitFor();

  const storedAfterNavigation = await page.evaluate(() => JSON.parse(localStorage.getItem('lingogoc_speaking_sessions_v1')));
  const activeAfterNavigation = storedAfterNavigation.sessions.find((item) => item.id === storedAfterNavigation.activeSessionId);
  assert.equal(activeAfterNavigation.pendingTurn, null, 'background completion must clear the pending turn');
  assert.equal(activeAfterNavigation.messages.length, 3, 'navigation must preserve the completed transcript');

  await page.reload();
  await openSpeaking();
  await page.getByText('Your background reply is ready.', { exact: true }).waitFor();
  await page.getByText('Your sentence is clear.', { exact: true }).waitFor();
  await page.getByLabel('Điểm luyện nói').waitFor();

  await input.fill('Please retry this safely.');
  const beforeRetry = requestIds.length;
  await page.getByTitle('Gửi').click();
  await page.getByRole('button', { name: 'Thử lại' }).waitFor();
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await page.getByText('The safe retry worked.', { exact: true }).waitFor();
  const retryRequestIds = requestIds.slice(beforeRetry);
  assert.equal(retryRequestIds.length, 2);
  assert.equal(retryRequestIds[0], retryRequestIds[1], 'manual retry must reuse the original idempotency key');
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    false,
    'speaking controls must not create horizontal overflow on mobile',
  );
  console.log('Mobile AI Speaking navigation, reload, and retry checks passed.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
