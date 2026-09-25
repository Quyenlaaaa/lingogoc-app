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
  await page.route('https://lingogoc-api.lingogoc-api.workers.dev/**', (route) => route.abort());
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.evaluate(() => {
    localStorage.removeItem('lingogoc_learning_module_sessions_v1');
    localStorage.removeItem('lingogoc_learning_events_v1');
    localStorage.removeItem('lingogoc_user_data_v1');
  });
  await page.reload();

  const openExploreModule = async (name) => {
    await page.locator('.mobile-bottom-nav button').filter({ hasText: 'Khám phá' }).click();
    await page.locator('.mobile-explore-grid button').filter({ hasText: name }).click();
  };
  const openHome = () => page.locator('.mobile-bottom-nav button').filter({ hasText: 'Hôm nay' }).click();

  await openExploreModule('Nghe Chép');
  await page.getByRole('button', { name: /Gõ Phím/ }).click();
  const dictationInput = page.locator('.dictation-view textarea');
  await dictationInput.fill('Can I have a cup of tea?');
  await openHome();
  await openExploreModule('Nghe Chép');
  assert.equal(await dictationInput.inputValue(), 'Can I have a cup of tea?', 'dictation draft must survive navigation');
  await page.getByRole('button', { name: 'Kiểm Tra Đáp Án' }).click();
  await page.getByText(/Xuất Sắc/).waitFor();
  const dictationProgress = await page.evaluate(() => JSON.parse(localStorage.getItem('lingogoc_user_data_v1')));
  assert.deepEqual(dictationProgress.completedDictation, [1]);

  await openExploreModule('Bẫy Lỗi Sai');
  await page.getByRole('button', { name: 'tell' }).click();
  await page.getByText(/Vì phía sau có tân ngữ/).waitFor();
  await openHome();
  await openExploreModule('Bẫy Lỗi Sai');
  await page.getByText(/Vì phía sau có tân ngữ/).waitFor();
  const trapProgress = await page.evaluate(() => JSON.parse(localStorage.getItem('lingogoc_user_data_v1')));
  assert.deepEqual(trapProgress.completedTraps, [1]);

  await openExploreModule('Tiếng Anh ngành IT');
  const search = page.getByPlaceholder('Tìm thuật ngữ, nghĩa hoặc ví dụ…');
  await search.fill('no-such-term-xyz');
  await page.getByText(/Không tìm thấy thuật ngữ phù hợp/).waitFor();
  await openHome();
  await openExploreModule('Tiếng Anh ngành IT');
  assert.equal(await search.inputValue(), 'no-such-term-xyz', 'IT search state must survive navigation');

  await openExploreModule('Phản xạ');
  await page.getByRole('button', { name: /Nhờ Vả Lịch Sự/ }).click();
  await page.getByRole('button', { name: 'Ví dụ 2' }).click();
  await openHome();
  await openExploreModule('Phản xạ');
  await page.getByText('Could you please help me with the wifi password?', { exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    false,
    'supporting modules must not create horizontal overflow on mobile',
  );
  console.log('Mobile supporting-module persistence and progress checks passed.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
