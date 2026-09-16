// Navbar.jsx - Header navigation with stats, speed control, VIP badge, and navigation tabs
import React, { useEffect, useState } from 'react';
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
  Settings,
  AlertTriangle,
  ChevronDown,
  Code2,
  MoreHorizontal,
  X
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
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const tabs = [
    { id: 'roadmap', label: 'Hôm nay', icon: Compass, badge: null, primary: true },
    { id: 'ipa', label: 'Phát âm', icon: Layers, badge: null, primary: true },
    { id: 'vocab', label: 'Từ vựng', icon: BookOpen, badge: null, primary: true },
    { id: 'srs', label: 'Ôn tập', icon: Brain, badge: dueSrsCount > 0 ? `${dueSrsCount}` : null, badgeColor: '#ef4444', primary: true },
    { id: 'reflex', label: 'Phản xạ', icon: Repeat, badge: null, primary: true },
    { id: 'speaking', label: 'Luyện nói', icon: Mic, badge: null, primary: true },
    { id: 'progress', label: 'Tiến độ', icon: UserCheck, badge: null, primary: true },
    { id: 'diagnostic', label: 'Kiểm tra đầu vào', icon: Sparkles, badge: 'Gợi ý', badgeColor: '#38bdf8' },
    { id: 'it-career', label: 'Tiếng Anh ngành IT', icon: Code2, badge: 'Mới', badgeColor: '#10b981' },
    { id: 'battle', label: 'Đấu Trường 60s', icon: Swords, badge: 'PvP', badgeColor: '#ef4444' },
    { id: 'leaderboard', label: 'Xếp Hạng', icon: Trophy, badge: 'Tuần', badgeColor: '#f59e0b' },
    { id: 'dictation', label: 'Nghe Chép', icon: Headphones, badge: 'Nối Âm', badgeColor: '#818cf8' },
    { id: 'traps', label: 'Bẫy Lỗi Sai', icon: AlertTriangle, badge: 'Cặp Từ', badgeColor: '#ef4444' },
    { id: 'certificate', label: 'Chứng Chỉ', icon: Award, badge: 'A2', badgeColor: '#10b981' },
  ];
  const primaryTabs = tabs.filter((tab) => tab.primary);
  const moreTabs = tabs.filter((tab) => !tab.primary);
  const isMoreActive = moreTabs.some((tab) => tab.id === activeTab);
  const mobilePrimaryIds = ['roadmap', 'vocab', 'srs', 'speaking'];
  const mobilePrimaryTabs = tabs.filter((tab) => mobilePrimaryIds.includes(tab.id));
  const mobileExploreTabs = tabs.filter((tab) => !mobilePrimaryIds.includes(tab.id));
  const isMobileExploreActive = mobileExploreTabs.some((tab) => tab.id === activeTab);

  const selectTab = (tabId) => {
    setActiveTab(tabId);
    setIsMoreOpen(false);
  };

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsMoreOpen(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    if (isMoreOpen && window.matchMedia('(max-width: 768px)').matches) {
      document.body.classList.add('mobile-nav-open');
    }

    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.classList.remove('mobile-nav-open');
    };
  }, [isMoreOpen]);

  // Calculate Level name based on XP
  const getLevelInfo = (xp) => {
    if (xp < 200) return { level: 1, name: 'Khởi động' };
    if (xp < 600) return { level: 2, name: 'Tập nói' };
    if (xp < 1200) return { level: 3, name: 'Phản xạ' };
    return { level: 4, name: 'Tự tin' };
  };

  const levelInfo = getLevelInfo(userData?.xp || 0);

  return (
    <>
    <header className="navbar-header">
      <div className="navbar-container">
        {/* Brand Logo */}
        <button className="brand-logo" onClick={() => selectTab('roadmap')} aria-label="Về trang Hôm nay">
          <div className="brand-icon">🌱</div>
          <div className="brand-text">
            <div className="brand-title">
              <span className="brand-highlight">LingoGoc</span> AI
            </div>
            <div className="brand-subtitle">Tiếng Anh Cho Người Mất Gốc</div>
          </div>
        </button>

        {/* Stats & Gamification Bar */}
        <div className="gamification-bar">
          {/* VIP Badge or Upgrade Button */}
          {userData?.isVip ? (
            <div
              className="vip-status-pill"
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
              className="vip-upgrade-btn"
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
      <nav className="nav-tabs-wrapper" aria-label="Điều hướng chính">
        <div className="nav-tabs">
          {primaryTabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => selectTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
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
          <div className="more-nav-wrap">
            <button
              className={`nav-tab-btn ${isMoreActive ? 'active' : ''}`}
              onClick={() => setIsMoreOpen((open) => !open)}
              aria-expanded={isMoreOpen}
              aria-controls="desktop-explore-menu"
            >
              <ChevronDown size={17} />
              <span className="tab-title">Khám phá</span>
            </button>
            {isMoreOpen && (
              <div className="more-nav-menu" id="desktop-explore-menu">
                {moreTabs.map((tab) => {
                  const IconComponent = tab.icon;
                  return (
                    <button key={tab.id} onClick={() => selectTab(tab.id)}>
                      <IconComponent size={18} />
                      <span>{tab.label}</span>
                      {tab.badge && <small>{tab.badge}</small>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>

    <nav className="mobile-bottom-nav" aria-label="Điều hướng trên điện thoại">
      {mobilePrimaryTabs.map((tab) => {
        const IconComponent = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            className={isActive ? 'active' : ''}
            onClick={() => selectTab(tab.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="mobile-nav-icon">
              <IconComponent size={21} />
              {tab.badge && <small>{tab.badge}</small>}
            </span>
            <span>{tab.label}</span>
          </button>
        );
      })}
      <button
        className={isMobileExploreActive || isMoreOpen ? 'active' : ''}
        onClick={() => setIsMoreOpen(true)}
        aria-expanded={isMoreOpen}
        aria-controls="mobile-explore-sheet"
      >
        <MoreHorizontal size={21} />
        <span>Khám phá</span>
      </button>
    </nav>

    {isMoreOpen && (
      <div className="mobile-explore-layer">
        <button className="mobile-explore-backdrop" onClick={() => setIsMoreOpen(false)} aria-label="Đóng Khám phá" />
        <section
          className="mobile-explore-sheet"
          id="mobile-explore-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-explore-title"
        >
          <div className="mobile-sheet-handle" />
          <div className="mobile-sheet-header">
            <div>
              <small>TẤT CẢ TÍNH NĂNG</small>
              <h2 id="mobile-explore-title">Khám phá LingoGoc</h2>
            </div>
            <button onClick={() => setIsMoreOpen(false)} aria-label="Đóng bảng Khám phá">
              <X size={20} />
            </button>
          </div>
          <div className="mobile-explore-grid">
            {mobileExploreTabs.map((tab) => {
              const IconComponent = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className={isActive ? 'active' : ''}
                  onClick={() => selectTab(tab.id)}
                >
                  <span className="mobile-explore-icon"><IconComponent size={21} /></span>
                  <span>
                    <strong>{tab.label}</strong>
                    <small>{tab.badge || (isActive ? 'Đang mở' : 'Mở tính năng')}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    )}
    </>
  );
}
