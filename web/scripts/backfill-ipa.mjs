import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vocabData } from '../src/data/vocabData.js';
import { normalizeIpa, sanitizeBundledVocabulary } from '../src/utils/vocabularyQuality.js';

const SOURCES = [
  'https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/en_US.txt',
  'https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/en_UK.txt',
];
const SPELLING_ALIASES = new Map([['offence', 'offense']]);

function parseDictionary(text) {
  const entries = new Map();
  text.split(/\r?\n/).forEach((line) => {
    const [entry, pronunciations] = line.split('\t');
    const pronunciation = String(pronunciations || '').split(', ')[0].trim();
    if (entry && pronunciation && !entries.has(entry.toLowerCase())) {
      entries.set(entry.toLowerCase(), pronunciation);
    }
  });
  return entries;
}

function stripSlashes(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '');
}

function lookupPronunciation(word, dictionaries) {
  const key = word.toLowerCase();
  const alias = SPELLING_ALIASES.get(key);
  for (const dictionary of dictionaries) {
    const exact = dictionary.get(key) || (alias ? dictionary.get(alias) : '');
    if (exact) return exact;
  }

  const parts = key.split(/\s+/).map((part) => {
    for (const dictionary of dictionaries) {
      const pronunciation = dictionary.get(part);
      if (pronunciation) return stripSlashes(pronunciation);
    }
    return '';
  });
  return parts.length > 1 && parts.every(Boolean) ? `/${parts.join(' ')}/` : '';
}

const dictionaries = await Promise.all(SOURCES.map(async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download IPA dictionary: HTTP ${response.status}`);
  return parseDictionary(await response.text());
}));

const words = sanitizeBundledVocabulary(vocabData).map((item) => {
  if (item.ipa) return item;
  const ipa = normalizeIpa(lookupPronunciation(item.word, dictionaries), item.word);
  return { ...item, ipa };
});
const unresolved = words.filter((item) => !item.ipa);
if (words.length !== 3000 || unresolved.length) {
  throw new Error(`IPA backfill incomplete: ${words.length} words, ${unresolved.length} unresolved.`);
}

const outputPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/vocabData.js');
const output = `// LingoGoc system vocabulary. IPA backfilled from open-dict-data/ipa-dict (MIT).\nexport const vocabData = ${JSON.stringify(words, null, 2)};\n\nexport default vocabData;\n`;
await writeFile(outputPath, output, 'utf8');
console.log(`Updated ${words.length} words; every word now has validated IPA.`);
