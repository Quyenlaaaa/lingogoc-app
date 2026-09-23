// scenariosData.js - AI Speaking Roleplay Scenarios for beginners

export const aiScenarios = [
  {
    id: 'cafe',
    title: 'Order Đồ Uống Tại Quán Cà Phê',
    titleEn: 'Ordering at a Coffee Shop',
    category: 'Daily',
    difficulty: 'Dễ (A1)',
    avatar: '☕',
    partnerName: 'Mark (Barista)',
    description: 'Thực hành gọi đồ uống, chọn kích cỡ, xin mật khẩu wifi và thanh toán tại quầy.',
    introMessage: 'Hello there! Welcome to Star Coffee. What can I get started for you today?',
    introMessageVi: 'Xin chào quý khách! Chào mừng đến Star Coffee. Hôm nay tôi có thể lấy món gì cho bạn nhỉ?',
    starterHints: [
      { en: 'Can I have an iced latte, please?', vi: 'Cho tôi một ly latte đá được không?', ipa: '/kæn aɪ hæv ən aɪst ˈlɑːteɪ pliːz/' },
      { en: 'I would like a hot cappuccino, please.', vi: 'Tôi muốn gọi một cappuccino nóng.', ipa: '/aɪ wʊd laɪk ə hɒt ˌkæpʊˈtʃiːnəʊ pliːz/' },
      { en: 'What do you recommend?', vi: 'Bạn gợi ý món nào ngon nhất?', ipa: '/wɒt duː juː ˌrekəˈmend/' }
    ],
    conversationFlow: [
      {
        triggerWords: ['latte', 'cappuccino', 'coffee', 'tea', 'americano'],
        aiReply: 'Great choice! What size would you like: Small, Medium, or Large?',
        aiReplyVi: 'Lựa chọn tuyệt vời! Bạn muốn dùng cỡ nào: Nhỏ (Small), Vừa (Medium) hay Lớn (Large)?',
        hints: [
          { en: 'Medium size, please.', vi: 'Cỡ vừa, làm ơn.', ipa: '/ˈmiːdiəm saɪz pliːz/' },
          { en: 'A large one, please. Less sugar.', vi: 'Cho tôi một ly lớn, ít đường nhé.', ipa: '/ə lɑːdʒ wʌn pliːz. les ˈʃʊɡə/' }
        ]
      },
      {
        triggerWords: ['small', 'medium', 'large', 'size'],
        aiReply: 'Got it. Would you like anything to eat with that, like a croissant or chocolate muffin?',
        aiReplyVi: 'Đã rõ. Bạn có muốn dùng kèm bánh gì không, như bánh sừng bò hay bánh muffin socola?',
        hints: [
          { en: 'No thanks, just the drink.', vi: 'Không cảm ơn, chỉ đồ uống thôi.', ipa: '/nəʊ θæŋks, dʒʌst ðə drɪŋk/' },
          { en: 'Yes, a croissant please.', vi: 'Có, cho tôi một bánh sừng bò nhé.', ipa: '/jes, ə krwɑːˈsɒ̃ pliːz/' }
        ]
      },
      {
        triggerWords: ['no', 'just', 'croissant', 'muffin', 'cake', 'thanks'],
        aiReply: 'Perfect! That will be 4 dollars and 50 cents. Will you pay in cash or by card?',
        aiReplyVi: 'Tuyệt! Của bạn hết 4 đô 50 cent. Bạn sẽ trả bằng tiền mặt hay thẻ?',
        hints: [
          { en: 'Can I pay by card?', vi: 'Tôi trả bằng thẻ được không?', ipa: '/kæn aɪ peɪ baɪ kɑːd/' },
          { en: 'Here is 5 dollars in cash.', vi: 'Đây là 5 đô tiền mặt.', ipa: '/hɪər ɪz faɪv ˈdɒləz ɪn kæʃ/' }
        ]
      },
      {
        triggerWords: ['card', 'cash', 'dollars', 'pay'],
        aiReply: 'Thank you very much! Here is your receipt. Your drink will be ready in 3 minutes at the counter!',
        aiReplyVi: 'Cảm ơn bạn rất nhiều! Đây là hóa đơn của bạn. Đồ uống sẽ có sau 3 phút tại quầy nhé!',
        hints: [
          { en: 'Thank you! By the way, what is the wifi password?', vi: 'Cảm ơn bạn! Tiện thể cho tôi hỏi mật khẩu wifi là gì?', ipa: '/θæŋk juː! baɪ ðə weɪ, wɒt ɪz ðə ˈwaɪfaɪ ˈpɑːswɜːd/' },
          { en: 'Thank you, have a nice day!', vi: 'Cảm ơn, chúc bạn một ngày tốt lành!', ipa: '/θæŋk juː, hæv ə naɪs deɪ/' }
        ]
      }
    ]
  },
  {
    id: 'airport',
    title: 'Hải Quan & Xuất Nhập Cảnh Sân Bay',
    titleEn: 'Airport & Immigration',
    category: 'Travel',
    difficulty: 'Căn bản (A2)',
    avatar: '✈️',
    partnerName: 'Officer Sarah',
    description: 'Thực hành trả lời câu hỏi hải quan khi đi du lịch hoặc công tác nước ngoài.',
    introMessage: 'Good morning. Passport and boarding pass, please.',
    introMessageVi: 'Chào buổi sáng. Xin vui lòng cho tôi xem hộ chiếu và thẻ lên máy bay.',
    starterHints: [
      { en: 'Good morning, here you are.', vi: 'Chào buổi sáng, của bạn đây ạ.', ipa: '/ɡʊd ˈmɔːnɪŋ, hɪə juː ɑː/' },
      { en: 'Here is my passport and ticket.', vi: 'Đây là hộ chiếu và vé máy bay của tôi.', ipa: '/hɪər ɪz maɪ ˈpɑːspɔːt ænd ˈtɪkɪt/' }
    ],
    conversationFlow: [
      {
        triggerWords: ['here', 'passport', 'morning', 'are'],
        aiReply: 'Thank you. What is the main purpose of your trip today?',
        aiReplyVi: 'Cảm ơn bạn. Mục đích chính của chuyến đi này là gì?',
        hints: [
          { en: 'I am here for traveling and holiday.', vi: 'Tôi đến đây để đi du lịch và nghỉ mát.', ipa: '/aɪ æm hɪə fɔː ˈtrævəlɪŋ ænd ˈhɒlədeɪ/' },
          { en: 'I am visiting my friends and family.', vi: 'Tôi đi thăm bạn bè và người thân.', ipa: '/aɪ æm ˈvɪzɪtɪŋ maɪ frendz ænd ˈfæməli/' },
          { en: 'I am here for business.', vi: 'Tôi đến đây vì công việc/công tác.', ipa: '/aɪ æm hɪə fɔː ˈbɪznəs/' }
        ]
      },
      {
        triggerWords: ['holiday', 'traveling', 'travel', 'business', 'friends', 'family'],
        aiReply: 'How long are you planning to stay in the country?',
        aiReplyVi: 'Bạn dự định sẽ ở lại đất nước này trong bao lâu?',
        hints: [
          { en: 'I will stay for two weeks.', vi: 'Tôi sẽ ở lại trong hai tuần.', ipa: '/aɪ wɪl steɪ fɔː tuː wiːks/' },
          { en: 'Just about five days.', vi: 'Chỉ khoảng năm ngày thôi.', ipa: '/dʒʌst əˈbaʊt faɪv deɪz/' }
        ]
      },
      {
        triggerWords: ['weeks', 'days', 'month', 'stay', 'time'],
        aiReply: 'Where will you be staying during your visit?',
        aiReplyVi: 'Bạn sẽ lưu trú tại đâu trong thời gian thăm quan?',
        hints: [
          { en: 'I will stay at a hotel in the city center.', vi: 'Tôi sẽ ở khách sạn tại trung tâm thành phố.', ipa: '/aɪ wɪl steɪ æt ə həʊˈtel ɪn ðə ˈsɪti ˈsentə/' },
          { en: 'I am staying at my friend house.', vi: 'Tôi sẽ ở nhà bạn của tôi.', ipa: '/aɪ æm ˈsteɪɪŋ æt maɪ frend haʊs/' }
        ]
      },
      {
        triggerWords: ['hotel', 'staying', 'friend', 'house', 'apartment', 'center'],
        aiReply: 'Everything looks good. Welcome! Enjoy your trip.',
        aiReplyVi: 'Mọi thông tin đều chuẩn xác. Chào mừng bạn! Chúc bạn có một chuyến đi vui vẻ.',
        hints: [
          { en: 'Thank you very much! Have a great day.', vi: 'Cảm ơn rất nhiều! Chúc bạn ngày tốt lành.', ipa: '/θæŋk juː ˈveri mʌtʃ! hæv ə ɡreɪt deɪ/' }
        ]
      }
    ]
  },
  {
    id: 'shopping',
    title: 'Mua Sắm Quần Áo & Hỏi Size',
    titleEn: 'Shopping & Clothes',
    category: 'Shopping',
    difficulty: 'Dễ (A1)',
    avatar: '🛍️',
    partnerName: 'Emma (Sales Assistant)',
    description: 'Thực hành hỏi size, nhờ tìm đồ màu yêu thích, hỏi phòng thử đồ và xin giảm giá.',
    introMessage: 'Hi there! Can I help you find anything today?',
    introMessageVi: 'Xin chào! Hôm nay tôi có thể hỗ trợ bạn tìm món đồ gì không?',
    starterHints: [
      { en: 'Yes, I am looking for a jacket.', vi: 'Có, tôi đang tìm một chiếc áo khoác.', ipa: '/jes, aɪ æm ˈlʊkɪŋ fɔːr ə ˈdʒækɪt/' },
      { en: 'Do you have this shirt in medium?', vi: 'Bạn có chiếc áo này cỡ vừa không?', ipa: '/duː juː hæv ðɪs ʃɜːt ɪn ˈmiːdiəm/' },
      { en: 'I am just looking, thank you!', vi: 'Tôi chỉ đang dạo xem thôi, cảm ơn!', ipa: '/aɪ æm dʒʌst ˈlʊkɪŋ, θæŋk juː/' }
    ],
    conversationFlow: [
      {
        triggerWords: ['jacket', 'shirt', 'dress', 'pants', 'looking', 'size', 'medium'],
        aiReply: 'Sure! Here is a medium in that style. Would you like to try it on?',
        aiReplyVi: 'Chắc chắn rồi! Đây là cỡ vừa của mẫu đó. Bạn có muốn mặc thử không?',
        hints: [
          { en: 'Yes, where is the fitting room?', vi: 'Vâng, phòng thử đồ ở đâu vậy?', ipa: '/jes, weər ɪz ðə ˈfɪtɪŋ ruːm/' },
          { en: 'Do you also have this in black or navy?', vi: 'Bạn có mẫu này màu đen hay xanh than không?', ipa: '/duː juː ˈɔːlsəʊ hæv ðɪs ɪn blæk ɔː ˈneɪvi/' }
        ]
      },
      {
        triggerWords: ['fitting', 'room', 'try', 'black', 'navy', 'where'],
        aiReply: 'The fitting rooms are right around the corner on your left! Let me know if you need another size.',
        aiReplyVi: 'Phòng thử đồ ngay góc phía bên tay trái của bạn nhé! Cứ nói tôi nếu cần đổi cỡ khác.',
        hints: [
          { en: 'It fits me very well. How much is it?', vi: 'Vừa vặn với tôi lắm. Chiếc này giá bao nhiêu?', ipa: '/ɪt fɪts miː ˈveri wel. haʊ mʌtʃ ɪz ɪt/' },
          { en: 'It is a bit too small. Can I get a large?', vi: 'Hơi chật một xíu. Cho tôi thử cỡ L được không?', ipa: '/ɪt ɪz ə bɪt tuː smɔːl. kæn aɪ ɡet ə lɑːdʒ/' }
        ]
      },
      {
        triggerWords: ['fits', 'how much', 'price', 'large', 'small'],
        aiReply: 'It looks fantastic on you! It is 35 dollars, and we currently have a 10% discount at the counter!',
        aiReplyVi: 'Trông bạn mặc rất đẹp! Giá là 35 đô, và hiện tại bên mình đang giảm 10% tại quầy thanh toán đấy!',
        hints: [
          { en: 'That is awesome, I will take it!', vi: 'Tuyệt quá, tôi sẽ lấy chiếc này!', ipa: '/ðæt ɪz ˈɔːsəm, aɪ wɪl teɪk ɪt/' }
        ]
      }
    ]
  },
  {
    id: 'freetalk',
    title: 'Tâm Sự & Luyện Nói Tự Do Với Cô Giáo AI Lily',
    titleEn: 'Free Talk with AI Tutor Lily',
    category: 'Coaching',
    difficulty: 'Mọi trình độ (Tự do)',
    avatar: '👩‍🏫',
    partnerName: 'Teacher Lily',
    description: 'Không gian luyện nói 1-1 thân thiện, không lo sợ sai. Lily sẽ kiên nhẫn lắng nghe, khen ngợi và giúp bạn sửa câu.',
    introMessage: 'Hello my friend! I am Lily, your personal speaking companion. How are you feeling today? Don\'t worry about making mistakes, I\'m here to help you practice!',
    introMessageVi: 'Xin chào bạn! Mình là Lily, người bạn đồng hành luyện nói của bạn. Hôm nay bạn cảm thấy thế nào? Đừng lo lắng về việc mắc lỗi, mình ở đây để giúp bạn nói tự tin hơn!',
    starterHints: [
      { en: 'Hello Lily, I am happy to learn English with you.', vi: 'Chào Lily, tôi rất vui khi được học tiếng Anh cùng bạn.', ipa: '/həˈləʊ ˈlɪli, aɪ æm ˈhæpi tuː lɜːn ˈɪŋɡlɪʃ wɪð juː/' },
      { en: 'I am a bit nervous because my English is basic.', vi: 'Tôi hơi hồi hộp vì tiếng Anh của tôi mới ở mức căn bản.', ipa: '/aɪ æm ə bɪt ˈnɜːvəs bɪˈkəz maɪ ˈɪŋɡlɪʃ ɪz ˈbeɪsɪk/' },
      { en: 'Today was a busy day for me, but I want to practice.', vi: 'Hôm nay là một ngày bận rộn, nhưng tôi vẫn muốn luyện tập.', ipa: '/təˈdeɪ wɒz ə ˈbɪzi deɪ fɔː miː, bʌt aɪ wɒnt tuː ˈpræktɪs/' }
    ],
    conversationFlow: [
      {
        triggerWords: ['nervous', 'basic', 'beginner', 'learn', 'happy', 'busy'],
        aiReply: 'You are doing great just by speaking up! Practice makes progress every single day. Tell me, what is your favorite hobby or food?',
        aiReplyVi: 'Bạn làm rất tốt chỉ bằng việc dám cất tiếng nói! Luyện tập mỗi ngày sẽ tiến bộ không ngừng. Kể cho mình nghe, sở thích hoặc món ăn yêu thích của bạn là gì?',
        hints: [
          { en: 'I love drinking Vietnamese coffee and listening to music.', vi: 'Tôi thích uống cà phê Việt Nam và nghe nhạc.', ipa: '/aɪ lʌv ˈdrɪŋkɪŋ ˌvjetnəˈmiːz ˈkɒfi ænd ˈlɪsnɪŋ tuː ˈmjuːzɪk/' },
          { en: 'My favorite food is Pho, it is very delicious.', vi: 'Món ăn yêu thích của tôi là Phở, nó rất ngon.', ipa: '/maɪ ˈfeɪvərɪt fuːd ɪz fəʊ, ɪt ɪz ˈveri dɪˈlɪʃəs/' }
        ]
      },
      {
        triggerWords: ['coffee', 'music', 'pho', 'food', 'hobby', 'delicious', 'like', 'love'],
        aiReply: 'Vietnamese coffee and Pho are world-famous! Your pronunciation is getting clearer. What are your plans for the weekend?',
        aiReplyVi: 'Cà phê Việt Nam và Phở nổi tiếng khắp thế giới đấy! Phát âm của bạn đang ngày càng rõ ràng hơn. Cuối tuần này bạn có dự định gì chưa?',
        hints: [
          { en: 'I plan to relax at home and spend time with my family.', vi: 'Tôi dự định nghỉ ngơi ở nhà và dành thời gian cho gia đình.', ipa: '/aɪ plæn tuː rɪˈlæks æt həʊm ænd spend taɪm wɪð maɪ ˈfæməli/' },
          { en: 'I will hang out with my close friends.', vi: 'Tôi sẽ đi chơi tụ tập với bạn thân.', ipa: '/aɪ wɪl hæŋ aʊt wɪð maɪ kləʊs frendz/' }
        ]
      },
      {
        triggerWords: ['relax', 'home', 'family', 'friends', 'weekend', 'plans'],
        aiReply: 'That sounds wonderful and relaxing! You did an amazing speaking session today. Keep this daily habit and you will speak fluently very soon!',
        aiReplyVi: 'Nghe thật tuyệt vời và thư thái! Hôm nay bạn đã có một buổi luyện nói xuất sắc. Hãy duy trì thói quen mỗi ngày và bạn sẽ nói trôi chảy rất sớm thôi!',
        hints: [
          { en: 'Thank you so much Lily, see you next time!', vi: 'Cảm ơn bạn rất nhiều Lily, hẹn gặp lại lần sau!', ipa: '/θæŋk juː səʊ mʌtʃ ˈlɪli, siː juː nekst taɪm/' }
        ]
      }
    ]
  }
];
