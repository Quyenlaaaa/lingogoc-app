// geminiService.js - Tích hợp Google Gemini 1.5 Flash API cho Free Talk & Sửa ngữ pháp sâu
// Hỗ trợ cả API key cá nhân của người dùng hoặc chế độ phản xạ cục bộ (offline fallback)

const GEMINI_API_KEY_STORAGE = 'lingogoc_gemini_api_key';

export function getGeminiApiKey() {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(GEMINI_API_KEY_STORAGE) || '';
  } catch (e) {
    return '';
  }
}

export function saveGeminiApiKey(key) {
  if (typeof window === 'undefined') return;
  try {
    if (!key) {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE);
    } else {
      localStorage.setItem(GEMINI_API_KEY_STORAGE, key.trim());
    }
  } catch (e) {}
}

/**
 * Gửi tin nhắn đến Google Gemini 1.5 Flash API
 * @param {string} userMessage - Câu người dùng vừa nói/gõ
 * @param {Array} history - Lịch sử hội thoại [{ sender: 'ai'|'user', text: string }]
 * @param {string} scenarioTitle - Ngữ cảnh hội thoại
 */
export async function sendChatMessageToGemini(userMessage, history = [], scenarioTitle = 'Free Talk') {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  const systemInstruction = `
Bạn là "Lily" - một gia sư tiếng Anh AI kiên nhẫn, ấm áp và tận tâm nhất dành cho người Việt Nam mất gốc tiếng Anh.
Ngữ cảnh hiện tại: "${scenarioTitle}".
Nhiệm vụ của bạn trong mỗi phản hồi:
1. Trả lời trực tiếp bằng tiếng Anh ngắn gọn, tự nhiên, từ ngữ đơn giản phù hợp trình độ A1-A2 (tối đa 2-3 câu ngắn).
2. Cung cấp câu dịch tiếng Việt trong ngoặc vuông ngay dưới câu tiếng Anh: [Dịch tiếng Việt: ...].
3. Nếu người dùng mắc lỗi ngữ pháp hoặc dùng từ chưa tự nhiên, hãy thêm một dòng nhẹ nhàng bằng tiếng Việt: 💡 Gợi ý sửa câu: [câu tiếng Anh chuẩn hơn] (lý do ngắn gọn bằng tiếng Việt).
4. Đưa ra 2 gợi ý câu trả lời tiếp theo để người học có thể chọn nói tiếp:
👉 Gợi ý 1: [English phrase] - [Phiên âm IPA] - [Nghĩa Việt]
👉 Gợi ý 2: [English phrase] - [Phiên âm IPA] - [Nghĩa Việt]
Không bao giờ dùng ngữ pháp phức tạp. Luôn khen ngợi và tạo cảm giác an toàn, thoải mái cho người học.
`;

  // Format contents according to Gemini REST API specifications
  const contents = [];

  // Add past conversation turns
  history.slice(-6).forEach(msg => {
    contents.push({
      role: msg.sender === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    });
  });

  // Current turn
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: contents,
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 600
      }
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.error?.message || `HTTP error ${response.status}`);
  }

  const data = await response.json();
  const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseGeminiResponse(replyText);
}

/**
 * Tách nội dung phản hồi từ Gemini thành các phần trực quan cho UI
 */
function parseGeminiResponse(rawText) {
  let aiReplyEn = '';
  let aiReplyVi = '';
  let correction = '';
  const hints = [];

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  let currentSection = 'en';

  lines.forEach(line => {
    if (line.includes('[Dịch tiếng Việt:') || line.startsWith('[Dịch:')) {
      aiReplyVi = line.replace(/\[Dịch.*?:/, '').replace(/\]$/, '').trim();
      currentSection = 'vi';
    } else if (line.includes('💡 Gợi ý sửa câu:')) {
      correction = line.replace('💡 Gợi ý sửa câu:', '').trim();
      currentSection = 'correction';
    } else if (line.startsWith('👉 Gợi ý')) {
      const hintContent = line.replace(/👉 Gợi ý \d+:/, '').trim();
      const parts = hintContent.split(' - ');
      hints.push({
        en: parts[0]?.trim() || hintContent,
        ipa: parts[1]?.trim() || '',
        vi: parts[2]?.trim() || ''
      });
      currentSection = 'hints';
    } else if (currentSection === 'en') {
      aiReplyEn += (aiReplyEn ? ' ' : '') + line;
    }
  });

  if (!aiReplyEn && lines.length > 0) {
    aiReplyEn = lines[0];
  }

  return {
    replyEn: aiReplyEn,
    replyVi: aiReplyVi,
    correction: correction,
    hints: hints.length > 0 ? hints : null
  };
}
