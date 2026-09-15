// DictationView.jsx - Luyện Nghe Chép Chính Tả & Bắt Nối Âm (Dictation Listening)
import React, { useState, useEffect } from 'react';
import { 
  Headphones, 
  Volume2, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  ArrowRight, 
  Lightbulb, 
  Keyboard, 
  Layers,
  Award
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { dictationLessons } from '../data/dictationData';
import { speakText } from '../utils/speechHelper';
import { addXP } from '../utils/storage';

export default function DictationView({ userData, onUpdateUserData }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputMode, setInputMode] = useState('tiles'); // 'tiles' hoặc 'type'
  const [selectedWords, setSelectedWords] = useState([]);
  const [availableWords, setAvailableWords] = useState([]);
  const [typedText, setTypedText] = useState('');
  const [isEvaluated, setIsEvaluated] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const currentLesson = dictationLessons[currentIndex];

  // Xáo trộn từ khi đổi câu
  useEffect(() => {
    if (!currentLesson) return;
    const shuffled = [...currentLesson.words]
      .map(w => w.replace(/[.,?!]/g, '')) // bỏ dấu câu khi hiển thị thẻ
      .sort(() => Math.random() - 0.5);

    setAvailableWords(shuffled.map((w, idx) => ({ id: `${w}-${idx}`, text: w })));
    setSelectedWords([]);
    setTypedText('');
    setIsEvaluated(false);
    setIsCorrect(false);
    setShowHint(false);

    // Tự động phát âm thanh khi mở câu mới
    setTimeout(() => {
      speakText(currentLesson.sentence, 0.85);
    }, 400);
  }, [currentIndex]);

  const handlePlaySlow = () => {
    speakText(currentLesson.sentence, 0.7);
  };

  const handlePlayNormal = () => {
    speakText(currentLesson.sentence, 0.95);
  };

  // Chọn từ từ khay có sẵn
  const handleSelectWord = (wordItem) => {
    if (isEvaluated) return;
    setSelectedWords(prev => [...prev, wordItem]);
    setAvailableWords(prev => prev.filter(w => w.id !== wordItem.id));
  };

  // Bỏ chọn từ đưa về khay
  const handleDeselectWord = (wordItem) => {
    if (isEvaluated) return;
    setSelectedWords(prev => prev.filter(w => w.id !== wordItem.id));
    setAvailableWords(prev => [...prev, wordItem]);
  };

  const handleCheckAnswer = () => {
    if (isEvaluated) return;

    const targetClean = currentLesson.sentence.toLowerCase().replace(/[.,?!]/g, '').trim();

    let userClean = '';
    if (inputMode === 'tiles') {
      userClean = selectedWords.map(w => w.text.toLowerCase()).join(' ').trim();
    } else {
      userClean = typedText.toLowerCase().replace(/[.,?!]/g, '').trim();
    }

    const match = userClean === targetClean;
    setIsCorrect(match);
    setIsEvaluated(true);

    if (match) {
      addXP(20);
      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } catch (e) {}
    }
  };

  const handleNextLesson = () => {
    if (currentIndex < dictationLessons.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  return (
    <div className="dictation-view animate-fade-in" style={{ maxWidth: '820px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Header Info */}
      <div className="module-header-card" style={{ marginBottom: '24px' }}>
        <div className="module-tag" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', borderColor: '#818cf8' }}>
          Nghe Tách Âm • Dictation Listening
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 className="module-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Headphones size={26} color="#818cf8" />
              <span>Luyện Nghe Chép Chính Tả & Bắt Nối Âm</span>
            </h2>
            <p className="module-desc">
              Khắc phục tình trạng "người bản xứ nói dính âm nghe không kịp". 
              Nghe câu ngắn, xếp lại trật tự từ và xem phân tích các điểm nối âm tinh tế.
            </p>
          </div>

          {/* Input Mode Switcher */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setInputMode('tiles')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: inputMode === 'tiles' ? 'var(--primary)' : 'transparent',
                color: inputMode === 'tiles' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Layers size={15} />
              <span>Xếp Thẻ Từ</span>
            </button>

            <button
              onClick={() => setInputMode('type')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: inputMode === 'type' ? 'var(--primary)' : 'transparent',
                color: inputMode === 'type' ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Keyboard size={15} />
              <span>Gõ Phím</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Exercise Card */}
      <div className="card glass-card" style={{ padding: '36px 28px', borderRadius: '24px', marginBottom: '24px' }}>
        {/* Progress indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
            Bài {currentIndex + 1} / {dictationLessons.length} • {currentLesson.topic}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Độ khó: {currentLesson.difficulty}
          </span>
        </div>

        {/* Audio Listen Buttons Bar */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '32px' }}>
          <button
            onClick={handlePlaySlow}
            className="btn btn-outline"
            style={{ padding: '12px 22px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}
            title="Nghe tốc độ chậm 0.7x rõ từng âm"
          >
            <Volume2 size={20} color="#f59e0b" />
            <span style={{ fontWeight: 700 }}>🐢 Nghe Chậm (0.7x)</span>
          </button>

          <button
            onClick={handlePlayNormal}
            className="btn btn-primary"
            style={{ padding: '12px 24px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
            title="Nghe tốc độ nói tự nhiên 1.0x"
          >
            <Volume2 size={20} />
            <span>🔊 Nghe Chuẩn (1.0x)</span>
          </button>
        </div>

        {/* Work Area (Tiles Tray or Text Input) */}
        {inputMode === 'tiles' ? (
          <div>
            {/* Selected Words Tray */}
            <div style={{
              minHeight: '72px',
              padding: '14px',
              borderRadius: '16px',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '2px dashed var(--border-color)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              {selectedWords.length === 0 ? (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 'auto' }}>
                  Bấm các thẻ từ bên dưới để ghép thành câu nghe được...
                </span>
              ) : (
                selectedWords.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleDeselectWord(item)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '12px',
                      background: 'rgba(56, 189, 248, 0.2)',
                      border: '1.5px solid #38bdf8',
                      color: '#38bdf8',
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title="Bấm để bỏ từ này"
                  >
                    {item.text}
                  </button>
                ))
              )}
            </div>

            {/* Available Words Pool */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              justifyContent: 'center',
              marginBottom: '28px'
            }}>
              {availableWords.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectWord(item)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1.5px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '1.05rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {item.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Manual Typing Input
          <div style={{ marginBottom: '28px' }}>
            <textarea
              rows={3}
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder="Gõ lại chính xác câu tiếng Anh bạn vừa nghe được..."
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '14px',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1.5px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '1.1rem',
                outline: 'none',
                resize: 'none'
              }}
            />
          </div>
        )}

        {/* Evaluation Banner & Linking Sound Breakdown */}
        {isEvaluated && (
          <div className="animate-fade-in" style={{
            padding: '20px',
            borderRadius: '16px',
            background: isCorrect ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1.5px solid ${isCorrect ? '#10b981' : '#ef4444'}`,
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              {isCorrect ? <CheckCircle2 size={22} color="#10b981" /> : <XCircle size={22} color="#ef4444" />}
              <strong style={{ fontSize: '1.1rem', color: isCorrect ? '#10b981' : '#ef4444' }}>
                {isCorrect ? 'Xuất Sắc! Bạn Đã Nghe Chuẩn Xác (+20 XP)!' : 'Chưa Chính Xác Lắm, Hãy Nghe Kỹ Lại Nhé!'}
              </strong>
            </div>

            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0' }}>
              "{currentLesson.sentence}"
            </div>

            <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              🇻🇳 Dịch nghĩa: {currentLesson.translation}
            </div>

            {/* Listening Breakdown / Linking Sound Box */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.2)',
              padding: '12px 16px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              color: '#38bdf8',
              lineHeight: '1.5',
              borderLeft: '3px solid #38bdf8'
            }}>
              {currentLesson.linkingNote}
            </div>
          </div>
        )}

        {/* Hint button */}
        {!isEvaluated && showHint && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid #f59e0b',
            marginBottom: '20px',
            fontSize: '0.85rem',
            color: '#f59e0b'
          }}>
            💡 Gợi ý nghĩa tiếng Việt: <strong>{currentLesson.translation}</strong>
          </div>
        )}

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <button
            onClick={() => setShowHint(!showHint)}
            className="btn btn-outline"
            style={{ padding: '10px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Lightbulb size={16} color="#f59e0b" />
            <span>{showHint ? 'Ẩn Gợi Ý' : 'Xem Gợi Ý Dịch'}</span>
          </button>

          <div style={{ display: 'flex', gap: '12px' }}>
            {!isEvaluated ? (
              <button
                onClick={handleCheckAnswer}
                disabled={inputMode === 'tiles' ? selectedWords.length === 0 : !typedText.trim()}
                className="btn btn-primary"
                style={{ padding: '12px 28px', fontSize: '1rem', fontWeight: 700 }}
              >
                Kiểm Tra Đáp Án
              </button>
            ) : (
              <button
                onClick={handleNextLesson}
                className="btn btn-primary"
                style={{ padding: '12px 28px', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span>Câu Tiếp Theo</span>
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
