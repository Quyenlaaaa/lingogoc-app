// LeaderboardView.jsx - Bảng Xếp Hạng Hàng Tuần & Đấu Hạng (Weekly Leagues)
import React, { useState } from 'react';
import { 
  Trophy, 
  Crown, 
  Medal, 
  ArrowUp, 
  ArrowDown, 
  Flame, 
  Sparkles, 
  Swords, 
  ShieldCheck, 
  Info,
  ChevronRight
} from 'lucide-react';
import { LEAGUES, getLeaderboardWithUser } from '../data/leaderboardData';

export default function LeaderboardView({ userData, onGoToBattle }) {
  const [selectedLeague, setSelectedLeague] = useState('silver');

  const leaderboardList = getLeaderboardWithUser(userData?.xp || 120, selectedLeague);
  const currentLeagueObj = LEAGUES.find(l => l.id === selectedLeague) || LEAGUES[1];

  const top1 = leaderboardList[0];
  const top2 = leaderboardList[1];
  const top3 = leaderboardList[2];
  const restList = leaderboardList.slice(3);

  return (
    <div className="leaderboard-view animate-fade-in" style={{ maxWidth: '840px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Header Info */}
      <div className="module-header-card" style={{ marginBottom: '24px' }}>
        <div className="module-tag" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderColor: '#f59e0b' }}>
          Đấu Hạng Tuần • Gamification
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 className="module-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>Bảng Xếp Hạng & Giải Đấu</span>
              <span style={{ fontSize: '1.4rem' }}>{currentLeagueObj.icon}</span>
            </h2>
            <p className="module-desc">
              Học bài, giữ Streak và chiến thắng Đấu Trường để tích lũy XP. Top 5 học viên xuất sắc nhất sẽ được thăng hạng vào Chủ Nhật!
            </p>
          </div>

          {onGoToBattle && (
            <button
              onClick={onGoToBattle}
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #ef4444, #f59e0b)',
                border: 'none',
                padding: '12px 24px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 6px 18px rgba(239, 68, 68, 0.35)'
              }}
            >
              <Swords size={18} />
              <span>Đấu Trường 60s Cày XP</span>
            </button>
          )}
        </div>

        {/* League Switcher Carousel */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px', marginTop: '20px' }}>
          {LEAGUES.map((league) => {
            const isActive = league.id === selectedLeague;
            return (
              <button
                key={league.id}
                onClick={() => setSelectedLeague(league.id)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '14px',
                  border: `1.5px solid ${isActive ? league.color : 'var(--border-color)'}`,
                  background: isActive ? `${league.color}20` : 'rgba(255, 255, 255, 0.03)',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>{league.icon}</span>
                <span>{league.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        alignItems: 'flex-end',
        marginBottom: '28px'
      }}>
        {/* Top 2 Silver */}
        {top2 && (
          <div className="card glass-card" style={{ padding: '24px 16px', textAlign: 'center', borderRadius: '18px', order: 1 }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🥈</div>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(148, 163, 184, 0.2)', border: '2px solid #94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 8px' }}>
              {top2.avatar}
            </div>
            <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.05rem' }}>{top2.name}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#94a3b8', marginTop: '4px' }}>{top2.xp} XP</div>
            <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '4px' }}>
              <ArrowUp size={14} /> Thăng hạng
            </div>
          </div>
        )}

        {/* Top 1 Gold (Highest Podium) */}
        {top1 && (
          <div className="card glass-card" style={{
            padding: '32px 20px',
            textAlign: 'center',
            borderRadius: '20px',
            border: '2px solid #f59e0b',
            boxShadow: '0 8px 30px rgba(245, 158, 11, 0.25)',
            order: 0,
            background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.1), rgba(255, 255, 255, 0.03))'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>👑</div>
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.2)', border: '3px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', margin: '0 auto 10px' }}>
              {top1.avatar}
            </div>
            <div style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: '1.2rem' }}>{top1.name}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f59e0b', marginTop: '4px' }}>{top1.xp} XP</div>
            <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '6px' }}>
              <ArrowUp size={15} /> Quán quân tuần
            </div>
          </div>
        )}

        {/* Top 3 Bronze */}
        {top3 && (
          <div className="card glass-card" style={{ padding: '24px 16px', textAlign: 'center', borderRadius: '18px', order: 2 }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🥉</div>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(205, 127, 50, 0.2)', border: '2px solid #cd7f32', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 8px' }}>
              {top3.avatar}
            </div>
            <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.05rem' }}>{top3.name}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#cd7f32', marginTop: '4px' }}>{top3.xp} XP</div>
            <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '4px' }}>
              <ArrowUp size={14} /> Thăng hạng
            </div>
          </div>
        )}
      </div>

      {/* Ranks 4+ List Table */}
      <div className="card glass-card" style={{ padding: '16px', borderRadius: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          <span>Thứ Hạng & Học Viên</span>
          <span>Điểm Tuần</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {restList.map((item) => {
            const isUser = item.isCurrentUser;
            const isPromoting = item.rank <= 5;
            const isDemoting = item.rank >= 9;

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: '14px',
                  background: isUser ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                  border: isUser ? '2px solid #38bdf8' : '1px solid var(--border-color)',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Left: Rank & User */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{
                    width: '28px',
                    fontSize: '1rem',
                    fontWeight: 800,
                    color: isPromoting ? '#10b981' : isDemoting ? '#ef4444' : 'var(--text-secondary)',
                    textAlign: 'center'
                  }}>
                    #{item.rank}
                  </span>

                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
                    {item.avatar}
                  </div>

                  <div>
                    <div style={{ fontWeight: isUser ? 800 : 600, color: isUser ? '#38bdf8' : 'var(--text-primary)', fontSize: '0.95rem' }}>
                      {item.name} {isUser && '(Bạn)'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: isPromoting ? '#10b981' : isDemoting ? '#ef4444' : 'var(--text-muted)' }}>
                      {isPromoting ? '🟢 Khu vực thăng hạng' : isDemoting ? '🔴 Khu vực nguy cơ' : '🟡 Khu vực an toàn'}
                    </div>
                  </div>
                </div>

                {/* Right: XP Score */}
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {item.xp} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>XP</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
