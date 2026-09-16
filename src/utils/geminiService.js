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

/**
 * Sử dụng Google Gemini LLM để bổ sung, làm giàu dữ liệu từ vựng chuyên sâu:
 * 3 câu ví dụ đời thực, cụm từ hay đi kèm (Collocations), và mẹo ghi nhớ tiếng Việt
 */
export async function enrichWordWithLLM(word, meaning = '', topic = '') {
  const apiKey = getGeminiApiKey();

  // Nếu có API Key, gọi trực tiếp Gemini 1.5 Flash
  if (apiKey) {
    try {
      const prompt = `
Phân tích chuyên sâu từ vựng tiếng Anh "${word}" (nghĩa cơ bản: "${meaning}", chủ đề: "${topic}") dành cho người Việt mất gốc.
Trả về định dạng JSON thuần túy (không dùng markdown khác ngoài json block) với các trường sau:
{
  "contextExamples": [
    { "en": "câu ví dụ tiếng Anh 1 thực tế đời sống", "vi": "dịch tiếng Việt câu 1" },
    { "en": "câu ví dụ tiếng Anh 2 trong giao tiếp", "vi": "dịch tiếng Việt câu 2" },
    { "en": "câu ví dụ tiếng Anh 3 trong công việc/mua sắm", "vi": "dịch tiếng Việt câu 3" }
  ],
  "collocations": [
    { "phrase": "cụm từ tiếng Anh hay gặp", "meaning": "nghĩa tiếng Việt" },
    { "phrase": "cụm từ 2", "meaning": "nghĩa tiếng Việt 2" }
  ],
  "mnemonicTip": "Mẹo nhớ từ bằng tiếng Việt hoặc câu chuyện vui ngắn dễ nhớ",
  "wordFamily": "danh từ/động từ/tính từ liên quan nếu có"
}
`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 800 }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return { ...parsed, isAiGenerated: true };
        }
      }
    } catch (e) {
      console.warn('Gemini enrichment failed, using enhanced fallback:', e);
    }
  }

  // Fallback phong phú theo ngữ cảnh khi không có API key
  return {
    isAiGenerated: false,
    contextExamples: [
      {
        en: `I always use '${word}' when talking about ${topic.toLowerCase() || 'daily life'}.`,
        vi: `Tôi luôn dùng từ '${word}' khi nói về ${topic.toLowerCase() || 'cuộc sống hàng ngày'}.`
      },
      {
        en: `Can you explain the meaning of '${word}' in this conversation?`,
        vi: `Bạn có thể giải thích ý nghĩa của từ '${word}' trong cuộc đối thoại này không?`
      },
      {
        en: `It is very common to hear '${word}' in real American English.`,
        vi: `Rất phổ biến khi nghe thấy từ '${word}' trong tiếng Anh giao tiếp thực tế của người Mỹ.`
      }
    ],
    collocations: [
      { phrase: `use ${word} correctly`, meaning: `sử dụng ${word} một cách chuẩn xác` },
      { phrase: `common ${word}`, meaning: `${word} thông dụng` }
    ],
    mnemonicTip: `💡 Mẹo nhớ: Hãy gắn từ '${word}' với một hình ảnh quen thuộc trong chủ đề ${topic || 'đời sống'} và nhẩm to 3 lần!`,
    wordFamily: `Từ gốc: ${word}`
  };
}
