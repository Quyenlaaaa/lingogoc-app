import { getBackendUrl, hasBackendApi, readBackendError, readJsonResponse } from './backendApi';

const CONFIG_KEY = 'lingogoc_speaking_preferences_v2';
const LEGACY_CONFIG_KEY = 'lingogoc_speaking_ai_config_v1';

export const DEFAULT_SPEAKING_CONFIG = {
  autoListen: String(import.meta.env.VITE_SPEAKING_AUTO_LISTEN || 'true').toLowerCase() !== 'false',
  useCloudVoice: true,
  voice: '',
};

export function loadSpeakingConfig() {
  try {
    // Remove legacy browser-stored credentials during the backend migration.
    localStorage.removeItem(LEGACY_CONFIG_KEY);
    const stored = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    return {
      ...DEFAULT_SPEAKING_CONFIG,
      autoListen: stored.autoListen ?? DEFAULT_SPEAKING_CONFIG.autoListen,
      useCloudVoice: stored.useCloudVoice ?? DEFAULT_SPEAKING_CONFIG.useCloudVoice,
      voice: typeof stored.voice === 'string' ? stored.voice : '',
    };
  } catch {
    return { ...DEFAULT_SPEAKING_CONFIG };
  }
}

export function saveSpeakingConfig(config) {
  const clean = {
    autoListen: Boolean(config.autoListen),
    useCloudVoice: Boolean(config.useCloudVoice),
    voice: typeof config.voice === 'string' ? config.voice : '',
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(clean));
  return clean;
}

function parseAssistantContent(content) {
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    return {
      replyEn: String(content.replyEn || content.reply_en || '').trim(),
      replyVi: String(content.replyVi || content.reply_vi || '').trim(),
      correction: String(content.correction || '').trim(),
      encouragement: String(content.encouragement || '').trim(),
      hints: Array.isArray(content.hints) ? content.hints.slice(0, 3) : [],
    };
  }

  const plain = Array.isArray(content)
    ? content.map((part) => part?.text || '').join('')
    : String(content || '');
  const withoutFence = plain.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const jsonCandidate = withoutFence.match(/\{[\s\S]*\}/)?.[0];
  if (jsonCandidate) {
    try {
      return parseAssistantContent(JSON.parse(jsonCandidate));
    } catch {
      // Return the provider's plain response below.
    }
  }
  return { replyEn: withoutFence, replyVi: '', correction: '', encouragement: '', hints: [] };
}

export async function requestSpeakingReply({ scenario, messages, signal }) {
  if (!hasBackendApi()) throw new Error('Backend AI chưa được cấu hình cho website này.');

  const response = await fetch(getBackendUrl('/api/speaking/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    signal,
    body: JSON.stringify({
      scenario: {
        id: scenario.id,
        title: scenario.title,
        titleEn: scenario.titleEn,
        partnerName: scenario.partnerName,
      },
      messages: messages.slice(-12).map((message) => ({
        role: message.sender === 'ai' ? 'assistant' : 'user',
        content: message.text,
      })),
    }),
  });
  if (!response.ok) throw new Error(await readBackendError(response, 'AI chưa thể trả lời.'));
  const payload = await readJsonResponse(response, 'Máy chủ hội thoại trả về dữ liệu không hợp lệ.');
  if (!payload) throw new Error('AI chưa trả lời. Hãy thử nói lại.');
  const direct = payload?.data || payload;
  const content = direct?.replyEn ? direct : direct?.choices?.[0]?.message?.content;
  const parsed = parseAssistantContent(content);
  if (!parsed.replyEn) throw new Error('Máy chủ AI không trả về nội dung hội thoại.');
  return parsed;
}

export async function requestCloudSpeech({ text, signal, config = DEFAULT_SPEAKING_CONFIG }) {
  if (!hasBackendApi()) throw new Error('Backend giọng nói chưa được cấu hình.');
  const response = await fetch(getBackendUrl('/api/speaking/speech'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ text, voice: config.voice || undefined }),
  });
  if (!response.ok) throw new Error(await readBackendError(response, 'Không thể tạo giọng đọc.'));
  return URL.createObjectURL(await response.blob());
}
