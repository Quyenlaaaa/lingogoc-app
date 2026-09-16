const CONFIG_KEY = 'lingogoc_speaking_ai_config_v1';

export const SPEAKING_PROVIDERS = {
  openrouter: {
    label: 'OpenRouter Free',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openrouter/free',
    note: 'Tự động chọn một model miễn phí đang khả dụng.',
  },
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-3.8-flash',
    note: 'Có free tier theo quota của Google AI Studio.',
  },
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'openai/gpt-oss-20b',
    note: 'Phản hồi nhanh, có giới hạn developer theo tài khoản.',
  },
  xkiro: {
    label: 'xKiro',
    baseUrl: 'https://api.xkiro.com/v1',
    model: '',
    note: 'Danh mục tổng hợp; chọn model được gắn nhãn Free.',
  },
  custom: {
    label: 'API tương thích OpenAI',
    baseUrl: '',
    model: '',
    note: 'Dùng endpoint /chat/completions của nhà cung cấp riêng.',
  },
};

const env = import.meta.env || {};
const envProvider = env.VITE_SPEAKING_PROVIDER || 'openrouter';
const envPreset = SPEAKING_PROVIDERS[envProvider] || SPEAKING_PROVIDERS.openrouter;
const envAutoListen = String(env.VITE_SPEAKING_AUTO_LISTEN || 'true').toLowerCase() !== 'false';

export const DEFAULT_SPEAKING_CONFIG = {
  provider: envProvider,
  baseUrl: env.VITE_SPEAKING_BASE_URL || envPreset.baseUrl,
  apiKey: env.VITE_SPEAKING_API_KEY || '',
  model: env.VITE_SPEAKING_MODEL || envPreset.model,
  autoListen: envAutoListen,
  useCloudVoice: false,
  voice: '',
};

function normalizeBaseUrl(value) {
  return (value || DEFAULT_SPEAKING_CONFIG.baseUrl).trim().replace(/\/+$/, '');
}

