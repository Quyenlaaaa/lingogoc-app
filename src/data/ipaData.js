// ipaData.js - 44 IPA sounds with Vietnamese learner tips and ending sound focus

export const ipaSounds = [
  // 1. Phụ âm dễ gây nhầm lẫn nhất cho người Việt (Đặc trị mất gốc)
  {
    symbol: '/s/',
    name: 'Âm Xì nhẹ (Voiceless S)',
    category: 'consonant',
    isCrucial: true,
    description: 'Rất quan trọng cho âm đuôi (ending sound). Người Việt thường quên âm này!',
    mouthGuide: 'Đặt đầu lưỡi gần chân răng trên, khép răng nhẹ và thổi luồng hơi ra ngoài tạo tiếng xì xì.',
    vietnameseTip: 'Giống chữ "s" trong tiếng Việt nhưng nhẹ hơn, hơi đẩy ra liên tục. Đừng bao giờ bỏ quên khi đứng cuối từ!',
    examples: [
      { word: 'see', ipa: '/siː/', meaning: 'nhìn thấy' },
      { word: 'nice', ipa: '/naɪs/', meaning: 'tốt đẹp (chú ý xì cuối)' },
      { word: 'books', ipa: '/bʊks/', meaning: 'những cuốn sách' },
      { word: 'bus', ipa: '/bʌs/', meaning: 'xe buýt' }
    ]
  },
  {
    symbol: '/z/',
    name: 'Âm Rung Z (Voiced Z)',
    category: 'consonant',
    isCrucial: true,
    description: 'Âm đuôi của phần lớn số nhiều và động từ chia ngôi thứ 3 (plays, pens, is).',
    mouthGuide: 'Khẩu hình giống hệt âm /s/, nhưng dây thanh quản ở cổ họng phải RUNG.',
    vietnameseTip: 'Đặt tay lên cổ họng, phát âm như tiếng ong bay "zzz". Phải cảm nhận được độ rung ở cổ.',
    examples: [
      { word: 'zoo', ipa: '/zuː/', meaning: 'sở thú' },
      { word: 'easy', ipa: '/ˈiːzi/', meaning: 'dễ dàng' },
      { word: 'is', ipa: '/ɪz/', meaning: 'thì, là, ở (phải rung cuối)' },
      { word: 'rose', ipa: '/rəʊz/', meaning: 'hoa hồng' }
    ]
  },
  {
    symbol: '/θ/',
    name: 'Âm Thè Lưỡi Thổi Gió (Voiceless TH)',
    category: 'consonant',
    isCrucial: true,
    description: 'Lỗi số 1 của người Việt: Thường bị đọc nhầm thành chữ "th" hoặc "s" hay "t".',
    mouthGuide: 'Đưa đầu lưỡi ra giữa 2 hàm răng, thổi luồng hơi nhẹ qua khe giữa lưỡi và răng trên. Cổ họng KHÔNG rung.',
    vietnameseTip: 'Thè nhẹ đầu lưỡi ra kẹp giữa hai hàm răng rồi thổi gió nhẹ. Tuyệt đối không đọc thành "thờ" tiếng Việt!',
    examples: [
      { word: 'think', ipa: '/θɪŋk/', meaning: 'suy nghĩ' },
      { word: 'thank', ipa: '/θæŋk/', meaning: 'cảm ơn' },
      { word: 'mouth', ipa: '/maʊθ/', meaning: 'cái miệng (âm gió cuối)' },
      { word: 'birthday', ipa: '/ˈbɜːθdeɪ/', meaning: 'sinh nhật' }
    ]
  },
  {
    symbol: '/ð/',
    name: 'Âm Thè Lưỡi Rung Cổ (Voiced TH)',
    category: 'consonant',
    isCrucial: true,
    description: 'Gặp trong các từ siêu thông dụng: this, that, the, they, with.',
    mouthGuide: 'Khẩu hình giống âm /θ/ (đầu lưỡi thè ra giữa 2 hàm răng), nhưng thổi hơi kết hợp RUNG cổ họng.',
    vietnameseTip: 'Thè nhẹ đầu lưỡi kẹp giữa 2 răng, phát âm như chữ "d" tiếng Việt nhưng cổ họng rung mạnh.',
    examples: [
      { word: 'this', ipa: '/ðɪs/', meaning: 'cái này' },
      { word: 'that', ipa: '/ðæt/', meaning: 'cái kia' },
      { word: 'they', ipa: '/ðeɪ/', meaning: 'họ, chúng nó' },
      { word: 'mother', ipa: '/ˈmʌðə(r)/', meaning: 'mẹ' }
    ]
  },
  {
    symbol: '/ʃ/',
    name: 'Âm Suỵt Nặng (Voiceless SH)',
    category: 'consonant',
    isCrucial: true,
    description: 'Người Việt hay nhầm với âm /s/ nhẹ. Khác biệt rõ rệt giữa "see" và "she".',
    mouthGuide: 'Chu môi tròn về phía trước như đang ra hiệu giữ im lặng (Suỵt!), thổi luồng hơi mạnh ra.',
    vietnameseTip: 'Chu môi tròn về phía trước thật rõ ràng, thổi hơi như tiếng suỵt kêu em bé ngủ.',
    examples: [
      { word: 'she', ipa: '/ʃiː/', meaning: 'cô ấy' },
      { word: 'ship', ipa: '/ʃɪp/', meaning: 'tàu thuyền' },
      { word: 'wash', ipa: '/wɒʃ/', meaning: 'rửa, giặt' },
      { word: 'fish', ipa: '/fɪʃ/', meaning: 'con cá' }
    ]
  },
  {
    symbol: '/tʃ/',
    name: 'Âm Ch Bật Hơi (Voiceless CH)',
    category: 'consonant',
    isCrucial: true,
    description: 'Xuất hiện trong chair, watch, check. Cần bật hơi dứt khoát.',
    mouthGuide: 'Chu môi tròn, đầu lưỡi chạm vòm miệng trên rồi bật nhanh ra kết hợp luồng hơi mạnh.',
    vietnameseTip: 'Gần giống chữ "ch" tiếng Việt nhưng phải chu môi và bật hơi dứt khoát hơn nhiều.',
    examples: [
      { word: 'chair', ipa: '/tʃeə(r)/', meaning: 'cái ghế' },
      { word: 'watch', ipa: '/wɒtʃ/', meaning: 'xem, đồng hồ' },
      { word: 'cheese', ipa: '/tʃiːz/', meaning: 'phô mai' },
      { word: 'teacher', ipa: '/ˈtiːtʃə(r)/', meaning: 'giáo viên' }
    ]
  },
  {
    symbol: '/dʒ/',
    name: 'Âm J Rung Giọng (Voiced J)',
    category: 'consonant',
    isCrucial: true,
    description: 'Xuất hiện trong job, enjoy, age, gym.',
    mouthGuide: 'Khẩu hình giống âm /tʃ/ nhưng dây thanh quản rung mạnh ở cổ họng.',
    vietnameseTip: 'Giống chữ "gi" trong tiếng Việt miền Nam nhưng chu môi và rung cổ họng.',
    examples: [
      { word: 'job', ipa: '/dʒɒb/', meaning: 'công việc' },
      { word: 'juice', ipa: '/dʒuːs/', meaning: 'nước ép' },
      { word: 'orange', ipa: '/ˈɒrɪndʒ/', meaning: 'quả cam' },
      { word: 'enjoy', ipa: '/ɪnˈdʒɔɪ/', meaning: 'thưởng thức, thích thú' }
    ]
  },
  {
    symbol: '/t/',
    name: 'Âm T Bật Đuôi (Voiceless T)',
    category: 'consonant',
    isCrucial: true,
    description: 'Âm đuôi cốt lõi: cat, eat, what, get. Người Việt hay nuốt mất âm này.',
    mouthGuide: 'Đầu lưỡi chạm gạc trên sau răng cửa, nén hơi rồi bật nhanh đầu lưỡi ra.',
    vietnameseTip: 'Bật hơi dứt khoát như tiếng "th" nhẹ, tuyệt đối đừng nuốt âm khi ở cuối từ!',
    examples: [
      { word: 'cat', ipa: '/kæt/', meaning: 'con mèo (bật t cuối)' },
      { word: 'hot', ipa: '/hɒt/', meaning: 'nóng' },
      { word: 'tea', ipa: '/tiː/', meaning: 'trà' },
      { word: 'water', ipa: '/ˈwɔːtə(r)/', meaning: 'nước' }
    ]
  },
  {
    symbol: '/d/',
    name: 'Âm D Bật Rung (Voiced D)',
    category: 'consonant',
    isCrucial: true,
    description: 'Âm đuôi cực phổ biến trong quá khứ (-ed) và từ vựng cơ bản (good, bad, red).',
    mouthGuide: 'Vị trí lưỡi giống /t/ nhưng rung dây thanh quản khi bật âm.',
    vietnameseTip: 'Chặn hơi bằng đầu lưỡi rồi bật ra có độ rung cổ họng.',
    examples: [
      { word: 'good', ipa: '/ɡʊd/', meaning: 'tốt' },
      { word: 'bad', ipa: '/bæd/', meaning: 'xấu, tồi' },
      { word: 'day', ipa: '/deɪ/', meaning: 'ngày' },
      { word: 'food', ipa: '/fuːd/', meaning: 'thức ăn' }
    ]
  },
  {
    symbol: '/ŋ/',
    name: 'Âm Ng Mũi (Voiced NG)',
    category: 'consonant',
    isCrucial: false,
    description: 'Đuôi -ing quen thuộc trong tiếng Anh: singing, English, morning.',
    mouthGuide: 'Cuống lưỡi nâng lên chạm ngạc mềm phía sau, đẩy luồng hơi thoát ra qua đường mũi.',
    vietnameseTip: 'Rất giống âm "ng" trong tiếng Việt như từ "vàng", "sáng".',
    examples: [
      { word: 'sing', ipa: '/sɪŋ/', meaning: 'hát' },
      { word: 'morning', ipa: '/ˈmɔːnɪŋ/', meaning: 'buổi sáng' },
      { word: 'English', ipa: '/ˈɪŋɡlɪʃ/', meaning: 'tiếng Anh' },
      { word: 'king', ipa: '/kɪŋ/', meaning: 'vua' }
    ]
  },

  // 2. Nguyên âm đơn (Vowels) - Cặp ngắn và dài
  {
    symbol: '/iː/',
    name: 'Âm I Dài (Cười mỉm)',
    category: 'vowel',
    isCrucial: true,
    description: 'Khác biệt giữa "leave" (rời đi) và "live" (sống).',
    mouthGuide: 'Môi kéo sang 2 bên như đang cười tươi, phát âm chữ "i" kéo dài khoảng 1-1.5 giây.',
    vietnameseTip: 'Cười tươi sang 2 bên mang tai, phát âm "iiiii" ngân dài.',
    examples: [
      { word: 'sheep', ipa: '/ʃiːp/', meaning: 'con cừu' },
      { word: 'tea', ipa: '/tiː/', meaning: 'trà' },
      { word: 'see', ipa: '/siː/', meaning: 'nhìn thấy' },
      { word: 'eat', ipa: '/iːt/', meaning: 'ăn' }
    ]
  },
  {
    symbol: '/ɪ/',
    name: 'Âm I Ngắn (Dứt khoát)',
    category: 'vowel',
    isCrucial: true,
    description: 'Rất ngắn, hơi lai giữa chữ "i" và "ê" trong tiếng Việt.',
    mouthGuide: 'Mở miệng tự nhiên hơi hé, phát âm dứt khoát trong vòng nửa giây.',
    vietnameseTip: 'Đừng kéo dài, hơi thả lỏng miệng, phát âm nhanh gọn gần giống chữ "ê" nhẹ.',
    examples: [
      { word: 'ship', ipa: '/ʃɪp/', meaning: 'con tàu (ngắn gọn)' },
      { word: 'sit', ipa: '/sɪt/', meaning: 'ngồi' },
      { word: 'fish', ipa: '/fɪʃ/', meaning: 'con cá' },
      { word: 'big', ipa: '/bɪɡ/', meaning: 'to lớn' }
    ]
  },
  {
    symbol: '/æ/',
    name: 'Âm E Bẹt (A bẹt)',
    category: 'vowel',
    isCrucial: true,
    description: 'Âm đặc trưng trong tiếng Anh Mỹ: cat, apple, bad, man.',
    mouthGuide: 'Mở rộng miệng hết cỡ theo chiều dọc và ngang, lưỡi hạ thấp chạm chân răng cửa dưới.',
    vietnameseTip: 'Mở miệng rộng như muốn cắn quả táo to, phát âm lai giữa "a" và "e".',
    examples: [
      { word: 'cat', ipa: '/kæt/', meaning: 'con mèo' },
      { word: 'apple', ipa: '/ˈæpl/', meaning: 'quả táo' },
      { word: 'man', ipa: '/mæn/', meaning: 'người đàn ông' },
      { word: 'happy', ipa: '/ˈhæpi/', meaning: 'hạnh phúc' }
    ]
  },
  {
    symbol: '/ʌ/',
    name: 'Âm Á Ngắn (Cup / Love)',
    category: 'vowel',
    isCrucial: true,
    description: 'Gặp trong: cup, sun, love, bus, money.',
    mouthGuide: 'Miệng mở tự nhiên, lưỡi ở vị trí thấp, phát âm dứt khoát tương tự âm "á" tiếng Việt.',
    vietnameseTip: 'Khá giống chữ "ă" hoặc "ớ" trong tiếng Việt nhưng dứt khoát hơn.',
    examples: [
      { word: 'cup', ipa: '/kʌp/', meaning: 'cái tách, cốc' },
      { word: 'sun', ipa: '/sʌn/', meaning: 'mặt trời' },
      { word: 'love', ipa: '/lʌv/', meaning: 'yêu' },
      { word: 'bus', ipa: '/bʌs/', meaning: 'xe buýt' }
    ]
  },
  {
    symbol: '/uː/',
    name: 'Âm U Dài (Chu môi)',
    category: 'vowel',
    isCrucial: false,
    description: 'Gặp trong: food, blue, shoe, two.',
    mouthGuide: 'Môi chu tròn nhỏ lại phía trước, phát âm âm "u" kéo dài.',
    vietnameseTip: 'Chu môi tròn như đang huýt sáo, phát âm "uuuu" kéo dài.',
    examples: [
      { word: 'food', ipa: '/fuːd/', meaning: 'thức ăn' },
      { word: 'blue', ipa: '/bluː/', meaning: 'màu xanh lam' },
      { word: 'choose', ipa: '/tʃuːz/', meaning: 'chọn lựa' },
      { word: 'cool', ipa: '/kuːl/', meaning: 'mát mẻ, ngầu' }
    ]
  },
  {
    symbol: '/ʊ/',
    name: 'Âm U Ngắn (Thả lỏng)',
    category: 'vowel',
    isCrucial: false,
    description: 'Gặp trong: book, look, good, foot.',
    mouthGuide: 'Môi hơi tròn tự nhiên, không chu quá nhiều, phát âm "u" dứt khoát ngắn gọn.',
    vietnameseTip: 'Phát âm nhanh, thả lỏng môi, giống chữ "u" nhẹ dứt khoát.',
    examples: [
      { word: 'book', ipa: '/bʊk/', meaning: 'quyển sách' },
      { word: 'good', ipa: '/ɡʊd/', meaning: 'tốt' },
      { word: 'look', ipa: '/lʊk/', meaning: 'nhìn' },
      { word: 'put', ipa: '/pʊt/', meaning: 'đặt, để' }
    ]
  },
  {
    symbol: '/eɪ/',
    name: 'Nguyên âm đôi EI (Say, Day)',
    category: 'diphthong',
    isCrucial: false,
    description: 'Trượt từ âm /e/ sang âm /ɪ/. Rất phổ biến: face, take, name.',
    mouthGuide: 'Mở miệng phát âm /e/ rồi nhẹ nhàng khép môi mỉm cười về phía âm /ɪ/.',
    vietnameseTip: 'Giống như khi ta nói từ "ây" trong tiếng Việt nhưng mềm mại hơn.',
    examples: [
      { word: 'name', ipa: '/neɪm/', meaning: 'tên' },
      { word: 'day', ipa: '/deɪ/', meaning: 'ngày' },
      { word: 'say', ipa: '/seɪ/', meaning: 'nói' },
      { word: 'play', ipa: '/pleɪ/', meaning: 'chơi' }
    ]
  },
  {
    symbol: '/aɪ/',
    name: 'Nguyên âm đôi AI (Time, Like)',
    category: 'diphthong',
    isCrucial: false,
    description: 'Trượt từ âm /a/ sang /ɪ/: my, like, price, night.',
    mouthGuide: 'Mở rộng miệng phát âm /a/ rồi thu nhỏ môi mỉm cười trượt về /ɪ/.',
    vietnameseTip: 'Gần giống vần "ai" trong tiếng Việt như "mai", "tai".',
    examples: [
      { word: 'time', ipa: '/taɪm/', meaning: 'thời gian' },
      { word: 'like', ipa: '/laɪk/', meaning: 'thích' },
      { word: 'price', ipa: '/praɪs/', meaning: 'giá cả' },
      { word: 'fly', ipa: '/flaɪ/', meaning: 'bay' }
    ]
  },
  {
    symbol: '/oʊ/ or /əʊ/',
    name: 'Nguyên âm đôi OU (Go, Home)',
    category: 'diphthong',
    isCrucial: false,
    description: 'Âm "ô" tròn môi trong: go, no, home, phone, road.',
    mouthGuide: 'Mở miệng hơi hờ rồi chu môi tròn lại tạo thành âm "ou".',
    vietnameseTip: 'Người Việt hay đọc thành chữ "ô" cụt lủn. Hãy làm tròn môi dần ở cuối để âm sang hơn.',
    examples: [
      { word: 'go', ipa: '/ɡəʊ/', meaning: 'đi' },
      { word: 'home', ipa: '/həʊm/', meaning: 'ngôi nhà' },
      { word: 'phone', ipa: '/fəʊn/', meaning: 'điện thoại' },
      { word: 'hope', ipa: '/həʊp/', meaning: 'hy vọng' }
    ]
  }
];

