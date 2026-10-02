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
  await page.addInitScript(() => {
    window.__lingogocAudioPauses = 0;
    window.__lingogocAudioTexts = [];
    window.Audio = class MockAudio {
      constructor() {
        this.currentTime = 0;
        this.playbackRate = 1;
        this.defaultPlaybackRate = 1;
        this.src = '';
      }

      load() {}

      play() {
        try {
          window.__lingogocAudioTexts.push(new URL(this.src, window.location.href).searchParams.get('text') || '');
        } catch {
          window.__lingogocAudioTexts.push('');
        }
        queueMicrotask(() => this.onplay?.({ type: 'play' }));
        return Promise.resolve();
      }

      pause() {
        window.__lingogocAudioPauses += 1;
      }
    };
  });
  const requestIds = [];
  const requestedLevels = [];
  let retryFailures = 0;
  const inFlight = new Map();
  await page.route('**/api/speaking/realtime/session', async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        protocolVersion: 1,
        sessionId: body.sessionId,
        level: body.level,
        transport: 'ndjson',
        turnEndpoint: '/api/speaking/realtime/turn',
        fallbackEndpoint: '/api/speaking/chat',
        heartbeatMs: 10_000,
        resumeFromSequence: body.lastAcknowledgedSequence || 0,
      }),
    });
  });
  await page.route('**/api/speaking/realtime/turn', async (route) => {
    const body = route.request().postDataJSON();
    const requestId = route.request().headers()['x-idempotency-key'];
    requestIds.push(requestId);
    requestedLevels.push(body.level);
    const userText = body.messages.at(-1)?.content || '';
    const baseEvent = {
      protocolVersion: 1,
      sessionId: body.sessionId,
      turnSequence: body.turnSequence,
      requestId,
      createdAt: new Date().toISOString(),
    };
    if (userText.includes('retry') && retryFailures === 0) {
      retryFailures += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: `${JSON.stringify({ ...baseEvent, eventSequence: 1, type: 'ack', level: body.level })}\n${JSON.stringify({ ...baseEvent, eventSequence: 2, type: 'error', status: 503, code: 'TEMPORARY_FAILURE', retryable: true, error: 'Temporary failure' })}\n`,
      });
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
    const result = await inFlight.get(requestId);
    await route.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body: [
        { ...baseEvent, eventSequence: 1, type: 'ack', level: body.level },
        { ...baseEvent, eventSequence: 2, type: 'delta', text: result.replyEn.slice(0, 18) },
        { ...baseEvent, eventSequence: 3, type: 'delta', text: result.replyEn },
        { ...baseEvent, eventSequence: 4, type: 'result', level: body.level, cache: 'MISS', data: result },
        { ...baseEvent, eventSequence: 5, type: 'done', level: body.level },
      ].map((event) => JSON.stringify(event)).join('\n') + '\n',
    });
  });
  await page.route('**/api/speaking/chat', async (route) => {
    const body = route.request().postDataJSON();
    const requestId = route.request().headers()['x-idempotency-key'];
    requestIds.push(requestId);
    requestedLevels.push(body.level);
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
  await page.evaluate(() => {
    localStorage.removeItem('lingogoc_speaking_sessions_v1');
    localStorage.removeItem('lingogoc_speaking_preferences_v2');
  });
  await page.reload();
  const openSpeaking = () => page.locator('.mobile-bottom-nav button').filter({ hasText: 'Luyện nói' }).click();
  await openSpeaking();
  await page.locator('.speaking-ai-v2').waitFor();
  const avatar = page.locator('.speaking-avatar');
  await avatar.waitFor();
  assert.match(await avatar.getAttribute('data-avatar-renderer'), /^(webgl-procedural|css-fallback)$/);
  assert.match(await avatar.getAttribute('aria-label'), /Gia sư AI hư cấu/);
  await page.getByTitle('Tắt hoạt ảnh gia sư AI').click();
  await page.locator('.speaking-orb').waitFor();
  await page.getByTitle('Bật hoạt ảnh gia sư AI').click();
  await avatar.waitFor();
  assert.equal(await page.getByRole('radio').count(), 5, 'A1-C1 controls must all be available');
  await page.getByRole('radio', { name: /B2/ }).click();
  assert.equal(await page.getByRole('radio', { name: /B2/ }).getAttribute('aria-checked'), 'true');
  const input = page.locator('.speaking-composer-v2 input');
  await input.fill('Please answer in the background.');
  await page.getByTitle('Gửi').click();
  await page.locator('.speaking-thinking').waitFor();
  assert.match(await avatar.getAttribute('data-avatar-state'), /thinking|streaming/);
  await page.locator('.mobile-bottom-nav button').filter({ hasText: 'Hôm nay' }).click();
  await page.waitForTimeout(650);
  await openSpeaking();
  await page.getByText('Your background reply is ready.', { exact: true }).waitFor();
  assert.equal(requestedLevels[0], 'B2', 'the selected CEFR level must reach the Speaking API');
  assert.match(requestIds[0], /^speaking:[a-f0-9-]+:turn:1$/, 'the first turn must use a reconnect-safe deterministic ID');

  const storedAfterNavigation = await page.evaluate(() => JSON.parse(localStorage.getItem('lingogoc_speaking_sessions_v1')));
  const activeAfterNavigation = storedAfterNavigation.sessions.find((item) => item.id === storedAfterNavigation.activeSessionId);
  assert.equal(activeAfterNavigation.pendingTurn, null, 'background completion must clear the pending turn');
  assert.equal(activeAfterNavigation.messages.length, 3, 'navigation must preserve the completed transcript');
  assert.equal(activeAfterNavigation.nextTurnSequence, 2);
  assert.equal(activeAfterNavigation.transport.state, 'idle');
  assert.equal(activeAfterNavigation.transport.lastAcknowledgedSequence, 1);

  await page.reload();
  await openSpeaking();
  assert.equal(await page.getByRole('radio', { name: /B2/ }).getAttribute('aria-checked'), 'true', 'the selected level must survive reload');
  await page.getByText('Your background reply is ready.', { exact: true }).waitFor();
  await page.getByText('Your sentence is clear.', { exact: true }).waitFor();
  await page.getByLabel('Điểm luyện nói').waitFor();

  await page.getByRole('button', { name: 'Nghe lại' }).last().click();
  await page.locator('[data-speaking-state="speaking"]').waitFor();
  assert.equal(await avatar.getAttribute('data-avatar-state'), 'speaking', 'avatar mouth state must follow audible TTS');
  await page.getByTitle('Ngắt lời AI và bắt đầu nói').click();
  assert.ok(await page.evaluate(() => window.__lingogocAudioPauses > 0), 'barge-in must stop active TTS immediately');
  assert.notEqual(await page.locator('.status-text').getAttribute('data-speaking-state'), 'speaking');
  assert.notEqual(await avatar.getAttribute('data-avatar-state'), 'speaking', 'barge-in must stop avatar speaking animation');

  await input.fill('Please retry this safely.');
  const beforeRetry = requestIds.length;
  await page.getByTitle('Gửi').click();
  await page.getByRole('button', { name: 'Thử lại' }).waitFor();
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await page.getByText('The safe retry worked.', { exact: true }).waitFor();
  await page.waitForFunction(() => window.__lingogocAudioTexts.includes('The safe retry worked.'));
  assert.equal(
    await page.evaluate(() => window.__lingogocAudioTexts.filter((text) => text === 'The safe retry worked.').length),
    1,
    'streamed sentence TTS must not replay the final response',
  );
  const retryRequestIds = requestIds.slice(beforeRetry);
  assert.equal(retryRequestIds.length, 2);
  assert.equal(retryRequestIds[0], retryRequestIds[1], 'manual retry must reuse the original idempotency key');
  assert.match(retryRequestIds[0], /:turn:2$/, 'retry must not allocate another turn sequence');
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    false,
    'speaking controls must not create horizontal overflow on mobile',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await openSpeaking();
  await avatar.waitFor();
  assert.equal(await avatar.getAttribute('data-avatar-renderer'), 'css-fallback', 'reduced motion must avoid WebGL animation');
  console.log('Mobile AI Speaking navigation, reload, and retry checks passed.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