function authHeaders(config, json = false) {
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (config.apiKey?.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`;
  if (config.provider === 'openrouter') {
    headers['X-OpenRouter-Title'] = 'LingoGoc AI Speaking';
    if (typeof window !== 'undefined') headers['HTTP-Referer'] = window.location.origin;
  }
  return headers;
}

async function readApiError(response) {
  let message = `API trả về lỗi ${response.status}`;
  try {
    const payload = await response.json();
    message = payload?.error?.message || payload?.message || message;
  } catch {
    // Keep the status-based message when the provider does not return JSON.
  }
  if (response.status === 401 || response.status === 403) {
    message = 'API key không hợp lệ hoặc chưa có quyền dùng model này.';
  }
  if (response.status === 429) {
    message = 'Đã chạm giới hạn miễn phí/tốc độ của model. Hãy thử model khác hoặc đợi một chút.';
  }
  return message;
}

export function loadSpeakingConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    const hasStoredKey = Boolean(stored.apiKey?.trim());
    const connection = hasStoredKey
      ? stored
      : {
          provider: DEFAULT_SPEAKING_CONFIG.provider,
          baseUrl: DEFAULT_SPEAKING_CONFIG.baseUrl,
          apiKey: DEFAULT_SPEAKING_CONFIG.apiKey,
          model: DEFAULT_SPEAKING_CONFIG.model,
        };
    return {
      ...DEFAULT_SPEAKING_CONFIG,
      ...stored,
      ...connection,
      baseUrl: normalizeBaseUrl(connection.baseUrl || stored.baseUrl),
    };
  } catch {
    return { ...DEFAULT_SPEAKING_CONFIG };
  }
}

export function saveSpeakingConfig(config) {
  const clean = { ...DEFAULT_SPEAKING_CONFIG, ...config, baseUrl: normalizeBaseUrl(config.baseUrl) };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(clean));
  return clean;
}

export async function fetchSpeakingModels(config, signal) {
  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/models`, {
    headers: authHeaders(config),
    signal,
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const payload = await response.json();
  const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];

  return rows
    .filter((item) => item?.id)
    .map((item) => ({
      id: item.id,
      name: item.name || item.display_name || item.id,
      accessTier: item.access_tier
        || item.tier
        || (item.id === 'openrouter/free' || item.id?.endsWith(':free') || (Number(item.pricing?.prompt) === 0 && Number(item.pricing?.completion) === 0) ? 'free' : 'unknown'),
    }))
    .concat(config.provider === 'openrouter' && !rows.some((item) => item.id === 'openrouter/free')
      ? [{ id: 'openrouter/free', name: 'OpenRouter Free Router', accessTier: 'free' }]
      : [])
    .sort((a, b) => {
      const freeOrder = Number(b.accessTier === 'free') - Number(a.accessTier === 'free');
      return freeOrder || a.name.localeCompare(b.name);
    });
}

function parseAssistantContent(content) {
  const plain = Array.isArray(content)
    ? content.map((part) => part?.text || '').join('')
    : String(content || '');
  const withoutFence = plain.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const jsonCandidate = withoutFence.match(/\{[\s\S]*\}/)?.[0];

  if (jsonCandidate) {
    try {
      const parsed = JSON.parse(jsonCandidate);
      return {
        replyEn: String(parsed.replyEn || parsed.reply_en || '').trim(),
        replyVi: String(parsed.replyVi || parsed.reply_vi || '').trim(),
        correction: String(parsed.correction || '').trim(),
        encouragement: String(parsed.encouragement || '').trim(),
        hints: Array.isArray(parsed.hints)
          ? parsed.hints.slice(0, 3).map((hint) => typeof hint === 'string' ? { en: hint, vi: '' } : hint)
          : [],
      };
    } catch {
      // Some compatible providers ignore JSON-only instructions; show their plain answer instead.
    }
  }

  return { replyEn: withoutFence, replyVi: '', correction: '', encouragement: '', hints: [] };
}

export async function requestSpeakingReply({ config, scenario, messages, signal }) {
  if (!config.apiKey?.trim()) throw new Error('Bạn cần nhập API key trước khi trò chuyện với AI.');
  if (!config.model) throw new Error('Bạn cần chọn một model hội thoại.');

  const recentHistory = messages.slice(-12).map((message) => ({
    role: message.sender === 'ai' ? 'assistant' : 'user',
    content: message.text,
  }));
  const systemPrompt = `Bạn là gia sư tiếng Anh thân thiện cho người Việt, đang nhập vai ${scenario.partnerName} trong tình huống "${scenario.titleEn || scenario.title}".
Mục tiêu là duy trì một cuộc hội thoại tự nhiên, phù hợp người học A1-B1. Trả lời bằng 1-3 câu tiếng Anh, hỏi tiếp đúng ngữ cảnh, không giảng dài dòng. Nếu câu của người học sai, sửa nhẹ nhàng và giải thích ngắn bằng tiếng Việt. Chỉ trả về một JSON hợp lệ, không dùng markdown, theo đúng cấu trúc:
{"replyEn":"...","replyVi":"Bản dịch tiếng Việt chính xác","correction":"Câu đúng hơn và giải thích ngắn; để trống nếu không cần sửa","encouragement":"Một lời động viên ngắn bằng tiếng Việt","hints":[{"en":"Câu trả lời gợi ý 1","vi":"Nghĩa Việt"},{"en":"Câu trả lời gợi ý 2","vi":"Nghĩa Việt"},{"en":"Câu trả lời gợi ý 3","vi":"Nghĩa Việt"}]}`;

  const requestBody = {
    model: config.model,
    messages: [{ role: 'system', content: systemPrompt }, ...recentHistory],
    temperature: 0.65,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  };
  const request = (body) => fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(config, true),
    signal,
    body: JSON.stringify(body),
  });
  let response = await request(requestBody);
  if (response.status === 400) {
    const { response_format: _unsupportedFormat, ...compatibleBody } = requestBody;
    response = await request(compatibleBody);
  }
  if (!response.ok) throw new Error(await readApiError(response));
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Model không trả về nội dung. Hãy thử lại hoặc chọn model khác.');
  return parseAssistantContent(content);
}

export async function requestCloudSpeech({ config, text, signal }) {
  if (config.provider !== 'xkiro') throw new Error('Giọng đọc cloud hiện chỉ hỗ trợ preset xKiro.');
  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/audio/speech`, {
    method: 'POST',
    headers: authHeaders(config, true),
    signal,
    body: JSON.stringify({
      model: 'xkiro-voice',
      input: text,
      ...(config.voice ? { voice: config.voice } : {}),
      response_format: 'mp3',
      speed: 0.95,
    }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  return URL.createObjectURL(await response.blob());
}
