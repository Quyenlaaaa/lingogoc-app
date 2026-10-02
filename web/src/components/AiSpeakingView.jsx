import React, { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Eye,
  EyeOff,
  Lightbulb,
  LoaderCircle,
  Mic,
  MicOff,
  Radio,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import { aiScenarios } from '../data/scenariosData';
import speechHelper from '../utils/speechHelper';
import { evaluatePronunciation } from '../utils/scoreEvaluator';
import AudioWave from './AudioWave';
import {
  loadSpeakingConfig,
  requestDurableSpeakingSession,
  requestSpeakingReply,
  saveSpeakingConfig,
} from '../utils/speakingAiService';
import { hasBackendApi } from '../utils/backendApi';
import { dispatchLearningEvent } from '../utils/learningEventEngine';
import { getSpeakingLevel, normalizeSpeakingLevel, SPEAKING_LEVEL_OPTIONS } from '../utils/speakingLevels';
import {
  INITIAL_SPEAKING_CONVERSATION_STATE,
  SPEAKING_STATUS_LABELS,
  speakingConversationReducer,
} from '../utils/speakingConversationState';
import {
  createSpeakingSentenceQueue,
  shiftSpeakingSentenceQueue,
  updateSpeakingSentenceQueue,
} from '../utils/speakingSentenceQueue';
import {
  beginSpeakingTurn,
  completeSpeakingTurn,
  createSpeakingSession,
  failSpeakingTurn,
  loadActiveSpeakingSession,
  loadCurrentSpeakingSession,
  mergeDurableSpeakingSession,
  retrySpeakingTurn,
} from '../utils/speakingSessionStore';

const SpeakingAvatar = lazy(() => import('./speaking/SpeakingAvatar'));

function initialSpeakingSession() {
  const config = loadSpeakingConfig();
  return loadCurrentSpeakingSession() || loadActiveSpeakingSession(aiScenarios[0], { level: config.level });
}

function messageTime(message) {
  const timestamp = Date.parse(message?.createdAt || '');
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
}

const SPEAKING_SCORE_LABELS = Object.freeze({
  grammar: 'Ngữ pháp',
  vocabulary: 'Từ vựng',
  fluency: 'Trôi chảy',
  taskCompletion: 'Hoàn thành',
  pronunciation: 'Khớp lời nói',
});

export default function AiSpeakingView({ onUpdateUserData, voiceSpeed = 0.9 }) {
  const [session, setSession] = useState(initialSpeakingSession);
  const [input, setInput] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [streamingReply, setStreamingReply] = useState('');
  const [showTranslation, setShowTranslation] = useState(true);
  const [showHints, setShowHints] = useState(true);
  const [pronunciation, setPronunciation] = useState(null);
  const [error, setError] = useState('');
  const [config, setConfig] = useState(loadSpeakingConfig);
  const [conversationState, dispatchConversation] = useReducer(
    speakingConversationReducer,
    INITIAL_SPEAKING_CONVERSATION_STATE,
  );
  const isRecording = ['listening', 'transcribing'].includes(conversationState.microphone);
  const isThinking = ['thinking', 'streaming', 'reconnecting'].includes(conversationState.transport);
  const isSpeaking = conversationState.playback === 'speaking';

  const recognitionRef = useRef(null);
  const requestControllerRef = useRef(null);
  const autoListenTimerRef = useRef(null);
  const startMicRef = useRef(null);
  const chatEndRef = useRef(null);
  const isMountedRef = useRef(true);
  const activeSessionIdRef = useRef(session.id);
  const resumedRequestRef = useRef(null);
  const speechRunRef = useRef(0);
  const sentenceQueueRef = useRef(createSpeakingSentenceQueue());
  const queuedSpeechPlayingRef = useRef(false);
  const playNextQueuedSentenceRef = useRef(null);

  const connected = hasBackendApi();
  const scenario = useMemo(() => aiScenarios.find((item) => item.id === session.scenarioId) || aiScenarios[0], [session.scenarioId]);
  const levelPolicy = useMemo(() => getSpeakingLevel(session.level), [session.level]);
  const messages = session.messages;
  const latestFeedback = session.feedback.at(-1) || null;
  const correction = latestFeedback?.correction || '';
  const encouragement = latestFeedback?.encouragement || '';
  const hints = latestFeedback?.hints?.length ? latestFeedback.hints : scenario.starterHints || [];

  const stopAudio = useCallback((updateState = true) => {
    speechRunRef.current += 1;
    sentenceQueueRef.current = createSpeakingSentenceQueue();
    queuedSpeechPlayingRef.current = false;
    if (autoListenTimerRef.current) {
      clearTimeout(autoListenTimerRef.current);
      autoListenTimerRef.current = null;
    }
    speechHelper.stopSpeaking();
    if (updateState && isMountedRef.current) dispatchConversation({ type: 'INTERRUPT' });
  }, []);

  const speak = useCallback(async (text, options = {}) => {
    if (!text) return;
    stopAudio();
    const speechRun = ++speechRunRef.current;
    dispatchConversation({ type: 'SPEECH_START' });
    const finishSpeech = () => {
      if (!isMountedRef.current || speechRun !== speechRunRef.current) return;
      dispatchConversation({ type: 'SPEECH_END', autoListen: options.resumeListening && config.autoListen });
      if (options.resumeListening && config.autoListen) {
        autoListenTimerRef.current = setTimeout(() => startMicRef.current?.(), 450);
      }
    };

    if (!isMountedRef.current) return;
    speechHelper.speak(text, {
      rate: Math.max(0.65, Math.min(1.2, voiceSpeed * levelPolicy.speechRate)),
      onEnd: finishSpeech,
      onError: finishSpeech,
    });
  }, [config.autoListen, levelPolicy.speechRate, stopAudio, voiceSpeed]);

  const playNextQueuedSentence = useCallback(() => {
    if (!isMountedRef.current || queuedSpeechPlayingRef.current) return;
    const shifted = shiftSpeakingSentenceQueue(sentenceQueueRef.current);
    sentenceQueueRef.current = shifted.state;
    if (!shifted.sentence) {
      dispatchConversation({ type: 'SPEECH_END' });
      if (sentenceQueueRef.current.final && config.autoListen) {
        autoListenTimerRef.current = setTimeout(() => startMicRef.current?.(), 450);
      }
      return;
    }

    queuedSpeechPlayingRef.current = true;
    const speechRun = ++speechRunRef.current;
    dispatchConversation({ type: 'SPEECH_START' });
    const finishSentence = () => {
      if (!isMountedRef.current || speechRun !== speechRunRef.current) return;
      queuedSpeechPlayingRef.current = false;
      playNextQueuedSentenceRef.current?.();
    };
    speechHelper.speak(shifted.sentence, {
      rate: Math.max(0.65, Math.min(1.2, voiceSpeed * levelPolicy.speechRate)),
      onEnd: finishSentence,
      onError: finishSentence,
    });
  }, [config.autoListen, levelPolicy.speechRate, voiceSpeed]);

  useEffect(() => {
    playNextQueuedSentenceRef.current = playNextQueuedSentence;
  }, [playNextQueuedSentence]);

  const startScenario = useCallback((nextScenario, nextLevel = config.level) => {
    requestControllerRef.current?.abort();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.abort();
      } catch {
        // Recognition may already be inactive when switching scenarios.
      }
    }
    stopAudio();
    const nextSession = createSpeakingSession(nextScenario, { level: nextLevel });
    activeSessionIdRef.current = nextSession.id;
    setSession(nextSession);
    setPronunciation(null);
    setInput('');
    setInterimTranscript('');
    setStreamingReply('');
    setError('');
    dispatchConversation({ type: 'RESET' });
  }, [config.level, stopAudio]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        try {
          recognition.abort();
        } catch {
          // Recognition may already be inactive during navigation.
        }
      }
      stopAudio(false);
    };
  }, [stopAudio]);

  useEffect(() => {
    if (!connected || !session.resumeToken) return undefined;
    const controller = new AbortController();
    requestDurableSpeakingSession({
      sessionId: session.id,
      resumeToken: session.resumeToken,
      signal: controller.signal,
    }).then((durable) => {
      if (!durable || !isMountedRef.current || activeSessionIdRef.current !== session.id) return;
      setSession((current) => (current.id === session.id ? mergeDurableSpeakingSession(current, durable) : current));
    }).catch((resumeError) => {
      if (resumeError.name !== 'AbortError') console.warn('Speaking session resume failed', resumeError);
    });
    return () => controller.abort();
  }, [connected, session.id, session.resumeToken]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking, interimTranscript, streamingReply]);

  const toggleHandsFree = () => {
    const saved = saveSpeakingConfig({ ...config, autoListen: !config.autoListen });
    setConfig(saved);
    if (config.autoListen) stopMic();
  };

  const toggleAvatar = () => {
    const saved = saveSpeakingConfig({ ...config, avatarEnabled: !config.avatarEnabled });
    setConfig(saved);
  };

  const changeLevel = (value) => {
    const level = normalizeSpeakingLevel(value);
    if (level === session.level) return;
    const saved = saveSpeakingConfig({ ...config, level });
    setConfig(saved);
    startScenario(scenario, level);
  };

  const activeHints = hints.slice(0, 3);

  const executePendingTurn = useCallback(async (pendingSession, pronunciationEvidence = null) => {
    if (!pendingSession.pendingTurn || !connected) return;
    const pendingScenario = aiScenarios.find((item) => item.id === pendingSession.scenarioId) || aiScenarios[0];
    const requestId = pendingSession.pendingTurn.requestId;
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setStreamingReply('');
    sentenceQueueRef.current = createSpeakingSentenceQueue(requestId);
    queuedSpeechPlayingRef.current = false;
    dispatchConversation({
      type: 'TURN_SUBMIT',
      requestId,
      turnSequence: pendingSession.pendingTurn.turnSequence,
      reconnecting: pendingSession.transport.state === 'reconnecting',
    });

    try {
      const result = await requestSpeakingReply({
        requestId,
        sessionId: pendingSession.id,
        resumeToken: pendingSession.resumeToken,
        turnSequence: pendingSession.pendingTurn.turnSequence,
        lastAcknowledgedSequence: pendingSession.transport.lastAcknowledgedSequence,
        reconnectAttempt: pendingSession.transport.reconnectAttempts,
        scenario: pendingScenario,
        level: pendingSession.level,
        messages: pendingSession.messages,
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === 'delta' && typeof event.text === 'string') {
            setStreamingReply(event.text);
            sentenceQueueRef.current = updateSpeakingSentenceQueue(sentenceQueueRef.current, event.text);
            playNextQueuedSentenceRef.current?.();
          }
          dispatchConversation({ type: 'STREAM_EVENT', event });
        },
      });
      const completed = completeSpeakingTurn(
        pendingSession,
        requestId,
        result,
        pronunciationEvidence?.score ?? null,
        pronunciationEvidence?.evidence ?? null,
      );
      const learningResult = dispatchLearningEvent({
        id: requestId,
        type: 'xp.awarded',
        source: 'speaking',
        payload: { xp: 15 },
      });
      onUpdateUserData?.(learningResult.userData);
      if (isMountedRef.current && activeSessionIdRef.current === pendingSession.id) {
        setSession(completed);
        setError('');
        setStreamingReply('');
        sentenceQueueRef.current = updateSpeakingSentenceQueue(sentenceQueueRef.current, result.replyEn, { final: true });
        playNextQueuedSentenceRef.current?.();
      }
    } catch (requestError) {
      stopAudio(false);
      const message = requestError.name === 'AbortError'
        ? 'Lượt nói đã tạm dừng. Bạn có thể thử lại mà không tạo lượt mới.'
        : requestError.message || 'Không thể kết nối với AI.';
      dispatchConversation(requestError.name === 'AbortError'
        ? { type: 'INTERRUPT' }
        : { type: 'FAIL', error: message });
      const failed = failSpeakingTurn(pendingSession, requestId, message);
      if (isMountedRef.current && activeSessionIdRef.current === pendingSession.id) {
        setSession(failed);
        setError(message);
      }
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
    }
  }, [connected, onUpdateUserData, stopAudio]);

  const sendTurn = useCallback(async (rawText, targetHint = null) => {
    const text = String(rawText || input).trim();
    if (!text || isThinking || session.pendingTurn) return;
    if (!connected) {
      setError('Backend AI chưa được cấu hình. Quản trị viên cần thiết lập VITE_API_BASE_URL khi deploy frontend.');
      return;
    }

    stopAudio();
    setInput('');
    setInterimTranscript('');
    setStreamingReply('');
    setError('');
    const pronunciationResult = targetHint ? evaluatePronunciation(targetHint.en, text) : null;
    setPronunciation(pronunciationResult);
    const pendingSession = beginSpeakingTurn(session, { text });
    setSession(pendingSession);
    await executePendingTurn(pendingSession, pronunciationResult);
  }, [connected, executePendingTurn, input, isThinking, session, stopAudio]);

  const retryPending = useCallback(() => {
    if (!session.pendingTurn || isThinking) return;
    setError('');
    const retried = retrySpeakingTurn(session);
    setSession(retried);
    executePendingTurn(retried);
  }, [executePendingTurn, isThinking, session]);

  useEffect(() => {
    activeSessionIdRef.current = session.id;
    if (session.pendingTurn?.status !== 'pending') return;
    if (resumedRequestRef.current === session.pendingTurn.requestId || requestControllerRef.current) return;
    resumedRequestRef.current = session.pendingTurn.requestId;
    executePendingTurn(session);
  }, [executePendingTurn, session]);

  const stopThinking = () => {
    dispatchConversation({ type: 'INTERRUPT' });
    requestControllerRef.current?.abort();
  };

  const startMic = (targetHint = null) => {
    if (isRecording) return;
    if (isSpeaking) stopAudio();
    if (!speechHelper.isSpeechRecognitionSupported()) {
      const message = 'Trình duyệt chưa hỗ trợ nhận giọng nói. Hãy dùng Chrome/Edge hoặc nhập câu ở ô bên dưới.';
      setError(message);
      dispatchConversation({ type: 'FAIL', error: message });
      return;
    }
    setError('');
    dispatchConversation({ type: 'LISTEN_START' });
    setInterimTranscript('Đang nghe...');
    const recognition = speechHelper.createRecognition(
      (result) => {
        if (result.interim) {
          setInterimTranscript(result.interim);
          dispatchConversation({ type: 'TRANSCRIPT_PARTIAL' });
        }
        if (result.isFinal) {
          setInterimTranscript(result.final);
          sendTurn(result.final, targetHint);
        }
      },
      (recognitionError) => {
        setInterimTranscript('');
        const message = recognitionError === 'not-allowed'
          ? 'Bạn chưa cấp quyền microphone cho trình duyệt.'
          : 'Không nhận được giọng nói. Hãy thử lại và nói gần microphone hơn.';
        setError(message);
        dispatchConversation({ type: 'FAIL', error: message });
      },
      () => dispatchConversation({ type: 'LISTEN_STOP' }),
    );
    recognitionRef.current = recognition;
    try {
      recognition?.start();
    } catch {
      recognitionRef.current = null;
      setInterimTranscript('');
      const message = 'Microphone đang bận. Hãy chờ một chút rồi thử lại.';
      setError(message);
      dispatchConversation({ type: 'FAIL', error: message });
    }
  };

  const stopMic = () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // Recognition may already have ended.
      }
    }
    setInterimTranscript('');
    dispatchConversation({ type: 'LISTEN_STOP' });
  };

  useEffect(() => {
    startMicRef.current = startMic;
  });

  return (
    <div className="ai-speaking-view speaking-ai-v2 animate-fade-in">
      <section className="module-header-card speaking-hero-v2">
        <div className="speaking-hero-copy">
          <div className="module-tag speaking-tag"><Sparkles size={15} /> AI Speaking Lab</div>
          <h2 className="module-title">Trò chuyện tiếng Anh trực tiếp với AI</h2>
          <p className="module-desc">Nói tự nhiên theo từng tình huống, nhận phản hồi đúng ngữ cảnh, bản dịch và cách diễn đạt tốt hơn sau mỗi lượt.</p>
          <div className="speaking-trust-row">
            <span><ShieldCheck size={15} /> API key được bảo vệ tại backend</span>
            <span><Mic size={15} /> Nhận giọng nói trên trình duyệt</span>
            <span><Radio size={15} /> Tự nghe lại sau khi AI trả lời</span>
          </div>
        </div>
        <div className={`provider-status-card ${connected ? 'connected' : ''}`}>
          <span className="provider-status-icon"><Bot size={22} /></span>
          <span>
            <small>{connected ? 'Kết nối an toàn' : 'Chưa cấu hình backend'}</small>
            <strong>{connected ? 'LingoGoc AI Backend' : 'Liên hệ quản trị viên'}</strong>
          </span>
          <ShieldCheck size={18} />
        </div>
      </section>

      <div className="scenarios-carousel speaking-scenarios-v2">
        {aiScenarios.map((item) => (
          <button key={item.id} className={`scenario-pill-item ${scenario.id === item.id ? 'active' : ''}`} onClick={() => startScenario(item)}>
            <span className="sc-icon">{item.avatar}</span>
            <span className="sc-text-wrap"><span className="sc-title">{item.title}</span><span className="sc-partner">{item.partnerName}</span></span>
          </button>
        ))}
      </div>

      <section className="speaking-level-picker" aria-labelledby="speaking-level-title">
        <div className="speaking-level-copy">
          <strong id="speaking-level-title">Trình độ hội thoại</strong>
          <span>{levelPolicy.description}</span>
        </div>
        <div className="speaking-level-options" role="radiogroup" aria-label="Chọn trình độ luyện nói">
          {SPEAKING_LEVEL_OPTIONS.map((level) => (
            <button
              key={level.id}
              type="button"
              role="radio"
              aria-checked={session.level === level.id}
              className={session.level === level.id ? 'active' : ''}
              onClick={() => changeLevel(level.id)}
              title={`${level.label} - ${level.title}`}
            >
              <strong>{level.label}</strong>
              <small>{level.title}</small>
            </button>
          ))}
        </div>
      </section>

      {error && <div className="speaking-error" role="alert"><AlertCircle size={18} /><span>{error}</span>{session.pendingTurn?.status === 'failed' && <button onClick={retryPending}>Thử lại</button>}<button onClick={() => setError('')} title="Đóng"><X size={16} /></button></div>}

      <section className="speaking-chat-arena speaking-arena-v2">
        <header className="chat-arena-header">
          <div className="arena-partner-info">
            <span className="partner-avatar">{scenario.avatar}</span>
            <div><div className="partner-name-row"><strong>{scenario.partnerName}</strong><span className="live-status-dot" /><span className="status-text" data-speaking-state={conversationState.status}>{SPEAKING_STATUS_LABELS[conversationState.status]}</span></div><div className="partner-desc">{scenario.description}</div></div>
          </div>
          <div className="speaking-header-actions">
            <button className={`hands-free-toggle ${config.autoListen ? 'active' : ''}`} onClick={toggleHandsFree} title="AI nói xong sẽ tự bật micro"><Radio size={16} /><span>{config.autoListen ? 'Rảnh tay: Bật' : 'Rảnh tay: Tắt'}</span></button>
            <button className={`icon-toggle ${config.avatarEnabled ? 'active' : ''}`} onClick={toggleAvatar} title={config.avatarEnabled ? 'Tắt hoạt ảnh gia sư AI' : 'Bật hoạt ảnh gia sư AI'} aria-pressed={config.avatarEnabled}><Bot size={17} /></button>
            <button className={`icon-toggle ${showTranslation ? 'active' : ''}`} onClick={() => setShowTranslation((value) => !value)} title="Bật/tắt bản dịch">{showTranslation ? <Eye size={17} /> : <EyeOff size={17} />}</button>
            <button className="reset-chat-btn" onClick={() => startScenario(scenario, session.level)}><RotateCcw size={16} /><span>Bắt đầu lại</span></button>
          </div>
        </header>

        <div className="speaking-stage-v2">
          <AudioWave isActive={isSpeaking || isRecording || isThinking} />
          {config.avatarEnabled ? (
            <Suspense fallback={<div className="speaking-avatar-loading" aria-label="Đang tải gia sư AI"><LoaderCircle size={28} className="animate-spin" /></div>}>
              <SpeakingAvatar state={conversationState.status} partnerName={scenario.partnerName} />
            </Suspense>
          ) : <div className={`speaking-orb ${isRecording ? 'recording' : ''} ${isThinking ? 'thinking' : ''}`}>{isThinking ? <LoaderCircle size={34} className="animate-spin" /> : isRecording ? <Mic size={34} /> : <Bot size={34} />}</div>}
          <span>{interimTranscript || (isRecording ? 'Hãy nói bằng tiếng Anh...' : config.autoListen ? 'Chạm micro một lần để bắt đầu hội thoại rảnh tay' : 'Chạm micro để bắt đầu nói')}</span>
        </div>

        <div className="chat-messages-container speaking-messages-v2">
          {messages.map((message, index) => {
            const isAi = message.sender === 'ai';
            return (
              <article key={`${message.timestamp}-${index}`} className={`chat-bubble-wrapper ${isAi ? 'from-ai' : 'from-user'}`}>
                <div className="bubble-avatar">{isAi ? scenario.avatar : '👤'}</div>
                <div className="bubble-content">
                  <div className="bubble-header-row"><span className="bubble-sender">{isAi ? scenario.partnerName : 'Bạn'}</span><span className="bubble-time">{messageTime(message)}</span></div>
                  <div className="bubble-text-en">{message.text}</div>
                  {isAi && <button className="replay-tts-btn" onClick={() => speak(message.text)}><Volume2 size={15} /> Nghe lại</button>}
                  {isAi && showTranslation && message.textVi && <div className="bubble-sub-vi">🇻🇳 {message.textVi}</div>}
                </div>
              </article>
            );
          })}
          {isThinking && <div className="chat-bubble-wrapper from-ai"><div className="bubble-avatar">{scenario.avatar}</div><div className={`bubble-content speaking-thinking ${streamingReply ? 'has-stream-text' : ''}`}>{streamingReply ? <><span className="streaming-reply-text">{streamingReply}</span><span className="streaming-cursor" aria-hidden="true" /></> : <><LoaderCircle size={17} className="animate-spin" /> AI đang tạo câu trả lời...</>}</div></div>}
          <div ref={chatEndRef} />
        </div>

        {(correction || encouragement) && <div className="ai-coach-card"><Sparkles size={20} /><div><strong>Phản hồi từ gia sư AI</strong>{correction && <p>{correction}</p>}{encouragement && <small>{encouragement}</small>}</div></div>}
        {latestFeedback?.scores && <div className="speaking-score-row" aria-label="Điểm luyện nói">{Object.entries(SPEAKING_SCORE_LABELS).map(([key, label]) => latestFeedback.scores[key] == null ? null : <span key={key}><strong>{latestFeedback.scores[key]}</strong><small>{label}</small></span>)}</div>}
        {pronunciation && <div className="eval-feedback-card"><div className="eval-score-gauge"><span className="score-num">{pronunciation.score}%</span><span className="score-label">Độ khớp câu</span></div><div className="eval-text-details"><div className="eval-title">So với câu gợi ý bạn vừa luyện</div><div className="eval-msg">{pronunciation.feedback}</div></div></div>}

        {showHints && activeHints.length > 0 && <div className="smart-hints-drawer speaking-hints-v2">
          <div className="hints-header-row"><div className="hints-title-wrap"><Lightbulb size={18} /><span>Chưa biết nói gì? Thử một trong các câu này</span></div><button className="icon-toggle" onClick={() => setShowHints(false)}><X size={16} /></button></div>
          <div className="hints-buttons-grid">{activeHints.map((hint, index) => <div className="hint-card-item" key={`${hint.en}-${index}`}><button className="hint-main-action" onClick={() => setInput(hint.en)}><span className="hint-en">{hint.en}</span>{hint.vi && <span className="hint-vi">{hint.vi}</span>}</button><div className="hint-actions"><button className="hint-audio-btn" onClick={() => speak(hint.en)} title="Nghe mẫu"><Volume2 size={16} /></button><button className="hint-speak-btn" onClick={() => startMic(hint)}><Mic size={16} /> Luyện câu</button></div></div>)}</div>
        </div>}

        <footer className="speaking-composer-v2">
          {!showHints && <button className="composer-tool" onClick={() => setShowHints(true)} title="Hiện gợi ý"><Lightbulb size={19} /></button>}
          <button className={`push-to-talk ${isRecording ? 'recording' : ''}`} onClick={isRecording ? stopMic : () => startMic()} disabled={isThinking} title={isRecording ? 'Dừng thu' : isSpeaking ? 'Ngắt lời AI và bắt đầu nói' : 'Bắt đầu nói'}>{isRecording ? <MicOff size={24} /> : <Mic size={24} />}</button>
          <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) sendTurn(); }} placeholder="Hoặc nhập câu tiếng Anh..." disabled={isThinking} />
          {isThinking ? <button className="send-speaking-btn stop" onClick={stopThinking} title="Dừng tạo câu trả lời"><Square size={18} /></button> : <button className="send-speaking-btn" onClick={() => sendTurn()} disabled={!input.trim()} title="Gửi"><Send size={19} /></button>}
        </footer>
        <div className="speaking-privacy-note">Nhận giọng nói phụ thuộc Chrome/Edge và có thể dùng dịch vụ nhận dạng của trình duyệt. Không có bản ghi âm nào được lưu trong ứng dụng.</div>
      </section>

    </div>
  );
}
