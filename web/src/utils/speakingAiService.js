import { getBackendUrl, hasBackendApi, readBackendError, readJsonResponse } from './backendApi';
import { DEFAULT_SPEAKING_LEVEL, normalizeSpeakingLevel } from './speakingLevels';

const CONFIG_KEY = 'lingogoc_speaking_preferences_v2';
const LEGACY_CONFIG_KEY = 'lingogoc_speaking_ai_config_v1';
const SPEAKING_REQUEST_TIMEOUT_MS = 45_000;

export const DEFAULT_SPEAKING_CONFIG = {
  autoListen: String(import.meta.env.VITE_SPEAKING_AUTO_LISTEN || 'true').toLowerCase() !== 'false',
  useCloudVoice: true,
  voice: '',
  level: DEFAULT_SPEAKING_LEVEL,
  avatarEnabled: true,
};

export function loadSpeakingConfig() {
  try {
    localStorage.removeItem(LEGACY_CONFIG_KEY);
    const stored = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    return {
      ...DEFAULT_SPEAKING_CONFIG,
      autoListen: stored.autoListen ?? DEFAULT_SPEAKING_CONFIG.autoListen,
      useCloudVoice: stored.useCloudVoice ?? DEFAULT_SPEAKING_CONFIG.useCloudVoice,
      voice: typeof stored.voice === 'string' ? stored.voice : '',
      level: normalizeSpeakingLevel(stored.level),
      avatarEnabled: stored.avatarEnabled ?? DEFAULT_SPEAKING_CONFIG.avatarEnabled,
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
    level: normalizeSpeakingLevel(config.level),
    avatarEnabled: config.avatarEnabled !== false,
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
      scores: content.scores && typeof content.scores === 'object' ? content.scores : {},
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
      // Fall through to the provider's plain response.
    }
  }
  return { replyEn: withoutFence, replyVi: '', correction: '', encouragement: '', hints: [], scores: {} };
}

function speakingPayload({ requestId, scenario, level, messages }) {
  return {
    scenario: {
      id: scenario.id,
      title: scenario.title,
      titleEn: scenario.titleEn,
      partnerName: scenario.partnerName,
    },
    level: normalizeSpeakingLevel(level),
    requestId,
    messages: messages.slice(-12).map((message) => ({
      role: message.sender === 'ai' ? 'assistant' : 'user',
      content: message.text,
    })),
  };
}

async function requestLegacySpeakingReply(payload, signal) {
  const response = await fetch(getBackendUrl('/api/speaking/chat'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(payload.requestId ? { 'X-Idempotency-Key': payload.requestId } : {}),
      },
      signal,
      body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readBackendError(response, 'AI chưa thể trả lời.'));
  const responsePayload = await readJsonResponse(response, 'Máy chủ hội thoại trả về dữ liệu không hợp lệ.');
  if (!responsePayload) throw new Error('AI chưa trả lời. Hãy thử nói lại.');
  const direct = responsePayload?.data || responsePayload;
  const content = direct?.replyEn ? direct : direct?.choices?.[0]?.message?.content;
  const parsed = parseAssistantContent(content);
  if (!parsed.replyEn) throw new Error('Máy chủ AI không trả về nội dung hội thoại.');
  return parsed;
}

async function requestRealtimeSpeakingReply({ payload, sessionId, resumeToken, turnSequence, lastAcknowledgedSequence, reconnectAttempt, signal, onEvent }) {
  const sessionResponse = await fetch(getBackendUrl('/api/speaking/realtime/session'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    signal,
    body: JSON.stringify({
      sessionId,
      resumeToken,
      level: payload.level,
      scenario: payload.scenario,
      lastAcknowledgedSequence,
      reconnectAttempt,
    }),
  });
  if ([404, 405, 501].includes(sessionResponse.status)) return null;
  if (!sessionResponse.ok) throw new Error(await readBackendError(sessionResponse, 'Không thể bắt đầu phiên realtime.'));

  const response = await fetch(getBackendUrl('/api/speaking/realtime/turn'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/x-ndjson',
      'X-Idempotency-Key': payload.requestId,
    },
    signal,
    body: JSON.stringify({ ...payload, sessionId, resumeToken, turnSequence, reconnectAttempt }),
  });
  if (!response.ok) throw new Error(await readBackendError(response, 'Kết nối realtime bị từ chối.'));
  if (!response.body?.getReader) throw new Error('Trình duyệt chưa hỗ trợ luồng hội thoại realtime. Hãy thử lại an toàn.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;
  const consumeLine = (line) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    onEvent?.(event);
    if (event.type === 'result') result = parseAssistantContent(event.data);
    if (event.type === 'error') {
      const error = new Error(event.error || 'Luồng hội thoại realtime bị gián đoạn. Hãy thử lại an toàn.');
      error.code = event.code;
      throw error;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    lines.forEach(consumeLine);
    if (done) break;
  }
  consumeLine(buffer);
  if (!result?.replyEn) throw new Error('Luồng realtime kết thúc trước khi có câu trả lời. Hãy thử lại an toàn.');
  return result;
}

export async function requestSpeakingReply({ requestId, sessionId, resumeToken, turnSequence, lastAcknowledgedSequence = 0, reconnectAttempt = 0, scenario, level, messages, signal, onEvent }) {
  if (!hasBackendApi()) throw new Error('Backend AI chưa được cấu hình cho website này.');

  const requestController = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => requestController.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeoutId = setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, SPEAKING_REQUEST_TIMEOUT_MS);

  try {
    const payload = speakingPayload({ requestId, scenario, level, messages });
    if (sessionId && Number.isInteger(Number(turnSequence)) && Number(turnSequence) > 0) {
      const realtimeResult = await requestRealtimeSpeakingReply({
        payload,
        sessionId,
        resumeToken,
        turnSequence: Number(turnSequence),
        lastAcknowledgedSequence,
        reconnectAttempt,
        signal: requestController.signal,
        onEvent,
      });
      if (realtimeResult) return realtimeResult;
    }
    return await requestLegacySpeakingReply(payload, requestController.signal);
  } catch (error) {
    if (timedOut && !signal?.aborted) {
      throw new Error('AI phản hồi quá lâu. Lượt nói đã được lưu để thử lại an toàn.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

export async function requestDurableSpeakingSession({ sessionId, resumeToken, signal }) {
  if (!hasBackendApi() || !sessionId || !resumeToken) return null;
  const response = await fetch(getBackendUrl('/api/speaking/realtime/resume'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    signal,
    body: JSON.stringify({ sessionId, resumeToken }),
  });
  if ([404, 405, 501, 503].includes(response.status)) return null;
  if (!response.ok) throw new Error(await readBackendError(response, 'KhÃ´ng thá»ƒ khÃ´i phá»¥c phiÃªn luyá»‡n nÃ³i.'));
  return readJsonResponse(response, 'MÃ¡y chá»§ tráº£ vá» phiÃªn luyá»‡n nÃ³i khÃ´ng há»£p lá»‡.');
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
