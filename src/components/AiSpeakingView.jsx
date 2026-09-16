import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  requestCloudSpeech,
  requestSpeakingReply,
  saveSpeakingConfig,
} from '../utils/speakingAiService';
import { hasBackendApi } from '../utils/backendApi';

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function AiSpeakingView({ userData, onUpdateUserData, voiceSpeed = 0.9 }) {
  const [scenario, setScenario] = useState(aiScenarios[0]);
  const [messages, setMessages] = useState(() => [{
    sender: 'ai',
    text: aiScenarios[0].introMessage,
    textVi: aiScenarios[0].introMessageVi,
    timestamp: now(),
  }]);
  const [input, setInput] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  const [showHints, setShowHints] = useState(true);
  const [hints, setHints] = useState(aiScenarios[0].starterHints || []);
  const [correction, setCorrection] = useState('');
  const [encouragement, setEncouragement] = useState('');
  const [pronunciation, setPronunciation] = useState(null);
  const [error, setError] = useState('');
  const [config, setConfig] = useState(loadSpeakingConfig);

  const recognitionRef = useRef(null);
  const requestControllerRef = useRef(null);
  const audioRef = useRef(null);
  const audioUrlRef = useRef('');
  const autoListenTimerRef = useRef(null);
  const startMicRef = useRef(null);
  const chatEndRef = useRef(null);
  const isMountedRef = useRef(true);

  const connected = hasBackendApi();

  const stopAudio = useCallback((updateState = true) => {
    if (autoListenTimerRef.current) {
      clearTimeout(autoListenTimerRef.current);
      autoListenTimerRef.current = null;
    }
    speechHelper.stopSpeaking();
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = '';
    }
    if (updateState && isMountedRef.current) setIsSpeaking(false);
  }, []);

  const speak = useCallback(async (text, options = {}) => {
    if (!text) return;
    stopAudio();
    setIsSpeaking(true);
    const finishSpeech = () => {
      if (audioRef.current) audioRef.current = null;
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = '';
      }
      if (!isMountedRef.current) return;
      setIsSpeaking(false);
      if (options.resumeListening && config.autoListen) {
        autoListenTimerRef.current = setTimeout(() => startMicRef.current?.(), 450);
      }
    };

    if (config.useCloudVoice && connected) {
      try {
        const url = await requestCloudSpeech({ config, text });
        if (!isMountedRef.current) {
          URL.revokeObjectURL(url);
          return;
        }
        audioUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = finishSpeech;
        audio.onerror = finishSpeech;
        await audio.play();
        return;
      } catch (cloudError) {
        console.warn('Cloud TTS failed, using browser voice:', cloudError);
      }
    }

    if (!isMountedRef.current) return;
    speechHelper.speak(text, {
      rate: voiceSpeed,
      onEnd: finishSpeech,
      onError: finishSpeech,
    });
  }, [config, connected, stopAudio, voiceSpeed]);

  const startScenario = useCallback((nextScenario) => {
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
    setScenario(nextScenario);
    setMessages([{
      sender: 'ai',
      text: nextScenario.introMessage,
      textVi: nextScenario.introMessageVi,
      timestamp: now(),
    }]);
    setHints(nextScenario.starterHints || []);
    setCorrection('');
    setEncouragement('');
    setPronunciation(null);
    setInput('');
    setInterimTranscript('');
    setError('');
  }, [stopAudio]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      requestControllerRef.current?.abort();
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
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking, interimTranscript]);

  const toggleHandsFree = () => {
    const saved = saveSpeakingConfig({ ...config, autoListen: !config.autoListen });
    setConfig(saved);
    if (config.autoListen) stopMic();
  };

  const activeHints = useMemo(() => hints?.slice(0, 3) || [], [hints]);

  const sendTurn = useCallback(async (rawText, targetHint = null) => {
    const text = String(rawText || input).trim();
    if (!text || isThinking) return;
    if (!connected) {
      setError('Backend AI chưa được cấu hình. Quản trị viên cần thiết lập VITE_API_BASE_URL khi deploy frontend.');
      return;
    }

    stopAudio();
    setInput('');
    setInterimTranscript('');
    setError('');
    setCorrection('');
    setEncouragement('');
    setPronunciation(targetHint ? evaluatePronunciation(targetHint.en, text) : null);

    const userMessage = { sender: 'user', text, timestamp: now() };
    const history = [...messages, userMessage];
    setMessages(history);
    setIsThinking(true);
    const controller = new AbortController();
    requestControllerRef.current = controller;

    try {
      const result = await requestSpeakingReply({ config, scenario, messages: history, signal: controller.signal });
      if (!isMountedRef.current) return;
      const aiMessage = {
        sender: 'ai',
        text: result.replyEn,
        textVi: result.replyVi,
        timestamp: now(),
      };
      setMessages((previous) => [...previous, aiMessage]);
      setCorrection(result.correction);
      setEncouragement(result.encouragement);
      if (result.hints?.length) setHints(result.hints);
      onUpdateUserData?.({ ...userData, xp: (userData?.xp || 0) + 15 });
      speak(result.replyEn, { resumeListening: true });
    } catch (requestError) {
      if (isMountedRef.current && requestError.name !== 'AbortError') setError(requestError.message || 'Không thể kết nối với AI.');
    } finally {
      if (isMountedRef.current) setIsThinking(false);
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    }
  }, [config, connected, input, isThinking, messages, onUpdateUserData, scenario, speak, stopAudio, userData]);

  const stopThinking = () => {
    requestControllerRef.current?.abort();
    setIsThinking(false);
  };

  const startMic = (targetHint = null) => {
    if (isRecording) return;
    if (!speechHelper.isSpeechRecognitionSupported()) {
      setError('Trình duyệt chưa hỗ trợ nhận giọng nói. Hãy dùng Chrome/Edge hoặc nhập câu ở ô bên dưới.');
      return;
    }
    setError('');
    setInterimTranscript('Đang nghe...');
    setIsRecording(true);
    const recognition = speechHelper.createRecognition(
      (result) => {
        if (result.interim) setInterimTranscript(result.interim);
        if (result.isFinal) {
          setIsRecording(false);
          setInterimTranscript(result.final);
          sendTurn(result.final, targetHint);
        }
      },
      (recognitionError) => {
        setIsRecording(false);
        setInterimTranscript('');
        setError(recognitionError === 'not-allowed'
          ? 'Bạn chưa cấp quyền microphone cho trình duyệt.'
          : 'Không nhận được giọng nói. Hãy thử lại và nói gần microphone hơn.');
      },
      () => setIsRecording(false),
    );
    recognitionRef.current = recognition;
    try {
      recognition?.start();
    } catch {
      recognitionRef.current = null;
      setIsRecording(false);
      setInterimTranscript('');
      setError('Microphone đang bận. Hãy chờ một chút rồi thử lại.');
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
    setIsRecording(false);
    setInterimTranscript('');
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

      {error && <div className="speaking-error" role="alert"><AlertCircle size={18} /><span>{error}</span><button onClick={() => setError('')}><X size={16} /></button></div>}

      <section className="speaking-chat-arena speaking-arena-v2">
        <header className="chat-arena-header">
          <div className="arena-partner-info">
            <span className="partner-avatar">{scenario.avatar}</span>
            <div><div className="partner-name-row"><strong>{scenario.partnerName}</strong><span className="live-status-dot" /><span className="status-text">{isThinking ? 'Đang suy nghĩ...' : isSpeaking ? 'Đang nói...' : isRecording ? 'Đang nghe...' : 'Sẵn sàng'}</span></div><div className="partner-desc">{scenario.description}</div></div>
          </div>
          <div className="speaking-header-actions">
            <button className={`hands-free-toggle ${config.autoListen ? 'active' : ''}`} onClick={toggleHandsFree} title="AI nói xong sẽ tự bật micro"><Radio size={16} /><span>{config.autoListen ? 'Rảnh tay: Bật' : 'Rảnh tay: Tắt'}</span></button>
            <button className={`icon-toggle ${showTranslation ? 'active' : ''}`} onClick={() => setShowTranslation((value) => !value)} title="Bật/tắt bản dịch">{showTranslation ? <Eye size={17} /> : <EyeOff size={17} />}</button>
            <button className="reset-chat-btn" onClick={() => startScenario(scenario)}><RotateCcw size={16} /><span>Bắt đầu lại</span></button>
          </div>
        </header>

        <div className="speaking-stage-v2">
          <AudioWave isActive={isSpeaking || isRecording || isThinking} />
          <div className={`speaking-orb ${isRecording ? 'recording' : ''} ${isThinking ? 'thinking' : ''}`}>
            {isThinking ? <LoaderCircle size={34} className="animate-spin" /> : isRecording ? <Mic size={34} /> : <Bot size={34} />}
          </div>
          <span>{interimTranscript || (isRecording ? 'Hãy nói bằng tiếng Anh...' : config.autoListen ? 'Chạm micro một lần để bắt đầu hội thoại rảnh tay' : 'Chạm micro để bắt đầu nói')}</span>
        </div>

        <div className="chat-messages-container speaking-messages-v2">
          {messages.map((message, index) => {
            const isAi = message.sender === 'ai';
            return (
              <article key={`${message.timestamp}-${index}`} className={`chat-bubble-wrapper ${isAi ? 'from-ai' : 'from-user'}`}>
                <div className="bubble-avatar">{isAi ? scenario.avatar : '👤'}</div>
                <div className="bubble-content">
                  <div className="bubble-header-row"><span className="bubble-sender">{isAi ? scenario.partnerName : 'Bạn'}</span><span className="bubble-time">{message.timestamp}</span></div>
                  <div className="bubble-text-en">{message.text}</div>
                  {isAi && <button className="replay-tts-btn" onClick={() => speak(message.text)}><Volume2 size={15} /> Nghe lại</button>}
                  {isAi && showTranslation && message.textVi && <div className="bubble-sub-vi">🇻🇳 {message.textVi}</div>}
                </div>
              </article>
            );
          })}
          {isThinking && <div className="chat-bubble-wrapper from-ai"><div className="bubble-avatar">{scenario.avatar}</div><div className="bubble-content speaking-thinking"><LoaderCircle size={17} className="animate-spin" /> AI đang tạo câu trả lời...</div></div>}
          <div ref={chatEndRef} />
        </div>

        {(correction || encouragement) && <div className="ai-coach-card"><Sparkles size={20} /><div><strong>Phản hồi từ gia sư AI</strong>{correction && <p>{correction}</p>}{encouragement && <small>{encouragement}</small>}</div></div>}
        {pronunciation && <div className="eval-feedback-card"><div className="eval-score-gauge"><span className="score-num">{pronunciation.score}%</span><span className="score-label">Độ khớp câu</span></div><div className="eval-text-details"><div className="eval-title">So với câu gợi ý bạn vừa luyện</div><div className="eval-msg">{pronunciation.feedback}</div></div></div>}

        {showHints && activeHints.length > 0 && <div className="smart-hints-drawer speaking-hints-v2">
          <div className="hints-header-row"><div className="hints-title-wrap"><Lightbulb size={18} /><span>Chưa biết nói gì? Thử một trong các câu này</span></div><button className="icon-toggle" onClick={() => setShowHints(false)}><X size={16} /></button></div>
          <div className="hints-buttons-grid">{activeHints.map((hint, index) => <div className="hint-card-item" key={`${hint.en}-${index}`}><button className="hint-main-action" onClick={() => setInput(hint.en)}><span className="hint-en">{hint.en}</span>{hint.vi && <span className="hint-vi">{hint.vi}</span>}</button><div className="hint-actions"><button className="hint-audio-btn" onClick={() => speak(hint.en)} title="Nghe mẫu"><Volume2 size={16} /></button><button className="hint-speak-btn" onClick={() => startMic(hint)}><Mic size={16} /> Luyện câu</button></div></div>)}</div>
        </div>}

        <footer className="speaking-composer-v2">
          {!showHints && <button className="composer-tool" onClick={() => setShowHints(true)} title="Hiện gợi ý"><Lightbulb size={19} /></button>}
          <button className={`push-to-talk ${isRecording ? 'recording' : ''}`} onClick={isRecording ? stopMic : () => startMic()} disabled={isThinking} title={isRecording ? 'Dừng thu' : 'Bắt đầu nói'}>{isRecording ? <MicOff size={24} /> : <Mic size={24} />}</button>
          <input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) sendTurn(); }} placeholder="Hoặc nhập câu tiếng Anh..." disabled={isThinking} />
          {isThinking ? <button className="send-speaking-btn stop" onClick={stopThinking} title="Dừng tạo câu trả lời"><Square size={18} /></button> : <button className="send-speaking-btn" onClick={() => sendTurn()} disabled={!input.trim()} title="Gửi"><Send size={19} /></button>}
        </footer>
        <div className="speaking-privacy-note">Nhận giọng nói phụ thuộc Chrome/Edge và có thể dùng dịch vụ nhận dạng của trình duyệt. Không có bản ghi âm nào được lưu trong ứng dụng.</div>
      </section>

    </div>
  );
}
