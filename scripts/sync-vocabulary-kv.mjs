import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { vocabData } from '../src/data/vocabData.js';
import { sanitizeBundledVocabulary } from '../src/utils/vocabularyQuality.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const words = sanitizeBundledVocabulary(vocabData);
if (words.length !== 3000) {
  throw new Error(`Refusing to sync an incomplete catalog: expected 3000 words, received ${words.length}.`);
}

const canonicalWords = JSON.stringify(words);
const contentHash = createHash('sha256').update(canonicalWords).digest('hex');
const catalog = {
  schemaVersion: 1,
  contentHash,
  updatedAt: new Date().toISOString(),
  count: words.length,
  enrichmentPromptVersion: 2,
  words,
};

if (process.argv.includes('--dry-run')) {
  console.log(`System vocabulary is valid: ${words.length} words, SHA-256 ${contentHash}`);
  process.exit(0);
}

const tempDirectory = await mkdtemp(path.join(tmpdir(), 'lingogoc-vocabulary-'));
const bulkFile = path.join(tempDirectory, 'catalog.json');
try {
  await writeFile(bulkFile, JSON.stringify([{
    key: 'system-vocabulary:v1',
    value: JSON.stringify(catalog),
    metadata: { schemaVersion: 1, count: words.length, contentHash },
  }]), 'utf8');

  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const mode = process.argv.includes('--local') ? '--local' : '--remote';
  const wranglerArguments = [
    'wrangler', 'kv', 'bulk', 'put', bulkFile,
    '--binding', 'VOCAB_CACHE',
    mode,
    '--config', path.join(root, 'backend', 'wrangler.toml'),
  ];
  const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : npx;
  const commandArguments = process.platform === 'win32'
    ? ['/d', '/s', '/c', npx, ...wranglerArguments]
    : wranglerArguments;
  const result = spawnSync(command, commandArguments, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
  console.log(`Synced ${words.length} system words to Workers KV (${contentHash}).`);
} finally {
  await rm(tempDirectory, { recursive: true, force: true });
}
