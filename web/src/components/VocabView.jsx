// VocabView.jsx - Stage 2: 3000 Oxford Essential Words Powerhouse
import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Layers, 
  HelpCircle, 
  BookOpen,
  Shuffle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { dispatchLearningEvent } from '../utils/learningEventEngine';
import speechHelper from '../utils/speechHelper';
import { evaluatePronunciation } from '../utils/scoreEvaluator';
import { enrichWordWithLLM, getCachedWordEnrichment } from '../utils/geminiService';
import { hasBackendApi } from '../utils/backendApi';
import { getCachedVietnameseMeaning, getMeaningCacheKey } from '../utils/vocabularyMeaningService';
import { fetchVocabularyBatch, toMeaningResultMap } from '../utils/vocabularyBatchService';
import {
  buildClozePrompt,
  buildQuizOptions,
} from '../utils/vocabularyQuality';
import { getVocabularyPresentation } from '../utils/vocabularyPresentation';
import {
  getVocabularyEnrichmentMessage,
  shouldApplyVocabularyBatchResult,
} from '../utils/vocabularyEnrichmentUi';
import WordDetailModal from './WordDetailModal';
import WordScrambleGame from './WordScrambleGame';

const QUIZ_LABELS = {
  'en-to-vi': '🎯 Chọn nghĩa tiếng Việt',
  'vi-to-en': '🔄 Chọn từ tiếng Anh',
  'listen-pick': '🎧 Nghe và phân biệt từ',
  cloze: '🧩 Điền từ theo ngữ cảnh',
};

function mergeMeaningResults(current, incoming) {
  let changed = false;
  const next = { ...current };
  Object.entries(incoming).forEach(([key, value]) => {
    if (current[key]?.meaningVi !== value?.meaningVi) {
      next[key] = value;
      changed = true;
    }
  });
  return changed ? next : current;
}

