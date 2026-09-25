import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Headphones,
  Info,
  Mic,
  MicOff,
  RotateCcw,
  ShieldCheck,
  Target,
  Volume2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { diagnosticQuestions, diagnosticSections, evaluateDiagnosticResults } from '../data/diagnosticData';
import { speakText, startSpeechRecognition } from '../utils/speechHelper';
import { evaluatePronunciation } from '../utils/scoreEvaluator';
import { loadDiagnosticHistory, loadLatestDiagnosticResult, saveDiagnosticResult } from '../utils/diagnosticHistory';

const OBJECTIVE_SECTIONS = ['language', 'vocabulary', 'reading', 'listening'];

function loadSavedResult() {
  return loadLatestDiagnosticResult();
}

export default function DiagnosticTestView({ onSelectStage, onCompleteTest }) {
  const [savedResult] = useState(loadSavedResult);
  const [phase, setPhase] = useState(savedResult ? 'result' : 'intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [speakingScores, setSpeakingScores] = useState({});
  const [spokenTexts, setSpokenTexts] = useState({});
  const [audioPlays, setAudioPlays] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [result, setResult] = useState(savedResult);
  const [showReview, setShowReview] = useState(false);
  const [history, setHistory] = useState(loadDiagnosticHistory);
  const recognitionRef = useRef(null);

  const question = diagnosticQuestions[currentIndex];
  const section = diagnosticSections.find((item) => item.id === question?.section);
  const isSpeaking = question?.type === 'speaking';
  const isListening = question?.type === 'listening';
  const progress = Math.round(((currentIndex + 1) / diagnosticQuestions.length) * 100);
  const currentAnswer = answers[question?.id];
  const currentSpeechScore = speakingScores[question?.id];

  const startTest = () => {
    recognitionRef.current?.stop();
    setPhase('test');
    setCurrentIndex(0);
    setAnswers({});
    setSpeakingScores({});
    setSpokenTexts({});
    setAudioPlays({});
    setSpeechError('');
    setShowReview(false);
  };

  const playListening = () => {
    const used = audioPlays[question.id] || 0;
    if (used >= 2) return;
    setAudioPlays((previous) => ({ ...previous, [question.id]: used + 1 }));
    speakText(question.audioPrompt, 0.92);
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    setSpeechError('');
    const recognition = startSpeechRecognition(
      (transcript) => {
        const evaluation = evaluatePronunciation(question.targetPhrase, transcript);
        setSpokenTexts((previous) => ({ ...previous, [question.id]: transcript }));
        setSpeakingScores((previous) => ({ ...previous, [question.id]: evaluation.score }));
        setIsRecording(false);
      },
      (error) => {
        setIsRecording(false);
        setSpeechError(error === 'not-allowed'
          ? 'Microphone chưa được cấp quyền. Bạn có thể bỏ qua phần nói.'
          : 'Chưa nhận được giọng nói rõ ràng. Hãy thử lại hoặc bỏ qua.');
      },
      () => setIsRecording(false),
    );
    recognitionRef.current = recognition;
    if (!recognition) {
      setIsRecording(false);
      setSpeechError('Trình duyệt không hỗ trợ nhận dạng giọng nói. Phần nói sẽ được bỏ qua.');
      return;
    }
    setIsRecording(true);
  };

  const submitTest = () => {
    const finalResult = evaluateDiagnosticResults(answers, speakingScores);
    setResult(finalResult);
    setPhase('result');
    setHistory(saveDiagnosticResult(finalResult));
    onCompleteTest?.(finalResult);
    try {
      confetti({ particleCount: 75, spread: 68, origin: { y: 0.62 } });
    } catch {
      // Visual celebration is optional.
    }
  };

  const goNext = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
    setSpeechError('');
    if (currentIndex === diagnosticQuestions.length - 1) submitTest();
    else setCurrentIndex((index) => index + 1);
  };

  const goBack = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
    setSpeechError('');
    setCurrentIndex((index) => Math.max(0, index - 1));
  };

  if (phase === 'intro') {
    return (
      <main className="placement-shell animate-fade-in">
        <section className="placement-intro-card">
          <div className="placement-kicker"><ShieldCheck size={16} /> CEFR placement • A1–B2</div>
          <div className="placement-intro-icon"><Brain size={42} /></div>
          <h1>Bài kiểm tra năng lực đầu vào</h1>
          <p className="placement-lead">Đánh giá khả năng sử dụng tiếng Anh trong ngữ cảnh thực tế để đề xuất đúng điểm bắt đầu, không kiểm tra mẹo ghi nhớ rời rạc.</p>

          <div className="placement-meta-grid">
            <div><Clock3 size={20} /><span><strong>12–15 phút</strong><small>Không giới hạn thời gian</small></span></div>
            <div><Target size={20} /><span><strong>21 câu tính điểm</strong><small>+ 2 mẫu nói tùy chọn</small></span></div>
            <div><BarChart3 size={20} /><span><strong>5 mức kết quả</strong><small>Pre-A1 đến B2</small></span></div>
          </div>

          <div className="placement-blueprint">
            {diagnosticSections.map((item, index) => (
              <div key={item.id} className="placement-blueprint-item">
                <span className="blueprint-index" style={{ color: item.color, borderColor: `${item.color}55` }}>{index + 1}</span>
                <span><strong>{item.label}</strong><small>{item.description}</small></span>
              </div>
            ))}
          </div>

          <div className="placement-rules">
            <Info size={18} />
            <p>Đáp án và giải thích chỉ xuất hiện sau khi nộp bài. Phần nghe được phát tối đa 2 lần. Kết quả dùng để định hướng lộ trình, không thay thế chứng chỉ ngoại ngữ chính thức.</p>
          </div>

          <button className="btn btn-primary placement-start-btn" onClick={startTest}>Bắt đầu đánh giá <ArrowRight size={20} /></button>
        </section>
      </main>
    );
  }

  if (phase === 'result' && result) {
    const reviewQuestions = diagnosticQuestions.filter((item) => OBJECTIVE_SECTIONS.includes(item.section));
    const previousResult = history.length > 1 ? history.at(-2) : null;
    const scoreDelta = previousResult ? result.overallScore - previousResult.overallScore : null;
    return (
      <main className="placement-shell placement-result-shell animate-fade-in">
        <section className="placement-result-hero">
          <div className="result-award"><Award size={38} /></div>
          <div>
            <span className="placement-kicker">KẾT QUẢ ĐỊNH HƯỚNG CEFR</span>
            <h1>{result.title}</h1>
            <p>{result.canDo}</p>
          </div>
          <div className="result-score-ring"><strong>{result.overallScore}</strong><span>/100</span><small>điểm tổng</small></div>
        </section>

        <section className="placement-result-grid">
          <div className="placement-report-card skills-report-card">
            <div className="report-card-title"><BarChart3 size={20} /><h2>Hồ sơ năng lực</h2></div>
            <div className="skill-score-list">
              {diagnosticSections.map((item) => {
                const skill = result.breakdown[item.id];
                const score = skill?.score;
                return (
                  <div className="skill-score-row" key={item.id}>
                    <div><span>{item.label}</span><strong style={{ color: item.color }}>{score === null || score === undefined ? 'Chưa làm' : `${score}%`}</strong></div>
                    <div className="skill-score-track"><span style={{ width: `${score || 0}%`, background: item.color }} /></div>
                    <small>{item.id === 'speaking' ? `${skill?.attempted || 0}/${skill?.total || 2} mẫu đã thực hiện` : `${skill?.correct || 0}/${skill?.total || 0} câu đúng`}</small>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="placement-report-card placement-insight-card">
            <div className="report-card-title"><Target size={20} /><h2>Điểm cần ưu tiên</h2></div>
            <div className="insight-highlight"><small>Thế mạnh hiện tại</small><strong>{result.strongestSkill.label} · {result.strongestSkill.score}%</strong></div>
            <div className="insight-highlight focus"><small>Nên tập trung</small><strong>{result.focusSkill.label} · {result.focusSkill.score}%</strong></div>
            <p>{result.summary}</p>
          </aside>
        </section>

        <section className="placement-report-card placement-route-card">
          <div className="route-icon"><BookOpen size={23} /></div>
          <div><small>LỘ TRÌNH ĐƯỢC ĐỀ XUẤT</small><p>{result.recommendation}</p></div>
          <button className="btn btn-primary" onClick={() => onSelectStage(result.targetStage)}>Bắt đầu học <ChevronRight size={18} /></button>
        </section>

        <section className="placement-band-card">
          <div className="report-card-title"><CheckCircle2 size={20} /><h2>Mức độ làm chủ theo bậc câu hỏi</h2></div>
          <div className="band-grid">{Object.entries(result.bandStats).map(([level, stats]) => <div key={level}><strong>{level}</strong><span>{stats.score}%</span><small>{stats.correct}/{stats.total} đúng</small></div>)}</div>
        </section>

        <section className="placement-band-card diagnostic-history-card">
          <div className="report-card-title"><Clock3 size={20} /><h2>Lịch sử đánh giá</h2></div>
          {previousResult && <p>So với lần trước: <strong>{scoreDelta >= 0 ? '+' : ''}{scoreDelta} điểm</strong> · {previousResult.level} → {result.level}</p>}
          <div className="diagnostic-history-list">
            {history.slice(-5).reverse().map((item) => (
              <div key={item.completedAt}><time>{new Date(item.completedAt).toLocaleDateString('vi-VN')}</time><strong>{item.level}</strong><span>{item.overallScore}/100</span></div>
            ))}
          </div>
        </section>

        <div className="placement-result-actions">
          <button className="btn btn-outline" onClick={() => setShowReview((value) => !value)}>{showReview ? 'Ẩn đáp án' : 'Xem đáp án & giải thích'}</button>
          <button className="btn btn-outline" onClick={startTest}><RotateCcw size={17} /> Làm lại bài test</button>
        </div>

        {showReview && <section className="placement-review-list">
          <h2>Đáp án và giải thích</h2>
          {reviewQuestions.map((item, index) => {
            const userAnswer = answers[item.id];
            const isCorrect = userAnswer === item.correctId;
            const correctText = item.options.find((choice) => choice.id === item.correctId)?.text;
            return <article className={`review-answer-card ${isCorrect ? 'correct' : 'incorrect'}`} key={item.id}><div className="review-answer-head"><span>Câu {index + 1} · {item.level}</span><strong>{isCorrect ? 'Đúng' : userAnswer ? 'Chưa đúng' : 'Kết quả cũ'}</strong></div><p>{item.question}</p><small>Đáp án: <b>{item.correctId}. {correctText}</b></small><div>{item.explanation}</div></article>;
          })}
        </section>}

        <p className="placement-disclaimer">{result.note}</p>
      </main>
    );
  }

  const playsUsed = audioPlays[question.id] || 0;
  const canContinue = isSpeaking || Boolean(currentAnswer);

  return (
    <main className="placement-shell placement-test-shell animate-fade-in">
      <header className="placement-test-header">
        <div className="test-header-copy"><span>{section.label}</span><small>{section.description}</small></div>
        <div className="test-counter"><strong>{currentIndex + 1}</strong><span>/ {diagnosticQuestions.length}</span></div>
        <div className="placement-progress-track"><span style={{ width: `${progress}%` }} /></div>
      </header>

      <div className="placement-section-map">
        {diagnosticSections.map((item) => {
          const sectionQuestions = diagnosticQuestions.filter((entry) => entry.section === item.id);
          const firstIndex = diagnosticQuestions.findIndex((entry) => entry.section === item.id);
          const lastIndex = firstIndex + sectionQuestions.length - 1;
          const active = question.section === item.id;
          const complete = currentIndex > lastIndex;
          return <div className={`${active ? 'active' : ''} ${complete ? 'complete' : ''}`} key={item.id}><span>{complete ? <Check size={13} /> : item.shortLabel}</span></div>;
        })}
      </div>

      <section className="placement-question-card">
        <div className="question-context-row"><span className="question-number">Câu {currentIndex + 1}</span><span className="question-instruction">{question.prompt || 'Read the sentence aloud.'}</span></div>

        {question.passage && <div className="placement-passage"><small>{question.passageTitle}</small><p>{question.passage}</p></div>}

        {isListening && <div className="placement-listening-box">
          <Headphones size={28} />
          <div><strong>Đoạn nghe không hiển thị phụ đề</strong><small>Nghe ý chính và chi tiết cần thiết. Bạn còn {Math.max(0, 2 - playsUsed)} lượt.</small></div>
          <button onClick={playListening} disabled={playsUsed >= 2}><Volume2 size={19} /> {playsUsed ? 'Nghe lại' : 'Phát audio'}</button>
        </div>}

        {!isSpeaking ? <>
          <h1 className="placement-question-text">{question.question}</h1>
          <div className="placement-options">
            {question.options.map((choice) => <button key={choice.id} className={currentAnswer === choice.id ? 'selected' : ''} onClick={() => setAnswers((previous) => ({ ...previous, [question.id]: choice.id }))}><span>{choice.id}</span><p>{choice.text}</p>{currentAnswer === choice.id && <Check size={19} />}</button>)}
          </div>
        </> : <div className="placement-speaking-task">
          <span className="speaking-optional-label">Mẫu nói tùy chọn • không quyết định bậc CEFR</span>
          <h1>“{question.targetPhrase}”</h1>
          <p>{question.meaning}</p>
          <div className="speaking-task-tip"><Info size={16} /> {question.tip}</div>
          <button className={`placement-mic-btn ${isRecording ? 'recording' : ''}`} onClick={toggleRecording}>{isRecording ? <MicOff size={30} /> : <Mic size={30} />}</button>
          <strong className="mic-status">{isRecording ? 'Đang nghe...' : Number.isFinite(currentSpeechScore) ? `Độ khớp bản ghi: ${currentSpeechScore}%` : 'Nhấn micro rồi đọc câu trên'}</strong>
          {spokenTexts[question.id] && <div className="speech-transcript">Trình duyệt nhận được: “{spokenTexts[question.id]}”</div>}
          {speechError && <div className="placement-inline-error"><AlertCircle size={16} /> {speechError}</div>}
        </div>}

        <footer className="placement-question-footer">
          <button className="btn btn-outline" onClick={goBack} disabled={currentIndex === 0}><ArrowLeft size={18} /> Quay lại</button>
          <span>{isSpeaking && !Number.isFinite(currentSpeechScore) ? 'Bạn có thể bỏ qua phần này' : currentAnswer ? 'Đã chọn câu trả lời' : 'Chọn một đáp án để tiếp tục'}</span>
          <button className="btn btn-primary" onClick={goNext} disabled={!canContinue}>{currentIndex === diagnosticQuestions.length - 1 ? 'Nộp bài' : isSpeaking && !Number.isFinite(currentSpeechScore) ? 'Bỏ qua' : 'Tiếp tục'} <ArrowRight size={18} /></button>
        </footer>
      </section>
    </main>
  );
}
