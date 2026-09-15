// Navbar.jsx - Header navigation with stats, speed control, VIP badge, and navigation tabs
import React from 'react';
import { 
  Flame, 
  Sparkles, 
  Trophy, 
  Volume2, 
  Compass, 
  BookOpen, 
  Mic, 
  Layers, 
  Repeat, 
  UserCheck, 
  Moon, 
  Sun,
  Brain,
  Swords,
  Headphones,
  Award,
  Crown,
  Settings
} from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  userData, 
  onToggleSpeed, 
  voiceSpeed,
  theme,
  onToggleTheme,
  dueSrsCount = 0,
  onOpenVipModal,
  onOpenSettingsModal
}) {
  const tabs = [
    { id: 'roadmap', label: 'Lộ Trình', icon: Compass, badge: null },
    { id: 'diagnostic', label: 'Test Đầu Vào', icon: Sparkles, badge: 'Khuyên Dùng', badgeColor: '#38bdf8' },
    { id: 'ipa', label: 'Xóa Mù IPA', icon: Layers, badge: 'Chặng 1' },
    { id: 'vocab', label: '3000 Từ Vựng', icon: BookOpen, badge: 'Chặng 2' },
    { id: 'srs', label: 'Ôn Tập SRS', icon: Brain, badge: dueSrsCount > 0 ? `${dueSrsCount} từ` : 'SM-2', badgeColor: dueSrsCount > 0 ? '#ef4444' : '#10b981' },
    { id: 'battle', label: 'Đấu Trường 60s', icon: Swords, badge: 'PvP', badgeColor: '#ef4444' },
    { id: 'leaderboard', label: 'Xếp Hạng', icon: Trophy, badge: 'Tuần', badgeColor: '#f59e0b' },
    { id: 'audiopod', label: 'Nghe Thụ Động', icon: Headphones, badge: 'Mới', badgeColor: '#8b5cf6' },
    { id: 'certificate', label: 'Chứng Chỉ', icon: Award, badge: 'A2', badgeColor: '#10b981' },
    { id: 'reflex', label: 'Mẫu Câu 3s', icon: Repeat, badge: 'Chặng 3' },
    { id: 'speaking', label: 'Luyện Nói AI', icon: Mic, badge: 'Chặng 4' },
    { id: 'progress', label: 'Tiến Độ', icon: UserCheck, badge: null }
  ];

  // Calculate Level name based on XP
  const getLevelInfo = (xp) => {
    if (xp < 200) return { level: 1, name: 'Khởi động' };
    if (xp < 600) return { level: 2, name: 'Tập nói' };
    if (xp < 1200) return { level: 3, name: 'Phản xạ' };
    return { level: 4, name: 'Tự tin' };
  };

  const levelInfo = getLevelInfo(userData?.xp || 0);

  return (
    <header className="navbar-header">
      <div className="navbar-container">
        {/* Brand Logo */}
        <div className="brand-logo" onClick={() => setActiveTab('roadmap')}>
          <div className="brand-icon">🌱</div>
          <div className="brand-text">
            <div className="brand-title">
              <span className="brand-highlight">LingoGoc</span> AI
            </div>
            <div className="brand-subtitle">Tiếng Anh Cho Người Mất Gốc</div>
          </div>
        </div>

        {/* Stats & Gamification Bar */}
        <div className="gamification-bar">
          {/* VIP Badge or Upgrade Button */}
          {userData?.isVip ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(234, 179, 8, 0.25))',
                border: '1px solid #f59e0b',
                color: '#f59e0b',
                fontWeight: 800,
                fontSize: '0.8rem'
              }}
              title="Tài khoản VIP Pro trọn đời"
            >
              <Crown size={15} />
              <span>VIP PRO</span>
            </div>
          ) : (
            <button
              onClick={onOpenVipModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)'
              }}
              title="Nâng cấp lên VIP Pro mở khóa 3000 từ và AI không giới hạn"
            >
              <Crown size={15} />
              <span>Nâng VIP</span>
            </button>
          )}

          <div className="stat-pill streak-pill" title="Chuỗi ngày học liên tục để tạo thói quen">
            <Flame className="pill-icon flame-icon" size={18} />
            <span className="stat-val">{userData?.streak || 1}</span>
            <span className="stat-lbl">ngày</span>
          </div>

          <div className="stat-pill xp-pill" title="Điểm kinh nghiệm tích lũy khi học bài">
            <Sparkles className="pill-icon xp-icon" size={18} />
            <span className="stat-val">{userData?.xp || 0}</span>
            <span className="stat-lbl">XP</span>
          </div>

          <div className="stat-pill level-pill" title="Cấp độ người học">
            <Trophy className="pill-icon trophy-icon" size={18} />
            <span className="stat-val">Cấp {levelInfo.level}:</span>
            <span className="stat-lbl">{levelInfo.name}</span>
          </div>

          {/* Voice Speed Toggle for Beginners */}
          <button 
            className={`speed-toggle-btn ${voiceSpeed < 1 ? 'slow-active' : ''}`}
            onClick={onToggleSpeed}
            title="Điều chỉnh tốc độ nói của AI: 0.75x (Chậm cho người mới) hoặc 1.0x (Chuẩn)"
          >
            <Volume2 size={16} />
            <span>{voiceSpeed < 1 ? '🐢 0.75x' : '🐇 1.0x'}</span>
          </button>

          {/* Theme Toggle */}
          <button 
            className="theme-toggle-btn" 
            onClick={onToggleTheme}
            title="Đổi giao diện Sáng / Tối"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Settings Button */}
          {onOpenSettingsModal && (
            <button
              onClick={onOpenSettingsModal}
              className="theme-toggle-btn"
              title="Cài đặt tài khoản & sao lưu dữ liệu"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Settings size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="nav-tabs-wrapper">
        <div className="nav-tabs">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <IconComponent size={18} className="tab-icon" />
                <span className="tab-title">{tab.label}</span>
                {tab.badge && (
                  <span 
                    className="tab-badge" 
                    style={tab.badgeColor ? { background: tab.badgeColor, color: '#fff' } : {}}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
