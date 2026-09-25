// ReflexView.jsx - Stage 3: 50 Survival Sentence Patterns for Instant Reflexes
import React, { useEffect, useRef, useState } from 'react';
import { 
  Volume2, 
  Mic, 
  MicOff, 
  CheckCircle2, 
  Info, 
  Award 
} from 'lucide-react';
import { reflexSentences } from '../data/reflexData';
import speechHelper from '../utils/speechHelper';
import { evaluatePronunciation } from '../utils/scoreEvaluator';
import confetti from 'canvas-confetti';
import { dispatchLearningEvent } from '../utils/learningEventEngine';
import { loadLearningModuleSession, saveLearningModuleSession } from '../utils/learningModuleSessionStore';

function loadInitialReflexSession() {
  const saved = loadLearningModuleSession('reflex');
  const categories = ['Tất cả', 'Ordering', 'Requests', 'Shopping', 'Directions', 'Survival', 'Social'];
  const activeCategory = categories.includes(saved.activeCategory) ? saved.activeCategory : 'Tất cả';
  const categoryPatterns = reflexSentences.filter((item) => activeCategory === 'Tất cả' || item.category === activeCategory);
  const activePattern = categoryPatterns.find((item) => String(item.id) === String(saved.activePatternId))
    || categoryPatterns[0]
    || reflexSentences[0];
  const selectedExampleIndex = Math.max(0, Math.min(activePattern.examples.length - 1, Number(saved.selectedExampleIndex) || 0));
  return { activeCategory, activePattern, selectedExampleIndex, evalResult: saved.evalResult || null };
}

