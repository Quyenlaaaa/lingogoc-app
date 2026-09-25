import React, { useMemo, useRef, useState } from 'react';
import { Check, Eye, Lightbulb, RotateCcw, Shuffle, Trophy, Volume2, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { isLowQualityMeaning } from '../utils/vocabularyQuality';
import { dispatchLearningEvent } from '../utils/learningEventEngine';
import { getVocabularyPresentation } from '../utils/vocabularyPresentation';

function shuffledLetters(word) {
  const source = word.toLowerCase().split('');
  let result = [...source];
  for (let attempt = 0; attempt < 6 && result.join('') === source.join(''); attempt += 1) {
    result = [...source];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
    }
  }
  if (result.join('') === source.join('') && result.length > 1) result.push(result.shift());
  return result.map((letter, index) => ({ id: `${index}-${letter}`, letter }));
}

function chooseWord(pool, previousId) {
  const candidates = pool.filter((word) => word.id !== previousId);
  return candidates[Math.floor(Math.random() * candidates.length)] || pool[0] || null;
}

export default function WordScrambleGame({ words, onUpdateUserData, onSpeak, onOpenDetail }) {
  const pool = useMemo(() => words
    .map((item) => {
      const presentation = getVocabularyPresentation(item);
      return { ...item, meaning: presentation.meaning, ipa: presentation.ipa, _presentation: presentation };
    })
    .filter((item) => /^[a-z]{4,14}$/i.test(item.word)
      && item._presentation.meaningSource !== 'pending'
      && !isLowQualityMeaning(item.meaning)), [words]);
  const [currentWord, setCurrentWord] = useState(() => chooseWord(pool));
  const [letters, setLetters] = useState(() => currentWord ? shuffledLetters(currentWord.word) : []);
  const [pickedIds, setPickedIds] = useState([]);
  const [status, setStatus] = useState('playing');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [difficulty, setDifficulty] = useState('normal');
  const [hintCount, setHintCount] = useState(0);
  const [awardedWordIds, setAwardedWordIds] = useState(() => new Set());
  const [lastReward, setLastReward] = useState(0);
  const roundIdRef = useRef(crypto.randomUUID());

  const pickedLetters = pickedIds.map((id) => letters.find((item) => item.id === id)).filter(Boolean);
  const answer = pickedLetters.map((item) => item.letter).join('');

  const resetRound = (word = currentWord) => {
    if (!word) return;
    roundIdRef.current = crypto.randomUUID();
    setCurrentWord(word);
    setLetters(shuffledLetters(word.word));
    setPickedIds([]);
    setStatus('playing');
    setMistakes(0);
    setHintCount(0);
    setLastReward(0);
  };

  const nextRound = () => resetRound(chooseWord(pool, currentWord?.id));

  const checkAnswer = () => {
    if (!currentWord || pickedIds.length !== letters.length || status === 'correct') return;
    if (answer === currentWord.word.toLowerCase()) {
      const gained = Math.max(3, 10 - hintCount * 2 - mistakes * 2);
      setStatus('correct');
      setScore((value) => value + gained);
      setStreak((value) => value + 1);
      setAwardedWordIds((ids) => new Set(ids).add(currentWord.id));
      dispatchLearningEvent({
        id: `word-scramble-review:${roundIdRef.current}`,
        type: 'word.reviewed',
        source: 'word-scramble',
        payload: {
          wordId: currentWord.id,
          quality: mistakes > 0 ? 1 : hintCount > 0 ? 2 : 3,
          xp: 0,
        },
      });
      const result = dispatchLearningEvent({
        type: 'progress.completed',
        source: 'word-scramble',
        payload: {
          collection: 'masteredWords',
          targetId: currentWord.id,
          xp: awardedWordIds.has(currentWord.id) ? 0 : gained,
          rewardKey: `word-scramble:${currentWord.id}`,
        },
      });
      setLastReward(result.awardedXp);
      onUpdateUserData?.(result.userData);
      try { confetti({ particleCount: 55, spread: 65, origin: { y: .68 } }); } catch { /* optional */ }
    } else {
      setStatus('wrong');
      setMistakes((value) => value + 1);
      setStreak(0);
    }
  };

  const revealHint = () => {
    if (!currentWord || status === 'correct') return;
    const nextIndex = pickedIds.length;
    const expectedLetter = currentWord.word.toLowerCase()[nextIndex];
    const tile = letters.find((item) => item.letter === expectedLetter && !pickedIds.includes(item.id));
    if (tile) setPickedIds((ids) => [...ids, tile.id]);
    setHintCount((value) => value + 1);
    setStatus('playing');
  };

  if (!currentWord || pool.length < 2) {
    return <div className="scramble-empty">Cần ít nhất 2 từ tiếng Anh hợp lệ từ 4–14 chữ cái trong bộ lọc hiện tại.</div>;
  }

  return (
    <section className="scramble-game-shell">
      <header className="scramble-game-header">
        <div><span className="scramble-kicker"><Shuffle size={15} /> Word Scramble</span><h3>Sắp xếp chữ thành từ đúng</h3><p>Dùng nghĩa và ngữ cảnh làm gợi ý, sau đó chọn từng chữ cái theo đúng thứ tự.</p></div>
        <div className="scramble-stats"><span><strong>{score}</strong> điểm</span><span><strong>{streak}</strong> chuỗi đúng</span></div>
      </header>

      <div className="scramble-toolbar">
        <span>Độ khó</span>
        <button className={difficulty === 'normal' ? 'active' : ''} onClick={() => setDifficulty('normal')}>Có gợi ý chữ</button>
        <button className={difficulty === 'hard' ? 'active' : ''} onClick={() => setDifficulty('hard')}>Thử thách</button>
      </div>

      <div className="scramble-clue-card">
        <span>{currentWord.level} • {currentWord.pos || currentWord.type || 'word'} • {currentWord.topic}</span>
        <h4>{currentWord.meaning}</h4>
        {difficulty === 'normal' && <p><Eye size={15} /> Từ có {currentWord.word.length} chữ cái, bắt đầu bằng <b>{currentWord.word[0].toUpperCase()}</b></p>}
      </div>

      <div className={`scramble-answer-slots ${status}`}>
        {letters.map((_, index) => <button key={index} onClick={() => pickedLetters[index] && setPickedIds((ids) => ids.filter((id) => id !== pickedLetters[index].id))}>{pickedLetters[index]?.letter.toUpperCase() || ''}</button>)}
      </div>

      <div className="scramble-letter-bank">
        {letters.map((item) => <button key={item.id} disabled={pickedIds.includes(item.id) || status === 'correct'} onClick={() => { setPickedIds((ids) => [...ids, item.id]); setStatus('playing'); }}>{item.letter.toUpperCase()}</button>)}
      </div>

      {status === 'wrong' && <div className="scramble-feedback wrong"><X size={18} /> Chưa đúng. Kiểm tra lại thứ tự các chữ cái nhé.</div>}
      {status === 'correct' && <div className="scramble-feedback correct"><Check size={18} /><span><b>Chính xác: {currentWord.word}</b> — +{Math.max(3, 10 - hintCount * 2 - mistakes * 2)} điểm{lastReward ? `, +${lastReward} XP` : ''}.</span><button onClick={() => onOpenDetail(currentWord)}>Xem ví dụ</button></div>}

      <div className="scramble-actions">
        <button onClick={() => onSpeak(currentWord.word)}><Volume2 size={17} /> Nghe từ</button>
        <button onClick={revealHint} disabled={status === 'correct'}><Lightbulb size={17} /> Gợi ý chữ</button>
        <button onClick={() => resetRound()}><RotateCcw size={17} /> Xáo lại</button>
        {status === 'correct' ? <button className="primary" onClick={nextRound}>Từ tiếp theo <Trophy size={17} /></button> : <button className="primary" onClick={checkAnswer} disabled={pickedIds.length !== letters.length}>Kiểm tra <Check size={17} /></button>}
      </div>
    </section>
  );
}
