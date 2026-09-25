import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { vocabData } from '../src/data/vocabData.js';

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
  let vocabularyBatchRequests = 0;
  let vocabularyEnrichmentRequests = 0;
  const vocabularyBatchBodies = [];
  await page.route('https://lingogoc-api.lingogoc-api.workers.dev/**', (route) => {
    if (new URL(route.request().url()).pathname === '/api/vocabulary/batch') {
      vocabularyBatchRequests += 1;
      const body = route.request().postDataJSON();
      vocabularyBatchBodies.push(body);
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: {
          items: [],
          missing: body.items.map(({ word }) => word.toLowerCase()),
          needsEnrichment: body.items.map(({ word }) => word.toLowerCase()),
        } }),
      });
    }
    if (new URL(route.request().url()).pathname === '/api/vocabulary/enrich') {
      vocabularyEnrichmentRequests += 1;
      const { word } = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: {
          primaryMeaningVi: `nghĩa tiếng Việt của ${word}`,
          contextExamples: Array.from({ length: 5 }, (_, index) => ({
            context: `manual-context-${index + 1}`,
            en: `A manual retry example for ${word} in situation ${index + 1}.`,
            vi: `Ví dụ thử lại cho ${word} trong tình huống ${index + 1}.`,
          })),
          generatedByProvider: 'TEST_FREE',
          generatedByModel: 'test-model',
          persistedOnServer: true,
          serverSavedAt: new Date().toISOString(),
        } }),
      });
    }
    return route.abort();
  });
  await page.goto(`http://127.0.0.1:${port}/`);
  const firstPageWords = vocabData.slice(0, 24).map(({ word }) => word.toLowerCase());
  await page.evaluate((firstPageWords) => {
    firstPageWords.forEach((word) => {
      const contextExamples = Array.from({ length: 5 }, (_, index) => ({
        context: `context-${index + 1}`,
        en: `A natural example for ${word} in situation number ${index + 1}.`,
        vi: `Một ví dụ tự nhiên cho ${word} trong tình huống số ${index + 1}.`,
      }));
      localStorage.setItem(`lingogoc_vocab_enrichment_v3_${word}`, JSON.stringify({
        schemaVersion: 1,
        savedAt: '2026-09-24T00:00:00.000Z',
        data: {
          primaryMeaningVi: word === 'abandon' ? 'từ bỏ; bỏ rơi' : `nghĩa tiếng Việt của ${word}`,
          contextExamples,
          persistedOnServer: true,
        },
      }));
    });
  }, firstPageWords);
  await page.reload();

  await page.locator('.mobile-bottom-nav button').filter({ hasText: 'Từ vựng' }).click();
  await page.locator('.vocab-view').waitFor();
  await page.locator('.vocab-cards-grid').waitFor();
  await page.waitForTimeout(300);
  assert.equal(vocabularyBatchRequests, 0, 'a locally complete page must not call the vocabulary batch API');
  assert.equal(
    await page.getByRole('button', { name: /Danh Sách/ }).getAttribute('class').then((value) => value.includes('active')),
    true,
    'the 3,000-word catalog list must be the default vocabulary surface',
  );
  const mobileSummaryGeometry = await page.locator('.item-example-box').evaluateAll((nodes) => nodes.slice(0, 8).map((node) => ({
    height: node.getBoundingClientRect().height,
    visible: Boolean(node.offsetWidth || node.offsetHeight),
  })));
  assert.equal(mobileSummaryGeometry.length > 0, true, 'catalog cards must render example-summary frames');
  assert.equal(mobileSummaryGeometry.every(({ height, visible }) => visible && Math.abs(height - 142) < 1), true, 'mobile example-summary frames must have one fixed height');

  const unresolvedWord = firstPageWords.at(-1);
  await page.evaluate((word) => localStorage.removeItem(`lingogoc_vocab_enrichment_v3_${word}`), unresolvedWord);
  await page.reload();
  await page.locator('.mobile-bottom-nav button').filter({ hasText: 'Từ vựng' }).click();
  await page.locator('.vocab-cards-grid').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.item-example-box').length === 24);
  for (let attempt = 0; attempt < 30 && vocabularyBatchRequests === 0; attempt += 1) {
    await page.waitForTimeout(50);
  }
  assert.equal(vocabularyBatchRequests, 1, 'one unresolved local word must trigger one batch request');
  assert.deepEqual(
    vocabularyBatchBodies[0].items.map(({ word }) => word.toLowerCase()),
    [unresolvedWord],
    'the batch request must contain only the unresolved word',
  );
  const unresolvedCard = page.locator('.vocab-item-card').filter({ has: page.getByText(unresolvedWord, { exact: true }) });
  await unresolvedCard.getByRole('button', { name: 'Thử lại AI' }).click();
  await unresolvedCard.getByText('5/5 ngữ cảnh đã sẵn sàng', { exact: true }).waitFor();
  assert.equal(vocabularyEnrichmentRequests, 1, 'manual retry must make one bounded enrichment request');
  assert.equal(vocabularyBatchRequests, 1, 'manual retry success must render directly without another batch read');
  await page.getByRole('button', { name: /Thẻ Nhớ 3D/ }).click();
  const search = page.locator('.vocab-search-input');
  await search.fill('ability');
  await page.locator('.card-word-text').getByText('ability', { exact: true }).waitFor();
  await page.locator('.clear-search-btn').click();
  await page.locator('.card-word-text').getByText('abandon', { exact: true }).waitFor();
  await page.locator('.flashcard-scene').click();
  await page.locator('.meaning-highlight').getByText('từ bỏ; bỏ rơi', { exact: true }).waitFor();
  const flipButton = page.locator('.fc-flip-btn');
  await flipButton.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await flipButton.click();
  await page.waitForFunction(() => !document.querySelector('.flashcard-scene')?.classList.contains('is-flipped'));
  const detailButton = page.getByRole('button', { name: 'Nghĩa & ví dụ' });
  await detailButton.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await detailButton.click();
  const modal = page.locator('.word-detail-modal-card');
  await modal.waitFor();
  assert.equal(await modal.locator('.word-detail-example-row').count(), 5, 'detail modal must show the five cached contexts');
  await page.waitForTimeout(500);
  const modalLayout = await modal.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, viewportHeight: innerHeight };
  });
  assert.ok(
    modalLayout.top >= -1 && modalLayout.bottom <= modalLayout.viewportHeight + 1,
    `detail modal must fit the mobile viewport: ${JSON.stringify(modalLayout)}`,
  );
  await page.getByRole('button', { name: 'Đóng chi tiết từ vựng' }).click();

  await page.getByRole('button', { name: /Danh Sách/ }).click();
  const pageInput = page.locator('#vocabulary-page-input');
  await pageInput.fill('2');
  await page.getByRole('button', { name: 'Chuyển tới' }).click();
  await page.getByText(/Trang 2 \/ /).waitFor();
  const paginationOrder = await page.locator('.pagination-section').evaluate((section) => {
    const buttons = section.querySelector('.pagination-bar').getBoundingClientRect();
    const jump = section.querySelector('.page-jump-form').getBoundingClientRect();
    return { jumpBelowButtons: jump.top >= buttons.bottom - 1 };
  });
  assert.equal(paginationOrder.jumpBelowButtons, true, 'page jump must remain below previous/next controls');

  await page.getByRole('button', { name: /Trắc Nghiệm Phản Xạ/ }).click();
  const quizOptions = page.locator('.quiz-opt-btn');
  await quizOptions.first().waitFor();
  await quizOptions.first().click();
  await page.locator('.quiz-answer-explanation').waitFor();
  const quizReviews = await page.evaluate(() => JSON.parse(localStorage.getItem('lingogoc_srs_records_v1') || '{}'));
  assert.ok(Object.keys(quizReviews).length > 0, 'every quiz answer must update its word review schedule');

  await page.locator('.mobile-bottom-nav button').filter({ hasText: 'Ôn tập' }).click();
  await page.locator('.srs-card').waitFor();
  await page.getByRole('button', { name: /Lật thẻ xem nghĩa/ }).click();
  const grades = page.locator('.srs-grade-options button');
  assert.equal(await grades.count(), 4, 'review must expose exactly four deterministic grades');
  const gradeLabels = await grades.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')));
  assert.deepEqual(gradeLabels.map((label) => label.split(':')[0]), ['Quên', 'Khó', 'Tốt', 'Dễ']);
  await grades.nth(3).click();
  const savedReview = await page.evaluate(() => JSON.parse(localStorage.getItem('lingogoc_srs_records_v1') || '{}'));
  assert.ok(Object.keys(savedReview).length > 0, 'choosing a grade must persist the review schedule');
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    false,
    'vocabulary and SRS controls must not create horizontal overflow',
  );

  const desktopPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await desktopPage.route('https://lingogoc-api.lingogoc-api.workers.dev/**', (route) => route.abort());
  await desktopPage.goto(`http://127.0.0.1:${port}/`);
  await desktopPage.locator('#tab-vocab').click();
  await desktopPage.locator('.vocab-cards-grid').waitFor();
  const desktopGeometry = await desktopPage.locator('.vocab-item-card').evaluateAll((cards) => cards.slice(0, 4).map((card) => ({
    cardHeight: card.getBoundingClientRect().height,
    summaryHeight: card.querySelector('.item-example-box')?.getBoundingClientRect().height || 0,
    summaryVisible: Boolean(card.querySelector('.item-example-box')?.offsetHeight),
  })));
  assert.equal(desktopGeometry.length >= 3, true, 'desktop catalog must render a complete first row');
  assert.equal(new Set(desktopGeometry.map(({ cardHeight }) => Math.round(cardHeight))).size, 1, 'desktop cards in a row must align');
  assert.equal(desktopGeometry.every(({ summaryHeight, summaryVisible }) => summaryVisible && Math.abs(summaryHeight - 142) < 1), true, 'desktop example-summary frames must align');
  await desktopPage.close();

  console.log('Mobile and desktop vocabulary/SRS browser checks passed.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
