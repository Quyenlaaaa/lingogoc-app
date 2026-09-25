// AudioPodView.jsx - Máy Nghe Từ Vựng Thụ Động (Hands-Free Audio Pod)
// Dành cho người bận rộn: Vừa đi lại, làm việc, thư giãn vừa ngấm 3000 từ vựng song ngữ
import React, { useState, useEffect, useRef } from 'react';
import { 
  Headphones, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Clock, 
  Moon,
  Repeat2,
} from 'lucide-react';
import speechHelper from '../utils/speechHelper';
import { dispatchLearningEvent } from '../utils/learningEventEngine';
import { loadLearningModuleSession, saveLearningModuleSession } from '../utils/learningModuleSessionStore';
import AudioWave from './AudioWave';

export default function AudioPodView({ voiceSpeed = 0.85, vocabulary = [], onUpdateUserData }) {
  const [initialSession] = useState(() => loadLearningModuleSession('audio-pod'));
  const topics = React.useMemo(() => ['Tất cả', ...new Set(vocabulary.map((item) => item.topic).filter(Boolean))], [vocabulary]);
  const levels = React.useMemo(() => ['Tất cả', ...new Set(vocabulary.map((item) => item.level).filter(Boolean))], [vocabulary]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState(topics.includes(initialSession.selectedTopic) ? initialSession.selectedTopic : 'Tất cả');
  const [selectedLevel, setSelectedLevel] = useState(levels.includes(initialSession.selectedLevel) ? initialSession.selectedLevel : levels.includes('A1') ? 'A1' : 'Tất cả');
  const [repeatMode, setRepeatMode] = useState(['all', 'one', 'off'].includes(initialSession.repeatMode) ? initialSession.repeatMode : 'all');
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState(0); // 0 = tắt
  const [sleepTimeRemaining, setSleepTimeRemaining] = useState(0);

  const isPlayingRef = useRef(isPlaying);
  const sleepTimerRef = useRef(null);
  const cycleTimerRef = useRef(null);
  const cycleTokenRef = useRef(0);
  const restoredWordIdRef = useRef(initialSession.wordId);
  const repeatModeRef = useRef(repeatMode);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  // Lọc danh sách từ theo Topic & Level
  const playlist = React.useMemo(() => {
    let list = vocabulary;
    if (selectedLevel !== 'Tất cả') {
      const code = selectedLevel.split(' ')[0];
      list = list.filter(w => w.level === code);
    }
    if (selectedTopic !== 'Tất cả') {
      list = list.filter(w => w.topic === selectedTopic);
    }
    return list;
  }, [selectedTopic, selectedLevel, vocabulary]);

  const currentWord = playlist[currentIndex] || playlist[0];

  useEffect(() => {
    if (!playlist.length) return;
    const restoredWordId = restoredWordIdRef.current;
    if (restoredWordId != null) {
      const restoredIndex = playlist.findIndex((item) => String(item.id ?? item.word) === String(restoredWordId));
      restoredWordIdRef.current = null;
      setCurrentIndex(restoredIndex >= 0 ? restoredIndex : 0);
    } else if (currentIndex >= playlist.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, playlist]);

  useEffect(() => {
    saveLearningModuleSession('audio-pod', {
      selectedTopic,
      selectedLevel,
      repeatMode,
      wordId: currentWord?.id ?? currentWord?.word ?? null,
    });
  }, [currentWord?.id, currentWord?.word, repeatMode, selectedLevel, selectedTopic]);

  const clearCycleTimer = () => {
    if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
    cycleTimerRef.current = null;
  };

  const playWordCycle = (index, token = cycleTokenRef.current) => {
    if (!isPlayingRef.current || !playlist[index] || token !== cycleTokenRef.current) return;
    const word = playlist[index];
    const finishWord = () => {
      if (!isPlayingRef.current || token !== cycleTokenRef.current) return;
      const wordId = word.id ?? word.word;
      const result = dispatchLearningEvent({
        id: `audio-pod:${wordId}`,
        type: 'progress.completed',
        source: 'audio-pod',
        payload: { collection: 'completedAudioWords', targetId: wordId, xp: 2, rewardKey: `audio-pod:${wordId}` },
      });
      onUpdateUserData?.(result.userData);

      let nextIndex = index + 1;
      if (repeatModeRef.current === 'one') nextIndex = index;
      else if (nextIndex >= playlist.length) {
        if (repeatModeRef.current === 'off') {
          isPlayingRef.current = false;
          setIsPlaying(false);
          return;
        }
        nextIndex = 0;
      }
      setCurrentIndex(nextIndex);
      clearCycleTimer();
      cycleTimerRef.current = setTimeout(() => playWordCycle(nextIndex, token), 700);
    };
    const speakExample = () => {
      if (!isPlayingRef.current || token !== cycleTokenRef.current) return;
      if (word.example) speechHelper.speak(word.example, { rate: voiceSpeed, onEnd: finishWord, onError: finishWord });
      else finishWord();
    };
    speechHelper.speak(word.word, { rate: voiceSpeed, onEnd: speakExample, onError: speakExample });
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      cycleTokenRef.current += 1;
      clearCycleTimer();
      speechHelper.stopSpeaking();
    } else {
      if (!playlist.length) return;
      setIsPlaying(true);
      isPlayingRef.current = true;
      cycleTokenRef.current += 1;
      playWordCycle(currentIndex, cycleTokenRef.current);
    }
  };

  const handleNext = () => {
    if (!playlist.length) return;
    cycleTokenRef.current += 1;
    clearCycleTimer();
    speechHelper.stopSpeaking();
    const nextIdx = (currentIndex + 1) % playlist.length;
    setCurrentIndex(nextIdx);
    if (isPlaying) {
      cycleTimerRef.current = setTimeout(() => playWordCycle(nextIdx, cycleTokenRef.current), 300);
    }
  };

  const handlePrev = () => {
    if (!playlist.length) return;
    cycleTokenRef.current += 1;
    clearCycleTimer();
    speechHelper.stopSpeaking();
    const prevIdx = (currentIndex - 1 + playlist.length) % playlist.length;
    setCurrentIndex(prevIdx);
    if (isPlaying) {
      cycleTimerRef.current = setTimeout(() => playWordCycle(prevIdx, cycleTokenRef.current), 300);
    }
  };

  const changePlaylistFilter = (setter, value) => {
    cycleTokenRef.current += 1;
    clearCycleTimer();
    speechHelper.stopSpeaking();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setter(value);
    setCurrentIndex(0);
    restoredWordIdRef.current = null;
  };

  const cycleRepeatMode = () => {
    setRepeatMode((current) => current === 'all' ? 'one' : current === 'one' ? 'off' : 'all');
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
            isPlayingRef.current = false;
            cycleTokenRef.current += 1;
            clearCycleTimer();
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
      isPlayingRef.current = false;
      cycleTokenRef.current += 1;
      clearCycleTimer();
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
            onChange={(e) => changePlaylistFilter(setSelectedLevel, e.target.value)}
            className="filter-select"
            style={{ padding: '8px 14px', borderRadius: '10px', background: 'var(--surface-soft)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          >
            {levels.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          <select 
            value={selectedTopic} 
            onChange={(e) => changePlaylistFilter(setSelectedTopic, e.target.value)}
            className="filter-select"
            style={{ padding: '8px 14px', borderRadius: '10px', background: 'var(--surface-soft)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
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
                background: 'var(--surface-soft)',
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
        {!currentWord && <div className="module-empty-state" role="status">Không có từ phù hợp với bộ lọc hiện tại. Hãy chọn cấp độ hoặc chủ đề khác.</div>}

        {/* Audio Player Controls */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
          <button
            onClick={handlePrev}
            disabled={!playlist.length}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--surface-medium)',
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
            disabled={!playlist.length}
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
            disabled={!playlist.length}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--surface-medium)',
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
          <button
            onClick={cycleRepeatMode}
            className="btn btn-outline"
            aria-label={`Chế độ lặp: ${repeatMode}`}
            title="Đổi chế độ lặp toàn bộ, một từ hoặc không lặp"
            style={{ padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <Repeat2 size={15} /> {repeatMode === 'all' ? 'Lặp tất cả' : repeatMode === 'one' ? 'Lặp một từ' : 'Không lặp'}
          </button>
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
