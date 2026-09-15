// AudioPodView.jsx - Máy Nghe Từ Vựng Thụ Động (Hands-Free Audio Pod)
// Dành cho người bận rộn: Vừa đi lại, làm việc, thư giãn vừa ngấm 3000 từ vựng song ngữ
import React, { useState, useEffect, useRef } from 'react';
import { 
  Headphones, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Repeat, 
  Clock, 
  Volume2, 
  Sparkles, 
  Sliders, 
  CheckCircle,
  Moon
} from 'lucide-react';
import { vocabList, topics, levels } from '../data/vocabData';
import { speakText, speechHelper } from '../utils/speechHelper';
import AudioWave from './AudioWave';

export default function AudioPodView({ voiceSpeed = 0.85 }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState('Tất cả');
  const [selectedLevel, setSelectedLevel] = useState('A1 (Cốt lõi)');
  const [repeatMode, setRepeatMode] = useState(1); // 1 = 1 lần, 2 = lặp lại 2 lần mỗi từ
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState(0); // 0 = tắt
  const [sleepTimeRemaining, setSleepTimeRemaining] = useState(0);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const timerRef = useRef(null);
  const sleepTimerRef = useRef(null);

  // Lọc danh sách từ theo Topic & Level
  const playlist = React.useMemo(() => {
    let list = vocabList;
    if (selectedLevel !== 'Tất cả') {
      const code = selectedLevel.split(' ')[0];
      list = list.filter(w => w.level === code);
    }
    if (selectedTopic !== 'Tất cả') {
      list = list.filter(w => w.topic === selectedTopic);
    }
    return list;
  }, [selectedTopic, selectedLevel]);

  const currentWord = playlist[currentIndex] || playlist[0];

  // Phát một từ vựng tuần tự (Anh -> Việt -> Ví dụ)
  const playWordCycle = async (index) => {
    if (!isPlayingRef.current || !playlist[index]) return;

    const word = playlist[index];

    // 1. Đọc tiếng Anh
    speakText(word.word, voiceSpeed);

    // Chờ đọc xong từ tiếng Anh + delay
    setTimeout(() => {
      if (!isPlayingRef.current) return;

      // 2. Chờ 1.5s rồi đọc câu ví dụ tiếng Anh
      if (word.example) {
        speakText(word.example, voiceSpeed);
      }

      // 3. Chờ tiếp và nhảy sang từ kế tiếp sau 4 giây
      setTimeout(() => {
        if (!isPlayingRef.current) return;

        if (index < playlist.length - 1) {
          setCurrentIndex(index + 1);
          playWordCycle(index + 1);
        } else {
          // Lặp lại từ đầu
          setCurrentIndex(0);
          playWordCycle(0);
        }
      }, 4000);
    }, 2000);
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      speechHelper.stopSpeaking();
    } else {
      setIsPlaying(true);
      isPlayingRef.current = true;
      playWordCycle(currentIndex);
    }
  };

  const handleNext = () => {
    speechHelper.stopSpeaking();
    const nextIdx = (currentIndex + 1) % playlist.length;
    setCurrentIndex(nextIdx);
    if (isPlaying) {
      setTimeout(() => playWordCycle(nextIdx), 300);
    }
  };

  const handlePrev = () => {
    speechHelper.stopSpeaking();
    const prevIdx = (currentIndex - 1 + playlist.length) % playlist.length;
    setCurrentIndex(prevIdx);
    if (isPlaying) {
      setTimeout(() => playWordCycle(prevIdx), 300);
    }
  };

  // Sleep Timer logic
  const handleSetSleepTimer = (mins) => {
    setSleepTimerMinutes(mins);
    setSleepTimeRemaining(mins * 60);

    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);

    if (mins > 0) {
      sleepTimerRef.current = setInterval(() => {
        setSleepTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(sleepTimerRef.current);
            setIsPlaying(false);
            speechHelper.stopSpeaking();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      speechHelper.stopSpeaking();
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    };
  }, []);

  return (
    <div className="audiopod-view animate-fade-in" style={{ maxWidth: '780px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Header Info */}
      <div className="module-header-card" style={{ marginBottom: '24px' }}>
        <div className="module-tag" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderColor: '#38bdf8' }}>
          Nghe Thụ Động • Hands-Free Learning
        </div>
        <h2 className="module-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Headphones size={28} color="#38bdf8" />
          <span>Máy Nghe Từ Vựng Song Ngữ</span>
        </h2>
        <p className="module-desc">
          Tắm ngôn ngữ tự nhiên khi đi lại, làm việc nhà hoặc chuẩn bị đi ngủ. 
          Hệ thống tự động phát âm chuẩn và diễn giải liên tục mà không cần chạm tay vào màn hình.
        </p>

        {/* Filters bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '16px' }}>
          <select 
            value={selectedLevel} 
            onChange={(e) => { setSelectedLevel(e.target.value); setCurrentIndex(0); }}
            className="filter-select"
            style={{ padding: '8px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          >
            {levels.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          <select 
            value={selectedTopic} 
            onChange={(e) => { setSelectedTopic(e.target.value); setCurrentIndex(0); }}
            className="filter-select"
            style={{ padding: '8px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          >
            {topics.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Main Music Player Card */}
      <div className="card glass-card" style={{
        padding: '40px 28px',
        textAlign: 'center',
        borderRadius: '24px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Sleep Timer Indicator */}
        {sleepTimeRemaining > 0 && (
          <div style={{
            position: 'absolute',
            top: '16px',
            right: '20px',
            fontSize: '0.85rem',
            color: '#818cf8',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(99, 102, 241, 0.15)',
            padding: '4px 12px',
            borderRadius: '20px'
          }}>
            <Moon size={14} />
            <span>Tắt sau: {Math.floor(sleepTimeRemaining / 60)}p {sleepTimeRemaining % 60}s</span>
          </div>
        )}

        {/* Audio Wave Visualizer */}
        <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
          <AudioWave isActive={isPlaying} />
        </div>

        {/* Current Word Info */}
        {currentWord && (
          <div style={{ marginBottom: '32px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Từ {currentIndex + 1} / {playlist.length} • {currentWord.topic}
            </span>

            <h1 style={{ fontSize: '3.4rem', fontWeight: 900, color: 'var(--text-primary)', margin: '10px 0 6px 0', letterSpacing: '-0.5px' }}>
              {currentWord.word}
            </h1>

            <div style={{ fontSize: '1.3rem', color: '#38bdf8', fontFamily: 'monospace', marginBottom: '12px' }}>
              {currentWord.ipa}
            </div>

            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981', marginBottom: '16px' }}>
              {currentWord.meaning}
            </div>

            {currentWord.example && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.04)',
                padding: '16px',
                borderRadius: '14px',
                maxWidth: '540px',
                margin: '0 auto',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ fontStyle: 'italic', fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  "{currentWord.example}"
                </div>
                {currentWord.exampleVi && (
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {currentWord.exampleVi}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Audio Player Controls */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
          <button
            onClick={handlePrev}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <SkipBack size={22} />
          </button>

          {/* Big Play/Pause Button */}
          <button
            onClick={handleTogglePlay}
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '50%',
              background: isPlaying ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #38bdf8, #2563eb)',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isPlaying ? '0 0 24px rgba(16, 185, 129, 0.5)' : '0 8px 24px rgba(56, 189, 248, 0.4)',
              transition: 'all 0.25s ease'
            }}
          >
            {isPlaying ? <Pause size={36} /> : <Play size={36} style={{ marginLeft: '4px' }} />}
          </button>

          <button
            onClick={handleNext}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <SkipForward size={22} />
          </button>
        </div>

        {/* Sleep Timer Preset Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginRight: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={16} /> Hẹn giờ tắt:
          </span>
          {[0, 15, 30, 45].map((mins) => (
            <button
              key={mins}
              onClick={() => handleSetSleepTimer(mins)}
              style={{
                padding: '6px 14px',
                borderRadius: '16px',
                border: `1px solid ${sleepTimerMinutes === mins ? '#818cf8' : 'var(--border-color)'}`,
                background: sleepTimerMinutes === mins ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                color: sleepTimerMinutes === mins ? '#818cf8' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              {mins === 0 ? 'Tắt' : `${mins} phút`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
