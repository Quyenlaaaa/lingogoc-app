import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationScript = path.join(scriptsDirectory, 'prepare-d1-vocabulary-migration.mjs');
const adminMigration = path.join(scriptsDirectory, '..', 'backend', 'migrations', '0002_vocabulary_admin_audit.sql');

const adminMigrationSql = await readFile(adminMigration, 'utf8');
assert.match(adminMigrationSql, /CREATE TABLE IF NOT EXISTS vocabulary_admin_events/);
assert.match(adminMigrationSql, /CREATE INDEX IF NOT EXISTS idx_vocabulary_admin_events_word/);

const safeDefault = spawnSync(process.execPath, [migrationScript], { encoding: 'utf8' });
assert.equal(safeDefault.status, 0);
assert.equal(JSON.parse(safeDefault.stdout).reason, 'INPUT_REQUIRED');

const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'lingogoc-d1-migration-test-'));
try {
  const inputPath = path.join(temporaryDirectory, 'kv-export.json');
  await writeFile(inputPath, JSON.stringify([
    {
      key: 'vocabulary:v2:complete-key',
      value: JSON.stringify({
        word: 'fire',
        primaryMeaningVi: "lửa của O'Brien",
        status: 'complete',
        contextExamples: Array.from({ length: 5 }, (_, index) => ({
          context: `context-${index}`,
          en: `Fire example ${index}.`,
          vi: `Ví dụ ${index}.`,
        })),
      }),
    },
    {
      key: 'vocabulary:v2:partial-key',
      value: { word: 'explore', primaryMeaningVi: 'khám phá', contextExamples: [] },
    },
    { key: 'system-vocabulary:v1', value: '{}' },
  ]), 'utf8');

  const prepared = spawnSync(process.execPath, [
    migrationScript,
    `--input=${inputPath}`,
    `--output-dir=${temporaryDirectory}`,
    '--write-sql',
  ], { encoding: 'utf8' });
  assert.equal(prepared.status, 0, prepared.stderr);
  const report = JSON.parse(prepared.stdout);
  assert.equal(report.executed, false);
  assert.equal(report.accepted, 2);
  assert.equal(report.complete, 1);
  assert.equal(report.partial, 1);
  const sql = await readFile(report.sqlPath, 'utf8');
  assert.match(sql, /ON CONFLICT\(cache_key\) DO UPDATE/);
  assert.match(sql, /O''Brien/);
  assert.doesNotMatch(sql, /BEGIN TRANSACTION|COMMIT;/);
  const checkpoint = JSON.parse(await readFile(report.checkpointPath, 'utf8'));
  assert.equal(checkpoint.applied, false);
  assert.equal(checkpoint.idempotencyKey, report.idempotencyKey);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log('D1 migration preparation checks passed.');
