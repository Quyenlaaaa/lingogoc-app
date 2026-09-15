// BattleView.jsx - Đấu Trường Từ Vựng 60 Giây (60s Vocab Battle)
import React, { useState, useEffect, useRef } from 'react';
import { 
  Swords, 
  Timer, 
  Flame, 
  Trophy, 
  Volume2, 
  RotateCcw, 
  ArrowRight, 
  Zap, 
  Sparkles, 
  Award, 
  Crown,
  ShieldAlert,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { vocabList } from '../data/vocabData';
import { speakText } from '../utils/speechHelper';
import { addXP } from '../utils/storage';

const OPPONENTS = [
  { name: 'Mai Anh', avatar: '👩‍💼', level: 'Cấp 2: Tập nói', baseSpeed: 2800, accuracy: 0.75 },
  { name: 'Quốc Bảo', avatar: '👨‍💻', level: 'Cấp 2: Tập nói', baseSpeed: 2500, accuracy: 0.8 },
  { name: 'Lan Phương', avatar: '👩‍🎓', level: 'Cấp 3: Phản xạ', baseSpeed: 2200, accuracy: 0.85 },
  { name: 'Minh Trí', avatar: '👨‍🏫', level: 'Cấp 1: Khởi động', baseSpeed: 3200, accuracy: 0.65 }
];

export default function BattleView({ userData, onUpdateUserData, onGoToLeaderboard }) {
  const [gameState, setGameState] = useState('idle'); // 'idle', 'matching', 'playing', 'ended'
  const [opponent, setOpponent] = useState(OPPONENTS[0]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [userScore, setUserScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [maxCombo, setMaxCombo] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [answerFeedback, setAnswerFeedback] = useState(null); // 'correct', 'wrong'

  const timerRef = useRef(null);
  const botTimerRef = useRef(null);

  // Sinh câu hỏi ngẫu nhiên từ 3000 từ vựng
  const generateQuestion = () => {
    if (!vocabList || vocabList.length < 4) return null;
    const randomIndex = Math.floor(Math.random() * vocabList.length);
    const targetWord = vocabList[randomIndex];

    // Lấy 3 đáp án sai
    const distractors = [];
    while (distractors.length < 3) {
      const randDist = vocabList[Math.floor(Math.random() * vocabList.length)];
      if (randDist.id !== targetWord.id && !distractors.some(d => d.id === randDist.id)) {
        distractors.push(randDist);
      }
    }

    const options = [
      { id: targetWord.id, text: targetWord.meaning, isCorrect: true },
      ...distractors.map(d => ({ id: d.id, text: d.meaning, isCorrect: false }))
    ].sort(() => Math.random() - 0.5);

    return {
      word: targetWord.word,
      ipa: targetWord.ipa,
      options,
      correctId: targetWord.id
    };
  };

  // Khởi động ghép cặp
  const handleStartMatch = () => {
    setGameState('matching');
    const randOpponent = OPPONENTS[Math.floor(Math.random() * OPPONENTS.length)];
    setOpponent(randOpponent);

    setTimeout(() => {
      setGameState('playing');
      setTimeLeft(60);
      setUserScore(0);
      setBotScore(0);
      setCombo(1);
      setMaxCombo(1);
      setSelectedOption(null);
      setAnswerFeedback(null);
      setCurrentQuestion(generateQuestion());
    }, 1500);
  };

  // Game countdown timer 60s
  useEffect(() => {
    if (gameState !== 'playing') return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleEndGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [gameState]);

  // AI Opponent bot answering logic
  useEffect(() => {
    if (gameState !== 'playing') return;

    const botInterval = setInterval(() => {
      // Xác suất đối thủ trả lời đúng
      const isBotCorrect = Math.random() < opponent.accuracy;
      if (isBotCorrect) {
        setBotScore(prev => prev + 10);
      }
    }, opponent.baseSpeed);

    botTimerRef.current = botInterval;
    return () => clearInterval(botInterval);
  }, [gameState, opponent]);

  const handleEndGame = () => {
    clearInterval(timerRef.current);
    clearInterval(botTimerRef.current);
    setGameState('ended');

    // Thưởng XP nếu thắng hoặc hòa
    if (userScore > botScore) {
      addXP(50);
      try {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      } catch (e) {}
    } else {
      addXP(20); // Điểm an ủi
    }
  };

  const handleSelectOption = (option) => {
    if (selectedOption !== null || gameState !== 'playing') return;

    setSelectedOption(option.id);

    if (option.isCorrect) {
      setAnswerFeedback('correct');
      const pointEarned = 10 * combo;
      setUserScore(prev => prev + pointEarned);
      const newCombo = combo + 1;
      setCombo(newCombo);
      if (newCombo > maxCombo) setMaxCombo(newCombo);
    } else {
      setAnswerFeedback('wrong');
      setCombo(1);
    }

    setTimeout(() => {
      setSelectedOption(null);
      setAnswerFeedback(null);
      setCurrentQuestion(generateQuestion());
    }, 450);
  };

  // 1. Màn hình Chờ / Giới thiệu
  if (gameState === 'idle') {
    return (
      <div className="battle-view animate-fade-in" style={{ maxWidth: '820px', margin: '0 auto', padding: '24px 16px' }}>
        <div className="card glass-card" style={{ padding: '44px 32px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '6px',
            background: 'linear-gradient(90deg, #ef4444, #f59e0b, #6366f1)'
          }} />

          <div style={{
            display: 'inline-flex',
            padding: '20px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(245, 158, 11, 0.2))',
            color: '#ef4444',
            marginBottom: '20px'
          }}>
            <Swords size={60} />
          </div>

          <h1 style={{ fontSize: '2.4rem', fontWeight: 900, marginBottom: '12px', color: 'var(--text-primary)' }}>
            Đấu Trường Từ Vựng 60 Giây
          </h1>
          <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', maxWidth: '580px', margin: '0 auto 28px', lineHeight: '1.6' }}>
            Thử thách phản xạ tốc độ cao! Tranh tài trả lời nhanh nghĩa 3000 từ vựng cùng học viên khác trong 60 giây nghẹt thở. Càng đúng liên tiếp, điểm nhân Combo càng khủng!
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '36px', textAlign: 'left' }}>
            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#f59e0b', marginBottom: '6px' }}>
                <Timer size={18} />
                <span>60 Giây Phản Xạ</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Mỗi câu trả lời đúng tăng tốc độ xử lý từ ngữ mà không cần dịch nhẩm trong đầu.</div>
            </div>

            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#ef4444', marginBottom: '6px' }}>
                <Flame size={18} />
                <span>Chuỗi Combo Bốc Lửa</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Đúng liên tiếp kích hoạt Combo x2, x3, x4 giúp bạn bứt phá điểm số ngoạn mục.</div>
            </div>

            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#10b981', marginBottom: '6px' }}>
                <Trophy size={18} />
                <span>Cúp Vàng & Leo Hạng</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Thắng trận nhận ngay +50 XP tích lũy trực tiếp vào Bảng Xếp Hạng Tuần.</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={handleStartMatch}
              className="btn btn-primary"
              style={{
                padding: '16px 44px',
                fontSize: '1.2rem',
                fontWeight: 800,
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #ef4444, #f59e0b)',
                border: 'none',
                boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <Swords size={24} />
              <span>Tìm Đối Thủ & Vào Trận</span>
            </button>
            {onGoToLeaderboard && (
              <button
                onClick={onGoToLeaderboard}
                className="btn btn-outline"
                style={{ padding: '16px 28px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Trophy size={20} color="#f59e0b" />
                <span>Xem Bảng Xếp Hạng</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. Màn hình Đang Ghép Cặp (Matching)
  if (gameState === 'matching') {
    return (
      <div className="battle-matching animate-fade-in" style={{ maxWidth: '650px', margin: '60px auto', textAlign: 'center' }}>
        <div className="card glass-card" style={{ padding: '48px 32px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '16px', animation: 'spin 2s linear infinite' }}>
            ⚡
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Đang Tìm Đối Thủ Cùng Cấp Độ...
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
            Hệ thống đang ghép cặp bạn với học viên có trình độ tương đương
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '28px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.2)', border: '2px solid #38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 8px' }}>
                👤
              </div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Bạn</div>
            </div>

            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ef4444' }}>VS</div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.2)', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto 8px' }}>
                {opponent.avatar}
              </div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{opponent.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{opponent.level}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Màn hình Kết Thúc Trận Đấu
  if (gameState === 'ended') {
    const isWinner = userScore > botScore;
    const isDraw = userScore === botScore;

    return (
      <div className="battle-ended animate-fade-in" style={{ maxWidth: '700px', margin: '0 auto', padding: '36px 16px' }}>
        <div className="card glass-card" style={{ padding: '40px 32px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            padding: '24px',
            borderRadius: '50%',
            background: isWinner ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: isWinner ? '#10b981' : '#ef4444',
            marginBottom: '16px'
          }}>
            {isWinner ? <Crown size={64} /> : <Award size={64} />}
          </div>

          <h1 style={{ fontSize: '2.4rem', fontWeight: 900, color: isWinner ? '#10b981' : isDraw ? '#f59e0b' : '#ef4444', marginBottom: '8px' }}>
            {isWinner ? '🏆 CHIẾN THẮNG TUYỆT ĐỐI!' : isDraw ? '🤝 KẾT QUẢ HÒA!' : '💪 ĐỪNG NẢN LÒNG!'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginBottom: '28px' }}>
            {isWinner 
              ? `Xuất sắc! Bạn đã vượt qua ${opponent.name} với phản xạ từ vựng cực đỉnh (+50 XP)!`
              : `Bạn đã thi đấu rất nỗ lực trước ${opponent.name} (+20 XP khích lệ)!`}
          </p>

          {/* Score Board Comparison */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: '24px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            marginBottom: '32px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>BẠN</div>
              <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#38bdf8' }}>{userScore}</div>
              <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600 }}>Combo cao nhất: x{maxCombo}</div>
            </div>

            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-muted)' }}>:</div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{opponent.name}</div>
              <div style={{ fontSize: '2.8rem', fontWeight: 900, color: '#ef4444' }}>{botScore}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{opponent.level}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={handleStartMatch}
              className="btn btn-primary"
              style={{ padding: '14px 32px', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <RotateCcw size={18} />
              <span>Tái Đấu Trận Khác</span>
            </button>
            {onGoToLeaderboard && (
              <button
                onClick={onGoToLeaderboard}
                className="btn btn-outline"
                style={{ padding: '14px 28px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Trophy size={18} color="#f59e0b" />
                <span>Bảng Xếp Hạng</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 4. Màn hình Trận Đấu Đang Diễn Ra (Playing)
  return (
    <div className="battle-arena animate-fade-in" style={{ maxWidth: '820px', margin: '0 auto', padding: '16px' }}>
      {/* Top Match Bar (Timer & Realtime Scores) */}
      <div className="card glass-card" style={{ padding: '16px 24px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '16px' }}>
        {/* User Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(56, 189, 248, 0.2)', border: '2px solid #38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
            👤
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Bạn</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#38bdf8' }}>{userScore} đ</div>
          </div>
        </div>

        {/* Center Timer & Combo */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 16px',
            borderRadius: '20px',
            background: timeLeft <= 10 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.08)',
            border: `1px solid ${timeLeft <= 10 ? '#ef4444' : 'var(--border-color)'}`,
            color: timeLeft <= 10 ? '#ef4444' : 'var(--text-primary)',
            fontWeight: 800,
            fontSize: '1.2rem',
            marginBottom: '4px'
          }}>
            <Timer size={20} className={timeLeft <= 10 ? 'animate-pulse' : ''} />
            <span>{timeLeft}s</span>
          </div>
          {combo > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: 800, color: '#f59e0b' }}>
              <Flame size={16} />
              <span>COMBO x{combo}!</span>
            </div>
          )}
        </div>

        {/* Opponent Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'right' }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{opponent.name}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ef4444' }}>{botScore} đ</div>
          </div>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.2)', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
            {opponent.avatar}
          </div>
        </div>
      </div>

      {/* Main Question Card */}
      {currentQuestion && (
        <div className="card glass-card" style={{ padding: '36px 28px', textAlign: 'center', borderRadius: '20px', marginBottom: '20px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Chọn nghĩa đúng của từ:
          </span>

          <div style={{ margin: '16px 0' }}>
            <h1 style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
              {currentQuestion.word}
            </h1>
            <div style={{ fontSize: '1.2rem', color: '#818cf8', fontFamily: 'monospace' }}>
              {currentQuestion.ipa}
            </div>
          </div>

          <button
            onClick={() => speakText(currentQuestion.word, 0.9)}
            className="btn btn-outline"
            style={{ borderRadius: '20px', padding: '6px 16px', marginBottom: '28px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Volume2 size={16} color="#38bdf8" />
            <span style={{ fontSize: '0.85rem' }}>Phát âm</span>
          </button>

          {/* Options Grid (4 options) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {currentQuestion.options.map((opt) => {
              const isSelected = selectedOption === opt.id;
              let btnBorder = 'var(--border-color)';
              let btnBg = 'rgba(255, 255, 255, 0.04)';

              if (isSelected) {
                if (opt.isCorrect) {
                  btnBorder = '#10b981';
                  btnBg = 'rgba(16, 185, 129, 0.2)';
                } else {
                  btnBorder = '#ef4444';
                  btnBg = 'rgba(239, 68, 68, 0.2)';
                }
              }

              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelectOption(opt)}
                  disabled={selectedOption !== null}
                  style={{
                    padding: '18px 20px',
                    borderRadius: '14px',
                    border: `1.5px solid ${btnBorder}`,
                    background: btnBg,
                    color: 'var(--text-primary)',
                    fontSize: '1.05rem',
                    fontWeight: 600,
                    cursor: selectedOption === null ? 'pointer' : 'default',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>{opt.text}</span>
                  {isSelected && opt.isCorrect && <CheckCircle2 size={20} color="#10b981" />}
                  {isSelected && !opt.isCorrect && <XCircle size={20} color="#ef4444" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
