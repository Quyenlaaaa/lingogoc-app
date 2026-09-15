// ProgressView.jsx - Learning Progress Dashboard & Gamification Badges
import React from 'react';
import { 
  Trophy, 
  Flame, 
  Sparkles, 
  BookOpen, 
  Layers, 
  Repeat, 
  Mic, 
  Award, 
  CheckCircle, 
  Lock, 
  RotateCcw 
} from 'lucide-react';

export default function ProgressView({ userData, onUpdateUserData }) {
  const masteredVocab = userData?.masteredWords?.length || 0;
  const masteredIpa = userData?.completedIpa?.length || 0;
  const masteredReflex = userData?.completedReflex?.length || 0;
  const completedScenarios = userData?.completedScenarios?.length || 0;
  const streak = userData?.streak || 1;
  const xp = userData?.xp || 0;

  // Badges logic
  const badges = [
    {
      id: 'first_step',
      title: 'Mầm Non Tiếng Anh',
      desc: 'Bắt đầu hành trình xóa bỏ mất gốc',
      icon: '🌱',
      unlocked: true
    },
    {
      id: 'voice_brave',
      title: 'Dũng Khí Bật Mic',
      desc: 'Thực hiện bài test phát âm đầu tiên qua microphone',
      icon: '🎙️',
      unlocked: masteredIpa > 0 || completedScenarios > 0
    },
    {
      id: 'vocab_50',
      title: 'Tích Lũy Vốn Từ',
      desc: 'Thuộc ít nhất 20 từ vựng cốt lõi',
      icon: '📚',
      unlocked: masteredVocab >= 20
    },
    {
      id: 'streak_3',
      title: 'Ngọn Lửa Kiên Trì',
      desc: 'Duy trì chuỗi học 3 ngày liên tiếp',
      icon: '🔥',
      unlocked: streak >= 3
    },
    {
      id: 'reflex_master',
      title: 'Phản Xạ Thần Tốc',
      desc: 'Thành thạo ít nhất 5 mẫu câu phản xạ 3 giây',
      icon: '⚡',
      unlocked: masteredReflex >= 5
    },
    {
      id: 'ai_partner',
      title: 'Bậc Thầy Đối Thoại AI',
      desc: 'Hoàn thành trọn vẹn 1 kịch bản luyện nói cùng AI',
      icon: '🤖',
      unlocked: completedScenarios >= 1
    },
    {
      id: 'vocab_500',
      title: 'Vươn Tầm Giao Tiếp',
      desc: 'Chinh phục 100 từ vựng trong kho 3000 từ',
      icon: '🏆',
      unlocked: masteredVocab >= 100
    },
    {
      id: 'fluent_master',
      title: 'Tự Do Giao Tiếp',
      desc: 'Làm chủ toàn bộ 4 chặng học bài bản',
      icon: '👑',
      unlocked: masteredVocab >= 500 && completedScenarios >= 4
    }
  ];

  const handleResetProgress = () => {
    if (window.confirm('Bạn có chắc chắn muốn thiết lập lại toàn bộ tiến độ học tập để bắt đầu lại từ đầu?')) {
      const resetData = {
        xp: 0,
        streak: 1,
        lastActiveDate: new Date().toISOString().split('T')[0],
        masteredWords: [],
        bookmarkedWords: [],
        completedIpa: [],
        completedReflex: [],
        completedScenarios: [],
        settings: userData?.settings || {}
      };
      onUpdateUserData(resetData);
    }
  };

  return (
    <div className="progress-view animate-fade-in">
      {/* Header */}
      <div className="module-header-card">
        <div className="module-tag progress-tag">Bảng Thành Tích & Hồ Sơ Cá Nhân</div>
        <h2 className="module-title">Theo Dõi Tiến Trình Vượt Mất Gốc</h2>
        <p className="module-desc">
          Mỗi từ bạn nhớ, mỗi câu bạn nói ra đều là một bước tiến vững chắc hướng tới sự tự tin.
        </p>
      </div>

      {/* Primary KPI Stats Grid */}
      <div className="progress-stats-grid">
        <div className="kpi-card kpi-xp">
          <div className="kpi-icon-box">
            <Sparkles size={24} />
          </div>
          <div className="kpi-info">
            <div className="kpi-value">{xp} XP</div>
            <div className="kpi-label">Điểm Kinh Nghiệm</div>
          </div>
        </div>

        <div className="kpi-card kpi-streak">
          <div className="kpi-icon-box">
            <Flame size={24} />
          </div>
          <div className="kpi-info">
            <div className="kpi-value">{streak} Ngày</div>
            <div className="kpi-label">Chuỗi Học Liên Tục</div>
          </div>
        </div>

        <div className="kpi-card kpi-vocab">
          <div className="kpi-icon-box">
            <BookOpen size={24} />
          </div>
          <div className="kpi-info">
            <div className="kpi-value">{masteredVocab} / 3000</div>
            <div className="kpi-label">Từ Vựng Đã Thuộc</div>
          </div>
        </div>

        <div className="kpi-card kpi-scenarios">
          <div className="kpi-icon-box">
            <Mic size={24} />
          </div>
          <div className="kpi-info">
            <div className="kpi-value">{completedScenarios} / 5</div>
            <div className="kpi-label">Kịch Bản AI Hoàn Thành</div>
          </div>
        </div>
      </div>

      {/* Progress Breakdown Bars */}
      <div className="breakdown-card">
        <h3 className="breakdown-heading">Tiến Độ Theo Từng Chặng Học:</h3>

        <div className="breakdown-list">
          {/* Chặng 1 */}
          <div className="breakdown-item">
            <div className="item-labels-row">
              <span className="item-title">Chặng 1: Xóa Mù Phát Âm (16 Âm Cốt Lõi)</span>
              <span className="item-pct">{masteredIpa} / 16 ({Math.round((masteredIpa / 16) * 100)}%)</span>
            </div>
            <div className="breakdown-track">
              <div 
                className="breakdown-fill fill-blue" 
                style={{ width: `${Math.min(100, (masteredIpa / 16) * 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Chặng 2 */}
          <div className="breakdown-item">
            <div className="item-labels-row">
              <span className="item-title">Chặng 2: 3000 Từ Vựng Thông Dụng Nhất (Oxford 3000)</span>
              <span className="item-pct">{masteredVocab} / 3000 ({((masteredVocab / 3000) * 100).toFixed(1)}%)</span>
            </div>
            <div className="breakdown-track">
              <div 
                className="breakdown-fill fill-emerald" 
                style={{ width: `${Math.min(100, (masteredVocab / 3000) * 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Chặng 3 */}
          <div className="breakdown-item">
            <div className="item-labels-row">
              <span className="item-title">Chặng 3: 50 Mẫu Câu Phản Xạ 3 Giây</span>
              <span className="item-pct">{masteredReflex} / 50 ({Math.round((masteredReflex / 50) * 100)}%)</span>
            </div>
            <div className="breakdown-track">
              <div 
                className="breakdown-fill fill-amber" 
                style={{ width: `${Math.min(100, (masteredReflex / 50) * 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Chặng 4 */}
          <div className="breakdown-item">
            <div className="item-labels-row">
              <span className="item-title">Chặng 4: Phòng Luyện Nói AI Thực Chiến</span>
              <span className="item-pct">{completedScenarios} / 5 ({Math.round((completedScenarios / 5) * 100)}%)</span>
            </div>
            <div className="breakdown-track">
              <div 
                className="breakdown-fill fill-purple" 
                style={{ width: `${Math.min(100, (completedScenarios / 5) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Achievement Badges Arena */}
      <div className="badges-section-card">
        <h3 className="breakdown-heading">Huy Hiệu Thành Tựu ({badges.filter(b => b.unlocked).length}/{badges.length}):</h3>

        <div className="badges-grid">
          {badges.map((b) => (
            <div key={b.id} className={`badge-card ${b.unlocked ? 'unlocked' : 'locked'}`}>
              <div className="badge-emoji-box">
                <span>{b.icon}</span>
                {!b.unlocked && <div className="lock-overlay"><Lock size={14} /></div>}
              </div>
              <div className="badge-info">
                <div className="badge-title">{b.title}</div>
                <div className="badge-desc">{b.desc}</div>
                <div className="badge-status-lbl">
                  {b.unlocked ? '✅ Đã đạt được' : '🔒 Chưa mở khóa'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Settings & Reset */}
      <div className="settings-danger-card">
        <div>
          <h4 className="danger-title">Quản Lý Dữ Liệu Học Tập</h4>
          <p className="danger-desc">
            Tiến độ học tập được lưu tự động trong trình duyệt của bạn (Local Storage).
          </p>
        </div>
        <button className="reset-progress-btn" onClick={handleResetProgress}>
          <RotateCcw size={16} />
          <span>Đặt lại tiến độ từ đầu</span>
        </button>
      </div>
    </div>
  );
}
