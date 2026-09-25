import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [indexHtml, workerSource, workerConfig] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../backend/src/worker.js', import.meta.url), 'utf8'),
  readFile(new URL('../backend/wrangler.toml', import.meta.url), 'utf8'),
]);

assert.match(indexHtml, /Content-Security-Policy/);
assert.match(indexHtml, /script-src 'self'/);
assert.doesNotMatch(indexHtml, /script-src[^;]*'unsafe-eval'/);
assert.match(indexHtml, /object-src 'none'/);
assert.match(indexHtml, /https:\/\/lingogoc-api\.lingogoc-api\.workers\.dev/);
assert.match(indexHtml, /meta name="referrer" content="no-referrer"/);

assert.match(workerSource, /CF-Connecting-IP/);
assert.match(workerSource, /X-Content-Type-Options', 'nosniff'/);
assert.match(workerSource, /Strict-Transport-Security/);
assert.match(workerSource, /UNSUPPORTED_MEDIA_TYPE/);
assert.match(workerSource, /RATE_LIMITED/);

const allowedOrigins = workerConfig.match(/^ALLOWED_ORIGINS\s*=\s*"([^"]+)"/m)?.[1] || '';
assert.ok(allowedOrigins);
assert.equal(allowedOrigins.split(',').includes('*'), false, 'production CORS must never use a wildcard');
['READ', 'AI', 'ADMIN', 'AUDIO'].forEach((category) => {
  assert.match(workerConfig, new RegExp(`RATE_LIMIT_${category}_PER_MINUTE\\s*=\\s*"\\d+"`));
});

console.log('Frontend CSP and Worker protection configuration checks passed.');
