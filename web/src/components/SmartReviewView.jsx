import React, { useRef, useState } from 'react';
import { 
  RotateCw, Volume2, Mic, MicOff, ArrowRight, Brain, Award
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { getDueWords, getSrsGradeOptions, getSrsStats } from '../utils/srsEngine';
import { speakText, startSpeechRecognition } from '../utils/speechHelper';
import { evaluatePronunciation } from '../utils/scoreEvaluator';
import { dispatchLearningEvent } from '../utils/learningEventEngine';
import { getVocabularyPresentation } from '../utils/vocabularyPresentation';

export default function SmartReviewView({ onBackToVocab, onUpdateUserData, vocabulary = [] }) {
  const sessionId = useRef(crypto.randomUUID());
  const [dueList, setDueList] = useState(() => getDueWords(vocabulary, 15));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(() => getDueWords(vocabulary, 15).length === 0);
  const [srsStats, setSrsStats] = useState(() => getSrsStats(vocabulary));

  // Speaking state
  const [isRecording, setIsRecording] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [pronounceResult, setPronounceResult] = useState(null);
  const [recognitionInstance, setRecognitionInstance] = useState(null);

  // Load due cards and stats
  const refreshCards = () => {
    const words = getDueWords(vocabulary, 15);
    setDueList(words);
    setCurrentIndex(0);
    setIsFlipped(false);
    setReviewedCount(0);
    setIsCompleted(words.length === 0);
    setSrsStats(getSrsStats(vocabulary));
  };

  const currentWord = dueList[currentIndex];
  const presentation = currentWord ? getVocabularyPresentation(currentWord) : null;
  const gradeOptions = getSrsGradeOptions(currentWord?.srsRecord);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handlePlayAudio = (text) => {
    speakText(text, 0.85);
  };

  const handleToggleRecord = () => {
    if (!currentWord) return;
    if (isRecording) {
      if (recognitionInstance) recognitionInstance.stop();
      setIsRecording(false);
      return;
    }

    setSpokenText('');
    setPronounceResult(null);
    setIsRecording(true);

    const instance = startSpeechRecognition(
      (transcript) => {
        setSpokenText(transcript);
        const evalRes = evaluatePronunciation(currentWord.word, transcript);
        setPronounceResult(evalRes);
        setIsRecording(false);
      },
      (err) => {
        console.warn('Speech error:', err);
        setIsRecording(false);
      },
      () => {
        setIsRecording(false);
      }
    );

    setRecognitionInstance(instance);
  };

  const handleGrade = (quality) => {
    if (!currentWord) return;

    const result = dispatchLearningEvent({
      id: `smart-review:${sessionId.current}:${currentWord.id}`,
      type: 'word.reviewed',
      source: 'smart-review',
      payload: { wordId: currentWord.id, quality, xp: 10 },
    });
    onUpdateUserData?.(result.userData);

    // Reset card state
    setIsFlipped(false);
    setPronounceResult(null);
    setSpokenText('');
    setReviewedCount(prev => prev + 1);

    if (currentIndex < dueList.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setIsCompleted(true);
      setSrsStats(getSrsStats(vocabulary));
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch {}
    }
  };

  // Completed Session Screen
  if (isCompleted || dueList.length === 0) {
    return (
      <div className="srs-completed animate-fade-in" style={{ maxWidth: '750px', margin: '0 auto', padding: '36px 16px' }}>
        <div className="card glass-card" style={{ padding: '48px 32px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            padding: '24px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            marginBottom: '20px'
          }}>
            <Award size={64} />
          </div>

          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Xuất Sắc! Bạn Đã Ôn Xong Mục Tiêu Hôm Nay!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '520px', margin: '0 auto 28px', lineHeight: '1.6' }}>
            Thuật toán SM-2 đã tự động xếp lịch ôn tiếp theo cho từng từ vựng dựa trên độ ghi nhớ của bạn. Hãy quay lại vào ngày mai nhé!
          </p>

          {/* Stats Badges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '36px' }}>
            <div style={{ padding: '16px', background: 'var(--surface-soft)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8' }}>{reviewedCount}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Từ vừa ôn tập</div>
            </div>
            <div style={{ padding: '16px', background: 'var(--surface-soft)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>{srsStats.learningCount}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Từ đang củng cố</div>
            </div>
            <div style={{ padding: '16px', background: 'var(--surface-soft)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>{srsStats.matureCount}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Từ đã nhớ sâu vĩnh viễn</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={refreshCards}
              className="btn btn-outline"
              style={{ padding: '14px 28px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <RotateCw size={18} />
              Ôn thêm 15 từ mới
            </button>
            {onBackToVocab && (
              <button
                onClick={onBackToVocab}
                className="btn btn-primary"
                style={{ padding: '14px 32px', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                Về kho 3000 từ vựng
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = Math.round(((currentIndex + 1) / dueList.length) * 100);

  return (
    <div className="srs-review animate-fade-in" style={{ maxWidth: '780px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Brain size={24} color="#818cf8" />
            Ôn Tập Thông Minh SRS (SM-2)
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Đường cong quên lãng Ebbinghaus • Tự động xếp lịch tối ưu
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8' }}>
            {currentIndex + 1} / {dueList.length}
          </span>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>từ hôm nay</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ height: '6px', background: 'var(--surface-medium)', borderRadius: '3px', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #10b981)', transition: 'width 0.25s ease' }} />
      </div>

      {/* Main Flashcard */}
      <div
        className="srs-card card glass-card"
        style={{
          minHeight: '380px',
          padding: '36px 28px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          borderRadius: '20px',
          border: '1.5px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.25)',
          marginBottom: '24px',
          transition: 'all 0.3s ease'
        }}
      >
        {/* Top Word Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            padding: '4px 10px',
            borderRadius: '6px',
            background: currentWord.isNew ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: currentWord.isNew ? '#38bdf8' : '#f59e0b'
          }}>
            {currentWord.isNew ? '✨ Từ mới nạp' : `🔁 Ôn tập lại (Chu kỳ: ${currentWord.srsRecord?.interval || 1} ngày)`}
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Chủ đề: {currentWord.topic}
          </span>
        </div>

        {/* Word Center */}
        <div style={{ textAlign: 'center', margin: '24px 0' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '-0.5px', margin: '0 0 10px 0', color: 'var(--text-primary)' }}>
            {currentWord.word}
          </h1>
          <div style={{ fontSize: '1.3rem', color: '#818cf8', fontFamily: 'monospace', marginBottom: '16px' }}>
            {presentation.ipa}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={() => handlePlayAudio(currentWord.word)}
              className="btn btn-outline"
              style={{ borderRadius: '24px', padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Volume2 size={18} color="#38bdf8" />
              <span>Nghe phát âm</span>
            </button>
            <button
              onClick={handleToggleRecord}
              className="btn btn-outline"
              style={{
                borderRadius: '24px',
                padding: '8px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: isRecording ? '#ef4444' : 'var(--border-color)',
                color: isRecording ? '#ef4444' : 'var(--text-primary)'
              }}
            >
              {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
              <span>{isRecording ? 'Đang nghe...' : 'Nói thử'}</span>
            </button>
          </div>

          {/* Pronounce Score Banner */}
          {pronounceResult && (
            <div style={{ marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '12px', background: 'var(--surface-soft)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Bạn nói: "{spokenText}"</span>
              <span style={{ fontWeight: 700, color: pronounceResult.score >= 70 ? '#10b981' : '#f59e0b' }}>
                ({pronounceResult.score}%)
              </span>
            </div>
          )}
        </div>

        {/* Back of Card: Meaning & Example */}
        {isFlipped ? (
          <div className="card-answer animate-fade-in" style={{
            padding: '20px',
            borderRadius: '14px',
            background: 'var(--surface-soft)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#10b981', marginBottom: '8px' }}>
              {presentation.meaning} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 400 }}>({currentWord.type})</span>
            </div>
            {presentation.primaryExample && (
              <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                <div style={{ fontStyle: 'italic', color: 'var(--text-primary)' }}>"{presentation.primaryExample.en}"</div>
                {presentation.primaryExample.vi && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {presentation.primaryExample.vi}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleFlip}
              className="btn btn-primary"
              style={{ padding: '12px 32px', fontSize: '1rem', fontWeight: 700, borderRadius: '14px' }}
            >
              Lật thẻ xem nghĩa tiếng Việt (Phím Space)
            </button>
          </div>
        )}
      </div>

      {/* 4 SM-2 Grading Buttons (Only visible after flip) */}
      {isFlipped && (
        <div className="animate-fade-in srs-grade-options" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px'
        }}>
          {gradeOptions.map((option) => (
            <button
              key={option.quality}
              onClick={() => handleGrade(option.quality)}
              aria-label={`${option.label}: ôn lại sau ${option.nextRecord.interval} ngày`}
              style={{
                padding: '14px 8px',
                borderRadius: '12px',
                border: `1px solid ${option.tone}`,
                background: option.background,
                color: option.tone,
                cursor: 'pointer',
                fontWeight: 700,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span style={{ fontSize: '1rem' }}>{option.label}</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{option.nextRecord.interval} ngày</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
