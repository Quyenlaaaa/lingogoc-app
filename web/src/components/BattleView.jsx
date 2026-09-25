import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Flame,
  RotateCcw,
  Swords,
  Timer,
  Volume2,
  XCircle,
} from 'lucide-react';
import { speakText } from '../utils/speechHelper';
import { dispatchLearningEvent } from '../utils/learningEventEngine';
import { getVocabularyPresentation } from '../utils/vocabularyPresentation';

const ROUND_SECONDS = 60;

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export default function BattleView({ onUpdateUserData, vocabulary = [] }) {
  const [gameState, setGameState] = useState('idle');
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [score, setScore] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState(0);
  const [combo, setCombo] = useState(1);
  const [maxCombo, setMaxCombo] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const rewardGrantedRef = useRef(false);
  const roundIdRef = useRef(crypto.randomUUID());
  const quizVocabulary = useMemo(() => vocabulary
    .map((word) => ({ ...word, presentation: getVocabularyPresentation(word) }))
    .filter((word) => word.presentation.meaningSource !== 'pending'), [vocabulary]);

  const generateQuestion = useCallback(() => {
    if (quizVocabulary.length < 4) return null;
    const target = quizVocabulary[Math.floor(Math.random() * quizVocabulary.length)];
    const distractors = shuffled(quizVocabulary.filter((item) => item.id !== target.id)).slice(0, 3);
    return {
      id: crypto.randomUUID(),
      targetId: target.id,
      word: target.word,
      ipa: target.presentation.ipa,
      options: shuffled([
        { id: target.id, text: target.presentation.meaning, isCorrect: true },
        ...distractors.map((item) => ({ id: item.id, text: item.presentation.meaning, isCorrect: false })),
      ]),
    };
  }, [quizVocabulary]);

  const startRound = () => {
    rewardGrantedRef.current = false;
    roundIdRef.current = crypto.randomUUID();
    setTimeLeft(ROUND_SECONDS);
    setScore(0);
    setCorrectAnswers(0);
    setAnsweredQuestions(0);
    setCombo(1);
    setMaxCombo(1);
    setSelectedOption(null);
    setCurrentQuestion(generateQuestion());
    setGameState('playing');
  };

  useEffect(() => {
    if (gameState !== 'playing') return undefined;
    const timer = window.setInterval(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [gameState]);

  useEffect(() => {
    if (gameState !== 'playing' || timeLeft > 0 || rewardGrantedRef.current) return;
    rewardGrantedRef.current = true;
    const reward = Math.min(50, 10 + correctAnswers * 2);
    const result = dispatchLearningEvent({
      id: `solo-challenge:${roundIdRef.current}`,
      type: 'xp.awarded',
      source: 'solo-challenge',
      payload: { xp: reward },
    });
    onUpdateUserData?.(result.userData);
    setGameState('ended');
  }, [correctAnswers, gameState, onUpdateUserData, timeLeft]);

  const selectOption = (option) => {
    if (selectedOption !== null || gameState !== 'playing') return;
    setSelectedOption(option.id);
    setAnsweredQuestions((current) => current + 1);
    const reviewResult = dispatchLearningEvent({
      id: `solo-challenge-review:${currentQuestion.id}`,
      type: 'word.reviewed',
      source: 'solo-challenge',
      payload: { wordId: currentQuestion.targetId, quality: option.isCorrect ? 3 : 1, xp: 0 },
    });
    onUpdateUserData?.(reviewResult.userData);
    if (option.isCorrect) {
      setScore((current) => current + 10 * combo);
      setCorrectAnswers((current) => current + 1);
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setMaxCombo((current) => Math.max(current, nextCombo));
    } else {
      setCombo(1);
    }
    window.setTimeout(() => {
      setSelectedOption(null);
      setCurrentQuestion(generateQuestion());
    }, 450);
  };

  if (gameState === 'idle') {
    return (
      <div className="battle-view animate-fade-in" style={{ maxWidth: '820px', margin: '0 auto', padding: '24px 16px' }}>
        <div className="card glass-card" style={{ padding: '44px 32px', textAlign: 'center' }}>
          <Swords size={60} color="#ef4444" />
          <div className="module-tag" style={{ margin: '18px auto 12px', width: 'fit-content' }}>Chế độ luyện tập cục bộ</div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900 }}>Thử Thách Từ Vựng Solo 60 Giây</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '12px auto 28px', lineHeight: 1.6 }}>
            Đây là bài luyện phản xạ cá nhân trên thiết bị, không phải ghép trận với người học khác.
            Trả lời đúng liên tiếp để tăng combo và cải thiện kỷ lục của chính bạn.
          </p>
          <button className="btn btn-primary" onClick={startRound} disabled={quizVocabulary.length < 4}>
            <Timer size={20} /> Bắt đầu luyện 60 giây
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'ended') {
    const accuracy = answeredQuestions ? Math.round((correctAnswers / answeredQuestions) * 100) : 0;
    return (
      <div className="battle-ended animate-fade-in" style={{ maxWidth: '700px', margin: '0 auto', padding: '36px 16px' }}>
        <div className="card glass-card" style={{ padding: '40px 32px', textAlign: 'center' }}>
          <Award size={64} color="#f59e0b" />
          <h1 style={{ fontSize: '2rem', fontWeight: 900 }}>Hoàn thành thử thách solo</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Kết quả được tính từ câu trả lời của bạn trên thiết bị này.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', margin: '28px 0' }}>
            <div className="card"><strong>{score}</strong><br /><small>Điểm</small></div>
            <div className="card"><strong>{accuracy}%</strong><br /><small>Chính xác</small></div>
            <div className="card"><strong>x{maxCombo}</strong><br /><small>Combo cao nhất</small></div>
          </div>
          <button className="btn btn-primary" onClick={startRound}><RotateCcw size={18} /> Luyện lại</button>
        </div>
      </div>
    );
  }

  return (
    <div className="battle-arena animate-fade-in" style={{ maxWidth: '820px', margin: '0 auto', padding: '16px' }}>
      <div className="card glass-card" style={{ padding: '16px 24px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><small>ĐIỂM SOLO</small><div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#38bdf8' }}>{score}</div></div>
        <div style={{ textAlign: 'center' }}><Timer size={20} /><strong> {timeLeft}s</strong></div>
        <div style={{ color: '#f59e0b', fontWeight: 800 }}><Flame size={16} /> Combo x{combo}</div>
      </div>
      {currentQuestion && (
        <div className="card glass-card" style={{ padding: '36px 28px', textAlign: 'center' }}>
          <small>CHỌN NGHĨA ĐÚNG</small>
          <h1 style={{ fontSize: '3rem', marginBottom: '4px' }}>{currentQuestion.word}</h1>
          <div style={{ color: '#818cf8', marginBottom: '12px' }}>{currentQuestion.ipa}</div>
          <button className="btn btn-outline" onClick={() => speakText(currentQuestion.word, 0.9)}>
            <Volume2 size={16} /> Phát âm
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginTop: '24px' }}>
            {currentQuestion.options.map((option) => {
              const selected = selectedOption === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => selectOption(option)}
                  disabled={selectedOption !== null}
                  className="btn btn-outline"
                  style={{ justifyContent: 'space-between', minHeight: '58px' }}
                >
                  <span>{option.text}</span>
                  {selected && option.isCorrect && <CheckCircle2 size={20} color="#10b981" />}
                  {selected && !option.isCorrect && <XCircle size={20} color="#ef4444" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
