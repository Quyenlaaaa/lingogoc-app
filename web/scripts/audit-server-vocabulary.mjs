import { isLowQualityMeaning, isValidIpa } from '../src/utils/vocabularyQuality.js';

const args = new Set(process.argv.slice(2));
const requiredConfirmation = '--allow-production-cache-reads';
if (!args.has(requiredConfirmation)) {
  console.log(JSON.stringify({
    executed: false,
    reason: 'CONFIRMATION_REQUIRED',
    message: `Audit server không được chạy mặc định. Thêm ${requiredConfirmation} khi đã xác nhận phạm vi.`,
    warning: 'Endpoint batch có thể quảng bá bản ghi Edge Cache hợp lệ vào KV. Lệnh thực hiện tối đa 125 POST và không gọi endpoint enrich.',
  }, null, 2));
  process.exit(0);
}

const apiBase = String(process.env.LINGOGOC_API_BASE_URL || 'https://lingogoc-api.lingogoc-api.workers.dev').replace(/\/+$/, '');
const batchSize = 24;
const concurrency = 1;

async function readJson(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

const catalogPayload = await readJson('/api/vocabulary/catalog');
const words = Array.isArray(catalogPayload?.data?.words) ? catalogPayload.data.words : [];
if (words.length !== 3000) throw new Error(`Expected 3000 catalog words, received ${words.length}`);

const batches = [];
for (let index = 0; index < words.length; index += batchSize) batches.push(words.slice(index, index + batchSize));

const records = new Map();
const failedBatches = [];
let nextBatchIndex = 0;
let completedBatches = 0;

async function auditBatchWorker() {
  while (nextBatchIndex < batches.length) {
    const batchIndex = nextBatchIndex;
    nextBatchIndex += 1;
    const batch = batches[batchIndex];
    try {
      const payload = await readJson('/api/vocabulary/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: batch.map((item) => ({ word: item.word, pos: item.pos || item.type || '' })) }),
      });
      for (const record of payload?.data?.items || []) records.set(record.word, record);
    } catch (error) {
      failedBatches.push({ batchIndex, message: error.message });
    }
    completedBatches += 1;
    if (completedBatches % 25 === 0 || completedBatches === batches.length) {
      console.error(`Audited ${Math.min(completedBatches * batchSize, words.length)}/${words.length} words...`);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => auditBatchWorker()));

const issueSamples = [];
const counts = {
  catalogWords: words.length,
  uniqueWords: new Set(words.map((item) => String(item.word).toLowerCase())).size,
  invalidIpa: 0,
  serverRecords: records.size,
  completeFiveContexts: 0,
  incompleteExamples: 0,
  clearVietnameseMeaning: 0,
  lowQualityResolvedMeaning: 0,
  missingServerRecord: 0,
};

for (const word of words) {
  if (!isValidIpa(word.ipa, word.word)) counts.invalidIpa += 1;
  const record = records.get(String(word.word).toLowerCase());
  const enrichment = record?.enrichment;
  const examples = Array.isArray(enrichment?.contextExamples) ? enrichment.contextExamples : [];
  const contexts = new Set(examples.map((item) => String(item.context || '').trim().toLowerCase()).filter(Boolean));
  const hasFiveContexts = examples.length === 5 && contexts.size === 5
    && examples.every((item) => String(item.en || '').trim() && String(item.vi || '').trim());
  const resolvedMeaning = enrichment?.primaryMeaningVi || record?.meaningVi || word.meaning || '';
  const meaningIsLowQuality = isLowQualityMeaning(resolvedMeaning);

  if (!record) counts.missingServerRecord += 1;
  if (hasFiveContexts) counts.completeFiveContexts += 1;
  else counts.incompleteExamples += 1;
  if (meaningIsLowQuality) counts.lowQualityResolvedMeaning += 1;
  else counts.clearVietnameseMeaning += 1;

  if ((!hasFiveContexts || meaningIsLowQuality) && issueSamples.length < 100) {
    issueSamples.push({
      word: word.word,
      meaning: resolvedMeaning,
      exampleCount: examples.length,
      distinctContexts: contexts.size,
      serverStatus: record?.status || 'missing',
    });
  }
}

const report = {
  checkedAt: new Date().toISOString(),
  apiBase,
  mutationNotice: 'Batch reads may promote valid Edge Cache records into KV; enrich is never called by this script.',
  ...counts,
  failedBatchCount: failedBatches.length,
  releaseReady: counts.catalogWords === 3000
    && counts.uniqueWords === 3000
    && counts.invalidIpa === 0
    && counts.completeFiveContexts === 3000
    && counts.clearVietnameseMeaning === 3000
    && failedBatches.length === 0,
  failedBatches,
  issueSamples,
};

console.log(JSON.stringify(report, null, 2));
if (args.has('--strict') && !report.releaseReady) process.exitCode = 1;
