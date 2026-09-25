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
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: null });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: undefined });
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Playback blocked', 'NotAllowedError'));
  });
  await page.route('https://lingogoc-api.lingogoc-api.workers.dev/**', (route) => route.abort());
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.locator('button[title="Cài đặt tài khoản & sao lưu dữ liệu"]').click();
  await page.getByRole('button', { name: 'Nghe thử' }).click();

  const alert = page.getByRole('alert');
  await alert.getByText('Không thể phát giọng đọc. Bạn có thể thử lại ngay.').waitFor();
  const retry = alert.getByRole('button', { name: 'Thử lại' });
  await retry.click();
  await alert.getByText('Không thể phát giọng đọc. Bạn có thể thử lại ngay.').waitFor();

  const layout = await alert.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      withinViewport: box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
      documentOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  assert.equal(layout.withinViewport, true, 'speech retry status must fit a mobile viewport');
  assert.equal(layout.documentOverflows, false, 'speech status must not create horizontal overflow');
  console.log('Mobile Edge speech behavior checks passed.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
