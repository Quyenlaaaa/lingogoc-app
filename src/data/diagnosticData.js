// diagnosticData.js - Dữ liệu bài kiểm tra năng lực đầu vào 10 phút (Diagnostic Test)
// Thiết kế chuyên biệt cho người mất gốc tiếng Anh

export const diagnosticQuestions = [
  // --- PHẦN 1: NGỮ ÂM & NHẬN DIỆN ÂM IPA (4 câu) ---
  {
    id: 1,
    section: 'ipa',
    sectionTitle: 'Phần 1: Ngữ Âm & Nhận Diện Âm IPA',
    question: 'Trong các từ sau, từ nào có phần gạch chân phát âm là âm dài /iː/ (cười mở rộng miệng)?',
    audioPrompt: 'sheep',
    options: [
      { id: 'A', text: 'ship /ʃɪp/ (con tàu)' },
      { id: 'B', text: 'sheep /ʃiːp/ (con cừu)', isCorrect: true },
      { id: 'C', text: 'sit /sɪt/ (ngồi)' },
      { id: 'D', text: 'hit /hɪt/ (đánh)' }
    ],
    explanation: 'Từ "sheep" có nguyên âm đôi "ee" phát âm là /iː/ (kéo dài, khóe miệng kéo sang hai bên như đang mỉm cười). Các từ còn lại phát âm là /ɪ/ ngắn dứt khoát.'
  },
  {
    id: 2,
    section: 'ipa',
    sectionTitle: 'Phần 1: Ngữ Âm & Nhận Diện Âm IPA',
    question: 'Khi thêm đuôi "-s/-es" vào từ "watches" (xem), đuôi này được phát âm là gì?',
    audioPrompt: 'watches',
    options: [
      { id: 'A', text: 'Phát âm là /s/' },
      { id: 'B', text: 'Phát âm là /z/' },
      { id: 'C', text: 'Phát âm là /ɪz/ (thêm một âm tiết)', isCorrect: true },
      { id: 'D', text: 'Không phát âm âm đuôi' },
    ],
    explanation: 'Quy tắc âm đuôi: Các từ kết thúc bằng các âm gió s, z, ʃ, tʃ, dʒ (như watch /wɒtʃ/) khi thêm "-es" sẽ phát âm thành /ɪz/ -> /ˈwɒtʃ.ɪz/.'
  },
  {
    id: 3,
    section: 'ipa',
    sectionTitle: 'Phần 1: Ngữ Âm & Nhận Diện Âm IPA',
    question: 'Từ "thank" /θæŋk/ (cảm ơn) bắt đầu bằng âm nào dưới đây?',
    audioPrompt: 'thank you',
    options: [
      { id: 'A', text: 'Âm /t/ (đọc như "thanh" trong tiếng Việt)' },
      { id: 'B', text: 'Âm vô thanh /θ/ (đặt đầu lưỡi giữa hai hàm răng và thổi hơi)', isCorrect: true },
      { id: 'C', text: 'Âm /s/ (đọc như "xank")' },
      { id: 'D', text: 'Âm /f/ (đọc như "fank")' }
    ],
    explanation: 'Âm /θ/ là một trong các âm khó nhất với người Việt. Cách làm đúng: Đưa nhẹ đầu lưỡi ra giữa hai hàm răng và đẩy luồng hơi ra, dây thanh quản KHÔNG rung.'
  },
  {
    id: 4,
    section: 'ipa',
    sectionTitle: 'Phần 1: Ngữ Âm & Nhận Diện Âm IPA',
    question: 'Từ nào có đuôi "-ed" được phát âm là /ɪd/?',
    audioPrompt: 'wanted',
    options: [
      { id: 'A', text: 'played (chơi)' },
      { id: 'B', text: 'watched (xem)' },
      { id: 'C', text: 'wanted (muốn)', isCorrect: true },
      { id: 'D', text: 'stopped (dừng lại)' }
    ],
    explanation: 'Quy tắc vàng đuôi "-ed": Chỉ những từ có âm tận cùng là /t/ hoặc /d/ (như want, need) khi thêm "-ed" mới đọc là /ɪd/ -> wanted /ˈwɒn.tɪd/.'
  },

  // --- PHẦN 2: VỐN TỪ VỰNG & PHẢN XẠ NGỮ CẢNH (4 câu) ---
  {
    id: 5,
    section: 'vocab',
    sectionTitle: 'Phần 2: Vốn Từ Vựng Cơ Bản & Ngữ Cảnh',
    question: 'Chọn từ thích hợp điền vào chỗ trống: "I would like a cup of ________, please."',
    audioPrompt: 'I would like a cup of coffee, please.',
    options: [
      { id: 'A', text: 'bread (bánh mì)' },
      { id: 'B', text: 'coffee (cà phê)', isCorrect: true },
      { id: 'C', text: 'table (cái bàn)' },
      { id: 'D', text: 'book (quyển sách)' }
    ],
    explanation: '"a cup of coffee" là cụm từ rất phổ biến khi gọi đồ uống tại quán cà phê hoặc nhà hàng.'
  },
  {
    id: 6,
    section: 'vocab',
    sectionTitle: 'Phần 2: Vốn Từ Vựng Cơ Bản & Ngữ Cảnh',
    question: 'Từ trái nghĩa với "expensive" (đắt đỏ) trong tiếng Anh là gì?',
    audioPrompt: 'cheap',
    options: [
      { id: 'A', text: 'cheap (rẻ)', isCorrect: true },
      { id: 'B', text: 'big (to lớn)' },
      { id: 'C', text: 'delicious (ngon miệng)' },
      { id: 'D', text: 'fast (nhanh)' }
    ],
    explanation: '"expensive" (đắt) đối nghĩa với "cheap" (rẻ). Cặp từ này thuộc 1000 từ cốt lõi A1 khi đi mua sắm.'
  },
  {
    id: 7,
    section: 'vocab',
    sectionTitle: 'Phần 2: Vốn Từ Vựng Cơ Bản & Ngữ Cảnh',
    question: 'Khi muốn hỏi đường đến nhà ga, câu nào sau đây là tự nhiên và lịch sự nhất?',
    audioPrompt: 'Excuse me, could you tell me how to get to the station?',
    options: [
      { id: 'A', text: 'Where station now?' },
      { id: 'B', text: 'Excuse me, could you tell me how to get to the station?', isCorrect: true },
      { id: 'C', text: 'Go station you tell me!' },
      { id: 'D', text: 'You show me station immediately.' }
    ],
    explanation: 'Cấu trúc "Excuse me, could you tell me how to get to [địa điểm]?" là mẫu câu kinh điển trong Chặng 3 giúp bạn hỏi đường một cách lịch sự.'
  },
  {
    id: 8,
    section: 'vocab',
    sectionTitle: 'Phần 2: Vốn Từ Vựng Cơ Bản & Ngữ Cảnh',
    question: 'Từ "schedule" /ˈskedʒ.uːl/ có nghĩa tiếng Việt là gì?',
    audioPrompt: 'schedule',
    options: [
      { id: 'A', text: 'Thời gian biểu, lịch trình', isCorrect: true },
      { id: 'B', text: 'Trường học, lớp học' },
      { id: 'C', text: 'Hóa đơn thanh toán' },
      { id: 'D', text: 'Hộ chiếu du lịch' }
    ],
    explanation: '"schedule" nghĩa là lịch trình, thời khóa biểu làm việc; thuộc nhóm từ vựng A2 rất hay dùng trong công việc và đời sống.'
  },

  // --- PHẦN 3: LUYỆN NÓI PHẢN XẠ VỚI MICROPHONE (4 câu) ---
  {
    id: 9,
    section: 'speaking',
    sectionTitle: 'Phần 3: Đọc To & Chấm Điểm Phát Âm Qua Mic',
    type: 'speaking',
    targetPhrase: 'Hello, nice to meet you.',
    ipa: '/həˈloʊ naɪs tuː miːt juː/',
    meaning: 'Xin chào, rất vui được gặp bạn.',
    tip: 'Hãy phát âm rõ âm cuối /s/ trong từ "nice" và âm /t/ trong từ "meet".'
  },
  {
    id: 10,
    section: 'speaking',
    sectionTitle: 'Phần 3: Đọc To & Chấm Điểm Phát Âm Qua Mic',
    type: 'speaking',
    targetPhrase: 'Can I have the menu, please?',
    ipa: '/kæn aɪ hæv ðə ˈmen.juː pliːz/',
    meaning: 'Cho tôi xem thực đơn được không?',
    tip: 'Lưu ý phát âm từ "please" có âm đuôi /z/ nhẹ nhàng và kéo dài âm /iː/.'
  },
  {
    id: 11,
    section: 'speaking',
    sectionTitle: 'Phần 3: Đọc To & Chấm Điểm Phát Âm Qua Mic',
    type: 'speaking',
    targetPhrase: 'Thank you very much.',
    ipa: '/θæŋk juː ˈver.i mʌtʃ/',
    meaning: 'Cảm ơn bạn rất nhiều.',
    tip: 'Chú ý âm /θ/ đầu từ "Thank" (đưa đầu lưỡi ra giữa 2 răng) và âm /tʃ/ cuối từ "much".'
  },
  {
    id: 12,
    section: 'speaking',
    sectionTitle: 'Phần 3: Đọc To & Chấm Điểm Phát Âm Qua Mic',
    type: 'speaking',
    targetPhrase: 'How much does this cost?',
    ipa: '/haʊ mʌtʃ dʌz ðɪs kɒst/',
    meaning: 'Cái này giá bao nhiêu?',
    tip: 'Lưu ý từ "cost" kết thúc bằng cụm phụ âm /st/, đừng bỏ quên âm /t/ ở cuối.'
  }
];

