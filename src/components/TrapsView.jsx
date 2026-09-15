// TrapsView.jsx - Sổ Tay Bẫy Lỗi Sai & 50 Cặp Từ/Cặp Âm Dễ Nhầm Lẫn
import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Volume2, 
  Lightbulb, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  ArrowRight, 
  HelpCircle,
  BookOpen
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { trapItems, trapCategories } from '../data/trapsData';
import { speakText } from '../utils/speechHelper';
import { addXP } from '../utils/storage';

export default function TrapsView({ userData, onUpdateUserData }) {
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [activeTrapId, setActiveTrapId] = useState(trapItems[0].id);
  const [quizAnswers, setQuizAnswers] = useState({}); // { [trapId]: selectedOptionIndex }
  const [showExplanations, setShowExplanations] = useState({}); // { [trapId]: boolean }

  const filteredTraps = trapItems.filter(item => {
    if (selectedCategory === 'Tất cả') return true;
    return item.category === selectedCategory;
  });

  const activeTrap = trapItems.find(t => t.id === activeTrapId) || trapItems[0];

  const handleSelectQuizOption = (trapId, optIndex, isCorrect) => {
    if (showExplanations[trapId]) return;

    setQuizAnswers(prev => ({ ...prev, [trapId]: optIndex }));
    setShowExplanations(prev => ({ ...prev, [trapId]: true }));

    if (isCorrect) {
      addXP(15);
      try {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
      } catch (e) {}
    }
  };

  return (
    <div className="traps-view animate-fade-in" style={{ maxWidth: '880px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Header Info */}
      <div className="module-header-card" style={{ marginBottom: '24px' }}>
        <div className="module-tag" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: '#ef4444' }}>
          Đặc Trị Bẫy Lỗi Sai • Common Traps
        </div>
        <h2 className="module-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={26} color="#ef4444" />
          <span>Sổ Tay Phân Biệt Các Cặp Từ & Cặp Âm Hay Nhầm</span>
        </h2>
        <p className="module-desc">
          Giải quyết triệt để các cặp từ "nghĩa na ná nhau" (Say/Tell, Borrow/Lend, Hear/Listen) 
          và các cặp âm phát âm lệch một li đi một dặm (sheep vs ship, bed vs bad).
        </p>

        {/* Filter categories */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
          {trapCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: `1px solid ${selectedCategory === cat ? '#ef4444' : 'var(--border-color)'}`,
                background: selectedCategory === cat ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                color: selectedCategory === cat ? '#ef4444' : 'var(--text-secondary)',
                fontWeight: selectedCategory === cat ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout: List Pills + Detailed Card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'start' }}>
        {/* Left: Trap Items List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredTraps.map((trap) => {
            const isActive = trap.id === activeTrapId;
            const isDone = showExplanations[trap.id];

            return (
              <div
                key={trap.id}
                onClick={() => setActiveTrapId(trap.id)}
                className="card glass-card"
                style={{
                  padding: '16px 20px',
                  borderRadius: '16px',
                  border: `1.5px solid ${isActive ? '#ef4444' : 'var(--border-color)'}`,
                  background: isActive ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: isActive ? '#ef4444' : 'var(--text-primary)' }}>
                    {trap.title}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {trap.summary}
                  </div>
                </div>

                {isDone && <CheckCircle2 size={18} color="#10b981" />}
              </div>
            );
          })}
        </div>

        {/* Right: Active Trap Detail Analysis */}
        {activeTrap && (
          <div className="card glass-card" style={{ padding: '28px 24px', borderRadius: '20px', position: 'sticky', top: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#ef4444', letterSpacing: '0.5px' }}>
                  {activeTrap.category}
                </span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', margin: '4px 0 0 0' }}>
                  {activeTrap.title}
                </h3>
              </div>
            </div>

            {/* Compared Words Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              {activeTrap.words.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '1.15rem', color: '#38bdf8' }}>{item.word}</strong>
                      <span style={{ fontSize: '0.85rem', color: '#818cf8', fontFamily: 'monospace' }}>{item.ipa}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {item.usage}
                    </div>
                  </div>

                  <button
                    onClick={() => speakText(item.word, 0.85)}
                    className="btn btn-outline"
                    style={{ padding: '8px 12px', borderRadius: '10px' }}
                    title="Nghe phát âm chuẩn"
                  >
                    <Volume2 size={16} color="#38bdf8" />
                  </button>
                </div>
              ))}
            </div>

            {/* Mnemonic Golden Tip Box */}
            <div style={{
              padding: '14px 16px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid #f59e0b',
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
              lineHeight: '1.5',
              marginBottom: '24px'
            }}>
              {activeTrap.mnemonicTip}
            </div>

            {/* Mini Practice Quiz */}
            <div style={{
              padding: '18px',
              borderRadius: '14px',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '10px' }}>
                <HelpCircle size={16} color="#38bdf8" />
                <span>Thử Thách Phản Xạ Nhanh:</span>
              </div>

              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginBottom: '14px' }}>
                {activeTrap.quiz.question}
              </div>

              {/* Quiz Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                {activeTrap.quiz.options.map((opt, optIdx) => {
                  const isAnswered = showExplanations[activeTrap.id];
                  const isSelected = quizAnswers[activeTrap.id] === optIdx;
                  let borderCol = 'var(--border-color)';
                  let bgCol = 'rgba(255, 255, 255, 0.04)';

                  if (isAnswered) {
                    if (opt.isCorrect) {
                      borderCol = '#10b981';
                      bgCol = 'rgba(16, 185, 129, 0.15)';
                    } else if (isSelected) {
                      borderCol = '#ef4444';
                      bgCol = 'rgba(239, 68, 68, 0.15)';
                    }
                  }

                  return (
                    <button
                      key={optIdx}
                      onClick={() => handleSelectQuizOption(activeTrap.id, optIdx, opt.isCorrect)}
                      disabled={isAnswered}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '10px',
                        border: `1.5px solid ${borderCol}`,
                        background: bgCol,
                        color: 'var(--text-primary)',
                        textAlign: 'left',
                        fontSize: '0.9rem',
                        cursor: isAnswered ? 'default' : 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>{opt.text}</span>
                      {isAnswered && opt.isCorrect && <CheckCircle2 size={16} color="#10b981" />}
                      {isAnswered && isSelected && !opt.isCorrect && <XCircle size={16} color="#ef4444" />}
                    </button>
                  );
                })}
              </div>

              {/* Explanation Box */}
              {showExplanations[activeTrap.id] && (
                <div className="animate-fade-in" style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid #10b981',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)'
                }}>
                  💡 <strong>Giải thích:</strong> {activeTrap.quiz.explanation}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
