export const diagnosticSections = [
  { id: 'language', label: 'Sử dụng ngôn ngữ', shortLabel: 'Language Use', description: 'Ngữ pháp và lựa chọn cấu trúc trong ngữ cảnh', color: '#818cf8' },
  { id: 'vocabulary', label: 'Từ vựng ngữ cảnh', shortLabel: 'Vocabulary', description: 'Collocation và nghĩa phù hợp tình huống', color: '#10b981' },
  { id: 'reading', label: 'Đọc hiểu', shortLabel: 'Reading', description: 'Ý chính, chi tiết và suy luận', color: '#38bdf8' },
  { id: 'listening', label: 'Nghe hiểu', shortLabel: 'Listening', description: 'Thông tin chính trong lời nói tự nhiên', color: '#f59e0b' },
  { id: 'speaking', label: 'Nói (tùy chọn)', shortLabel: 'Speaking sample', description: 'Độ khớp khi đọc câu mẫu qua micro', color: '#f472b6' },
];

const option = (id, text) => ({ id, text });

export const diagnosticQuestions = [
  {
    id: 'lang-a1-1', section: 'language', level: 'A1', type: 'choice',
    prompt: 'Choose the best answer.',
    question: 'My sister ___ in Da Nang, but she works in Hoi An.',
    options: [option('A', 'live'), option('B', 'lives'), option('C', 'living'), option('D', 'is live')],
    correctId: 'B', explanation: 'Với chủ ngữ số ít “my sister” ở hiện tại đơn, động từ thêm -s: lives.',
  },
  {
    id: 'lang-a1-2', section: 'language', level: 'A1', type: 'choice',
    prompt: 'Choose the best answer.',
    question: 'We ___ dinner at home yesterday because the restaurant was closed.',
    options: [option('A', 'have'), option('B', 'had'), option('C', 'are having'), option('D', 'have had')],
    correctId: 'B', explanation: '“Yesterday” yêu cầu quá khứ đơn; quá khứ của have là had.',
  },
  {
    id: 'lang-a2-1', section: 'language', level: 'A2', type: 'choice',
    prompt: 'Choose the best answer.',
    question: 'I have worked for this company ___ 2022.',
    options: [option('A', 'for'), option('B', 'during'), option('C', 'since'), option('D', 'from')],
    correctId: 'C', explanation: 'Since đi với một mốc thời gian; for đi với một khoảng thời gian.',
  },
  {
    id: 'lang-b1-1', section: 'language', level: 'B1', type: 'choice',
    prompt: 'Choose the best answer.',
    question: 'If I had more free time, I ___ another language.',
    options: [option('A', 'learn'), option('B', 'will learn'), option('C', 'would learn'), option('D', 'learned')],
    correctId: 'C', explanation: 'Điều kiện loại 2 dùng If + quá khứ đơn, would + động từ nguyên mẫu.',
  },
  {
    id: 'lang-b1-2', section: 'language', level: 'B1', type: 'choice',
    prompt: 'Choose the sentence with the same meaning.',
    question: 'They postponed the meeting because the manager was ill.',
    options: [
      option('A', 'The meeting was put off because the manager was ill.'),
      option('B', 'The meeting was taken over by the ill manager.'),
      option('C', 'The manager attended the meeting despite being ill.'),
      option('D', 'They brought the meeting forward for the manager.'),
    ],
    correctId: 'A', explanation: 'Put off có nghĩa là hoãn lại, tương đương postpone.',
  },
  {
    id: 'lang-b2-1', section: 'language', level: 'B2', type: 'choice',
    prompt: 'Choose the best answer.',
    question: 'Hardly ___ when the fire alarm went off.',
    options: [
      option('A', 'the presentation had begun'),
      option('B', 'had the presentation begun'),
      option('C', 'did the presentation begin'),
      option('D', 'the presentation began'),
    ],
    correctId: 'B', explanation: 'Sau “Hardly” ở đầu câu cần đảo trợ động từ: Hardly had + subject + past participle + when...',
  },

  {
    id: 'vocab-a1-1', section: 'vocabulary', level: 'A1', type: 'choice',
    prompt: 'Choose the word that best completes the sentence.',
    question: 'Could I ___ your phone for a minute? I need to call my mother.',
    options: [option('A', 'borrow'), option('B', 'lend'), option('C', 'owe'), option('D', 'rent')],
    correctId: 'A', explanation: 'Borrow là mượn từ người khác; lend là cho người khác mượn.',
  },
  {
    id: 'vocab-a2-1', section: 'vocabulary', level: 'A2', type: 'choice',
    prompt: 'Choose the word that best completes the sentence.',
    question: 'The 7 p.m. table is not ___, but we can book one for 8:30.',
    options: [option('A', 'comfortable'), option('B', 'available'), option('C', 'ordinary'), option('D', 'responsible')],
    correctId: 'B', explanation: 'Available trong ngữ cảnh đặt bàn nghĩa là còn trống/có thể đặt.',
  },
  {
    id: 'vocab-a2-2', section: 'vocabulary', level: 'A2', type: 'choice',
    prompt: 'Choose the most natural phrase.',
    question: 'I need to ___ my phone before we leave for the airport.',
    options: [option('A', 'fill'), option('B', 'load'), option('C', 'charge'), option('D', 'power')],
    correctId: 'C', explanation: 'Charge a phone là sạc điện thoại.',
  },
  {
    id: 'vocab-b1-1', section: 'vocabulary', level: 'B1', type: 'choice',
    prompt: 'Choose the word that best completes the sentence.',
    question: 'The report must be finished by Friday. We cannot miss the ___.',
    options: [option('A', 'schedule'), option('B', 'appointment'), option('C', 'deadline'), option('D', 'occasion')],
    correctId: 'C', explanation: 'Deadline là hạn chót phải hoàn thành công việc.',
  },
  {
    id: 'vocab-b2-1', section: 'vocabulary', level: 'B2', type: 'choice',
    prompt: 'Choose the most natural collocation.',
    question: 'Several employees ___ concerns about the new data policy.',
    options: [option('A', 'raised'), option('B', 'lifted'), option('C', 'grew'), option('D', 'built')],
    correctId: 'A', explanation: 'Raise concerns là collocation tự nhiên, nghĩa là nêu lên sự lo ngại.',
  },

  {
    id: 'read-a1-1', section: 'reading', level: 'A1', type: 'choice',
    passageTitle: 'Library notice',
    passage: 'SATURDAY 14 JUNE: The library will close at 3 p.m. for maintenance. Please return books through the box beside the main entrance after 3 p.m.',
    prompt: 'Read the notice and choose the best answer.',
    question: 'What time will the library close on Saturday?',
    options: [option('A', 'At noon'), option('B', 'At 3 p.m.'), option('C', 'At 6 p.m.'), option('D', 'It will not open')],
    correctId: 'B', explanation: 'Thông báo nói rõ thư viện sẽ đóng cửa lúc 3 giờ chiều.',
  },
  {
    id: 'read-a2-1', section: 'reading', level: 'A2', type: 'choice',
    passageTitle: 'Library notice',
    passage: 'SATURDAY 14 JUNE: The library will close at 3 p.m. for maintenance. Please return books through the box beside the main entrance after 3 p.m.',
    prompt: 'Read the notice and choose the best answer.',
    question: 'What should visitors do if they return a book at 4 p.m.?',
    options: [
      option('A', 'Keep it until Monday'),
      option('B', 'Give it to the maintenance staff'),
      option('C', 'Leave it in the return box'),
      option('D', 'Take it to another library'),
    ],
    correctId: 'C', explanation: 'Sau 3 giờ, sách được trả qua hộp cạnh lối vào chính.',
  },
  {
    id: 'read-b1-1', section: 'reading', level: 'B1', type: 'choice',
    passageTitle: 'Message from a project manager',
    passage: 'Because of Friday’s rail strike, our project meeting will take place online rather than at the office. Please send me your first draft by noon on Wednesday so that everyone has time to add comments before the meeting. The Friday deadline for the final version has not changed.',
    prompt: 'Read the message and choose the best answer.',
    question: 'Why has the meeting format changed?',
    options: [
      option('A', 'The office internet is unavailable.'),
      option('B', 'Travel may be difficult on Friday.'),
      option('C', 'The final report is already complete.'),
      option('D', 'The manager will be away on Wednesday.'),
    ],
    correctId: 'B', explanation: 'Cuộc đình công đường sắt có thể gây khó khăn cho việc đi lại nên cuộc họp chuyển sang trực tuyến.',
  },
  {
    id: 'read-b1-2', section: 'reading', level: 'B1', type: 'choice',
    passageTitle: 'Message from a project manager',
    passage: 'Because of Friday’s rail strike, our project meeting will take place online rather than at the office. Please send me your first draft by noon on Wednesday so that everyone has time to add comments before the meeting. The Friday deadline for the final version has not changed.',
    prompt: 'Read the message and choose the best answer.',
    question: 'What must team members do by Wednesday noon?',
    options: [
      option('A', 'Submit an initial version of their work'),
      option('B', 'Finish and publish the final report'),
      option('C', 'Comment on every colleague’s work'),
      option('D', 'Confirm that they can travel on Friday'),
    ],
    correctId: 'A', explanation: '“First draft” là bản nháp/bản đầu tiên, cần được gửi trước trưa thứ Tư.',
  },
  {
    id: 'read-b2-1', section: 'reading', level: 'B2', type: 'choice',
    passageTitle: 'Rethinking remote work',
    passage: 'Research on remote work often appears contradictory. Some studies report higher productivity, while others point to weaker collaboration. The difference may lie less in where people work than in the nature of their tasks. Work requiring long periods of concentration can benefit from fewer interruptions, whereas projects that depend on rapid idea-sharing may suffer when every exchange must be scheduled. Effective policies should therefore respond to the work itself instead of assuming one arrangement suits everyone.',
    prompt: 'Read the paragraph and choose the best answer.',
    question: 'What is the writer’s main argument?',
    options: [
      option('A', 'Remote workers are usually more productive than office workers.'),
      option('B', 'Online collaboration tools should replace meetings.'),
      option('C', 'Work arrangements should depend on the type of task.'),
      option('D', 'Research on workplace productivity cannot be trusted.'),
    ],
    correctId: 'C', explanation: 'Tác giả cho rằng chính tính chất công việc nên quyết định cách tổ chức, không phải một chính sách chung cho mọi người.',
  },
  {
    id: 'read-b2-2', section: 'reading', level: 'B2', type: 'choice',
    passageTitle: 'Rethinking remote work',
    passage: 'Research on remote work often appears contradictory. Some studies report higher productivity, while others point to weaker collaboration. The difference may lie less in where people work than in the nature of their tasks. Work requiring long periods of concentration can benefit from fewer interruptions, whereas projects that depend on rapid idea-sharing may suffer when every exchange must be scheduled. Effective policies should therefore respond to the work itself instead of assuming one arrangement suits everyone.',
    prompt: 'Read the paragraph and choose the best answer.',
    question: 'The phrase “one arrangement suits everyone” refers to the idea that...',
    options: [
      option('A', 'all employees should follow the same working model'),
      option('B', 'employees should choose their own job responsibilities'),
      option('C', 'researchers should use the same method'),
      option('D', 'all meetings should be scheduled in advance'),
    ],
    correctId: 'A', explanation: 'Cụm này chỉ một mô hình làm việc duy nhất được áp dụng giống nhau cho tất cả nhân viên.',
  },

  {
    id: 'listen-a1-1', section: 'listening', level: 'A1', type: 'listening',
    audioPrompt: 'Hi, this is Anna. I am waiting for you outside the café, next to the flower shop.',
    prompt: 'Listen up to two times and choose the best answer.',
    question: 'Where is Anna waiting?',
    options: [option('A', 'Inside the café'), option('B', 'Outside the café'), option('C', 'At the bus stop'), option('D', 'Inside the flower shop')],
    correctId: 'B', explanation: 'Anna nói “outside the café”.',
  },
  {
    id: 'listen-a2-1', section: 'listening', level: 'A2', type: 'listening',
    audioPrompt: 'The museum tour normally starts at ten thirty, but today it will begin fifteen minutes later because our guide is delayed.',
    prompt: 'Listen up to two times and choose the best answer.',
    question: 'What time will today’s tour begin?',
    options: [option('A', '10:15'), option('B', '10:30'), option('C', '10:45'), option('D', '11:15')],
    correctId: 'C', explanation: '10:30 cộng thêm 15 phút là 10:45.',
  },
  {
    id: 'listen-b1-1', section: 'listening', level: 'B1', type: 'listening',
    audioPrompt: 'I was going to drive to the conference, but parking near the venue is expensive. The train takes a little longer, but I can work on the way, so I have decided to take that instead.',
    prompt: 'Listen up to two times and choose the best answer.',
    question: 'Why did the speaker decide to travel by train?',
    options: [
      option('A', 'The conference venue changed.'),
      option('B', 'The train is the fastest option.'),
      option('C', 'The speaker does not know how to drive.'),
      option('D', 'It avoids costly parking and allows time to work.'),
    ],
    correctId: 'D', explanation: 'Người nói tránh phí đỗ xe cao và có thể làm việc trên tàu.',
  },
  {
    id: 'listen-b2-1', section: 'listening', level: 'B2', type: 'listening',
    audioPrompt: 'Although the proposal is ambitious, rejecting it now would be premature. The initial costs are considerable, but the long-term savings could outweigh them, provided that the implementation is carefully monitored.',
    prompt: 'Listen up to two times and choose the best answer.',
    question: 'What is the speaker’s attitude toward the proposal?',
    options: [
      option('A', 'Completely opposed because it is too expensive'),
      option('B', 'Cautiously supportive if progress is supervised'),
      option('C', 'Certain that it will produce immediate savings'),
      option('D', 'Uninterested because there is not enough information'),
    ],
    correctId: 'B', explanation: 'Người nói ủng hộ có điều kiện: lợi ích dài hạn có thể lớn hơn chi phí nếu việc triển khai được giám sát.',
  },

  {
    id: 'speak-a2-1', section: 'speaking', level: 'A2', type: 'speaking',
    targetPhrase: 'Could you tell me how to get to the nearest station?',
    meaning: 'Bạn có thể chỉ cho tôi cách đến nhà ga gần nhất không?',
    tip: 'Nói liền mạch theo cụm nghĩa; không cần bắt chước giọng bản xứ.',
  },
  {
    id: 'speak-b1-1', section: 'speaking', level: 'B1', type: 'speaking',
    targetPhrase: 'I would prefer to work from home because I can concentrate better there.',
    meaning: 'Tôi thích làm việc ở nhà hơn vì tôi có thể tập trung tốt hơn ở đó.',
    tip: 'Giữ nhịp tự nhiên và phát âm rõ các từ khóa “prefer”, “concentrate”, “better”.',
  },
];