export function evaluateDiagnosticResults(answers, speakingScores) {
  let ipaCorrect = 0;
  let vocabCorrect = 0;
  let totalSpeakingScore = 0;
  let speakingCount = 0;

  diagnosticQuestions.forEach(q => {
    if (q.section === 'ipa') {
      if (answers[q.id] && answers[q.id].isCorrect) ipaCorrect += 1;
    } else if (q.section === 'vocab') {
      if (answers[q.id] && answers[q.id].isCorrect) vocabCorrect += 1;
    } else if (q.section === 'speaking') {
      const score = speakingScores[q.id] || 0;
      totalSpeakingScore += score;
      speakingCount += 1;
    }
  });

  const ipaPercent = Math.round((ipaCorrect / 4) * 100);
  const vocabPercent = Math.round((vocabCorrect / 4) * 100);
  const speakingPercent = speakingCount > 0 ? Math.round(totalSpeakingScore / speakingCount) : 0;

  // Tính điểm tổng trọng số: IPA 30%, Vocab 35%, Speaking 35%
  const overallScore = Math.round((ipaPercent * 0.3) + (vocabPercent * 0.35) + (speakingPercent * 0.35));

  let level = 'Pre-A1';
  let title = 'Mất Gốc Toàn Diện (Pre-A1)';
  let targetStage = 1; // Stage 1 IPA
  let summary = 'Bạn chưa có nhiều phản xạ về ngữ âm chuẩn và vốn từ còn mỏng. Đây là điều hoàn toàn bình thường!';
  let recommendation = 'Hãy bắt đầu từ Chặng 1: Xóa mù IPA để nắm chắc 44 âm và âm đuôi /-s, -ed/, kết hợp 300 từ cốt lõi A1.';

  if (overallScore >= 75) {
    level = 'A2';
    title = 'Nền Tảng Tốt - Phản Xạ Ngập Ngừng (A2)';
    targetStage = 4; // Stage 4 AI Speaking
    summary = 'Bạn có nền tảng ngữ âm và từ vựng tương đối vững, có thể hiểu câu nhưng phản xạ nói vẫn còn ngập ngừng.';
    recommendation = 'Lộ trình tối ưu: Hãy tiến thẳng vào Chặng 3 (Mẫu câu 3s) và Chặng 4 (Phòng Luyện Nói AI) để rèn sự tự tin!';
  } else if (overallScore >= 45) {
    level = 'A1';
    title = 'Biết Từ Nhưng Chưa Nói Được (A1)';
    targetStage = 2; // Stage 2 Vocab
    summary = 'Bạn đã nhận biết được một số mặt từ vựng quen thuộc nhưng hay quên âm cuối và chưa tự tin ghép câu để nói.';
    recommendation = 'Lộ trình tối ưu: Bắt đầu từ Chặng 2 (3000 từ vựng Oxford) để củng cố vốn từ và qua Chặng 3 để luyện khung câu giao tiếp.';
  }

  return {
    overallScore,
    level,
    title,
    targetStage,
    summary,
    recommendation,
    breakdown: {
      ipa: { score: ipaPercent, label: 'Ngữ âm IPA & Âm cuối', correct: ipaCorrect, total: 4 },
      vocab: { score: vocabPercent, label: 'Vốn từ vựng & Ngữ cảnh', correct: vocabCorrect, total: 4 },
      speaking: { score: speakingPercent, label: 'Phát âm & Nói qua Mic', avgScore: speakingPercent }
    }
  };
}
