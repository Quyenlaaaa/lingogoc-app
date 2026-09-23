// IpaView.jsx - Stage 1: IPA Chart & Ending Sounds Practice for Vietnamese Learners
import React, { useState } from 'react';
import { 
  Volume2, 
  Mic, 
  MicOff, 
  Check, 
  Sparkles, 
  AlertCircle, 
  Info, 
  BookOpen, 
  Award, 
  HelpCircle 
} from 'lucide-react';
import { ipaSounds, endingSoundRules } from '../data/ipaData';
import speechHelper from '../utils/speechHelper';
import { evaluatePronunciation } from '../utils/scoreEvaluator';

export default function IpaView({ userData, onUpdateUserData, voiceSpeed }) {
  const [activeFilter, setActiveFilter] = useState('crucial'); // 'all', 'crucial', 'vowel', 'consonant', 'rules'
  const [selectedSound, setSelectedSound] = useState(ipaSounds[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [recognitionObj, setRecognitionObj] = useState(null);
  const [spokenResult, setSpokenResult] = useState(null);
  const [evalResult, setEvalResult] = useState(null);

  const completedIpa = new Set(userData?.completedIpa || []);

  const filteredSounds = ipaSounds.filter((sound) => {
    if (activeFilter === 'crucial') return sound.isCrucial;
    if (activeFilter === 'vowel') return sound.category === 'vowel' || sound.category === 'diphthong';
    if (activeFilter === 'consonant') return sound.category === 'consonant';
    return true;
  });

  const handlePlayAudio = (word, rate = voiceSpeed) => {
    speechHelper.speak(word, { rate });
  };

  const toggleSoundCompleted = (symbol) => {
    const updated = new Set(completedIpa);
    let xpGain = 0;
    if (updated.has(symbol)) {
      updated.delete(symbol);
    } else {
      updated.add(symbol);
      xpGain = 20;
    }
    onUpdateUserData({
      ...userData,
      completedIpa: Array.from(updated),
      xp: (userData?.xp || 0) + xpGain
    });
  };

  const handleStartRecording = (targetWord) => {
    if (!speechHelper.isSpeechRecognitionSupported()) {
      alert('Trình duyệt của bạn hiện chưa hỗ trợ Web Speech Recognition. Bạn có thể sử dụng Chrome, Edge hoặc Safari để dùng micro.');
      return;
    }

    setSpokenResult(null);
    setEvalResult(null);
    setIsRecording(true);

    const rec = speechHelper.createRecognition(
      (result) => {
        if (result.isFinal) {
          setSpokenResult(result.final);
          const evaluation = evaluatePronunciation(targetWord, result.final);
          setEvalResult(evaluation);
          setIsRecording(false);
          if (evaluation.score >= 70) {
            toggleSoundCompleted(selectedSound.symbol);
          }
        }
      },
      (error) => {
        console.error('Speech error', error);
        setIsRecording(false);
      },
      () => {
        setIsRecording(false);
      }
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
    <div className="ipa-view animate-fade-in">
      {/* Header Info */}
      <div className="module-header-card">
        <div className="module-tag ipa-tag">Chặng 1: Xóa Mù Phát Âm</div>
        <h2 className="module-title">Bảng Ngữ Âm IPA & Đặc Trị Lỗi Người Việt</h2>
        <p className="module-desc">
          Luyện mở đúng khẩu hình, không nuốt âm cuối (-s, -z, -ed, -t, -d) và phân biệt rõ 
          các cặp âm hay nhầm lẫn. Bấm vào từng âm để nghe chuẩn và test micro.
        </p>

        {/* Filter Navigation */}
        <div className="ipa-filters-bar">
          <button 
            className={`filter-btn ${activeFilter === 'crucial' ? 'active' : ''}`}
            onClick={() => setActiveFilter('crucial')}
          >
            ⭐ 16 Âm Hay Nhầm Của Người Việt
          </button>
          <button 
            className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            Tất Cả 44 Âm
          </button>
          <button 
            className={`filter-btn ${activeFilter === 'vowel' ? 'active' : ''}`}
            onClick={() => setActiveFilter('vowel')}
          >
            Nguyên Âm (Vowels)
          </button>
          <button 
            className={`filter-btn ${activeFilter === 'consonant' ? 'active' : ''}`}
            onClick={() => setActiveFilter('consonant')}
          >
            Phụ Âm (Consonants)
          </button>
          <button 
            className={`filter-btn ${activeFilter === 'rules' ? 'active' : ''}`}
            onClick={() => setActiveFilter('rules')}
          >
            📖 Quy Tắc Đuôi -S và -ED
          </button>
        </div>
      </div>

      {activeFilter === 'rules' ? (
        /* Ending sound rules screen */
        <div className="ending-rules-grid">
          {endingSoundRules.map((rule, idx) => (
            <div key={idx} className="rule-card">
              <div className="rule-header">
                <BookOpen className="rule-icon" size={22} />
                <h3 className="rule-title">{rule.title}</h3>
              </div>
              <p className="rule-description">{rule.description}</p>
              
              <div className="rule-cases-list">
                {rule.cases.map((c, i) => (
                  <div key={i} className="case-item">
                    <div className="case-sound-badge">{c.sound}</div>
                    <div className="case-details">
                      <div className="case-rule-text"><strong>Quy tắc:</strong> {c.rule}</div>
                      <div className="case-examples-text"><strong>Ví dụ:</strong> {c.examples}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* IPA Sounds Grid + Detail Panel */
        <div className="ipa-workspace-layout">
          {/* Sounds Grid */}
          <div className="ipa-grid-container">
            <div className="ipa-sound-cards-grid">
              {filteredSounds.map((sound) => {
                const isSelected = selectedSound?.symbol === sound.symbol;
                const isDone = completedIpa.has(sound.symbol);

                return (
                  <div
                    key={sound.symbol}
                    className={`sound-cell ${isSelected ? 'selected' : ''} ${isDone ? 'done' : ''}`}
                    onClick={() => {
                      setSelectedSound(sound);
                      setEvalResult(null);
                      setSpokenResult(null);
                      handlePlayAudio(sound.examples[0].word);
                    }}
                  >
                    <div className="sound-symbol">{sound.symbol}</div>
                    <div className="sound-name-mini">{sound.name}</div>
                    {isDone && <Check size={14} className="sound-done-check" />}
                    {sound.isCrucial && <span className="crucial-dot" title="Âm cực quan trọng cho người Việt">★</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Sound Practice Card */}
          {selectedSound && (
            <div className="ipa-detail-card">
              <div className="detail-header">
                <div>
                  <div className="detail-symbol-banner">{selectedSound.symbol}</div>
                  <h3 className="detail-name">{selectedSound.name}</h3>
                </div>
                <button
                  className={`mark-done-btn ${completedIpa.has(selectedSound.symbol) ? 'done' : ''}`}
                  onClick={() => toggleSoundCompleted(selectedSound.symbol)}
                >
                  <Check size={16} />
                  <span>{completedIpa.has(selectedSound.symbol) ? 'Đã thành thạo (+20 XP)' : 'Đánh dấu đã thuộc'}</span>
                </button>
              </div>

              {/* Tips & Guides */}
              <div className="guide-box">
                <div className="guide-item">
                  <div className="guide-label">
                    <Info size={16} />
                    <span>Hướng Dẫn Mở Khẩu Hình:</span>
                  </div>
                  <div className="guide-text">{selectedSound.mouthGuide}</div>
                </div>

                <div className="guide-item highlight-vn-tip">
                  <div className="guide-label">
                    <Sparkles size={16} />
                    <span>Mẹo Nhớ Cho Người Việt:</span>
                  </div>
                  <div className="guide-text">{selectedSound.vietnameseTip}</div>
                </div>
              </div>

              {/* Example Words & Pronunciation Testing */}
              <div className="ipa-examples-section">
                <h4 className="examples-heading">Từ Ví Dụ Thực Hành (Bấm nghe & Luyện nói):</h4>
                <div className="examples-list">
                  {selectedSound.examples.map((ex, idx) => (
                    <div key={idx} className="example-row-card">
                      <div className="ex-word-info">
                        <span className="ex-word">{ex.word}</span>
                        <span className="ex-ipa">{ex.ipa}</span>
                        <span className="ex-meaning">({ex.meaning})</span>
                      </div>

                      <div className="ex-actions">
                        <button 
                          className="audio-btn"
                          title="Nghe phát âm chuẩn US"
                          onClick={() => handlePlayAudio(ex.word)}
                        >
                          <Volume2 size={18} />
                          <span>Nghe</span>
                        </button>

                        <button 
                          className={`mic-btn ${isRecording ? 'recording' : ''}`}
                          title="Bật mic đọc thử từ này"
                          onClick={() => isRecording ? handleStopRecording() : handleStartRecording(ex.word)}
                        >
                          {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                          <span>{isRecording ? 'Đang nghe...' : 'Nói thử'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Microphone Evaluation Result */}
                {evalResult && (
                  <div className={`eval-result-card status-${evalResult.status}`}>
                    <div className="eval-score-row">
                      <Award size={24} className="eval-trophy" />
                      <div className="eval-score-text">
                        Độ chính xác: <strong className="score-number">{evalResult.score}%</strong>
                      </div>
                    </div>
                    <div className="eval-feedback">{evalResult.feedback}</div>
                    {evalResult.spokenText && (
                      <div className="eval-spoken">
                        Bạn đã nói: <em>"{evalResult.spokenText}"</em>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
