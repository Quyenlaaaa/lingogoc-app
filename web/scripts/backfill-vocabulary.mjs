import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkpointPath = path.join(root, 'scripts', 'data_cache', 'vocabulary-backfill-state.json');
const apiBaseUrl = String(process.env.LINGOGOC_API_BASE_URL || 'https://lingogoc-api.lingogoc-api.workers.dev').replace(/\/+$/, '');
const limitArg = process.argv.find((value) => value.startsWith('--limit='));
const dailyLimit = Math.max(1, Math.min(800, Number(limitArg?.split('=')[1] || 100)));
const delayArg = process.argv.find((value) => value.startsWith('--delay='));
const delayMs = Math.max(700, Number(delayArg?.split('=')[1] || 900));

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function request(pathname, options = {}) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(payload?.error || `HTTP_${response.status}`);
    error.status = response.status;
    error.code = payload?.code;
    error.retryable = payload?.retryable;
    throw error;
  }
  return payload;
}

async function loadCheckpoint(contentHash) {
  try {
    const parsed = JSON.parse(await readFile(checkpointPath, 'utf8'));
    if (parsed.contentHash === contentHash) return parsed;
  } catch {
    // A missing checkpoint starts a fresh deterministic scan.
  }
  return { contentHash, cursor: 0, generated: 0, passes: 0, updatedAt: null };
}

async function saveCheckpoint(checkpoint) {
  await mkdir(path.dirname(checkpointPath), { recursive: true });
  await writeFile(checkpointPath, JSON.stringify({ ...checkpoint, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
}

const catalogPayload = await request('/api/vocabulary/catalog');
const catalog = catalogPayload?.data;
if (!Array.isArray(catalog?.words) || catalog.words.length !== 3000) {
  throw new Error('Production catalog is not a valid 3000-word release.');
}

const checkpoint = await loadCheckpoint(catalog.contentHash);
let generatedThisRun = 0;
let attemptedThisRun = 0;
let scannedThisRun = 0;
let cachedThisRun = 0;
let failuresThisRun = 0;

function isTerminalProviderFailure(error) {
  const detail = `${error?.code || ''} ${error?.message || ''}`;
  return error?.status === 429
    || error?.status === 402
    || error?.retryable === false
    || /AI_PROVIDER_(?:400|401|402|403|429)|quota|daily.?limit|balance|billing|permission_denied/i.test(detail);
}

while (attemptedThisRun < dailyLimit && scannedThisRun < catalog.words.length) {
  const start = checkpoint.cursor;
  const remaining = catalog.words.length - start;
  const batchSize = Math.min(24, remaining);
  const batch = catalog.words.slice(start, start + batchSize);
  const batchPayload = await request('/api/vocabulary/batch', {
    method: 'POST',
    body: JSON.stringify({ items: batch.map((item) => ({ word: item.word, pos: item.pos })) }),
  });
  const needsEnrichment = new Set(batchPayload?.data?.needsEnrichment || []);

  for (const item of batch) {
    if (!needsEnrichment.has(item.word.toLowerCase())) {
      checkpoint.cursor += 1;
      scannedThisRun += 1;
      cachedThisRun += 1;
      continue;
    }
    if (attemptedThisRun >= dailyLimit) break;
    attemptedThisRun += 1;
    try {
      await request('/api/vocabulary/enrich', {
        method: 'POST',
        body: JSON.stringify({ word: item.word, meaning: item.meaning, topic: item.topic }),
      });
      checkpoint.cursor += 1;
      scannedThisRun += 1;
      generatedThisRun += 1;
      checkpoint.generated += 1;
      console.log(`[${attemptedThisRun}/${dailyLimit}] enriched ${item.word}`);
    } catch (error) {
      failuresThisRun += 1;
      console.warn(`Failed ${item.word}: ${error.code || error.message}`);
      if (isTerminalProviderFailure(error)) {
        await saveCheckpoint(checkpoint);
        console.log('Stopped safely because the provider or daily budget is unavailable.');
        process.exit(0);
      }
      checkpoint.cursor += 1;
      scannedThisRun += 1;
    }
    await saveCheckpoint(checkpoint);
    await wait(delayMs);
  }

  if (checkpoint.cursor >= catalog.words.length) {
    checkpoint.cursor = 0;
    checkpoint.passes += 1;
  }
  await saveCheckpoint(checkpoint);
}

console.log(JSON.stringify({
  contentHash: checkpoint.contentHash,
  cursor: checkpoint.cursor,
  passes: checkpoint.passes,
  generatedThisRun,
  attemptedThisRun,
  cachedThisRun,
  failuresThisRun,
  scannedThisRun,
}, null, 2));