export default function ReflexView({ userData, onUpdateUserData, voiceSpeed }) {
  const [initialSession] = useState(loadInitialReflexSession);
  const [activeCategory, setActiveCategory] = useState(initialSession.activeCategory);
  const [activePattern, setActivePattern] = useState(initialSession.activePattern);
  const [selectedExampleIndex, setSelectedExampleIndex] = useState(initialSession.selectedExampleIndex);
  
  // Microphone & Speech Evaluation States
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const [evalResult, setEvalResult] = useState(initialSession.evalResult);

  const completedReflex = new Set(userData?.completedReflex || []);

  const categories = ['Tất cả', 'Ordering', 'Requests', 'Shopping', 'Directions', 'Survival', 'Social'];

  const filteredPatterns = reflexSentences.filter(p => 
    activeCategory === 'Tất cả' ? true : p.category === activeCategory
  );

  const activeExample = activePattern.examples[selectedExampleIndex] || activePattern.examples[0];

  useEffect(() => {
    saveLearningModuleSession('reflex', {
      activeCategory,
      activePatternId: activePattern.id,
      selectedExampleIndex,
      evalResult,
    });
  }, [activeCategory, activePattern.id, evalResult, selectedExampleIndex]);

  useEffect(() => () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    try {
      recognition?.abort();
    } catch {
      // Recognition may already be inactive during navigation.
    }
    speechHelper.stopSpeaking();
  }, []);

  const handleSpeak = (text, rate = voiceSpeed) => {
    speechHelper.speak(text, { rate });
  };

  const setPatternCompleted = (patternId, completed) => {
    if (completed && !completedReflex.has(patternId)) {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    }
    const result = dispatchLearningEvent({
      type: 'progress.toggled',
      source: 'reflex',
      payload: {
        collection: 'completedReflex',
        targetId: patternId,
        completed,
        xp: 20,
        rewardKey: `reflex:${patternId}`,
      },
    });
    onUpdateUserData(result.userData);
  };

  const toggleCompleted = (patternId) => setPatternCompleted(patternId, !completedReflex.has(patternId));

  const handleStartRecording = (targetText) => {
    if (!speechHelper.isSpeechRecognitionSupported()) {
      alert('Trình duyệt chưa hỗ trợ ghi âm trực tiếp. Vui lòng mở bằng Google Chrome hoặc Edge.');
      return;
    }

    setEvalResult(null);
    setIsRecording(true);

    const rec = speechHelper.createRecognition(
      (result) => {
        if (result.isFinal) {
          const evalScore = evaluatePronunciation(targetText, result.final);
          setEvalResult(evalScore);
          setIsRecording(false);
          if (evalScore.score >= 65) setPatternCompleted(activePattern.id, true);
        }
      },
      () => setIsRecording(false),
      () => setIsRecording(false)
    );

    if (rec) {
      recognitionRef.current = rec;
      rec.start();
    }
  };

  const handleStopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  return (
    <div className="reflex-view animate-fade-in">
      {/* Header Info */}
      <div className="module-header-card">
        <div className="module-tag reflex-tag">Chặng 3: Mẫu Câu Phản Xạ 3 Giây</div>
        <h2 className="module-title">50 Mẫu Câu Giao Tiếp Sống Còn</h2>
        <p className="module-desc">
          Phương pháp "lắp ghép từ vựng vào khung xương câu". Luyện phản xạ nói tức thì 
          mà không cần suy nghĩ ngữ pháp phức tạp hay dịch nhẩm từ tiếng Việt.
        </p>

        {/* Category Tabs */}
        <div className="category-filter-bar">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`cat-pill-btn ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => {
                setActiveCategory(cat);
                const found = reflexSentences.find(p => cat === 'Tất cả' || p.category === cat);
                if (found) {
                  setActivePattern(found);
                  setSelectedExampleIndex(0);
                  setEvalResult(null);
                }
              }}
            >
              {cat === 'Tất cả' ? '🌐 Tất Cả' :
               cat === 'Ordering' ? '🍽️ Gọi Món & Ăn Uống' :
               cat === 'Requests' ? '🙏 Nhờ Vả Lịch Sự' :
               cat === 'Shopping' ? '🛍️ Mua Sắm & Giá Cả' :
               cat === 'Directions' ? '🗺️ Hỏi Đường' :
               cat === 'Survival' ? '🆘 Giao Tiếp Cứu Sinh' : '🤝 Làm Quen & Đời Sống'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout: Patterns Grid + Interactive Arena */}
      <div className="reflex-workspace-layout">
        {/* Left Side: Patterns List */}
        <div className="reflex-list-panel">
          <div className="patterns-scroll-container">
            {filteredPatterns.map((pat) => {
              const isSelected = activePattern.id === pat.id;
              const isDone = completedReflex.has(pat.id);

              return (
                <div
                  key={pat.id}
                  className={`pattern-item-card ${isSelected ? 'selected' : ''} ${isDone ? 'done' : ''}`}
                  onClick={() => {
                    setActivePattern(pat);
                    setSelectedExampleIndex(0);
                    setEvalResult(null);
                    handleSpeak(pat.examples[0].en);
                  }}
                >
                  <div className="pattern-item-top">
                    <span className="pattern-cat-badge">{pat.category}</span>
                    {isDone && <CheckCircle2 size={16} className="done-icon" />}
                  </div>
                  <div className="pattern-item-formula">{pat.pattern}</div>
                  <div className="pattern-item-meaning">{pat.meaning}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Interactive Practice Arena */}
        {activePattern && (
          <div className="reflex-practice-card">
            <div className="practice-header">
              <div>
                <span className="practice-label">Mẫu Câu Đang Luyện:</span>
                <h3 className="practice-formula">{activePattern.pattern}</h3>
                <div className="practice-formula-vi">{activePattern.meaning}</div>
              </div>

              <button
                className={`master-toggle-btn ${completedReflex.has(activePattern.id) ? 'active' : ''}`}
                onClick={() => toggleCompleted(activePattern.id)}
              >
                <CheckCircle2 size={18} />
                <span>{completedReflex.has(activePattern.id) ? 'Đã thành thạo (+20 XP)' : 'Đánh dấu đã thuộc'}</span>
              </button>
            </div>

            {/* Beginner Tip */}
            {activePattern.tips && (
              <div className="reflex-tip-box">
                <Info size={18} className="tip-icon" />
                <div className="tip-content">
                  <strong>Mẹo phản xạ:</strong> {activePattern.tips}
                </div>
              </div>
            )}

            {/* Examples Tabs */}
            <div className="examples-choice-block">
              <span className="choice-label">Chọn câu ví dụ để luyện nói:</span>
              <div className="example-tabs-row">
                {activePattern.examples.map((ex, idx) => (
                  <button
                    key={idx}
                    className={`example-tab-btn ${selectedExampleIndex === idx ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedExampleIndex(idx);
                      setEvalResult(null);
                      handleSpeak(ex.en);
                    }}
                  >
                    Ví dụ {idx + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Interactive Sentence Box */}
            <div className="sentence-display-box">
              <div className="sentence-en-row">
                <span className="sentence-en-text">{activeExample.en}</span>
                <button 
                  className="sentence-audio-btn" 
                  onClick={() => handleSpeak(activeExample.en)}
                  title="Nghe câu chuẩn"
                >
                  <Volume2 size={22} />
                  <span>Nghe</span>
                </button>
                <button 
                  className="sentence-audio-btn slow" 
                  onClick={() => handleSpeak(activeExample.en, 0.75)}
                  title="Nghe chậm 0.75x"
                >
                  <span>🐢 Chậm</span>
                </button>
              </div>
              <div className="sentence-vi-text">{activeExample.vi}</div>
            </div>

            {/* Microphone Recording Action */}
            <div className="mic-practice-action-box">
              <button
                className={`big-record-btn ${isRecording ? 'is-recording' : ''}`}
                onClick={() => isRecording ? handleStopRecording() : handleStartRecording(activeExample.en)}
              >
                {isRecording ? <MicOff size={26} /> : <Mic size={26} />}
                <span>{isRecording ? 'Đang lắng nghe... Bấm để dừng' : 'Bấm mic & Đọc to câu này'}</span>
              </button>
              <p className="mic-hint-text">Nói to, rõ ràng theo đúng nhịp điệu của câu mẫu.</p>
            </div>

            {/* Pronunciation Scoring Results */}
            {evalResult && (
              <div className={`eval-result-card status-${evalResult.status} mt-4`}>
                <div className="eval-score-row">
                  <Award size={24} />
                  <span>Độ chính xác: <strong>{evalResult.score}%</strong></span>
                </div>
                <div className="eval-feedback">{evalResult.feedback}</div>

                {/* Word by word breakdown */}
                <div className="word-breakdown-row">
                  {evalResult.words.map((w, i) => (
                    <span key={i} className={`word-token token-${w.status}`}>
                      {w.word}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
