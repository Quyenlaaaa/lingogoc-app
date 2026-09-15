// VocabView.jsx - Stage 2: 3000 Oxford Essential Words Powerhouse
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Volume2, 
  Star, 
  CheckCircle2, 
  RotateCw, 
  Sparkles, 
  Mic, 
  MicOff, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  X, 
  Filter, 
  Layers, 
  HelpCircle, 
  Play, 
  RefreshCw 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { vocabList, topics, levels } from '../data/vocabData';
import speechHelper from '../utils/speechHelper';
import { evaluatePronunciation } from '../utils/scoreEvaluator';

export default function VocabView({ userData, onUpdateUserData, voiceSpeed }) {
  // Navigation & Filter States
  const [studyMode, setStudyMode] = useState('flashcard'); // 'flashcard', 'list', 'quiz', 'mic'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('Tất cả');
  const [selectedLevel, setSelectedLevel] = useState('Tất cả');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all', 'mastered', 'unmastered', 'bookmarked'
  
  // Flashcard States
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // List Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;

  // Quiz States
  const [quizQuestion, setQuizQuestion] = useState(null);
  const [quizSelectedAnswer, setQuizSelectedAnswer] = useState(null);
  const [quizIsAnswered, setQuizIsAnswered] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  // Microphone Testing States
  const [isRecording, setIsRecording] = useState(false);
  const [activeWordForMic, setActiveWordForMic] = useState(null);
  const [evalResult, setEvalResult] = useState(null);
  const [recognitionObj, setRecognitionObj] = useState(null);

  const masteredSet = useMemo(() => new Set(userData?.masteredWords || []), [userData]);
  const bookmarkedSet = useMemo(() => new Set(userData?.bookmarkedWords || []), [userData]);

  // Filter 3000 vocabulary words
  const filteredWords = useMemo(() => {
    let result = vocabList;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(w => 
        w.word.toLowerCase().includes(q) || 
        w.meaning.toLowerCase().includes(q)
      );
    }

    // Topic filter
    if (selectedTopic !== 'Tất cả') {
      result = result.filter(w => w.topic === selectedTopic);
    }

    // Level filter
    if (selectedLevel !== 'Tất cả') {
      const lvlCode = selectedLevel.split(' ')[0]; // 'A1', 'A2', 'B1'
      result = result.filter(w => w.level === lvlCode);
    }

    // Status filter
    if (selectedStatus === 'mastered') {
      result = result.filter(w => masteredSet.has(w.id));
    } else if (selectedStatus === 'unmastered') {
      result = result.filter(w => !masteredSet.has(w.id));
    } else if (selectedStatus === 'bookmarked') {
      result = result.filter(w => bookmarkedSet.has(w.id));
    }

    return result;
  }, [searchQuery, selectedTopic, selectedLevel, selectedStatus, masteredSet, bookmarkedSet]);

  // Reset pagination / card index when filters change
  useEffect(() => {
    setCurrentPage(1);
    setCardIndex(0);
    setIsFlipped(false);
  }, [searchQuery, selectedTopic, selectedLevel, selectedStatus]);

  // Active Flashcard Word
  const currentCard = filteredWords[cardIndex] || filteredWords[0] || null;

  // Toggle Mastered Status
  const handleToggleMastered = (wordId) => {
    const updated = new Set(masteredSet);
    let xpGain = 0;
    if (updated.has(wordId)) {
      updated.delete(wordId);
    } else {
      updated.add(wordId);
      xpGain = 15;
      // Trigger confetti celebration
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 }
      });
    }

    onUpdateUserData({
      ...userData,
      masteredWords: Array.from(updated),
      xp: (userData?.xp || 0) + xpGain
    });
  };

  // Toggle Bookmark
  const handleToggleBookmark = (wordId) => {
    const updated = new Set(bookmarkedSet);
    if (updated.has(wordId)) {
      updated.delete(wordId);
    } else {
      updated.add(wordId);
    }
    onUpdateUserData({
      ...userData,
      bookmarkedWords: Array.from(updated)
    });
  };

  // Play Audio
  const handleSpeak = (text, rate = voiceSpeed) => {
    speechHelper.speak(text, { rate });
  };

  // Generate Quiz Question
  const generateQuiz = () => {
    if (filteredWords.length < 4) return;
    const randomIndex = Math.floor(Math.random() * filteredWords.length);
    const correctWord = filteredWords[randomIndex];

    // Pick 3 random distractors
    const distractors = [];
    while (distractors.length < 3) {
      const rand = Math.floor(Math.random() * vocabList.length);
      const w = vocabList[rand];
      if (w.id !== correctWord.id && !distractors.some(d => d.id === w.id)) {
        distractors.push(w);
      }
    }

    // Randomize options
    const options = [...distractors, correctWord].sort(() => Math.random() - 0.5);

    setQuizQuestion({
      target: correctWord,
      options,
      type: Math.random() > 0.5 ? 'en-to-vi' : 'listen-pick'
    });
    setQuizSelectedAnswer(null);
    setQuizIsAnswered(false);

    if (correctWord && options.length === 4) {
      handleSpeak(correctWord.word);
    }
  };

  useEffect(() => {
    if (studyMode === 'quiz' && !quizQuestion) {
      generateQuiz();
    }
  }, [studyMode]);

  // Handle Quiz Answer
  const handleAnswerQuiz = (option) => {
    if (quizIsAnswered) return;
    setQuizSelectedAnswer(option.id);
    setQuizIsAnswered(true);

    if (option.id === quizQuestion.target.id) {
      setQuizScore(prev => prev + 1);
      handleToggleMastered(quizQuestion.target.id);
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
    }
  };

  // Handle Mic Test
  const handleStartRecording = (targetWord) => {
    if (!speechHelper.isSpeechRecognitionSupported()) {
      alert('Trình duyệt chưa hỗ trợ ghi âm trực tiếp. Hãy sử dụng Chrome hoặc Edge để dùng mic.');
      return;
    }

    setActiveWordForMic(targetWord);
    setEvalResult(null);
    setIsRecording(true);

    const rec = speechHelper.createRecognition(
      (result) => {
        if (result.isFinal) {
          const evalScore = evaluatePronunciation(targetWord.word, result.final);
          setEvalResult(evalScore);
          setIsRecording(false);
          if (evalScore.score >= 70) {
            handleToggleMastered(targetWord.id);
          }
        }
      },
      () => setIsRecording(false),
      () => setIsRecording(false)
    );

    if (rec) {
      setRecognitionObj(rec);
      rec.start();
    }
  };

  const handleStopRecording = () => {
    if (recognitionObj) {
      recognitionObj.stop();
    }
    setIsRecording(false);
  };

  return (
    <div className="vocab-view animate-fade-in">
      {/* Header Info */}
      <div className="module-header-card">
        <div className="module-tag vocab-tag">Chặng 2: 3000 Từ Vựng Thông Dụng Nhất</div>
        <div className="vocab-header-flex">
          <div>
            <h2 className="module-title">Kho 3000 Từ Vựng Cốt Lõi (Oxford 3000)</h2>
            <p className="module-desc">
              Phân loại theo chuẩn CEFR (A1 - A2 - B1) và 16 chủ đề thực tế. 
              Hiện có <strong className="highlight-text">{masteredSet.size} / 3000</strong> từ đã thuộc.
            </p>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="study-mode-toggle">
            <button 
              className={`mode-btn ${studyMode === 'flashcard' ? 'active' : ''}`}
              onClick={() => setStudyMode('flashcard')}
            >
              <RotateCw size={16} />
              <span>Thẻ Nhớ 3D</span>
            </button>
            <button 
              className={`mode-btn ${studyMode === 'list' ? 'active' : ''}`}
              onClick={() => setStudyMode('list')}
            >
              <Layers size={16} />
              <span>Danh Sách ({filteredWords.length})</span>
            </button>
            <button 
              className={`mode-btn ${studyMode === 'quiz' ? 'active' : ''}`}
              onClick={() => {
                setStudyMode('quiz');
                generateQuiz();
              }}
            >
              <HelpCircle size={16} />
              <span>Trắc Nghiệm Phản Xạ</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="search-filter-grid">
          {/* Search Box */}
          <div className="search-input-wrapper">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              className="vocab-search-input"
              placeholder="Tìm kiếm theo từ tiếng Anh hoặc nghĩa tiếng Việt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                <X size={16} />
              </button>
            )}
          </div>

          {/* Level Filter */}
          <select 
            className="filter-select"
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
          >
            {levels.map((lvl) => (
              <option key={lvl} value={lvl}>{lvl}</option>
            ))}
          </select>

          {/* Topic Filter */}
          <select 
            className="filter-select"
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
          >
            {topics.map((top) => (
              <option key={top} value={top}>{top}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select 
            className="filter-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="mastered">✅ Đã thuộc ({masteredSet.size})</option>
            <option value="unmastered">⏳ Chưa thuộc ({3000 - masteredSet.size})</option>
            <option value="bookmarked">⭐ Yêu thích ({bookmarkedSet.size})</option>
          </select>
        </div>
      </div>

      {/* Main Content by Mode */}
      {studyMode === 'flashcard' && currentCard && (
        <div className="flashcard-arena">
          <div className="flashcard-progress-bar">
            <span>Thẻ {cardIndex + 1} / {filteredWords.length}</span>
            <div className="progress-track">
              <div 
                className="progress-fill" 
                style={{ width: `${((cardIndex + 1) / filteredWords.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* 3D Flip Flashcard */}
          <div 
            className={`flashcard-scene ${isFlipped ? 'is-flipped' : ''}`}
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div className="flashcard-inner">
              {/* Front of Card */}
              <div className="flashcard-face flashcard-front">
                <div className="card-top-tags">
                  <span className="badge-level">{currentCard.level}</span>
                  <span className="badge-topic">{currentCard.topic}</span>
                  <span className="badge-pos">({currentCard.pos})</span>
                </div>

                <div className="card-center-word">
                  <h3 className="card-word-text">{currentCard.word}</h3>
                  <div className="card-ipa-text">{currentCard.ipa}</div>
                </div>

                <div className="card-instruction-hint">
                  <RotateCw size={15} />
                  <span>Bấm vào thẻ để lật xem nghĩa tiếng Việt & ví dụ</span>
                </div>

                <div className="card-bottom-actions" onClick={(e) => e.stopPropagation()}>
                  <button 
                    className="card-audio-btn"
                    title="Nghe phát âm chuẩn US"
                    onClick={() => handleSpeak(currentCard.word)}
                  >
                    <Volume2 size={20} />
                    <span>Nghe</span>
                  </button>

                  <button 
                    className="card-audio-btn slow-btn"
                    title="Nghe chậm 0.75x"
                    onClick={() => handleSpeak(currentCard.word, 0.75)}
                  >
                    <span>🐢 Chậm</span>
                  </button>

                  <button 
                    className={`card-mic-btn ${isRecording && activeWordForMic?.id === currentCard.id ? 'recording' : ''}`}
                    title="Luyện đọc từ này qua micro"
                    onClick={() => isRecording ? handleStopRecording() : handleStartRecording(currentCard)}
                  >
                    {isRecording && activeWordForMic?.id === currentCard.id ? <MicOff size={18} /> : <Mic size={18} />}
                    <span>{isRecording && activeWordForMic?.id === currentCard.id ? 'Đang nghe...' : 'Nói thử'}</span>
                  </button>
                </div>
              </div>

              {/* Back of Card */}
              <div className="flashcard-face flashcard-back">
                <div className="card-top-tags">
                  <span className="badge-level">{currentCard.level}</span>
                  <span className="badge-topic">{currentCard.topic}</span>
                </div>

                <div className="card-meaning-block">
                  <div className="meaning-label">Nghĩa tiếng Việt:</div>
                  <div className="meaning-highlight">{currentCard.meaning}</div>
                </div>

                <div className="card-example-box" onClick={(e) => e.stopPropagation()}>
                  <div className="ex-en-row">
                    <span className="ex-en-text">{currentCard.example}</span>
                    <button 
                      className="inline-audio-btn"
                      onClick={() => handleSpeak(currentCard.example)}
                    >
                      <Volume2 size={16} />
                    </button>
                  </div>
                  <div className="ex-vi-text">{currentCard.exampleVi}</div>
                </div>

                <div className="card-back-footer" onClick={(e) => e.stopPropagation()}>
                  <button 
                    className={`card-btn-bookmark ${bookmarkedSet.has(currentCard.id) ? 'bookmarked' : ''}`}
                    onClick={() => handleToggleBookmark(currentCard.id)}
                  >
                    <Star size={18} fill={bookmarkedSet.has(currentCard.id) ? '#f59e0b' : 'none'} />
                    <span>{bookmarkedSet.has(currentCard.id) ? 'Đã lưu' : 'Lưu lại'}</span>
                  </button>

                  <button 
                    className={`card-btn-mastered ${masteredSet.has(currentCard.id) ? 'mastered' : ''}`}
                    onClick={() => handleToggleMastered(currentCard.id)}
                  >
                    <CheckCircle2 size={18} />
                    <span>{masteredSet.has(currentCard.id) ? 'Đã thuộc (+15 XP)' : 'Đánh dấu đã thuộc'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Pronunciation Eval Feedback if any */}
          {evalResult && activeWordForMic?.id === currentCard.id && (
            <div className={`eval-result-card status-${evalResult.status} mt-4`}>
              <div className="eval-score-row">
                <Sparkles size={20} />
                <span>Điểm phát âm: <strong>{evalResult.score}%</strong></span>
              </div>
              <div className="eval-feedback">{evalResult.feedback}</div>
            </div>
          )}

          {/* Flashcard Controller Buttons */}
          <div className="flashcard-nav-controls">
            <button 
              className="fc-nav-btn prev-btn"
              disabled={cardIndex === 0}
              onClick={() => {
                setIsFlipped(false);
                setEvalResult(null);
                setCardIndex(prev => Math.max(0, prev - 1));
              }}
            >
              <ArrowLeft size={20} />
              <span>Từ trước</span>
            </button>

            <button 
              className="fc-flip-btn"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <RotateCw size={18} />
              <span>Lật thẻ (Phím Space)</span>
            </button>

            <button 
              className="fc-nav-btn next-btn"
              disabled={cardIndex >= filteredWords.length - 1}
              onClick={() => {
                setIsFlipped(false);
                setEvalResult(null);
                setCardIndex(prev => Math.min(filteredWords.length - 1, prev + 1));
              }}
            >
              <span>Từ kế tiếp</span>
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Mode 2: Word List / Grid Table */}
      {studyMode === 'list' && (
        <div className="vocab-list-container">
          <div className="vocab-cards-grid">
            {filteredWords
              .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
              .map((w) => {
                const isMastered = masteredSet.has(w.id);
                const isBookmarked = bookmarkedSet.has(w.id);

                return (
                  <div key={w.id} className={`vocab-item-card ${isMastered ? 'mastered' : ''}`}>
                    <div className="item-card-header">
                      <div className="item-badges">
                        <span className="badge-level">{w.level}</span>
                        <span className="badge-topic">{w.topic}</span>
                      </div>

                      <button 
                        className={`star-action-btn ${isBookmarked ? 'active' : ''}`}
                        onClick={() => handleToggleBookmark(w.id)}
                        title="Lưu từ yêu thích"
                      >
                        <Star size={16} fill={isBookmarked ? '#f59e0b' : 'none'} />
                      </button>
                    </div>

                    <div className="item-word-body">
                      <div className="item-word-name">{w.word}</div>
                      <div className="item-ipa-text">{w.ipa}</div>
                      <div className="item-meaning-text">{w.meaning}</div>
                      <div className="item-example-box">
                        <div className="item-ex-en">{w.example}</div>
                        <div className="item-ex-vi">{w.exampleVi}</div>
                      </div>
                    </div>

                    <div className="item-card-footer">
                      <button 
                        className="item-btn audio" 
                        onClick={() => handleSpeak(w.word)}
                        title="Nghe phát âm"
                      >
                        <Volume2 size={16} />
                      </button>

                      <button 
                        className={`item-btn mic ${isRecording && activeWordForMic?.id === w.id ? 'recording' : ''}`}
                        onClick={() => isRecording ? handleStopRecording() : handleStartRecording(w)}
                        title="Luyện đọc từ này qua mic"
                      >
                        <Mic size={16} />
                      </button>

                      <button 
                        className={`item-btn done ${isMastered ? 'is-done' : ''}`}
                        onClick={() => handleToggleMastered(w.id)}
                        title="Đánh dấu đã thuộc"
                      >
                        <CheckCircle2 size={16} />
                        <span>{isMastered ? 'Đã thuộc' : 'Thuộc'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Pagination */}
          <div className="pagination-bar">
            <button 
              className="page-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              <ArrowLeft size={16} />
              <span>Trang trước</span>
            </button>
            <span className="page-indicator">
              Trang {currentPage} / {Math.ceil(filteredWords.length / itemsPerPage) || 1}
            </span>
            <button 
              className="page-btn"
              disabled={currentPage >= Math.ceil(filteredWords.length / itemsPerPage)}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              <span>Trang sau</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Mode 3: Quiz Arena */}
      {studyMode === 'quiz' && quizQuestion && (
        <div className="quiz-arena-container">
          <div className="quiz-card">
            <div className="quiz-top-info">
              <span className="quiz-type-badge">
                {quizQuestion.type === 'listen-pick' ? '🎧 Nghe & Chọn Từ Đúng' : '🎯 Chọn Nghĩa Tiếng Việt'}
              </span>
              <span className="quiz-score-badge">Đúng: {quizScore} câu</span>
            </div>

            <div className="quiz-question-box">
              {quizQuestion.type === 'listen-pick' ? (
                <div className="listen-quiz-prompt">
                  <button 
                    className="listen-big-audio-btn"
                    onClick={() => handleSpeak(quizQuestion.target.word)}
                  >
                    <Volume2 size={36} />
                    <span>Nghe lại âm thanh</span>
                  </button>
                  <p className="listen-hint-text">Nghe kỹ âm thanh và chọn từ chính xác bên dưới:</p>
                </div>
              ) : (
                <div className="en-quiz-prompt">
                  <h3 className="target-word-heading">{quizQuestion.target.word}</h3>
                  <div className="target-ipa">{quizQuestion.target.ipa} ({quizQuestion.target.pos})</div>
                  <button 
                    className="listen-sound-btn" 
                    onClick={() => handleSpeak(quizQuestion.target.word)}
                  >
                    <Volume2 size={16} />
                    <span>Phát âm</span>
                  </button>
                </div>
              )}
            </div>

            {/* 4 Choices */}
            <div className="quiz-options-grid">
              {quizQuestion.options.map((option, idx) => {
                const isSelected = quizSelectedAnswer === option.id;
                const isCorrect = option.id === quizQuestion.target.id;
                let btnClass = 'quiz-opt-btn';

                if (quizIsAnswered) {
                  if (isCorrect) btnClass += ' correct';
                  else if (isSelected) btnClass += ' wrong';
                }

                return (
                  <button
                    key={option.id}
                    className={btnClass}
                    onClick={() => handleAnswerQuiz(option)}
                    disabled={quizIsAnswered}
                  >
                    <span className="opt-letter">{['A', 'B', 'C', 'D'][idx]}</span>
                    <span className="opt-text">
                      {quizQuestion.type === 'listen-pick' ? option.word : option.meaning}
                    </span>
                    {quizIsAnswered && isCorrect && <Check size={18} className="opt-status-icon" />}
                    {quizIsAnswered && isSelected && !isCorrect && <X size={18} className="opt-status-icon" />}
                  </button>
                );
              })}
            </div>

            {/* Next Quiz Button */}
            {quizIsAnswered && (
              <div className="quiz-footer-actions">
                <button className="next-quiz-btn" onClick={generateQuiz}>
                  <span>Câu tiếp theo</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
