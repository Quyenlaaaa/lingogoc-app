// trapsData.js - Sổ tay 50 bẫy từ vựng & cặp âm dễ nhầm lẫn của người Việt
// Giúp người mất gốc phân biệt rành mạch và không bao giờ dùng sai

export const trapCategories = ['Tất cả', 'Cặp Từ Giao Tiếp', 'Cặp Âm IPA Dễ Nhầm'];

export const trapItems = [
  // --- CẶP TỪ GIAO TIẾP ---
  {
    id: 1,
    category: 'Cặp Từ Giao Tiếp',
    title: 'Say vs Tell vs Talk vs Speak',
    summary: 'Bộ 4 từ "Nói" khiến 95% người học mất gốc bối rối',
    words: [
      { word: 'Say', ipa: '/seɪ/', usage: 'Nói ra nội dung cụ thể (Say something to someone)' },
      { word: 'Tell', ipa: '/tel/', usage: 'Bảo ai đó, kể cho ai (Tell someone something - bắt buộc có tân ngữ)' },
      { word: 'Talk', ipa: '/tɔːk/', usage: 'Trò chuyện qua lại thân mật 2 chiều (Talk to/with someone)' },
      { word: 'Speak', ipa: '/spiːk/', usage: 'Nói ngôn ngữ, hoặc phát biểu trang trọng 1 chiều (Speak English)' }
    ],
    mnemonicTip: '💡 Mẹo vàng: "Say" nói nội dung, "Tell" kể cho người khác nghe, "Talk" tâm sự hai chiều, "Speak" nói một thứ tiếng.',
    quiz: {
      question: 'Điền từ thích hợp: "Can you ________ me how to get to the station?"',
      options: [
        { text: 'say', isCorrect: false },
        { text: 'tell', isCorrect: true },
        { text: 'speak', isCorrect: false },
        { text: 'talk', isCorrect: false }
      ],
      explanation: 'Vì phía sau có tân ngữ "me" nên bắt buộc dùng cấu trúc: Tell someone how to... -> "Can you tell me..."'
    }
  },
  {
    id: 2,
    category: 'Cặp Từ Giao Tiếp',
    title: 'Borrow vs Lend',
    summary: 'Mượn tiền hay Cho mượn tiền?',
    words: [
      { word: 'Borrow', ipa: '/ˈbɒr.əʊ/', usage: 'Vay, mượn từ ai đó (Borrow something FROM someone - đi vào)' },
      { word: 'Lend', ipa: '/lend/', usage: 'Cho ai vay, mượn (Lend someone something - đi ra)' }
    ],
    mnemonicTip: '💡 Mẹo vàng: Borrow = Lấy về túi mình (mượn). Lend = Đưa từ túi mình cho người khác (cho mượn).',
    quiz: {
      question: 'Điền từ thích hợp: "Can I ________ your pen for a moment?"',
      options: [
        { text: 'borrow', isCorrect: true },
        { text: 'lend', isCorrect: false }
      ],
      explanation: 'Bạn muốn lấy bút của người khác về dùng tạm nên dùng "borrow": "Can I borrow your pen?"'
    }
  },
  {
    id: 3,
    category: 'Cặp Từ Giao Tiếp',
    title: 'Hear vs Listen',
    summary: 'Nghe thụ động vô tình vs Lắng nghe có chủ đích',
    words: [
      { word: 'Hear', ipa: '/hɪər/', usage: 'Âm thanh tự đập vào tai, không chủ ý (Did you hear that noise?)' },
      { word: 'Listen', ipa: '/ˈlɪs.ən/', usage: 'Tập trung lắng nghe có chủ đích (Listen to music/teacher)' }
    ],
    mnemonicTip: '💡 Mẹo vàng: Tai mở thì "Hear" (vô tình nghe thấy). Não tập trung thì "Listen" (chăm chú lắng nghe).',
    quiz: {
      question: 'Điền từ thích hợp: "Please ________ carefully to the instructions."',
      options: [
        { text: 'hear', isCorrect: false },
        { text: 'listen', isCorrect: true }
      ],
      explanation: 'Yêu cầu tập trung chú ý vào lời dặn thì dùng "listen to": "Please listen carefully..."'
    }
  },
  {
    id: 4,
    category: 'Cặp Từ Giao Tiếp',
    title: 'Look vs See vs Watch',
    summary: 'Nhìn hướng mắt vs Nhìn thấy vs Xem chuyển động',
    words: [
      { word: 'Look', ipa: '/lʊk/', usage: 'Hướng ánh mắt về đâu đó có chủ ý (Look at the picture)' },
      { word: 'See', ipa: '/siː/', usage: 'Hình ảnh lọt vào tầm mắt tự nhiên (I see a bird in the tree)' },
      { word: 'Watch', ipa: '/wɒtʃ/', usage: 'Theo dõi sự vật có chuyển động liên tục (Watch TV, Watch a movie)' }
    ],
    mnemonicTip: '💡 Mẹo vàng: Có chuyển động diễn biến (phim, bóng đá) luôn luôn dùng "Watch"!',
    quiz: {
      question: 'Điền từ thích hợp: "Do you want to ________ a movie tonight?"',
      options: [
        { text: 'look', isCorrect: false },
        { text: 'see', isCorrect: false },
        { text: 'watch', isCorrect: true }
      ],
      explanation: 'Xem phim có chuyển động liên tục dùng "watch a movie".'
    }
  },
  {
    id: 5,
    category: 'Cặp Từ Giao Tiếp',
    title: 'Make vs Do',
    summary: 'Tạo ra sản phẩm mới vs Thực hiện hành động/nhiệm vụ',
    words: [
      { word: 'Make', ipa: '/meɪk/', usage: 'Tạo ra cái mới cụ thể (Make coffee, Make a cake, Make a mistake)' },
      { word: 'Do', ipa: '/duː/', usage: 'Làm công việc, nghĩa vụ, hoạt động chung (Do homework, Do housework, Do exercise)' }
    ],
    mnemonicTip: '💡 Mẹo vàng: "Make" tạo ra vật thể (bánh, cafe, tiền). "Do" gắn liền công việc hàng ngày (bài tập, thể dục).',
    quiz: {
      question: 'Điền từ thích hợp: "I need to ________ my homework before dinner."',
      options: [
        { text: 'make', isCorrect: false },
        { text: 'do', isCorrect: true }
      ],
      explanation: 'Bài tập về nhà là nhiệm vụ học tập, cụm cố định luôn là "do homework".'
    }
  },

  // --- CẶP ÂM IPA TỐI THIỂU (MINIMAL PAIRS) ---
  {
    id: 6,
    category: 'Cặp Âm IPA Dễ Nhầm',
    title: '/iː/ (sheep) vs /ɪ/ (ship)',
    summary: 'Nguyên âm dài cười mở miệng vs Nguyên âm ngắn dứt khoát',
    words: [
      { word: 'sheep', ipa: '/ʃiːp/', usage: 'Con cừu (kéo dài âm /iː/, khóe miệng kéo ngang như đang cười)' },
      { word: 'ship', ipa: '/ʃɪp/', usage: 'Con tàu (âm /ɪ/ ngắn, thả lỏng môi, phát âm dứt khoát nửa giây)' }
    ],
    mnemonicTip: '💡 Hậu quả nếu nhầm: Muốn nói "con tàu" mà đọc kéo dài sẽ thành "con cừu"!',
    quiz: {
      question: 'Từ nào phát âm với âm /iː/ kéo dài môi mỉm cười?',
      options: [
        { text: 'sheep /ʃiːp/ (con cừu)', isCorrect: true },
        { text: 'ship /ʃɪp/ (con tàu)', isCorrect: false }
      ],
      explanation: 'Âm có dấu hai chấm /iː/ là âm dài, đọc ngân dài và miệng mở rộng như đang mỉm cười.'
    }
  },
  {
    id: 7,
    category: 'Cặp Âm IPA Dễ Nhầm',
    title: '/e/ (bed) vs /æ/ (bad)',
    summary: 'Âm e mở vừa vs Âm a bẹt há rộng hàm',
    words: [
      { word: 'bed', ipa: '/bed/', usage: 'Cái giường (âm /e/ mở miệng vừa phải như chữ e tiếng Việt)' },
      { word: 'bad', ipa: '/bæd/', usage: 'Tồi tệ, xấu (âm /æ/ há rộng cằm xuống dưới, lưỡi hạ thấp)' }
    ],
    mnemonicTip: '💡 Mẹo vàng: /æ/ trong "bad" phải mở miệng to gấp đôi âm /e/ trong "bed".',
    quiz: {
      question: 'Khi muốn nói "Tôi cảm thấy tồi tệ", bạn cần đọc từ nào với khẩu hình há rộng cằm /æ/?',
      options: [
        { text: 'bad /bæd/', isCorrect: true },
        { text: 'bed /bed/', isCorrect: false }
      ],
      explanation: 'Từ "bad" phát âm là /bæd/ (hạ cằm sâu). Nếu đọc là /bed/ người nghe sẽ tưởng bạn nói "cái giường".'
    }
  },
  {
    id: 8,
    category: 'Cặp Âm IPA Dễ Nhầm',
    title: '/s/ (see) vs /ʃ/ (she)',
    summary: 'Âm s xì nhẹ răng khép vs Âm sh chu môi tròn thổi hơi',
    words: [
      { word: 'see', ipa: '/siː/', usage: 'Nhìn thấy (hai hàm răng khép nhẹ, đẩy hơi qua khe răng như chữ x)' },
      { word: 'she', ipa: '/ʃiː/', usage: 'Cô ấy (chu tròn môi về phía trước, thổi hơi mạnh như đang ra hiệu trật tự)' }
    ],
    mnemonicTip: '💡 Mẹo vàng: Thấy chữ "sh" luôn luôn phải chu mỏ tròn môi về phía trước!',
    quiz: {
      question: 'Khi phát âm từ "she" (cô ấy), khẩu hình miệng đúng là gì?',
      options: [
        { text: 'Chu môi tròn về phía trước và đẩy luồng hơi mạnh /ʃ/', isCorrect: true },
        { text: 'Khép răng và xì nhẹ như chữ x tiếng Việt', isCorrect: false }
      ],
      explanation: 'Âm /ʃ/ là âm s nặng trong tiếng Anh, bắt buộc phải chu tròn môi để âm thanh vang dày.'
    }
  }
];
