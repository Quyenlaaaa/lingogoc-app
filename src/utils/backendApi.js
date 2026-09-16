const configuredBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');

if (typeof window !== 'undefined') {
  try {
    [
      'lingogoc_gemini_api_key',
      'lingogoc_cambridge_dictionary_config_v1',
      'lingogoc_speaking_ai_config_v1',
    ].forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage may be unavailable in private browsing; backend mode still works.
  }
}

export function hasBackendApi() {
  return Boolean(configuredBaseUrl);
}

export function getBackendUrl(path) {
  if (!configuredBaseUrl) return '';
  const cleanPath = String(path || '').startsWith('/') ? path : `/${path}`;
  return `${configuredBaseUrl}${cleanPath}`;
}

export async function readJsonResponse(response, fallback = 'Máy chủ trả về dữ liệu không hợp lệ.') {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(fallback);
  }
}

export async function readBackendError(response, fallback = 'Không thể kết nối máy chủ AI.') {
  try {
    const payload = await readJsonResponse(response, fallback);
    return payload?.error?.message || payload?.error || payload?.message || fallback;
  } catch {
    return response.status ? `${fallback} (HTTP ${response.status})` : fallback;
  }
}
