import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, AlertCircle, Volume2, Mic, MicOff, RotateCcw, 
  ArrowRight, Award, Compass, Sparkles, Brain, Check, BarChart2, ChevronRight 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { diagnosticQuestions, evaluateDiagnosticResults } from '../data/diagnosticData';
import { speakText, startSpeechRecognition } from '../utils/speechHelper';
import { evaluatePronunciation } from '../utils/scoreEvaluator';

export default function DiagnosticTestView({ onSelectStage, onCompleteTest }) {
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [speakingScores, setSpeakingScores] = useState({});
  const [selectedOption, setSelectedOption] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [currentPronounceResult, setCurrentPronounceResult] = useState(null);
  const [recognitionInstance, setRecognitionInstance] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [result, setResult] = useState(null);

  // Load existing test result if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lingogoc_diagnostic_result');
      if (saved) {
        setResult(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const currentQ = diagnosticQuestions[currentIndex];
  const isSpeakingType = currentQ?.type === 'speaking';
  const progressPercent = Math.round(((currentIndex + 1) / diagnosticQuestions.length) * 100);

  const handleStart = () => {
    setStarted(true);
    setCurrentIndex(0);
    setAnswers({});
    setSpeakingScores({});
    setSelectedOption(null);
    setShowExplanation(false);
    setResult(null);
  };

  const handleSelectOption = (opt) => {
    if (showExplanation) return;
    setSelectedOption(opt);
    setShowExplanation(true);
    setAnswers(prev => ({ ...prev, [currentQ.id]: opt }));
  };

  const handlePlayAudio = (text) => {
    speakText(text, 0.85);
  };

  const handleToggleRecord = () => {
    if (isRecording) {
      if (recognitionInstance) recognitionInstance.stop();
      setIsRecording(false);
      return;
    }

    setSpokenText('');
    setCurrentPronounceResult(null);
    setIsRecording(true);

    const instance = startSpeechRecognition(
      (transcript) => {
        setSpokenText(transcript);
        const evalRes = evaluatePronunciation(currentQ.targetPhrase, transcript);
        setCurrentPronounceResult(evalRes);
        setSpeakingScores(prev => ({ ...prev, [currentQ.id]: evalRes.score }));
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

  const handleNext = () => {
    if (isSpeakingType && !speakingScores[currentQ.id]) {
      // If skipped speaking without score, assign 0 or neutral
      setSpeakingScores(prev => ({ ...prev, [currentQ.id]: 0 }));
    }

    setSelectedOption(null);
    setShowExplanation(false);
    setCurrentPronounceResult(null);
    setSpokenText('');

    if (currentIndex < diagnosticQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Calculate final results
      const finalResult = evaluateDiagnosticResults(answers, speakingScores);
      setResult(finalResult);
      try {
        localStorage.setItem('lingogoc_diagnostic_result', JSON.stringify(finalResult));
      } catch (e) {
        console.error(e);
      }
      if (onCompleteTest) onCompleteTest(finalResult);
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {
        // Confetti silent fail
      }
    }
  };

  // 1. Màn hình kết quả (Đã test xong)
  if (result && (!started || currentIndex === diagnosticQuestions.length - 1)) {
    return (
      <div className="diagnostic-container animate-fade-in" style={{ maxWidth: '880px', margin: '0 auto', padding: '24px 16px' }}>
        <div className="card glass-card" style={{ padding: '36px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '6px',
            background: 'linear-gradient(90deg, #6366f1, #10b981, #f59e0b)'
          }} />

          <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', marginBottom: '16px' }}>
            <Award size={48} />
          </div>

          <h2 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-primary)' }}>
            Kết Quả Chẩn Đoán Trình Độ
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '1rem' }}>
            Hệ thống AI đã phân tích toàn diện 3 kỹ năng cốt lõi của bạn
          </p>

          {/* Level Badge Banner */}
          <div style={{
            background: result.level === 'Pre-A1' 
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(249, 115, 22, 0.12))'
              : result.level === 'A1'
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(234, 179, 8, 0.12))'
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(59, 130, 246, 0.12))',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ 
              fontSize: '0.85rem', 
              fontWeight: 700, 
              textTransform: 'uppercase', 
              letterSpacing: '1px', 
              color: 'var(--text-secondary)' 
            }}>
              Cấp độ hiện tại của bạn
            </span>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#38bdf8' }}>
              {result.title}
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Điểm năng lực: <span style={{ color: '#10b981' }}>{result.overallScore}/100</span>
            </div>
          </div>

          {/* 3 Skill Breakdown Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px', textAlign: 'left' }}>
            <div className="card" style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Ngữ âm IPA</span>
                <span style={{ fontWeight: 700, color: '#818cf8' }}>{result.breakdown.ipa.score}%</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${result.breakdown.ipa.score}%`, height: '100%', background: '#818cf8', borderRadius: '4px' }} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Đúng {result.breakdown.ipa.correct}/4 câu kiểm tra âm
              </div>
            </div>

            <div className="card" style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Vốn từ vựng</span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>{result.breakdown.vocab.score}%</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${result.breakdown.vocab.score}%`, height: '100%', background: '#10b981', borderRadius: '4px' }} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Đúng {result.breakdown.vocab.correct}/4 câu từ vựng ngữ cảnh
              </div>
            </div>

            <div className="card" style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Phát âm qua Mic</span>
                <span style={{ fontWeight: 700, color: '#f59e0b' }}>{result.breakdown.speaking.score}%</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${result.breakdown.speaking.score}%`, height: '100%', background: '#f59e0b', borderRadius: '4px' }} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Điểm trung bình độ chuẩn xác giọng nói
              </div>
            </div>
          </div>

          {/* AI Tutor Advice Box */}
          <div style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '16px',
            padding: '20px',
            textAlign: 'left',
            marginBottom: '32px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <Sparkles size={22} color="#818cf8" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Nhận xét & Lộ trình đề xuất từ Gia sư AI Lily:
              </h3>
            </div>
            <p style={{ margin: '0 0 10px 0', fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              {result.summary}
            </p>
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.6', fontWeight: 600, color: '#38bdf8' }}>
              🎯 {result.recommendation}
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
            <button
              onClick={() => onSelectStage(result.targetStage || 1)}
              className="btn btn-primary"
              style={{ padding: '14px 32px', fontSize: '1.05rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '10px' }}
            >
              Áp dụng lộ trình & Bắt đầu học ngay
              <ArrowRight size={20} />
            </button>

            <button
              onClick={handleStart}
              className="btn btn-outline"
              style={{ padding: '14px 24px', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <RotateCcw size={18} />
              Làm lại bài kiểm tra
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Màn hình giới thiệu trước khi bắt đầu
  if (!started) {
    return (
      <div className="diagnostic-intro animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 16px' }}>
        <div className="card glass-card" style={{ padding: '40px 32px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            padding: '20px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(56, 189, 248, 0.2))',
            color: '#818cf8',
            marginBottom: '20px'
          }}>
            <Brain size={56} />
          </div>

          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>
            Bài Kiểm Tra Năng Lực Đầu Vào
          </h1>
          <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', maxWidth: '580px', margin: '0 auto 28px', lineHeight: '1.6' }}>
            Dành riêng cho người mất gốc hoặc chưa tự tin giao tiếp. Chỉ mất 5-10 phút để chẩn đoán chính xác lỗ hổng phát âm và xây dựng lộ trình học phù hợp nhất với bạn.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '36px', textAlign: 'left' }}>
            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700, color: '#818cf8', marginBottom: '4px' }}>1. Ngữ âm IPA</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>4 câu kiểm tra khả năng nhận diện âm dài/ngắn và quy tắc âm đuôi /-s, -ed/.</div>
            </div>

            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700, color: '#10b981', marginBottom: '4px' }}>2. Vốn từ vựng</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>4 câu trắc nghiệm từ vựng ngữ cảnh thực tế phổ biến nhất trong đời sống.</div>
            </div>

            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: '4px' }}>3. Phát âm qua Mic</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>4 câu thực hành đọc to câu giao tiếp để AI chấm điểm độ lưu loát và âm cuối.</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
            <button
              onClick={handleStart}
              className="btn btn-primary"
              style={{ padding: '16px 40px', fontSize: '1.15rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '10px' }}
            >
              Bắt đầu kiểm tra ngay
              <ArrowRight size={22} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Màn hình làm câu hỏi test
  return (
    <div className="diagnostic-quiz animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Progress Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {currentQ.sectionTitle}
          </span>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38bdf8' }}>
            Câu {currentIndex + 1}/{diagnosticQuestions.length} ({progressPercent}%)
          </span>
        </div>
        <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #6366f1, #38bdf8)',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* Main Question Card */}
      <div className="card glass-card" style={{ padding: '32px 24px', marginBottom: '20px' }}>
        {!isSpeakingType ? (
          // Dạng trắc nghiệm (Phần 1 & 2)
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, lineHeight: '1.5', margin: 0, color: 'var(--text-primary)' }}>
                {currentQ.question}
              </h2>
              {currentQ.audioPrompt && (
                <button
                  onClick={() => handlePlayAudio(currentQ.audioPrompt)}
                  className="btn btn-outline"
                  style={{ flexShrink: 0, padding: '10px 14px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Nghe phát âm chuẩn"
                >
                  <Volume2 size={20} color="#38bdf8" />
                  <span style={{ fontSize: '0.85rem' }}>Nghe</span>
                </button>
              )}
            </div>

            {/* Options List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {currentQ.options.map((opt) => {
                const isSelected = selectedOption?.id === opt.id;
                let optBorder = 'var(--border-color)';
                let optBg = 'rgba(255, 255, 255, 0.03)';

                if (showExplanation) {
                  if (opt.isCorrect) {
                    optBorder = '#10b981';
                    optBg = 'rgba(16, 185, 129, 0.15)';
                  } else if (isSelected) {
                    optBorder = '#ef4444';
                    optBg = 'rgba(239, 68, 68, 0.15)';
                  }
                } else if (isSelected) {
                  optBorder = '#6366f1';
                  optBg = 'rgba(99, 102, 241, 0.15)';
                }

                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelectOption(opt)}
                    disabled={showExplanation}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '16px 20px',
                      borderRadius: '14px',
                      border: `1.5px solid ${optBorder}`,
                      background: optBg,
                      cursor: showExplanation ? 'default' : 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                      width: '100%'
                    }}
                  >
                    <span style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      background: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                      color: isSelected ? '#fff' : 'var(--text-secondary)',
                      flexShrink: 0
                    }}>
                      {opt.id}
                    </span>
                    <span style={{ fontSize: '1rem', color: 'var(--text-primary)', flex: 1, fontWeight: 500 }}>
                      {opt.text}
                    </span>
                    {showExplanation && opt.isCorrect && (
                      <CheckCircle2 size={22} color="#10b981" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation box when answered */}
            {showExplanation && (
              <div style={{
                padding: '16px',
                borderRadius: '12px',
                background: selectedOption?.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                border: `1px solid ${selectedOption?.isCorrect ? '#10b981' : '#f59e0b'}`,
                marginBottom: '20px'
              }}>
                <div style={{ fontWeight: 700, marginBottom: '6px', color: selectedOption?.isCorrect ? '#10b981' : '#f59e0b' }}>
                  {selectedOption?.isCorrect ? '🎉 Chính xác!' : '💡 Lời giải thích:'}
                </div>
                <div style={{ fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                  {currentQ.explanation}
                </div>
              </div>
            )}
          </div>
        ) : (
          // Dạng đọc to qua Microphone (Phần 3)
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <span style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: '20px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                fontSize: '0.85rem',
                fontWeight: 600,
                marginBottom: '12px'
              }}>
                Đọc to câu tiếng Anh sau
              </span>

              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                "{currentQ.targetPhrase}"
              </h2>

              <div style={{ fontSize: '1.1rem', color: '#38bdf8', fontFamily: 'monospace', marginBottom: '8px' }}>
                {currentQ.ipa}
              </div>

              <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                ({currentQ.meaning})
              </div>

              <div style={{ fontSize: '0.85rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', display: 'inline-block', padding: '6px 14px', borderRadius: '8px' }}>
                💡 Mẹo: {currentQ.tip}
              </div>
            </div>

            {/* Listen button & Mic Control */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <button
                onClick={() => handlePlayAudio(currentQ.targetPhrase)}
                className="btn btn-outline"
                style={{ borderRadius: '24px', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Volume2 size={20} color="#38bdf8" />
                <span>Nghe mẫu chuẩn</span>
              </button>

              {/* Record Big Button */}
              <button
                onClick={handleToggleRecord}
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: isRecording ? '#ef4444' : 'linear-gradient(135deg, #6366f1, #3b82f6)',
                  border: 'none',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: isRecording ? '0 0 24px rgba(239, 68, 68, 0.5)' : '0 8px 24px rgba(99, 102, 241, 0.4)',
                  transition: 'all 0.25s ease'
                }}
              >
                {isRecording ? <MicOff size={36} /> : <Mic size={36} />}
              </button>
              <span style={{ fontSize: '0.9rem', color: isRecording ? '#ef4444' : 'var(--text-secondary)', fontWeight: 600 }}>
                {isRecording ? 'Đang lắng nghe giọng bạn...' : 'Bấm mic và đọc to câu trên'}
              </span>
            </div>

            {/* Speaking Result */}
            {currentPronounceResult && (
              <div style={{
                padding: '16px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-color)',
                textAlign: 'center',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Bạn vừa đọc:
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
                  "{spokenText || 'Chưa nhận diện được rõ âm'}"
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '20px', background: currentPronounceResult.score >= 70 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)' }}>
                  <span style={{ fontWeight: 700, color: currentPronounceResult.score >= 70 ? '#10b981' : '#f59e0b', fontSize: '1.2rem' }}>
                    {currentPronounceResult.score}%
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    - {currentPronounceResult.score >= 70 ? 'Phát âm rất tốt!' : 'Cần chú ý âm đuôi hơn một chút'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Next Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button
            onClick={handleNext}
            disabled={!isSpeakingType && !selectedOption}
            className="btn btn-primary"
            style={{
              padding: '12px 28px',
              fontSize: '1rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: (!isSpeakingType && !selectedOption) ? 0.5 : 1
            }}
          >
            <span>{currentIndex === diagnosticQuestions.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo'}</span>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