export const endingSoundRules = [
  {
    title: 'Quy tắc phát âm đuôi -S / -ES',
    description: 'Người mất gốc thường bỏ quên hoặc chỉ đọc bừa thành "xì". Cần chia làm 3 trường hợp:',
    cases: [
      {
        sound: '/s/ (Gió)',
        rule: 'Sau các âm vô thanh: /p/, /t/, /k/, /f/, /θ/ (Mẹo nhớ: Thời phong kiến phương Tây)',
        examples: 'cups /kʌps/, cats /kæts/, books /bʊks/, laughs /lɑːfs/'
      },
      {
        sound: '/ɪz/ (Ít-z)',
        rule: 'Sau các âm xì/suỵt: /s/, /z/, /ʃ/, /tʃ/, /dʒ/ (Mẹo: Sông xôn xao chẳng sóng gió)',
        examples: 'buses /ˈbʌsɪz/, watches /ˈwɒtʃɪz/, dishes /ˈdɪʃɪz/, boxes /ˈbɒksɪz/'
      },
      {
        sound: '/z/ (Rung)',
        rule: 'Các trường hợp còn lại (nguyên âm và các phụ âm rung)',
        examples: 'plays /pleɪz/, pens /penz/, dogs /dɒɡz/, rooms /ruːmz/'
      }
    ]
  },
  {
    title: 'Quy tắc phát âm đuôi -ED (Quá khứ)',
    description: 'Chỉ 3 quy tắc đơn giản giúp bạn đọc chuẩn 100% mọi động từ quá khứ:',
    cases: [
      {
        sound: '/ɪd/ (Ít-đ)',
        rule: 'Động từ tận cùng bằng âm /t/ hoặc /d/ (Mẹo: Tiền Đô)',
        examples: 'wanted /ˈwɒntɪd/, needed /ˈniːdɪd/, started /ˈstɑːtɪd/'
      },
      {
        sound: '/t/ (Bật gió)',
        rule: 'Sau các âm vô thanh: /p/, /k/, /f/, /s/, /ʃ/, /tʃ/ (Mẹo: Chính phủ phát sách không thu phí)',
        examples: 'helped /helpt/, looked /lʊkt/, washed /wɒʃt/, watched /wɒtʃt/'
      },
      {
        sound: '/d/ (Rung nhẹ)',
        rule: 'Các trường hợp còn lại (nguyên âm và phụ âm rung)',
        examples: 'played /pleɪd/, cleaned /kliːnd/, lived /lɪvd/, opened /ˈəʊpənd/'
      }
    ]
  }
];
