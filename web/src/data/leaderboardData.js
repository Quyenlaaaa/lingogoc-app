// leaderboardData.js - Dữ liệu bảng xếp hạng và các giải đấu tuần (Weekly Leagues)

export const LEAGUES = [
  { id: 'bronze', name: 'Hạng Đồng', icon: '🥉', color: '#cd7f32', minXp: 0 },
  { id: 'silver', name: 'Hạng Bạc', icon: '🥈', color: '#94a3b8', minXp: 250 },
  { id: 'gold', name: 'Hạng Vàng', icon: '🥇', color: '#f59e0b', minXp: 600 },
  { id: 'diamond', name: 'Hạng Kim Cương', icon: '💎', color: '#38bdf8', minXp: 1200 },
  { id: 'champion', name: 'Hạng Quán Quân', icon: '👑', color: '#ec4899', minXp: 2000 }
];

export const MOCK_STUDENTS = [
  { id: 101, name: 'Hoàng Long', avatar: '🦁', xp: 480, streak: 12, league: 'silver' },
  { id: 102, name: 'Bảo Trâm', avatar: '🌸', xp: 435, streak: 8, league: 'silver' },
  { id: 103, name: 'Thanh Tùng', avatar: '🌲', xp: 390, streak: 6, league: 'silver' },
  { id: 104, name: 'Minh Thư', avatar: '🐱', xp: 350, streak: 5, league: 'silver' },
  { id: 105, name: 'Anh Quân', avatar: '🚀', xp: 310, streak: 4, league: 'silver' },
  { id: 106, name: 'Ngọc Hân', avatar: '🌷', xp: 275, streak: 7, league: 'silver' },
  { id: 107, name: 'Hữu Phước', avatar: '⚽', xp: 240, streak: 3, league: 'silver' },
  { id: 108, name: 'Kim Ngân', avatar: '💎', xp: 210, streak: 2, league: 'silver' },
  { id: 109, name: 'Văn Nam', avatar: '🎸', xp: 180, streak: 1, league: 'silver' },

  // Gold League
  { id: 201, name: 'Gia Bảo', avatar: '👑', xp: 1150, streak: 24, league: 'gold' },
  { id: 202, name: 'Khánh Linh', avatar: '🦄', xp: 980, streak: 19, league: 'gold' },
  { id: 203, name: 'Đức Huy', avatar: '🐯', xp: 850, streak: 15, league: 'gold' },
  { id: 204, name: 'Thảo My', avatar: '🎨', xp: 780, streak: 14, league: 'gold' },
  { id: 205, name: 'Trung Kiên', avatar: '⚡', xp: 690, streak: 11, league: 'gold' },

  // Diamond League
  { id: 301, name: 'Hải Đăng', avatar: '🦅', xp: 1850, streak: 45, league: 'diamond' },
  { id: 302, name: 'Phương Thảo', avatar: '🌟', xp: 1620, streak: 38, league: 'diamond' },
  { id: 303, name: 'Tuấn Anh', avatar: '🔥', xp: 1450, streak: 30, league: 'diamond' }
];

export function getLeaderboardWithUser(userXp = 120, selectedLeagueId = 'silver') {
  // Lọc học viên theo giải đấu
  const students = MOCK_STUDENTS.filter(s => s.league === selectedLeagueId);

  // Ghép người dùng vào danh sách
  const userEntry = {
    id: 'user-current',
    name: 'Bạn',
    avatar: '👤',
    xp: userXp,
    streak: 3,
    isCurrentUser: true,
    league: selectedLeagueId
  };

  const combined = [...students, userEntry].sort((a, b) => b.xp - a.xp);

  // Đánh số thứ hạng rank 1, 2, 3...
  return combined.map((item, index) => ({
    ...item,
    rank: index + 1
  }));
}
