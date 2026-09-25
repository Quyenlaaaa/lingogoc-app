import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const inputArg = args.find((value) => value.startsWith('--input='));
const outputArg = args.find((value) => value.startsWith('--output-dir='));
const writeSql = args.includes('--write-sql');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = outputArg
  ? path.resolve(root, outputArg.slice('--output-dir='.length))
  : path.join(root, 'scripts', 'data_cache', 'd1-migration');

if (!inputArg) {
  console.log(JSON.stringify({
    executed: false,
    mode: 'dry-run',
    reason: 'INPUT_REQUIRED',
    usage: 'npm run migrate:vocab-d1 -- --input=<KV-export.json> [--write-sql]',
    safety: 'Lệnh mặc định không kết nối Cloudflare và không ghi D1. --write-sql chỉ tạo file SQL cục bộ trong data_cache.',
  }, null, 2));
  process.exit(0);
}

function parseExport(text) {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed).map(([key, value]) => ({ key, value }));
    }
  } catch {
    const records = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    if (records.length) return records;
  }
  throw new Error('KV export must be a JSON array, object map, or JSON Lines file.');
}

function decodeValue(value) {
  if (typeof value === 'string') return JSON.parse(value);
  if (value && typeof value === 'object') return value;
  throw new Error('KV record value is not JSON.');
}

function sqlString(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

const inputPath = path.resolve(root, inputArg.slice('--input='.length));
const sourceText = await readFile(inputPath, 'utf8');
const sourceHash = createHash('sha256').update(sourceText).digest('hex');
const sourceRecords = parseExport(sourceText);
const accepted = [];
const rejected = [];

for (const entry of sourceRecords) {
  const key = String(entry?.key || '');
  if (!key.startsWith('vocabulary:v2:')) continue;
  try {
    const payload = decodeValue(entry.value);
    const word = String(payload?.word || '').trim().toLowerCase();
    if (!word || !/^[a-z][a-z '-]*$/i.test(word)) throw new Error('INVALID_WORD');
    const examples = Array.isArray(payload?.contextExamples) ? payload.contextExamples : [];
    const status = payload?.status === 'complete' || examples.length === 5 ? 'complete' : 'partial';
    accepted.push({
      cacheKey: key,
      word,
      status,
      payload,
      provider: String(payload?.generatedByProvider || ''),
      model: String(payload?.generatedByModel || ''),
      updatedAt: String(payload?.serverSavedAt || new Date(0).toISOString()),
    });
  } catch (error) {
    rejected.push({ key, reason: String(error?.message || 'INVALID_RECORD') });
  }
}

const statements = accepted.map((record) => `INSERT INTO vocabulary_enrichments (cache_key, word, prompt_version, status, payload_json, provider, model, updated_at) VALUES (${sqlString(record.cacheKey)}, ${sqlString(record.word)}, 2, ${sqlString(record.status)}, ${sqlString(JSON.stringify(record.payload))}, ${sqlString(record.provider)}, ${sqlString(record.model)}, ${sqlString(record.updatedAt)}) ON CONFLICT(cache_key) DO UPDATE SET status=excluded.status, payload_json=excluded.payload_json, provider=excluded.provider, model=excluded.model, updated_at=excluded.updated_at;`);

const report = {
  executed: false,
  mode: writeSql ? 'prepare-sql' : 'dry-run',
  inputPath,
  sourceHash,
  sourceRecords: sourceRecords.length,
  accepted: accepted.length,
  complete: accepted.filter((item) => item.status === 'complete').length,
  partial: accepted.filter((item) => item.status === 'partial').length,
  rejected: rejected.length,
  rejectedSamples: rejected.slice(0, 25),
  idempotencyKey: `kv-export:${sourceHash}`,
};

if (writeSql) {
  await mkdir(outputDirectory, { recursive: true });
  const sqlPath = path.join(outputDirectory, `${sourceHash}.sql`);
  const checkpointPath = path.join(outputDirectory, `${sourceHash}.checkpoint.json`);
  const sql = [
    'BEGIN TRANSACTION;',
    ...statements,
    'COMMIT;',
    '',
  ].join('\n');
  await writeFile(sqlPath, sql, 'utf8');
  await writeFile(checkpointPath, `${JSON.stringify({
    ...report,
    preparedAt: new Date().toISOString(),
    sqlPath,
    applied: false,
  }, null, 2)}\n`, 'utf8');
  report.sqlPath = sqlPath;
  report.checkpointPath = checkpointPath;
}

console.log(JSON.stringify(report, null, 2));
if (rejected.length) process.exitCode = 1;