export default function VocabView({ userData, onUpdateUserData, voiceSpeed, vocabulary = [] }) {
  const vocabList = vocabulary;
  const topics = React.useMemo(() => ['Tất cả', ...new Set(vocabList.map((item) => item.topic).filter(Boolean))], [vocabList]);
  const levels = React.useMemo(() => ['Tất cả', ...new Set(vocabList.map((item) => item.level).filter(Boolean))], [vocabList]);
  // Navigation & Filter States
  // The 3,000-word catalog is the primary vocabulary surface. Keep flashcards as an
  // explicit learning mode instead of hiding the catalog controls on first entry.
  const [studyMode, setStudyMode] = useState('list'); // 'flashcard', 'list', 'quiz', 'scramble'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('Tất cả');
  const [selectedLevel, setSelectedLevel] = useState('Tất cả');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all', 'mastered', 'unmastered', 'bookmarked'
  const [detailWord, setDetailWord] = useState(null); // Modal xem chi tiết từ điển thật & AI
  
  // Flashcard States
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // List Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [listAiData, setListAiData] = useState({});
  const [flashcardAiState, setFlashcardAiState] = useState({ word: '', data: null });
  const [translatedMeanings, setTranslatedMeanings] = useState({});
  const [isLoadingFlashcardExamples, setIsLoadingFlashcardExamples] = useState(false);
  const viewMountedRef = useRef(true);
  const enrichmentRequestSequenceRef = useRef(0);
  const manualRetryVersionRef = useRef(new Map());
  const listContainerRef = useRef(null);
  const itemsPerPage = 24;

  // Quiz States
  const [quizQuestion, setQuizQuestion] = useState(null);
  const [quizSelectedAnswer, setQuizSelectedAnswer] = useState(null);
  const [quizIsAnswered, setQuizIsAnswered] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const quizSessionIdRef = useRef(crypto.randomUUID());
  const quizQuestionSequenceRef = useRef(0);

  // Microphone Testing States
  const [isRecording, setIsRecording] = useState(false);
  const [activeWordForMic, setActiveWordForMic] = useState(null);
  const [evalResult, setEvalResult] = useState(null);
  const [recognitionObj, setRecognitionObj] = useState(null);

  const masteredSet = useMemo(() => new Set(userData?.masteredWords || []), [userData]);
  const bookmarkedSet = useMemo(() => new Set(userData?.bookmarkedWords || []), [userData]);

  const getWordPresentation = (item, enrichment) => {
    if (!item) return null;
    const translated = translatedMeanings[getMeaningCacheKey(item)] || getCachedVietnameseMeaning(item);
    return getVocabularyPresentation(item, { enrichment, meaning: translated });
  };

  // Filter 3000 vocabulary words
  const filteredWords = useMemo(() => {
    let result = vocabList;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((word) => {
        const translated = translatedMeanings[getMeaningCacheKey(word)]?.meaningVi || '';
        return word.word.toLowerCase().includes(q)
          || word.meaning.toLowerCase().includes(q)
          || translated.toLowerCase().includes(q);
      });
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
  }, [searchQuery, selectedTopic, selectedLevel, selectedStatus, masteredSet, bookmarkedSet, translatedMeanings, vocabList]);

  const totalPages = Math.max(1, Math.ceil(filteredWords.length / itemsPerPage));

  const goToPage = (requestedPage) => {
    const parsedPage = Number.parseInt(String(requestedPage), 10);
    const nextPage = Number.isFinite(parsedPage)
      ? Math.min(totalPages, Math.max(1, parsedPage))
      : currentPage;
    setCurrentPage(nextPage);
    setPageInput(String(nextPage));
    if (nextPage !== currentPage) {
      window.requestAnimationFrame(() => {
        listContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const visibleListWords = useMemo(
    () => filteredWords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [filteredWords, currentPage],
  );

  useEffect(() => {
    viewMountedRef.current = true;
    return () => {
      viewMountedRef.current = false;
    };
  }, []);

  const resetFilteredNavigation = () => {
    setCurrentPage(1);
    setPageInput('1');
    setCardIndex(0);
    setIsFlipped(false);
  };

  // Active Flashcard Word
  const currentCard = filteredWords[cardIndex] || filteredWords[0] || null;
  const currentEnrichment = currentCard ? getCachedWordEnrichment(currentCard.word) : null;
  const flashcardAiData = currentCard && flashcardAiState.word === currentCard.word
    ? flashcardAiState.data
    : null;
  const meaningCandidates = useMemo(() => {
    if (studyMode === 'list') return visibleListWords;
    if (studyMode === 'flashcard' && currentCard) return [currentCard];
    if (studyMode === 'quiz' && quizQuestion) return [quizQuestion.target, ...quizQuestion.options];
    return [];
  }, [currentCard, quizQuestion, studyMode, visibleListWords]);

  // Read only the current screen from server KV in one request. Missing records
  // remain pending for the server-side maintenance pipeline; browsing never
  // launches an unbounded AI job.
  useEffect(() => {
    if (!meaningCandidates.length) return undefined;

    const controller = new AbortController();
    const batchStartedAt = ++enrichmentRequestSequenceRef.current;
    fetchVocabularyBatch(meaningCandidates, controller.signal)
      .then((results) => {
        if (!viewMountedRef.current) return;
        const meanings = toMeaningResultMap(meaningCandidates, results);
        if (Object.keys(meanings).length) {
          setTranslatedMeanings((current) => mergeMeaningResults(current, meanings));
        }
        if (studyMode === 'list') {
          setListAiData((current) => {
            const next = { ...current };
            meaningCandidates.forEach((item) => {
              if (!shouldApplyVocabularyBatchResult(
                batchStartedAt,
                manualRetryVersionRef.current.get(item.word.toLowerCase()),
              )) return;
              const result = results[item.word.toLowerCase()];
              if (result?.enrichment) next[item.word.toLowerCase()] = result.enrichment;
              else if (result?.pending) next[item.word.toLowerCase()] = { unavailableReason: 'SYSTEM_ENRICHMENT_PENDING' };
            });
            return next;
          });
        } else if (studyMode === 'flashcard' && currentCard) {
          const result = results[currentCard.word.toLowerCase()];
          if (result?.enrichment && shouldApplyVocabularyBatchResult(
            batchStartedAt,
            manualRetryVersionRef.current.get(currentCard.word.toLowerCase()),
          )) {
            setFlashcardAiState({ word: currentCard.word, data: result.enrichment });
          }
        }
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('Could not read vocabulary batch:', error);
      });
    return () => controller.abort();
  }, [currentCard, meaningCandidates, studyMode]);

  const activeEnrichment = flashcardAiData || currentEnrichment;
  const currentPresentation = getWordPresentation(currentCard, activeEnrichment);
  const currentExamples = currentPresentation?.examples.slice(0, 2) || [];

  const retryFlashcardExamples = async (event) => {
    event.stopPropagation();
    if (!currentCard || isLoadingFlashcardExamples) return;
    manualRetryVersionRef.current.set(
      currentCard.word.toLowerCase(),
      ++enrichmentRequestSequenceRef.current,
    );
    setIsLoadingFlashcardExamples(true);
    try {
      const result = await enrichWordWithLLM(
        currentCard.word,
        currentPresentation.meaning,
        currentCard.topic,
        [],
        undefined,
        { manualRetry: true, keepAlive: true, maxAttempts: 1 },
      );
      manualRetryVersionRef.current.set(
        currentCard.word.toLowerCase(),
        ++enrichmentRequestSequenceRef.current,
      );
      if (viewMountedRef.current) setFlashcardAiState({ word: currentCard.word, data: result });
    } catch (error) {
      if (error?.name !== 'AbortError') {
        manualRetryVersionRef.current.set(
          currentCard.word.toLowerCase(),
          ++enrichmentRequestSequenceRef.current,
        );
        console.warn('Could not retry vocabulary examples:', error);
        if (viewMountedRef.current) {
          setFlashcardAiState({
            word: currentCard.word,
            data: {
              isAiGenerated: false,
              contextExamples: [],
              unavailableReason: error?.message || 'Không thể kết nối API AI.',
            },
          });
        }
      }
    } finally {
      if (viewMountedRef.current) {
        setIsLoadingFlashcardExamples(false);
      }
    }
  };

  const retryListExamples = async (item) => {
    const key = item.word.toLowerCase();
    manualRetryVersionRef.current.set(key, ++enrichmentRequestSequenceRef.current);
    setListAiData((current) => ({ ...current, [key]: { isLoading: true, retryAttempt: 0 } }));
    try {
      const result = await enrichWordWithLLM(
        item.word,
        getWordPresentation(item).meaning,
        item.topic,
        [],
        undefined,
        {
          manualRetry: true,
          keepAlive: true,
          maxAttempts: 1,
          onRetry: ({ attempt }) => {
            if (viewMountedRef.current) {
              setListAiData((current) => ({ ...current, [key]: { isLoading: true, retryAttempt: attempt } }));
            }
          },
        },
      );
      manualRetryVersionRef.current.set(key, ++enrichmentRequestSequenceRef.current);
      if (viewMountedRef.current) {
        setListAiData((current) => ({ ...current, [key]: result }));
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        manualRetryVersionRef.current.set(key, ++enrichmentRequestSequenceRef.current);
        console.warn('Could not retry vocabulary examples:', error);
        if (viewMountedRef.current) {
          setListAiData((current) => ({
            ...current,
            [key]: {
              isAiGenerated: false,
              contextExamples: [],
              unavailableReason: error?.message || 'Không thể kết nối API AI.',
            },
          }));
        }
      }
    }
  };

  const openWordDetail = (item, enrichment) => {
    const availableEnrichment = enrichment || getCachedWordEnrichment(item.word);
    setDetailWord({
      ...item,
      _aiEnrichment: availableEnrichment || null,
      _meaningResult: translatedMeanings[getMeaningCacheKey(item)] || getCachedVietnameseMeaning(item),
    });
  };

  // Toggle Mastered Status
  const handleToggleMastered = (wordId) => {
    const completing = !masteredSet.has(wordId);
    if (completing) {
      // Trigger confetti celebration
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 }
      });
    }
    const result = dispatchLearningEvent({
      type: 'progress.toggled',
      source: 'vocabulary',
      payload: {
        collection: 'masteredWords',
        targetId: wordId,
        completed: completing,
        xp: 15,
        rewardKey: `vocabulary:${wordId}`,
      },
    });
    onUpdateUserData(result.userData);
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
    const translatedVocabulary = vocabList.map((word) => {
      const presentation = getWordPresentation(word);
      return { ...word, meaning: presentation.meaning, _presentation: presentation };
    });
    const translatedById = new Map(translatedVocabulary.map((word) => [word.id, word]));
    const quizPool = filteredWords
      .map((word) => translatedById.get(word.id) || word)
      .filter((word) => word._presentation?.meaningSource !== 'pending');
    if (quizPool.length < 4) return;
    const correctWord = quizPool[Math.floor(Math.random() * quizPool.length)];
    const clozePrompt = buildClozePrompt(correctWord);
    const availableTypes = ['en-to-vi', 'vi-to-en', 'listen-pick'];
    if (clozePrompt) availableTypes.push('cloze');
    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    const answerField = type === 'en-to-vi' ? 'meaning' : 'word';
    const options = buildQuizOptions(correctWord, translatedVocabulary, answerField, 4);

    if (options.length < 4) return;

    setQuizQuestion({
      id: `${quizSessionIdRef.current}:${++quizQuestionSequenceRef.current}:${correctWord.id}`,
      target: correctWord,
      options,
      type,
      clozePrompt,
    });
    setQuizSelectedAnswer(null);
    setQuizIsAnswered(false);

    if (type === 'listen-pick') {
      handleSpeak(correctWord.word);
    }
  };

  // Handle Quiz Answer
  const handleAnswerQuiz = (option) => {
    if (quizIsAnswered) return;
    setQuizSelectedAnswer(option.id);
    setQuizIsAnswered(true);
    const isCorrect = option.id === quizQuestion.target.id;
    const reviewResult = dispatchLearningEvent({
      id: `vocabulary-quiz:${quizQuestion.id}`,
      type: 'word.reviewed',
      source: 'vocabulary-quiz',
      payload: { wordId: quizQuestion.target.id, quality: isCorrect ? 3 : 1, xp: 0 },
    });
    onUpdateUserData(reviewResult.userData);

    if (isCorrect) {
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

  if (!vocabList.length) {
    return <div className="empty-state-card">Kho từ hệ thống đang được tải. Vui lòng thử lại sau giây lát.</div>;
  }

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
            <button
              className={`mode-btn ${studyMode === 'scramble' ? 'active' : ''}`}
              onClick={() => setStudyMode('scramble')}
            >
              <Shuffle size={16} />
              <span>Xếp Chữ</span>
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
              onChange={(e) => { setSearchQuery(e.target.value); resetFilteredNavigation(); }}
            />
            {searchQuery && (
              <button className="clear-search-btn" onClick={() => { setSearchQuery(''); resetFilteredNavigation(); }}>
                <X size={16} />
              </button>
            )}
          </div>

          {/* Level Filter */}
          <select 
            className="filter-select"
            value={selectedLevel}
            onChange={(e) => { setSelectedLevel(e.target.value); resetFilteredNavigation(); }}
          >
            {levels.map((lvl) => (
              <option key={lvl} value={lvl}>{lvl}</option>
            ))}
          </select>

          {/* Topic Filter */}
          <select 
            className="filter-select"
            value={selectedTopic}
            onChange={(e) => { setSelectedTopic(e.target.value); resetFilteredNavigation(); }}
          >
            {topics.map((top) => (
              <option key={top} value={top}>{top}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select 
            className="filter-select"
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); resetFilteredNavigation(); }}
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
                  <div className="card-ipa-text">{currentPresentation.ipa}</div>
                </div>

                <div className="card-instruction-hint">
                  <RotateCw size={15} />
                  <span>Bấm vào thẻ để lật xem nghĩa tiếng Việt & ví dụ</span>
                </div>

                <div className="card-bottom-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="card-audio-btn"
                    title="Nghe phát âm chuẩn US"
                    onClick={() => handleSpeak(currentCard.word, voiceSpeed)}
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

                  <button
                    className="card-audio-btn"
                    style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: '#38bdf8', color: '#38bdf8', fontWeight: 700 }}
                    title="Đối chiếu nghĩa, cách dùng và ví dụ theo ngữ cảnh"
                    onClick={() => openWordDetail(currentCard, activeEnrichment)}
                  >
                    <Sparkles size={18} />
                    <span>Nghĩa & ví dụ</span>
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
                  <div className="meaning-highlight">{currentPresentation.meaning}</div>
                  {(activeEnrichment?.primaryMeaningVi || translatedMeanings[getMeaningCacheKey(currentCard)]) && (
                    <div className="meaning-verified-badge">Nghĩa tiếng Việt đã được chuẩn hóa</div>
                  )}
                  {activeEnrichment?.persistedOnServer
                    ? <div className="example-saved-badge">Đã lưu trên máy chủ · không mất khi xóa dữ liệu trình duyệt</div>
                    : activeEnrichment?.savedAt && <div className="example-saved-badge">Đã lưu trên thiết bị · mở lại không tốn lượt AI</div>}
                  {currentPresentation.meaningSource === 'pending' && (
                    <button className="meaning-review-link" onClick={(event) => { event.stopPropagation(); openWordDetail(currentCard, activeEnrichment); }}>
                      Nghĩa này chưa đủ tin cậy · Mở phần đối chiếu
                    </button>
                  )}
                </div>

                <div className="card-example-box" onClick={(e) => e.stopPropagation()}>
                  {currentPresentation.hasCompleteContexts && (
                    <div className="example-saved-badge">Đang xem 2 câu tóm tắt · đủ 5 ngữ cảnh trong phần chi tiết</div>
                  )}
                  {currentExamples.length > 0 ? currentExamples.map((example) => (
                    <div className="trusted-example" key={example.en}>
                      <span className="trusted-example-context">{example.context || 'Ví dụ thực tế'}</span>
                      <div className="ex-en-row">
                        <span className="ex-en-text">{example.en}</span>
                        <button className="inline-audio-btn" onClick={() => handleSpeak(example.en)} aria-label={`Nghe câu ${example.en}`}>
                          <Volume2 size={16} />
                        </button>
                      </div>
                      {example.vi && <div className="ex-vi-text">{example.vi}</div>}
                    </div>
                  )) : (
                    <button
                      className="example-quality-placeholder"
                      onClick={flashcardAiData?.unavailableReason ? retryFlashcardExamples : () => openWordDetail(currentCard, activeEnrichment)}
                    >
                      <BookOpen size={17} />
                      <span>
                        {isLoadingFlashcardExamples
                          ? 'Đang tải ví dụ song ngữ…'
                          : flashcardAiData?.unavailableReason
                            ? `${getVocabularyEnrichmentMessage(flashcardAiData)} Bấm để thử lại.`
                            : 'Chưa có ví dụ đã kiểm chứng. Mở phần ví dụ đa ngữ cảnh.'}
                      </span>
                    </button>
                  )}
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
        <div ref={listContainerRef} className="vocab-list-container">
          <div className="vocab-cards-grid">
            {visibleListWords
              .map((w) => {
                const isMastered = masteredSet.has(w.id);
                const isBookmarked = bookmarkedSet.has(w.id);
                const cachedAiData = getCachedWordEnrichment(w.word);
                const aiState = listAiData[w.word.toLowerCase()];
                const presentation = getWordPresentation(w, aiState || cachedAiData);
                const availableExamples = presentation.examples;
                const hasFiveContexts = presentation.hasCompleteContexts;
                const contextLabels = [...new Set(availableExamples
                  .map((example) => example.context || 'Thực tế'))]
                  .slice(0, 3);

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
                      <div className="item-ipa-text">{presentation.ipa}</div>
                      <div className="item-meaning-text">{presentation.meaning}</div>
                      <div className="item-example-box">
                        <div className="item-example-summary">
                          <span className="item-example-summary-label">Ví dụ đa ngữ cảnh</span>
                          {hasFiveContexts ? (
                            <>
                              <strong>5/5 ngữ cảnh đã sẵn sàng</strong>
                              <span className="item-example-contexts">{contextLabels.join(' • ')}</span>
                              {aiState?.persistencePending && (
                                <span className="item-example-sync-pending">Đã lưu trên thiết bị · server sẽ đồng bộ lại.</span>
                              )}
                            </>
                          ) : (
                            <div className="item-example-loading">
                            {availableExamples.length
                              ? `${availableExamples.length}/5 ví dụ tạm có · hệ thống đang bổ sung phần còn thiếu.`
                              : aiState?.unavailableReason === 'SYSTEM_ENRICHMENT_PENDING'
                              ? '0/5 ví dụ · hệ thống đang tự động bổ sung.'
                              : aiState?.unavailableReason
                              ? getVocabularyEnrichmentMessage(aiState)
                              : aiState?.isLoading || hasBackendApi()
                                ? aiState?.retryAttempt
                                  ? `AI phản hồi chậm · đang tự thử lại lần ${aiState.retryAttempt}…`
                                  : 'Đang tạo ví dụ song ngữ theo nhiều ngữ cảnh…'
                                : 'Chưa có ví dụ đã kiểm chứng.'}
                            {aiState?.unavailableReason && (
                              <>
                                {aiState.unavailableRequestId && (
                                  <span className="item-ai-request-id">Mã lỗi: {aiState.unavailableRequestId}</span>
                                )}
                                <button type="button" className="item-ai-retry" onClick={() => retryListExamples(w)}>
                                  Thử lại AI
                                </button>
                              </>
                            )}
                          </div>
                          )}
                        </div>
                        <button type="button" className="item-more-examples" onClick={() => openWordDetail(w, aiState || cachedAiData)}>
                          {hasFiveContexts ? 'Xem đủ 5 ví dụ' : `Còn thiếu ${5 - Math.min(5, availableExamples.length)} ví dụ`}
                        </button>
                      </div>
                    </div>

                    <div className="item-card-footer">
                      <button 
                        className="item-btn audio" 
                        onClick={() => handleSpeak(w.word, voiceSpeed)}
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
          <div className="pagination-section">
            <div className="pagination-bar">
              <button
                type="button"
                className="page-btn"
                disabled={currentPage === 1}
                onClick={() => goToPage(currentPage - 1)}
              >
                <ArrowLeft size={16} />
                <span>Trang trước</span>
              </button>
              <span className="page-indicator">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                className="page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => goToPage(currentPage + 1)}
              >
                <span>Trang sau</span>
                <ArrowRight size={16} />
              </button>
            </div>

            <form
              className="page-jump-form"
              onSubmit={(event) => {
                event.preventDefault();
                goToPage(pageInput);
              }}
            >
              <label htmlFor="vocabulary-page-input">Nhập trang</label>
              <input
                id="vocabulary-page-input"
                className="page-jump-input"
                type="number"
                inputMode="numeric"
                min="1"
                max={totalPages}
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                onBlur={() => {
                  if (!pageInput) setPageInput(String(currentPage));
                }}
                aria-label={`Nhập số trang từ 1 đến ${totalPages}`}
              />
              <button type="submit" className="page-jump-btn">Chuyển tới</button>
            </form>
          </div>
        </div>
      )}

      {/* Mode 3: Quiz Arena */}
      {studyMode === 'quiz' && quizQuestion && (
        <div className="quiz-arena-container">
          <div className="quiz-card">
            <div className="quiz-top-info">
              <span className="quiz-type-badge">
                {QUIZ_LABELS[quizQuestion.type]}
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
              ) : quizQuestion.type === 'vi-to-en' ? (
                <div className="en-quiz-prompt">
                  <p className="quiz-direction">Từ tiếng Anh nào phù hợp nhất với nghĩa:</p>
                  <h3 className="meaning-quiz-heading">{getWordPresentation(quizQuestion.target).meaning}</h3>
                  <div className="target-ipa">Loại từ: {quizQuestion.target.pos || quizQuestion.target.type || '—'}</div>
                </div>
              ) : quizQuestion.type === 'cloze' ? (
                <div className="en-quiz-prompt">
                  <p className="quiz-direction">Chọn từ phù hợp nhất với ngữ cảnh:</p>
                  <h3 className="cloze-quiz-heading">{quizQuestion.clozePrompt}</h3>
                  <div className="target-ipa">{getWordPresentation(quizQuestion.target).meaning}</div>
                </div>
              ) : (
                <div className="en-quiz-prompt">
                  <h3 className="target-word-heading">{quizQuestion.target.word}</h3>
                  <div className="target-ipa">{getWordPresentation(quizQuestion.target).ipa} ({quizQuestion.target.pos})</div>
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
                      {quizQuestion.type === 'en-to-vi' ? getWordPresentation(option).meaning : option.word}
                    </span>
                    {quizIsAnswered && isCorrect && <Check size={18} className="opt-status-icon" />}
                    {quizIsAnswered && isSelected && !isCorrect && <X size={18} className="opt-status-icon" />}
                  </button>
                );
              })}
            </div>

            {quizIsAnswered && (
              <div className="quiz-answer-explanation" role="status">
                <strong>{quizSelectedAnswer === quizQuestion.target.id ? 'Chính xác.' : 'Chưa đúng.'}</strong>
                <span><b>{quizQuestion.target.word}</b> — {getWordPresentation(quizQuestion.target).meaning}</span>
                <button onClick={() => openWordDetail(quizQuestion.target)}>Xem cách dùng và ví dụ</button>
              </div>
            )}

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
      {studyMode === 'scramble' && (
        <WordScrambleGame
          key={`${selectedTopic}-${selectedLevel}-${selectedStatus}-${searchQuery}`}
          words={filteredWords}
          userData={userData}
          onUpdateUserData={onUpdateUserData}
          onSpeak={handleSpeak}
          onOpenDetail={openWordDetail}
        />
      )}
      <WordDetailModal
        key={detailWord?.word || 'closed-word-detail'}
        word={detailWord}
        initialEnrichment={detailWord?._aiEnrichment}
        isOpen={Boolean(detailWord)}
        onClose={() => setDetailWord(null)}
      />
    </div>
  );
}
