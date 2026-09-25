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

let retryCalls = 0;
let correctionCalls = 0;
const browser = await chromium.launch({ executablePath: edgePath, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route('https://lingogoc-api.lingogoc-api.workers.dev/api/admin/**', async (route) => {
    const request = route.request();
    const authorization = request.headers().authorization || '';
    if (authorization === 'Bearer wrong-key') {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Administrator authorization is required.' }) });
      return;
    }
    if (authorization === 'Bearer d1-missing') {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'D1 is required for vocabulary administration.' }) });
      return;
    }
    assert.equal(authorization, 'Bearer admin-test-key');
    const url = new URL(request.url());
    if (url.pathname.endsWith('/retry')) {
      retryCalls += 1;
      await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ data: { status: 'retry_pending' } }) });
      return;
    }
    if (url.pathname.endsWith('/correction')) {
      correctionCalls += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { status: 'complete' } }) });
      return;
    }
    const offset = Number(url.searchParams.get('offset')) || 0;
    const issues = offset === 0
      ? Array.from({ length: 25 }, (_, index) => ({ word: `issue${index + 1}`, status: 'partial', example_count: index % 5 }))
      : [{ word: 'secondpage', status: 'partial', example_count: 2 }];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {
        pagination: { limit: 25, offset },
        enrichmentCounts: { complete: 120, partial: 26 },
        jobCounts: { retry_pending: retryCalls },
        manualReview: [],
        issues,
        auditEvents: [],
      } }),
    });
  });

  await page.goto(`http://127.0.0.1:${port}/?admin=1`);
  await page.getByLabel('Khóa quản trị').fill('wrong-key');
  await page.getByRole('button', { name: 'Tải trạng thái' }).click();
  await page.getByRole('alert').getByText('Administrator authorization is required.').waitFor();

  await page.getByLabel('Khóa quản trị').fill('d1-missing');
  await page.getByRole('button', { name: 'Tải trạng thái' }).click();
  await page.getByRole('alert').getByText('D1 is required for vocabulary administration.').waitFor();

  await page.getByLabel('Khóa quản trị').fill('admin-test-key');
  await page.getByRole('button', { name: 'Tải trạng thái' }).click();
  await page.getByText('120').waitFor();
  await page.getByText('issue1', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Trang sau' }).click();
  await page.getByText('Trang 2').waitFor();
  await page.getByText('secondpage', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Xếp hàng thử lại' }).click();
  assert.equal(retryCalls, 1);

  const correction = {
    word: 'accept',
    enrichment: {
      primaryMeaningVi: 'chấp nhận',
      contextExamples: Array.from({ length: 5 }, (_, index) => ({
        context: `context-${index}`,
        en: `We accept example number ${index}.`,
        vi: `Chúng tôi chấp nhận ví dụ số ${index}.`,
      })),
    },
  };
  await page.locator('.vocab-admin-correction textarea').fill(JSON.stringify(correction));
  await page.getByRole('button', { name: 'Kiểm định và lưu' }).click();
  assert.equal(correctionCalls, 1);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileLayout = await page.locator('.vocab-admin-stats').evaluate((element) => ({
    columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
    overflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  assert.equal(mobileLayout.columns, 2);
  assert.equal(mobileLayout.overflows, false);

  await page.getByRole('button', { name: 'Khóa phiên' }).click();
  assert.equal(await page.getByLabel('Khóa quản trị').inputValue(), '');
  console.log('Vocabulary administration browser checks passed.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
