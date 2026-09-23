// dictationData.js - Bộ bài luyện nghe chép chính tả & bắt nối âm (Dictation Practice)
// Thiết kế chuyên biệt cho người Việt mất gốc tiếng Anh

export const dictationLessons = [
  // --- CHỦ ĐỀ: ĂN UỐNG & GIAO TIẾP HÀNG NGÀY ---
  {
    id: 1,
    sentence: "Can I have a cup of tea?",
    translation: "Cho tôi một tách trà được không?",
    words: ["Can", "I", "have", "a", "cup", "of", "tea?"],
    topic: "Ăn uống & Cafe",
    difficulty: "Dễ",
    linkingNote: "🔗 Nối âm tự nhiên: 'Can I' nối âm phụ âm với nguyên âm đọc liền thành /kænaɪ/. 'have a' nối thành /ˈhæv.ə/. 'cup of' nối thành /ˈkʌp.əv/."
  },
  {
    id: 2,
    sentence: "How much is this shirt?",
    translation: "Chiếc áo sơ mi này giá bao nhiêu?",
    words: ["How", "much", "is", "this", "shirt?"],
    topic: "Mua sắm",
    difficulty: "Dễ",
    linkingNote: "🔗 Nối âm: 'much is' nối âm /tʃ/ sang /ɪ/ đọc liền thành /ˈmʌtʃ.ɪz/. Lưu ý từ 'shirt' có âm cuối là /t/ cần bật nhẹ."
  },
  {
    id: 3,
    sentence: "Could you tell me the time?",
    translation: "Bạn có thể xem giúp tôi mấy giờ rồi không?",
    words: ["Could", "you", "tell", "me", "the", "time?"],
    topic: "Hỏi đường & Giờ giấc",
    difficulty: "Vừa",
    linkingNote: "🔗 Nối âm: 'Could you' người bản xứ thường biến âm nhẹ thành /ˈkʊdʒ.uː/ hoặc /ˈkʊd.juː/. Chữ 'l' trong 'tell' phát âm chuẩn cong đầu lưỡi."
  },
  {
    id: 4,
    sentence: "I would like to pay by card.",
    translation: "Tôi muốn thanh toán bằng thẻ.",
    words: ["I", "would", "like", "to", "pay", "by", "card."],
    topic: "Ăn uống & Cafe",
    difficulty: "Vừa",
    linkingNote: "💡 Chú ý âm đuôi: Từ 'card' có âm tận cùng là /d/, phát âm rung cổ họng khác với 'car' (xe hơi) và 'cart' (xe đẩy)."
  },
  {
    id: 5,
    sentence: "What is your phone number?",
    translation: "Số điện thoại của bạn là gì?",
    words: ["What", "is", "your", "phone", "number?"],
    topic: "Giao tiếp cơ bản",
    difficulty: "Dễ",
    linkingNote: "🔗 Nối âm: 'What is' người bản xứ thường nối âm thành /ˈwɒt.ɪz/ hoặc nói tắt thành 'What's' /wɒts/."
  },
  {
    id: 6,
    sentence: "Where is the nearest bank?",
    translation: "Ngân hàng gần nhất ở đâu vậy?",
    words: ["Where", "is", "the", "nearest", "bank?"],
    topic: "Hỏi đường & Du lịch",
    difficulty: "Vừa",
    linkingNote: "🔗 Nối âm: 'Where is' nối thành /ˈweər.ɪz/. 'nearest bank' có cụm phụ âm /st/ trong 'nearest' thường được nuốt âm /t/ nhẹ khi đi trước phụ âm /b/."
  },
  {
    id: 7,
    sentence: "Nice to meet you today.",
    translation: "Rất vui được gặp bạn ngày hôm nay.",
    words: ["Nice", "to", "meet", "you", "today."],
    topic: "Giao tiếp cơ bản",
    difficulty: "Dễ",
    linkingNote: "🔗 Nối âm: 'meet you' nối âm thành /ˈmiːtʃ.uː/. Đừng quên âm đuôi /s/ trong từ 'nice'!"
  },
  {
    id: 8,
    sentence: "I am looking for a jacket.",
    translation: "Tôi đang tìm mua một chiếc áo khoác.",
    words: ["I", "am", "looking", "for", "a", "jacket."],
    topic: "Mua sắm",
    difficulty: "Vừa",
    linkingNote: "🔗 Nối âm: 'for a' nối âm thành /ˈfɔːr.ə/. Từ 'jacket' có âm đầu /dʒ/ và âm cuối /t/."
  },
  {
    id: 9,
    sentence: "Do you have free wifi here?",
    translation: "Ở đây các bạn có wifi miễn phí không?",
    words: ["Do", "you", "have", "free", "wifi", "here?"],
    topic: "Ăn uống & Cafe",
    difficulty: "Dễ",
    linkingNote: "💡 Mẹo nghe: Từ 'wifi' phát âm là /ˈwaɪ.faɪ/ (hai âm tiết mở), 'here' phát âm là /hɪər/."
  },
  {
    id: 10,
    sentence: "See you later tomorrow morning.",
    translation: "Hẹn gặp lại bạn vào sáng mai nhé.",
    words: ["See", "you", "later", "tomorrow", "morning."],
    topic: "Giao tiếp cơ bản",
    difficulty: "Vừa",
    linkingNote: "💡 Mẹo nghe giọng Mỹ: Trong từ 'later', âm /t/ nằm giữa 2 nguyên âm nên được đọc lướt thành âm 'Flap T' (nghe giống âm /d/ nhẹ)."
  }
];