const OBJECTIVE_SECTIONS = ['language', 'vocabulary', 'reading', 'listening'];
const LEVELS = ['A1', 'A2', 'B1', 'B2'];

function percent(correct, total) {
  return total ? Math.round((correct / total) * 100) : 0;
}

export function evaluateDiagnosticResults(answers, speakingScores) {
  const breakdown = {};
  const bandStats = {};

  diagnosticSections.forEach((section) => {
    const questions = diagnosticQuestions.filter((question) => question.section === section.id);
    if (section.id === 'speaking') {
      const attempted = questions.filter((question) => Number.isFinite(speakingScores[question.id]));
      const totalScore = attempted.reduce((sum, question) => sum + speakingScores[question.id], 0);
      breakdown.speaking = {
        label: section.label,
        score: attempted.length ? Math.round(totalScore / attempted.length) : null,
        attempted: attempted.length,
        total: questions.length,
      };
      return;
    }
    const correct = questions.filter((question) => answers[question.id] === question.correctId).length;
    breakdown[section.id] = { label: section.label, score: percent(correct, questions.length), correct, total: questions.length };
  });

  LEVELS.forEach((level) => {
    const questions = diagnosticQuestions.filter((question) => OBJECTIVE_SECTIONS.includes(question.section) && question.level === level);
    const correct = questions.filter((question) => answers[question.id] === question.correctId).length;
    bandStats[level] = { correct, total: questions.length, score: percent(correct, questions.length) };
  });

  const sectionScores = OBJECTIVE_SECTIONS.map((section) => breakdown[section].score);
  const overallScore = Math.round(sectionScores.reduce((sum, score) => sum + score, 0) / sectionScores.length);
  const answeredCount = diagnosticQuestions.filter((question) => OBJECTIVE_SECTIONS.includes(question.section) && answers[question.id]).length;
  const objectiveTotal = diagnosticQuestions.filter((question) => OBJECTIVE_SECTIONS.includes(question.section)).length;

  let level = 'Pre-A1';
  if (overallScore >= 75 && bandStats.B2.score >= 50 && bandStats.B1.score >= 67) level = 'B2';
  else if (overallScore >= 58 && bandStats.B1.score >= 50 && bandStats.A2.score >= 60) level = 'B1';
  else if (overallScore >= 40 && bandStats.A2.score >= 40) level = 'A2';
  else if (overallScore >= 20 || bandStats.A1.score >= 50) level = 'A1';

  const profiles = {
    'Pre-A1': {
      title: 'Khởi đầu (Pre-A1)', targetStage: 1,
      canDo: 'Bạn đang xây dựng khả năng nhận biết các từ và mẫu câu rất quen thuộc.',
      summary: 'Nền tảng hiện tại chưa ổn định ở các tình huống giao tiếp cơ bản. Đây là điểm xuất phát phù hợp để củng cố âm, từ và câu ngắn.',
      recommendation: 'Bắt đầu với ngữ âm và nhóm từ A1, sau đó luyện các mẫu giới thiệu bản thân, mua sắm và hỏi thông tin.',
    },
    A1: {
      title: 'Căn bản (CEFR A1)', targetStage: 2,
      canDo: 'Có thể hiểu và dùng một số cách diễn đạt quen thuộc cho nhu cầu cụ thể.',
      summary: 'Bạn xử lý được câu đơn và thông tin trực tiếp, nhưng cần củng cố cấu trúc cơ bản và vốn từ thường ngày.',
      recommendation: 'Học từ vựng A1 theo ngữ cảnh, kết hợp hiện tại đơn, quá khứ đơn và hội thoại ngắn có hỗ trợ.',
    },
    A2: {
      title: 'Sơ trung cấp (CEFR A2)', targetStage: 3,
      canDo: 'Có thể trao đổi thông tin đơn giản trong các nhiệm vụ quen thuộc và thường ngày.',
      summary: 'Bạn hiểu tốt nội dung quen thuộc và giao tiếp theo mẫu, nhưng suy luận và diễn đạt dài hơn còn chưa ổn định.',
      recommendation: 'Tập phản xạ câu theo tình huống, nghe đoạn ngắn và mở rộng collocation A2–B1.',
    },
    B1: {
      title: 'Trung cấp (CEFR B1)', targetStage: 4,
      canDo: 'Có thể nắm ý chính của ngôn ngữ chuẩn về chủ đề quen thuộc và giải thích ngắn gọn ý kiến, kế hoạch.',
      summary: 'Bạn đã có nền tảng độc lập cho công việc, học tập và du lịch; cần tăng độ tự nhiên và chính xác ở nội dung phức tạp.',
      recommendation: 'Ưu tiên luyện nói AI, nghe B1–B2, đọc suy luận và hệ thống lại cấu trúc câu phức.',
    },
    B2: {
      title: 'Trên trung cấp (CEFR B2)', targetStage: 4,
      canDo: 'Có thể hiểu ý chính của văn bản phức tạp và tương tác khá trôi chảy về nhiều chủ đề.',
      summary: 'Bạn xử lý tốt cả thông tin trực tiếp lẫn hàm ý và đã sẵn sàng cho giao tiếp độc lập ở mức B2.',
      recommendation: 'Tập trung hội thoại tự do, tiếng Anh chuyên ngành, lập luận và phản hồi chi tiết để tiến tới C1.',
    },
  };

  const rankedSkills = OBJECTIVE_SECTIONS
    .map((section) => ({ id: section, ...breakdown[section] }))
    .sort((a, b) => b.score - a.score);
  const profile = profiles[level];

  return {
    version: 2,
    completedAt: new Date().toISOString(),
    overallScore,
    level,
    ...profile,
    breakdown,
    bandStats,
    answeredCount,
    objectiveTotal,
    strongestSkill: rankedSkills[0],
    focusSkill: rankedSkills[rankedSkills.length - 1],
    note: 'Kết quả định hướng theo CEFR, không phải chứng chỉ ngoại ngữ chính thức.',
  };
}
