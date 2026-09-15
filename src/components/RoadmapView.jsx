// RoadmapView.jsx - Visual 4-Stage Learning Path for Beginners
import React from 'react';
import { 
  Layers, 
  BookOpen, 
  Repeat, 
  Mic, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  Volume2 
} from 'lucide-react';

export default function RoadmapView({ setActiveTab, userData }) {
  const masteredCount = userData?.masteredWords?.length || 0;
  const ipaCount = userData?.completedIpa?.length || 0;
  const reflexCount = userData?.completedReflex?.length || 0;
  const scenariosCount = userData?.completedScenarios?.length || 0;

  const stages = [
    {
      id: 'ipa',
      stageNumber: 1,
      title: 'Chặng 1: Xóa Mù Phát Âm (IPA & Ending Sounds)',
      subtitle: 'Nắm vững 16 âm dễ nhầm nhất & quy tắc âm đuôi s/z/ed',
      desc: 'Người Việt mất gốc 90% do phát âm sai dẫn đến nghe không hiểu và nói người khác không hiểu. Chặng này giúp bạn mở đúng khẩu hình và nhả âm đuôi chuẩn xác.',
      icon: Layers,
      color: '#3b82f6',
      progress: `${ipaCount}/16 âm cốt lõi`,
      status: ipaCount > 0 ? 'Đang tiến hành' : 'Khởi động',
      actionText: 'Luyện Phát Âm Ngay',
      highlights: [
        'Bảng 44 âm IPA trực quan có hướng dẫn tiếng Việt',
        'Đặc trị âm gió /s/, /z/, /θ/, /ð/, /ʃ/, /tʃ/',
        'Bí quyết bật âm đuôi -s/-es và -ed chuẩn 100%',
        'Test thử giọng qua micro với AI chấm điểm'
      ]
    },
    {
      id: 'vocab',
      stageNumber: 2,
      title: 'Chặng 2: 3000 Từ Vựng Sống Còn (Oxford 3000)',
      subtitle: 'Xây dựng vốn từ theo 3 cấp độ A1 -> A2 -> B1',
      desc: 'Chiếm 95% mọi cuộc hội thoại tiếng Anh hàng ngày. Học đa giác quan qua Flashcard 3D, nghe giọng bản xứ, quiz phản xạ và test mic phát âm từng từ.',
      icon: BookOpen,
      color: '#10b981',
      progress: `${masteredCount}/3000 từ đã thuộc`,
      status: masteredCount >= 10 ? 'Tiến độ tốt' : 'Đang học',
      actionText: 'Khám Phá 3000 Từ Vựng',
      highlights: [
        'Phân tầng A1 (căn bản), A2 (mở rộng), B1 (làm chủ)',
        '16 Chủ đề thực tế: Ăn uống, Du lịch, Mua sắm, Công sở...',
        'Flashcard 3D lật thẻ + Audio chậm 0.75x',
        'Thu âm đọc từng từ được AI chấm điểm chính xác'
      ]
    },
    {
      id: 'reflex',
      stageNumber: 3,
      title: 'Chặng 3: 50 Mẫu Câu Phản Xạ 3 Giây',
      subtitle: 'Lắp ghép từ vựng vào khung câu giao tiếp tức thì',
      desc: 'Không cần học ngữ pháp rườm rà. Bạn chỉ cần áp dụng 50 "khung xương câu thần thánh" để bật ra lời nói trong vòng 3 giây mà không cần dịch nhẩm trong đầu.',
      icon: Repeat,
      color: '#f59e0b',
      progress: `${reflexCount}/50 mẫu câu`,
      status: 'Sẵn sàng',
      actionText: 'Luyện Mẫu Câu Phản Xạ',
      highlights: [
        'Mẫu câu gọi món, hỏi đường, mua sắm, nhờ vả lịch thiệp',
        'Phương pháp "thay thế từ vựng" linh hoạt',
        'Nghe câu chuẩn và luyện nói lặp lại theo nhịp điệu',
        'Chấm điểm phát âm cả câu hoàn chỉnh'
      ]
    },
    {
      id: 'speaking',
      stageNumber: 4,
      title: 'Chặng 4: Phòng Luyện Nói AI Thực Chiến',
      subtitle: 'Nhập vai đối thoại 1-1 không sợ sai với trợ lý ảo Lily',
      desc: 'Môi trường an toàn tuyệt đối để bạn cất tiếng nói. AI phản hồi tự nhiên, giải thích bằng tiếng Việt, chấm điểm phát âm từng từ và có nút "Gợi ý câu trả lời" cứu cánh.',
      icon: Mic,
      color: '#8b5cf6',
      progress: `${scenariosCount}/5 kịch bản thực tế`,
      status: 'Phòng AI mở 24/7',
      actionText: 'Vào Phòng Luyện Nói AI',
      highlights: [
        '5 Kịch bản thực tế: Quán cafe, Sân bay, Mua sắm, Free talk',
        'Nút "Bí ý tưởng? Gợi ý câu trả lời" kèm phiên âm',
        'Chấm điểm phát âm màu sắc: Xanh (Chuẩn), Vàng, Đỏ',
        'Hỗ trợ cả Micro và Bàn phím dự phòng'
      ]
    }
  ];

  return (
    <div className="roadmap-view animate-fade-in">
      {/* Hero Welcome Banner */}
      <div className="roadmap-hero-card">
        <div className="hero-badge">
          <Sparkles size={16} />
          <span>Phương pháp độc quyền cho người mất gốc</span>
        </div>
        <h1 className="hero-title">
          Hành Trình Chinh Phục Tiếng Anh Từ Con Số 0
        </h1>
        <p className="hero-desc">
          Xóa bỏ nỗi sợ sai, xây chắc nền tảng phát âm chuẩn IPA, làm chủ 3000 từ vựng cốt lõi 
          và tự tin đối thoại cùng gia sư ảo AI kiên nhẫn nhất.
        </p>

        {/* Learning Principles */}
        <div className="hero-features-row">
          <div className="hero-feat-item">
            <ShieldCheck size={20} className="feat-icon feat-blue" />
            <span>Không sợ phán xét - AI 1-1</span>
          </div>
          <div className="hero-feat-item">
            <Zap size={20} className="feat-icon feat-emerald" />
            <span>Phản xạ tức thì 3 giây</span>
          </div>
          <div className="hero-feat-item">
            <Volume2 size={20} className="feat-icon feat-purple" />
            <span>Âm thanh chậm 0.75x dễ nghe</span>
          </div>
        </div>
      </div>

      {/* 4 Stages Progression */}
      <div className="stages-container">
        <div className="section-header-block">
          <h2 className="section-heading">Lộ Trình 4 Chặng Bài Bản</h2>
          <p className="section-subheading">Hãy đi tuần tự từ Chặng 1 đến Chặng 4 để đạt hiệu quả cao nhất</p>
        </div>

        <div className="stages-grid">
          {stages.map((stage) => {
            const Icon = stage.icon;
            return (
              <div key={stage.id} className="stage-card">
                <div className="stage-top-bar" style={{ borderColor: stage.color }}>
                  <div className="stage-badge-num" style={{ backgroundColor: stage.color }}>
                    Chặng {stage.stageNumber}
                  </div>
                  <div className="stage-progress-indicator">
                    <CheckCircle2 size={16} style={{ color: stage.color }} />
                    <span>{stage.progress}</span>
                  </div>
                </div>

                <div className="stage-card-body">
                  <div className="stage-header-info">
                    <div className="stage-icon-box" style={{ backgroundColor: `${stage.color}18`, color: stage.color }}>
                      <Icon size={28} />
                    </div>
                    <div>
                      <h3 className="stage-title">{stage.title}</h3>
                      <div className="stage-subtitle">{stage.subtitle}</div>
                    </div>
                  </div>

                  <p className="stage-description">{stage.desc}</p>

                  <div className="stage-highlights-list">
                    {stage.highlights.map((h, i) => (
                      <div key={i} className="highlight-item">
                        <span className="bullet-dot" style={{ backgroundColor: stage.color }}></span>
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="stage-card-footer">
                  <button 
                    className="stage-action-btn"
                    style={{ backgroundColor: stage.color }}
                    onClick={() => setActiveTab(stage.id)}
                  >
                    <span>{stage.actionText}</span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
