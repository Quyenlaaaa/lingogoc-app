const CONFIG_KEY = 'lingogoc_cambridge_dictionary_config_v1';
const CACHE_PREFIX = 'lingogoc_cambridge_entry_v1_';
const DEFAULT_CONFIG = {
  accessKey: '',
  dictionaryCode: 'british',
  baseUrl: 'https://dictionary.cambridge.org/api/v1',
};

const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();

export function loadCambridgeConfig() {
  if (typeof window === 'undefined') return { ...DEFAULT_CONFIG };
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveCambridgeConfig(config) {
  const clean = {
    ...DEFAULT_CONFIG,
    ...config,
    accessKey: config.accessKey?.trim() || '',
    dictionaryCode: config.dictionaryCode?.trim() || DEFAULT_CONFIG.dictionaryCode,
    baseUrl: (config.baseUrl || DEFAULT_CONFIG.baseUrl).trim().replace(/\/+$/, ''),
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(clean));
  return clean;
}

function unique(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.toLocaleLowerCase('en');
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractCambridgeContent(entryContent) {
  if (!entryContent || typeof DOMParser === 'undefined') return { examples: [], definitions: [], phonetic: '' };
  const document = new DOMParser().parseFromString(entryContent, 'text/html');
  const collect = (selectors, limit) => {
    const values = [];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        const value = normalize(node.textContent);
        if (value && values.length < limit) values.push(value);
      });
    });
    return unique(values).slice(0, limit);
  };

  return {
    examples: collect(['.examp .eg', '.examp', '.eg', '[class*="example"]'], 10),
    definitions: collect(['.def', '[class*="definition"]'], 8),
    phonetic: collect(['.ipa', '.pron', '[class*="phonetic"]'], 1)[0] || '',
  };
}

async function readError(response) {
  if (response.status === 403) return 'Cambridge accessKey không hợp lệ hoặc chưa được cấp quyền cho bộ từ điển này.';
  if (response.status === 404) return 'Không tìm thấy từ hoặc dictionary code không hợp lệ.';
  try {
    const data = await response.json();
    return data.errorMessage || data.message || `Cambridge API trả về lỗi ${response.status}.`;
  } catch {
    return `Cambridge API trả về lỗi ${response.status}.`;
  }
}

export async function fetchCambridgeWordData(word, config = loadCambridgeConfig(), signal) {
  if (!word || !config.accessKey) return null;
  const cleanWord = word.trim().toLowerCase();
  const cacheKey = `${CACHE_PREFIX}${config.dictionaryCode}_${cleanWord}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return { ...JSON.parse(cached), fromCache: true };
  } catch {
    // Continue with a live request when cache is unavailable.
  }

  const url = `${config.baseUrl.replace(/\/+$/, '')}/dictionaries/${encodeURIComponent(config.dictionaryCode)}/search/first?format=html&q=${encodeURIComponent(cleanWord)}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json', accessKey: config.accessKey },
    signal,
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = await response.json();
  const entry = payload.entry || payload;
  const extracted = extractCambridgeContent(entry.entryContent);
  const result = {
    word: entry.entryLabel || cleanWord,
    entryId: entry.entryId || '',
    entryUrl: entry.entryUrl || '',
    dictionaryCode: entry.dictionaryCode || config.dictionaryCode,
    ...extracted,
  };
  try {
    localStorage.setItem(cacheKey, JSON.stringify(result));
  } catch {
    // Cache is an optimization only.
  }
  return result;
}
