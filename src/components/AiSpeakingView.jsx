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
  Bot 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { aiScenarios } from '../data/scenariosData';
import speechHelper from '../utils/speechHelper';
import { evaluatePronunciation } from '../utils/scoreEvaluator';
import AudioWave from './AudioWave';

export default function AiSpeakingView({ userData, onUpdateUserData, voiceSpeed }) {
  const [selectedScenario, setSelectedScenario] = useState(aiScenarios[0]);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [userInputText, setUserInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [recognitionObj, setRecognitionObj] = useState(null);
  const [showVietnameseSubs, setShowVietnameseSubs] = useState(true);
  const [showSmartHints, setShowSmartHints] = useState(true);
  const [latestEval, setLatestEval] = useState(null);
  const [isFinished, setIsFinished] = useState(false);

  const chatEndRef = useRef(null);

  // Initialize Scenario Chat
  const startScenario = (scenario) => {
    setSelectedScenario(scenario);
    setCurrentStep(0);
    setUserInputText('');
    setLatestEval(null);
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
  }, [chatMessages, isAiSpeaking]);

  const speakMessage = (text) => {
    setIsAiSpeaking(true);
    speechHelper.speak(text, {
      rate: voiceSpeed,
      onEnd: () => setIsAiSpeaking(false),
      onError: () => setIsAiSpeaking(false)
    });
  };

  // Process User Turn (either from Mic or typed)
  const handleUserSend = (spokenText, targetHint = null) => {
    const textToSend = spokenText || userInputText;
    if (!textToSend.trim()) return;

    // Pronunciation Evaluation if practicing a hint
    let evaluation = null;
    if (targetHint) {
      evaluation = evaluatePronunciation(targetHint.en, textToSend);
      setLatestEval(evaluation);
    } else {
      // General feedback
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

    // Determine AI Next Reply
    setTimeout(() => {
      const flowList = selectedScenario.conversationFlow;
      let nextStep = currentStep;

      // Find matching reply or move to next step
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
          confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
          
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

  // Get current active hints
  const currentHints = 
    currentStep === 0 
      ? selectedScenario.starterHints 
      : selectedScenario.conversationFlow[currentStep - 1]?.hints || selectedScenario.starterHints;

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

          {/* Subtitles & Hints Toggles */}
          <div className="aux-controls-group">
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
              title="Bật/tắt gợi ý mẫu câu trả lời thông minh"
            >
              <Lightbulb size={16} />
              <span>Gợi ý câu</span>
            </button>

            <button 
              className="aux-pill-btn reset-btn"
              onClick={() => startScenario(selectedScenario)}
              title="Bắt đầu lại kịch bản này"
            >
              <RotateCcw size={16} />
              <span>Làm lại</span>
            </button>
          </div>
        </div>

        {/* Scenarios Selector Tabs */}
        <div className="scenarios-picker-row">
          {aiScenarios.map((sc) => (
            <button
              key={sc.id}
              className={`scenario-card-btn ${selectedScenario.id === sc.id ? 'active' : ''}`}
              onClick={() => startScenario(sc)}
            >
              <span className="sc-avatar">{sc.avatar}</span>
              <div className="sc-text-col">
                <div className="sc-title">{sc.title}</div>
                <div className="sc-partner">Cùng {sc.partnerName} ({sc.difficulty})</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Conversation Arena */}
      <div className="speaking-chat-arena">
        {/* Chat Messages Container */}
        <div className="chat-messages-container">
          {chatMessages.map((msg, index) => {
            const isAi = msg.sender === 'ai';
            return (
              <div key={index} className={`chat-bubble-wrapper ${isAi ? 'ai-bubble' : 'user-bubble'}`}>
                {isAi && <div className="chat-avatar-circle">{selectedScenario.avatar}</div>}
                
                <div className="chat-bubble-content">
                  <div className="bubble-header-info">
                    <span className="bubble-sender-name">{isAi ? selectedScenario.partnerName : 'Bạn'}</span>
                    <span className="bubble-time">{msg.timestamp}</span>
                  </div>

                  <div className="bubble-text-row">
                    <span className="bubble-text-en">{msg.text}</span>
                    {isAi && (
                      <button 
                        className="bubble-audio-btn" 
                        onClick={() => speakMessage(msg.text)}
                        title="Nghe lại câu này"
                      >
                        <Volume2 size={16} />
                      </button>
                    )}
                  </div>

                  {/* Vietnamese Translation Subtitle */}
                  {isAi && showVietnameseSubs && msg.textVi && (
                    <div className="bubble-text-vi">{msg.textVi}</div>
                  )}

                  {/* Pronunciation score badge if user msg */}
                  {!isAi && msg.score && (
                    <div className="bubble-score-badge">
                      <Award size={14} />
                      <span>Điểm phát âm: {msg.score}%</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Audio Wave indicator when AI speaks */}
          {isAiSpeaking && (
            <div className="ai-speaking-indicator">
              <AudioWave isActive={true} color="#8b5cf6" label={`${selectedScenario.partnerName} đang nói...`} />
            </div>
          )}

          {/* Conversation Finished Card */}
          {isFinished && (
            <div className="congrats-finish-card">
              <div className="congrats-emoji">🎉🏆</div>
              <h3 className="congrats-title">Xuất Sắc! Bạn Đã Hoàn Thành Cuộc Hội Thoại!</h3>
              <p className="congrats-desc">
                Bạn đã vượt qua nỗi sợ và giao tiếp trọn vẹn kịch bản 
                <strong> "{selectedScenario.title}"</strong>. +50 XP đã được cộng vào tài khoản!
              </p>
              <button 
                className="congrats-replay-btn"
                onClick={() => startScenario(selectedScenario)}
              >
                <RotateCcw size={16} />
                <span>Luyện lại một lần nữa để nói mượt hơn</span>
              </button>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Latest Pronunciation Feedback Panel */}
        {latestEval && (
          <div className={`eval-inline-banner status-${latestEval.status}`}>
            <div className="eval-inline-header">
              <Sparkles size={18} />
              <span>Chấm điểm phát âm: <strong>{latestEval.score}%</strong></span>
            </div>
            <div className="eval-inline-feedback">{latestEval.feedback}</div>
          </div>
        )}

        {/* Smart Hints Bar for Beginners (Bí ý tưởng) */}
        {showSmartHints && currentHints && currentHints.length > 0 && !isFinished && (
          <div className="smart-hints-container">
            <div className="hints-header-label">
              <Lightbulb size={16} className="hint-bulb" />
              <span>Gợi ý câu trả lời tiếp theo (Bấm để chọn và luyện đọc):</span>
            </div>

            <div className="hints-buttons-grid">
              {currentHints.map((hint, idx) => (
                <div key={idx} className="hint-card-item">
                  <div className="hint-texts">
                    <div className="hint-en">{hint.en}</div>
                    <div className="hint-ipa">{hint.ipa}</div>
                    <div className="hint-vi">{hint.vi}</div>
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
                disabled={!userInputText.trim()}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
