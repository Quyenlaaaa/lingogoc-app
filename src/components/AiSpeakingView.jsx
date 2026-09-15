// AiSpeakingView.jsx - Stage 4: AI Speaking Arena & Roleplay Partner for Beginners
import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Send, 
  Volume2, 
  Sparkles, 
  RotateCcw, 
  Lightbulb, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  Award, 
  MessageSquare, 
  Bot,
  Key,
  Settings,
  X,
  Zap,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { aiScenarios } from '../data/scenariosData';
import speechHelper from '../utils/speechHelper';
import { evaluatePronunciation } from '../utils/scoreEvaluator';
import AudioWave from './AudioWave';
import { getGeminiApiKey, saveGeminiApiKey, sendChatMessageToGemini } from '../utils/geminiService';

export default function AiSpeakingView({ userData, onUpdateUserData, voiceSpeed }) {
  const [selectedScenario, setSelectedScenario] = useState(aiScenarios[0]);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [userInputText, setUserInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [recognitionObj, setRecognitionObj] = useState(null);
  const [showVietnameseSubs, setShowVietnameseSubs] = useState(true);
  const [showSmartHints, setShowSmartHints] = useState(true);
  const [latestEval, setLatestEval] = useState(null);
  const [latestCorrection, setLatestCorrection] = useState(null);
  const [isFinished, setIsFinished] = useState(false);

  // Gemini API Key State
  const [apiKey, setApiKey] = useState(getGeminiApiKey());
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [inputKey, setInputKey] = useState(apiKey);
  const [dynamicGeminiHints, setDynamicGeminiHints] = useState(null);

  const chatEndRef = useRef(null);

  // Initialize Scenario Chat
  const startScenario = (scenario) => {
    setSelectedScenario(scenario);
    setCurrentStep(0);
    setUserInputText('');
    setLatestEval(null);
    setLatestCorrection(null);
    setDynamicGeminiHints(null);
    setIsFinished(false);

    const initialMessage = {
      sender: 'ai',
      text: scenario.introMessage,
      textVi: scenario.introMessageVi,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages([initialMessage]);

    // Speak initial welcome message
    setTimeout(() => {
      speakMessage(scenario.introMessage);
    }, 400);
  };

  useEffect(() => {
    startScenario(selectedScenario);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isAiSpeaking, isAiThinking]);

  const speakMessage = (text) => {
    setIsAiSpeaking(true);
    speechHelper.speak(text, {
      rate: voiceSpeed,
      onEnd: () => setIsAiSpeaking(false),
      onError: () => setIsAiSpeaking(false)
    });
  };

  const handleSaveApiKey = () => {
    saveGeminiApiKey(inputKey);
    setApiKey(inputKey.trim());
    setShowKeyModal(false);
  };

  // Process User Turn (either from Mic or typed)
  const handleUserSend = async (spokenText, targetHint = null) => {
    const textToSend = spokenText || userInputText;
    if (!textToSend.trim()) return;

    // Pronunciation Evaluation if practicing a hint
    let evaluation = null;
    if (targetHint) {
      evaluation = evaluatePronunciation(targetHint.en, textToSend);
      setLatestEval(evaluation);
    } else {
      evaluation = {
        score: 85,
        status: 'good',
        feedback: 'Bạn đã giao tiếp tự tin và mạch lạc! Tiếp tục phát huy nhé! 🎉'
      };
      setLatestEval(evaluation);
    }

    const newUserMsg = {
      sender: 'user',
      text: textToSend,
      score: evaluation?.score,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...chatMessages, newUserMsg];
    setChatMessages(updatedMessages);
    setUserInputText('');

    // If Gemini API Key is provided, use Gemini 1.5 Flash LLM
    if (apiKey) {
      setIsAiThinking(true);
      try {
        const geminiRes = await sendChatMessageToGemini(textToSend, updatedMessages, selectedScenario.title);
        setIsAiThinking(false);

        if (geminiRes.correction) {
          setLatestCorrection(geminiRes.correction);
        } else {
          setLatestCorrection(null);
        }

        if (geminiRes.hints) {
          setDynamicGeminiHints(geminiRes.hints);
        }

        const aiReplyMsg = {
          sender: 'ai',
          text: geminiRes.replyEn,
          textVi: geminiRes.replyVi,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setChatMessages([...updatedMessages, aiReplyMsg]);
        speakMessage(geminiRes.replyEn);

        // Add XP
        onUpdateUserData({
          ...userData,
          xp: (userData?.xp || 0) + 15
        });
        return;
      } catch (err) {
        console.warn('Gemini API call failed, falling back to local simulation:', err);
        setIsAiThinking(false);
        // Fallback to local rule-based below
      }
    }

    // Local offline flow fallback
    setTimeout(() => {
      const flowList = selectedScenario.conversationFlow;
      let matchedFlow = flowList[currentStep];
      if (!matchedFlow && flowList.length > 0) {
        matchedFlow = flowList[flowList.length - 1];
      }

      if (matchedFlow) {
        const aiReplyMsg = {
          sender: 'ai',
          text: matchedFlow.aiReply,
          textVi: matchedFlow.aiReplyVi,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages([...updatedMessages, aiReplyMsg]);
        speakMessage(matchedFlow.aiReply);

        if (currentStep < flowList.length - 1) {
          setCurrentStep(prev => prev + 1);
        } else {
          // Completed conversation scenario!
          setIsFinished(true);
          try {
            confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
          } catch (e) {}
          
          const completedSet = new Set(userData?.completedScenarios || []);
          completedSet.add(selectedScenario.id);
          onUpdateUserData({
            ...userData,
            completedScenarios: Array.from(completedSet),
            xp: (userData?.xp || 0) + 50 // 50 XP for speaking roleplay
          });
        }
      }
    }, 900);
  };

  // Microphone Handling
  const handleStartMic = (targetHint = null) => {
    if (!speechHelper.isSpeechRecognitionSupported()) {
      alert('Trình duyệt chưa hỗ trợ ghi âm trực tiếp. Hãy sử dụng Google Chrome hoặc Edge.');
      return;
    }

    setIsRecording(true);
    setLatestEval(null);

    const rec = speechHelper.createRecognition(
      (result) => {
        if (result.isFinal) {
          setIsRecording(false);
          handleUserSend(result.final, targetHint);
        }
      },
      (error) => {
        console.error(error);
        setIsRecording(false);
      },
      () => setIsRecording(false)
    );

    if (rec) {
      setRecognitionObj(rec);
      rec.start();
    }
  };

  const handleStopMic = () => {
    if (recognitionObj) {
      recognitionObj.stop();
    }
    setIsRecording(false);
  };

  // Get current active hints (dynamic from Gemini or static from scenario)
  const currentHints = dynamicGeminiHints || (
    currentStep === 0 
      ? selectedScenario.starterHints 
      : selectedScenario.conversationFlow[currentStep - 1]?.hints || selectedScenario.starterHints
  );

  return (
    <div className="ai-speaking-view animate-fade-in">
      {/* Header & Scenarios Bar */}
      <div className="module-header-card">
        <div className="module-tag speaking-tag">Chặng 4: Phòng Luyện Nói AI Thực Chiến</div>
        <div className="speaking-header-flex">
          <div>
            <h2 className="module-title">Đối Thoại Thực Chiến Không Sợ Sai</h2>
            <p className="module-desc">
              AI kiên nhẫn nhất thế giới, sẵn sàng lắng nghe, sửa lỗi phát âm và phản xạ 
              cùng bạn 24/7. Có nút gợi ý câu trả lời và dịch tiếng Việt trợ lực 100%.
            </p>
          </div>

          {/* Subtitles, Hints & Gemini Key Toggles */}
          <div className="aux-controls-group" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button 
              className={`aux-pill-btn ${apiKey ? 'active' : ''}`}
              onClick={() => setShowKeyModal(true)}
              title="Cài đặt kết nối Google Gemini AI"
              style={{ background: apiKey ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)', borderColor: apiKey ? '#10b981' : 'var(--border-color)' }}
            >
              <Zap size={16} color={apiKey ? '#10b981' : 'var(--text-secondary)'} />
              <span style={{ color: apiKey ? '#10b981' : 'var(--text-secondary)' }}>
                {apiKey ? 'Gemini AI: Bật' : 'Kết nối Gemini API'}
              </span>
            </button>

            <button 
              className={`aux-pill-btn ${showVietnameseSubs ? 'active' : ''}`}
              onClick={() => setShowVietnameseSubs(!showVietnameseSubs)}
              title="Bật/tắt phụ đề tiếng Việt bên dưới câu của AI"
            >
              {showVietnameseSubs ? <Eye size={16} /> : <EyeOff size={16} />}
              <span>{showVietnameseSubs ? 'Hiện dịch Việt' : 'Ẩn dịch Việt'}</span>
            </button>

            <button 
              className={`aux-pill-btn ${showSmartHints ? 'active' : ''}`}
              onClick={() => setShowSmartHints(!showSmartHints)}
              title="Bật/tắt gợi ý câu trả lời"
            >
              <Lightbulb size={16} />
              <span>{showSmartHints ? 'Hiện gợi ý' : 'Ẩn gợi ý'}</span>
            </button>
          </div>
        </div>

        {/* Scenarios Selector Tabs */}
        <div className="scenarios-carousel">
          {aiScenarios.map((sc) => {
            const isSelected = selectedScenario.id === sc.id;
            return (
              <button
                key={sc.id}
                className={`scenario-pill-item ${isSelected ? 'active' : ''}`}
                onClick={() => startScenario(sc)}
              >
                <span className="sc-icon">{sc.avatar}</span>
                <div className="sc-text-wrap">
                  <div className="sc-title">{sc.title}</div>
                  <div className="sc-partner">Bạn đồng hành: {sc.partnerName}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chat Arena */}
      <div className="speaking-chat-arena">
        <div className="chat-arena-header">
          <div className="arena-partner-info">
            <span className="partner-avatar">{selectedScenario.avatar}</span>
            <div>
              <div className="partner-name-row">
                <strong>{selectedScenario.partnerName}</strong>
                <span className="live-status-dot"></span>
                <span className="status-text">{isAiThinking ? 'Đang suy nghĩ...' : isAiSpeaking ? 'Đang nói...' : 'Đang lắng nghe'}</span>
              </div>
              <div className="partner-desc">{selectedScenario.description}</div>
            </div>
          </div>

          <button 
            className="reset-chat-btn" 
            onClick={() => startScenario(selectedScenario)}
            title="Bắt đầu lại cuộc đối thoại"
          >
            <RotateCcw size={16} />
            <span>Bắt đầu lại</span>
          </button>
        </div>

        {/* Audio Wave Visualizer while AI speaks or User records */}
        <div className="speaking-waves-container">
          <AudioWave isActive={isAiSpeaking || isRecording || isAiThinking} />
        </div>

        {/* Messages Stream */}
        <div className="chat-messages-container">
          {chatMessages.map((msg, index) => {
            const isAi = msg.sender === 'ai';
            return (
              <div 
                key={index} 
                className={`chat-bubble-wrapper ${isAi ? 'from-ai' : 'from-user'}`}
              >
                <div className="bubble-avatar">
                  {isAi ? selectedScenario.avatar : '👤'}
                </div>

                <div className="bubble-content">
                  <div className="bubble-header-row">
                    <span className="bubble-sender">{isAi ? selectedScenario.partnerName : 'Bạn'}</span>
                    <span className="bubble-time">{msg.timestamp}</span>
                  </div>

                  <div className="bubble-text-en">{msg.text}</div>

                  {/* Audio replay button for AI messages */}
                  {isAi && (
                    <button 
                      className="replay-tts-btn" 
                      onClick={() => speakMessage(msg.text)}
                      title="Nghe lại câu này"
                    >
                      <Volume2 size={15} />
                      <span>Nghe lại</span>
                    </button>
                  )}

                  {/* Vietnamese Subtitle for AI */}
                  {isAi && showVietnameseSubs && msg.textVi && (
                    <div className="bubble-sub-vi">
                      🇻🇳 {msg.textVi}
                    </div>
                  )}

                  {/* Score badge for User message */}
                  {!isAi && msg.score && (
                    <div className="user-score-pill">
                      <CheckCircle2 size={13} color="#10b981" />
                      <span>Độ chính xác phát âm: {msg.score}%</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isAiThinking && (
            <div className="chat-bubble-wrapper from-ai">
              <div className="bubble-avatar">{selectedScenario.avatar}</div>
              <div className="bubble-content" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px' }}>
                <Sparkles size={16} color="#818cf8" className="animate-spin" />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Lily đang soạn câu trả lời phù hợp...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* AI Grammar Correction Banner if provided */}
        {latestCorrection && (
          <div style={{
            margin: '0 20px 16px',
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Sparkles size={20} color="#818cf8" />
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', flex: 1 }}>
              <strong style={{ color: '#818cf8' }}>Gợi ý từ AI: </strong> {latestCorrection}
            </div>
          </div>
        )}

        {/* Latest Evaluation Feedback Banner */}
        {latestEval && (
          <div className="eval-feedback-card">
            <div className="eval-score-gauge">
              <span className="score-num">{latestEval.score}%</span>
              <span className="score-label">Điểm phát âm</span>
            </div>
            <div className="eval-text-details">
              <div className="eval-title">Đánh giá phát âm câu vừa nói:</div>
              <div className="eval-msg">{latestEval.feedback}</div>
            </div>
          </div>
        )}

        {/* Scenario Finished Congratulations */}
        {isFinished && (
          <div className="scenario-completed-banner animate-fade-in">
            <div className="completed-icon-badge">
              <Award size={48} color="#f59e0b" />
            </div>
            <h3>Xuất Sắc! Hoàn Thành Hội Thoại!</h3>
            <p>
              Bạn đã hoàn thành trọn vẹn kịch bản <strong>"{selectedScenario.title}"</strong>. 
              Bạn vừa nhận thêm <strong>+50 XP</strong> vào hồ sơ học tập!
            </p>
            <button 
              className="btn btn-primary next-scenario-btn"
              onClick={() => {
                const currentIndex = aiScenarios.findIndex(s => s.id === selectedScenario.id);
                const nextIndex = (currentIndex + 1) % aiScenarios.length;
                startScenario(aiScenarios[nextIndex]);
              }}
            >
              Thử Thách Kịch Bản Tiếp Theo
            </button>
          </div>
        )}

        {/* Smart Hints Box (Gợi ý câu trả lời song ngữ) */}
        {!isFinished && showSmartHints && currentHints && currentHints.length > 0 && (
          <div className="smart-hints-drawer">
            <div className="hints-header-row">
              <div className="hints-title-wrap">
                <Lightbulb size={18} color="#f59e0b" />
                <span>Bí ý tưởng? Gợi ý các câu trả lời tự nhiên (Bấm mic đọc thử):</span>
              </div>
            </div>

            <div className="hints-buttons-grid">
              {currentHints.map((hint, idx) => (
                <div key={idx} className="hint-card-item">
                  <div className="hint-texts">
                    <div className="hint-en">{hint.en}</div>
                    {hint.ipa && <div className="hint-ipa">{hint.ipa}</div>}
                    {hint.vi && <div className="hint-vi">{hint.vi}</div>}
                  </div>

                  <div className="hint-actions">
                    <button 
                      className="hint-audio-btn" 
                      onClick={() => speakMessage(hint.en)}
                      title="Nghe phát âm mẫu"
                    >
                      <Volume2 size={16} />
                    </button>

                    <button 
                      className="hint-speak-btn"
                      onClick={() => handleStartMic(hint)}
                      title="Bật mic đọc câu này"
                    >
                      <Mic size={16} />
                      <span>Đọc câu này</span>
                    </button>

                    <button 
                      className="hint-send-btn"
                      onClick={() => handleUserSend(hint.en, hint)}
                      title="Gửi câu này luôn"
                    >
                      <Send size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User Input Bar (Mic + Text fallback) */}
        {!isFinished && (
          <div className="speaking-input-bar">
            {/* Big Mic Button */}
            <button 
              className={`mic-primary-btn ${isRecording ? 'is-recording' : ''}`}
              onClick={() => isRecording ? handleStopMic() : handleStartMic()}
              title="Bấm để nói tiếng Anh qua microphone"
            >
              {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
              <span>{isRecording ? 'Đang nghe... (Bấm dừng)' : 'Bấm mic để nói'}</span>
            </button>

            {/* Text Input Fallback */}
            <div className="text-fallback-wrapper">
              <input
                type="text"
                className="chat-text-input"
                placeholder="Hoặc gõ câu trả lời của bạn tại đây..."
                value={userInputText}
                onChange={(e) => setUserInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUserSend()}
              />
              <button 
                className="chat-send-btn" 
                onClick={() => handleUserSend()}
                disabled={!userInputText.trim() || isAiThinking}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Cài Đặt Gemini API Key */}
      {showKeyModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="card glass-card animate-fade-in" style={{
            maxWidth: '520px',
            width: '100%',
            padding: '28px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowKeyModal(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Key size={24} color="#10b981" />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Kết Nối Google Gemini 1.5 Flash API
              </h3>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '16px' }}>
              Nhập API Key miễn phí từ Google AI Studio để mở khóa khả năng trò chuyện tự do không giới hạn với gia sư AI Lily, sửa lỗi ngữ pháp chi tiết bằng tiếng Việt.
            </p>

            <div style={{
              background: 'rgba(255,255,255,0.03)',
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              marginBottom: '16px',
              fontSize: '0.85rem',
              color: 'var(--text-muted)'
            }}>
              💡 <em>Lưu ý: Không bắt buộc. Nếu để trống, LingoGoc AI vẫn hoạt động 100% mượt mà với kịch bản có sẵn offline.</em>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Google Gemini API Key:
              </label>
              <input
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="AIzaSy..."
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--border-color)',
                  background: 'rgba(0,0,0,0.2)',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              {apiKey && (
                <button
                  onClick={() => {
                    setInputKey('');
                    saveGeminiApiKey('');
                    setApiKey('');
                    setShowKeyModal(false);
                  }}
                  className="btn btn-outline"
                  style={{ padding: '10px 18px', color: '#ef4444', borderColor: '#ef4444' }}
                >
                  Xóa Key
                </button>
              )}
              <button
                onClick={handleSaveApiKey}
                className="btn btn-primary"
                style={{ padding: '10px 24px', fontWeight: 700 }}
              >
                Lưu & Kích Hoạt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
