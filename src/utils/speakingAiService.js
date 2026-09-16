const CONFIG_KEY = 'lingogoc_speaking_ai_config_v1';

export const DEFAULT_SPEAKING_CONFIG = {
  baseUrl: 'https://api.xkiro.com/v1',
  apiKey: '',
  model: '',
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
    return { ...DEFAULT_SPEAKING_CONFIG, ...stored, baseUrl: normalizeBaseUrl(stored.baseUrl) };
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
      accessTier: item.access_tier || item.tier || 'unknown',
    }))
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

  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: authHeaders(config, true),
    signal,
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'system', content: systemPrompt }, ...recentHistory],
      temperature: 0.65,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Model không trả về nội dung. Hãy thử lại hoặc chọn model khác.');
  return parseAssistantContent(content);
}

export async function requestCloudSpeech({ config, text, signal }) {
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
