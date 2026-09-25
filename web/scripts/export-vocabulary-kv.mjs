import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const namespaceArg = args.find((value) => value.startsWith('--namespace-id='));
const outputArg = args.find((value) => value.startsWith('--output='));

if (!namespaceArg) {
  console.error('Usage: node scripts/export-vocabulary-kv.mjs --namespace-id=<id> [--output=<file>]');
  process.exit(1);
}

const namespaceId = namespaceArg.slice('--namespace-id='.length).trim();
if (!/^[a-f0-9]{32}$/i.test(namespaceId)) {
  throw new Error('Invalid KV namespace ID.');
}

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = outputArg
  ? path.resolve(webRoot, outputArg.slice('--output='.length))
  : path.join(webRoot, 'scripts', 'data_cache', 'kv-vocabulary-export.json');
const npxCli = process.platform === 'win32'
  ? path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js')
  : null;

function runWrangler(commandArgs) {
  const executable = npxCli ? process.execPath : 'npx';
  const executableArgs = npxCli
    ? [npxCli, 'wrangler', ...commandArgs]
    : ['wrangler', ...commandArgs];
  return execFileSync(executable, executableArgs, {
    cwd: path.join(webRoot, 'backend'),
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

const listed = JSON.parse(runWrangler([
  'kv', 'key', 'list',
  '--namespace-id', namespaceId,
  '--prefix', 'vocabulary:v2:',
  '--remote',
]));
const keys = listed.map((entry) => entry?.name).filter(Boolean);
if (!keys.length) throw new Error('No vocabulary:v2:* keys found in KV.');

await mkdir(path.dirname(outputPath), { recursive: true });
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'lingogoc-kv-export-'));
const exported = {};

try {
  for (let offset = 0; offset < keys.length; offset += 100) {
    const batch = keys.slice(offset, offset + 100);
    const keyFile = path.join(temporaryDirectory, `keys-${String(offset).padStart(5, '0')}.json`);
    await writeFile(keyFile, JSON.stringify(batch), 'utf8');
    const values = JSON.parse(runWrangler([
      'kv', 'bulk', 'get', keyFile,
      '--namespace-id', namespaceId,
      '--remote',
    ]));
    Object.assign(exported, values);
    console.log(`Exported ${Math.min(offset + batch.length, keys.length)}/${keys.length}`);
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

if (Object.keys(exported).length !== keys.length) {
  throw new Error(`KV export incomplete: expected ${keys.length}, received ${Object.keys(exported).length}.`);
}

await writeFile(outputPath, `${JSON.stringify(exported)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, keys: keys.length }, null, 2));
