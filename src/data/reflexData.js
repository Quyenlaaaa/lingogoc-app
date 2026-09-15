// reflexData.js - 50 survival English sentence frames with instant reflexes

export const reflexSentences = [
  // 1. Nhờ vả & Yêu cầu lịch sự (Polite Requests)
  {
    id: 1,
    pattern: 'Can I have [something], please?',
    meaning: 'Cho tôi xin / Cho tôi gọi [thứ gì đó], làm ơn?',
    category: 'Ordering',
    examples: [
      { en: 'Can I have a cup of coffee, please?', vi: 'Cho tôi xin một tách cà phê được không?' },
      { en: 'Can I have the menu, please?', vi: 'Cho tôi xin thực đơn được không?' },
      { en: 'Can I have the bill, please?', vi: 'Cho tôi xin hóa đơn thanh toán nhé?' }
    ],
    tips: 'Mẫu câu thần thánh số 1 khi vào nhà hàng, quán nước, máy bay hay khách sạn.'
  },
  {
    id: 2,
    pattern: 'Could you please help me with [something]?',
    meaning: 'Bạn có thể vui lòng giúp tôi việc [gì đó] được không?',
    category: 'Requests',
    examples: [
      { en: 'Could you please help me with this bag?', vi: 'Bạn có thể giúp tôi xách chiếc túi này được không?' },
      { en: 'Could you please help me with the wifi password?', vi: 'Bạn giúp tôi mật khẩu wifi với được không?' }
    ],
    tips: 'Dùng "Could you please..." thể hiện sự văn minh, lịch thiệp hơn "Can you".'
  },
  {
    id: 3,
    pattern: 'I would like to [verb]...',
    meaning: 'Tôi muốn [làm gì đó]... (lịch sự)',
    category: 'Requests',
    examples: [
      { en: 'I would like to book a table for two.', vi: 'Tôi muốn đặt một bàn cho hai người.' },
      { en: 'I would like to check in, please.', vi: 'Tôi muốn làm thủ tục nhận phòng.' },
      { en: 'I would like to try this shirt.', vi: 'Tôi muốn thử chiếc áo này.' }
    ],
    tips: 'Thay vì nói "I want..." cộc lốc, hãy luôn dùng "I would like to..." (viết tắt là I’d like to).'
  },
  {
    id: 4,
    pattern: 'How much is [this / that]?',
    meaning: '[Cái này / cái kia] giá bao nhiêu tiền?',
    category: 'Shopping',
    examples: [
      { en: 'How much is this shirt?', vi: 'Chiếc áo sơ mi này giá bao nhiêu?' },
      { en: 'How much is a bottle of water?', vi: 'Một chai nước này giá bao nhiêu tiền?' }
    ],
    tips: 'Câu hỏi giá kinh điển khi đi mua sắm ở bất kỳ đâu trên thế giới.'
  },
  {
    id: 5,
    pattern: 'Do you have this in [size / color]?',
    meaning: 'Bạn có món này bằng [cỡ nào / màu nào] không?',
    category: 'Shopping',
    examples: [
      { en: 'Do you have this in size M?', vi: 'Bạn có chiếc này cỡ M không?' },
      { en: 'Do you have this in black?', vi: 'Bạn có mẫu này màu đen không?' }
    ],
    tips: 'Rất cần thiết khi đi mua quần áo, giày dép.'
  },
  {
    id: 6,
    pattern: 'Can I pay by [cash / card]?',
    meaning: 'Tôi có thể thanh toán bằng [tiền mặt / thẻ] được không?',
    category: 'Shopping',
    examples: [
      { en: 'Can I pay by credit card?', vi: 'Tôi có thể quẹt thẻ tín dụng được không?' },
      { en: 'Can I pay in cash?', vi: 'Tôi có thể trả bằng tiền mặt được không?' }
    ],
    tips: 'Hỏi trước khi gọi thanh toán để chuẩn bị tiền hoặc thẻ.'
  },

  // 2. Hỏi đường & Di chuyển (Directions & Travel)
  {
    id: 7,
    pattern: 'Excuse me, where is the [place]?',
    meaning: 'Xin lỗi, [địa điểm] ở đâu vậy ạ?',
    category: 'Directions',
    examples: [
      { en: 'Excuse me, where is the restroom?', vi: 'Xin lỗi, nhà vệ sinh ở đâu vậy ạ?' },
      { en: 'Excuse me, where is the nearest bus stop?', vi: 'Xin lỗi, trạm xe buýt gần nhất ở đâu?' },
      { en: 'Excuse me, where is the luggage claim?', vi: 'Xin lỗi, chỗ nhận hành lý ở đâu?' }
    ],
    tips: 'Luôn mở đầu bằng "Excuse me" trước khi hỏi người lạ để nhận được sự trợ giúp nhiệt tình.'
  },
  {
    id: 8,
    pattern: 'How do I get to [place]?',
    meaning: 'Làm thế nào để tôi đi đến được [nơi nào đó]?',
    category: 'Directions',
    examples: [
      { en: 'How do I get to the airport?', vi: 'Làm thế nào để tôi đi đến sân bay?' },
      { en: 'How do I get to the train station?', vi: 'Làm sao để tôi đi đến ga tàu hỏa?' }
    ],
    tips: 'Dùng khi muốn hỏi lộ trình đi lại chi tiết.'
  },
  {
    id: 9,
    pattern: 'Is it far from here?',
    meaning: 'Chỗ đó có xa đây không?',
    category: 'Directions',
    examples: [
      { en: 'Is it far from here? Can I walk there?', vi: 'Chỗ đó có xa đây không? Tôi đi bộ tới được không?' },
      { en: 'How long does it take to get there?', vi: 'Mất bao lâu để đến được đó?' }
    ],
    tips: 'Hỏi để quyết định nên đi bộ hay gọi taxi/grab.'
  },

  // 3. Xử lý sự cố & Giao tiếp cứu sinh (Survival Communication)
  {
    id: 10,
    pattern: 'Could you please speak more slowly?',
    meaning: 'Bạn có thể vui lòng nói chậm lại một chút được không?',
    category: 'Survival',
    examples: [
      { en: 'My English is not very good. Could you speak more slowly, please?', vi: 'Tiếng Anh của tôi chưa tốt lắm. Bạn nói chậm lại chút được không?' }
    ],
    tips: 'Câu thần chú cứu cánh của người mất gốc khi gặp người nước ngoài nói quá nhanh!'
  },
  {
    id: 11,
    pattern: 'Could you repeat that, please?',
    meaning: 'Bạn có thể nhắc lại câu đó được không?',
    category: 'Survival',
    examples: [
      { en: 'Sorry, I did not catch that. Could you repeat that, please?', vi: 'Xin lỗi, tôi chưa nghe kịp. Bạn nhắc lại giúp tôi nhé?' }
    ],
    tips: 'Tự tin hỏi lại thay vì im lặng gật đầu dù không hiểu.'
  },
  {
    id: 12,
    pattern: 'What does [word] mean?',
    meaning: 'Từ [này] có nghĩa là gì vậy?',
    category: 'Survival',
    examples: [
      { en: 'What does this word mean?', vi: 'Từ này có nghĩa là gì thế?' },
      { en: 'How do you say this in English?', vi: 'Cái này tiếng Anh nói thế nào?' }
    ],
    tips: 'Học hỏi trực tiếp từ người bản xứ hoặc trợ lý AI khi gặp từ mới.'
  },

  // 4. Chào hỏi, kết bạn & đời sống (Daily & Social)
  {
    id: 13,
    pattern: 'Nice to meet you! My name is [name].',
    meaning: 'Rất vui được gặp bạn! Tên tôi là [tên].',
    category: 'Social',
    examples: [
      { en: 'Nice to meet you! My name is Nam, I am from Vietnam.', vi: 'Rất vui được gặp bạn! Tôi tên là Nam, tôi đến từ Việt Nam.' }
    ],
    tips: 'Mẫu câu mở màn quen thuộc và thân thiện nhất.'
  },
  {
    id: 14,
    pattern: 'What do you do for a living?',
    meaning: 'Bạn làm nghề gì vậy?',
    category: 'Social',
    examples: [
      { en: 'What do you do? - I am a graphic designer.', vi: 'Bạn làm nghề gì? - Tôi là nhà thiết kế đồ họa.' }
    ],
    tips: 'Hỏi nghề nghiệp tự nhiên hơn nhiều so với "What is your job?".'
  },
  {
    id: 15,
    pattern: 'How was your day?',
    meaning: 'Hôm nay của bạn thế nào?',
    category: 'Social',
    examples: [
      { en: 'How was your day? - It was pretty busy but good!', vi: 'Hôm nay thế nào? - Khá bận nhưng vui!' }
    ],
    tips: 'Dùng để mở đầu cuộc trò chuyện thân mật với đồng nghiệp hoặc bạn bè cuối ngày.'
  }
];
