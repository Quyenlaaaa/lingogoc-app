import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const component = await readFile(new URL('../src/components/VocabularyAdminView.jsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

assert.match(app, /URLSearchParams\(window\.location\.search\).*admin/s);
assert.match(app, /lazy\(\(\) => import\('\.\/components\/VocabularyAdminView'\)\)/);
assert.doesNotMatch(component, /localStorage|sessionStorage/);
assert.match(component, /type="password"/);
assert.match(component, /Authorization: `Bearer \$\{adminKey\}`/);
assert.match(component, /\/api\/admin\/vocabulary\/retry/);
assert.match(component, /\/api\/admin\/vocabulary\/correction/);
assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.vocab-admin-stats/);

console.log('Vocabulary administration UI checks passed.');
