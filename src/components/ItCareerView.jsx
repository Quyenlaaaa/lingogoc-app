import React, { useMemo, useState } from 'react';
import {
  BookOpen, BriefcaseBusiness, Check, CheckCircle2, Code2, MessageSquareText,
  Search, Target, Volume2,
} from 'lucide-react';
import { itCareerCategories, itCareerVocabulary, itWorkPhrases } from '../data/itCareerData';
import speechHelper from '../utils/speechHelper';

const ALL_CATEGORIES = 'Tất cả chủ đề';

export default function ItCareerView({ userData, onUpdateUserData, voiceSpeed = 0.85 }) {
  const [mode, setMode] = useState('vocabulary');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const learnedSet = useMemo(() => new Set(userData?.completedItTerms || []), [userData]);

  const filteredTerms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return itCareerVocabulary.filter((item) => {
      const matchesCategory = category === ALL_CATEGORIES || item.category === category;
      const matchesQuery = !normalizedQuery || [item.word, item.meaning, item.example, item.category]
        .some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  const learnedCount = learnedSet.size;
  const progress = Math.round((learnedCount / itCareerVocabulary.length) * 100);

  const toggleLearned = (id) => {
    const next = new Set(learnedSet);
    const isNew = !next.has(id);
    if (isNew) next.add(id);
    else next.delete(id);

    onUpdateUserData({
      ...userData,
      completedItTerms: [...next],
      xp: (userData?.xp || 0) + (isNew ? 10 : 0),
    });
  };

  const speak = (text) => speechHelper.speak(text, { rate: voiceSpeed });

  return (
    <div className="it-career-view animate-fade-in">
      <section className="it-career-hero">
        <div className="it-hero-copy">
          <span className="it-hero-eyebrow"><Code2 size={16} /> English for IT Career Switchers</span>
          <h1>Tiếng Anh cho người chuyển ngành Công nghệ thông tin</h1>
          <p>Học đúng từ xuất hiện trong tài liệu kỹ thuật, Git, dự án Agile, buổi họp và phỏng vấn — kèm câu dùng tự nhiên trong môi trường làm việc.</p>
          <div className="it-hero-stats">
            <div><strong>{itCareerVocabulary.length}</strong><span>thuật ngữ cốt lõi</span></div>
            <div><strong>{itCareerCategories.length}</strong><span>nhóm kỹ năng</span></div>
            <div><strong>{itWorkPhrases.length}</strong><span>cụm câu công việc</span></div>
          </div>
        </div>
        <div className="it-progress-card">
          <Target size={26} />
          <strong>{progress}%</strong>
          <span>{learnedCount}/{itCareerVocabulary.length} thuật ngữ đã học</span>
          <div className="it-progress-track"><div style={{ width: `${progress}%` }} /></div>
        </div>
      </section>

      <div className="it-mode-tabs" role="tablist">
        <button className={mode === 'vocabulary' ? 'active' : ''} onClick={() => setMode('vocabulary')}>
          <BookOpen size={17} /> Bộ từ vựng
        </button>
        <button className={mode === 'roadmap' ? 'active' : ''} onClick={() => setMode('roadmap')}>
          <Target size={17} /> Lộ trình chủ đề
        </button>
        <button className={mode === 'phrases' ? 'active' : ''} onClick={() => setMode('phrases')}>
          <MessageSquareText size={17} /> Cụm câu đi làm
        </button>
      </div>

      {mode === 'vocabulary' && (
        <>
          <div className="it-filter-bar">
            <label className="it-search-box">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm thuật ngữ, nghĩa hoặc ví dụ…" />
            </label>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option>{ALL_CATEGORIES}</option>
              {itCareerCategories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>

          <div className="it-result-summary">Hiển thị {filteredTerms.length} thuật ngữ</div>
          <div className="it-terms-grid">
            {filteredTerms.map((item) => {
              const learned = learnedSet.has(item.id);
              return (
                <article className={`it-term-card ${learned ? 'learned' : ''}`} key={item.id}>
                  <div className="it-term-top">
                    <span>{item.category}</span>
                    <button onClick={() => toggleLearned(item.id)} title={learned ? 'Bỏ đánh dấu đã học' : 'Đánh dấu đã học'}>
                      {learned ? <CheckCircle2 size={20} /> : <Check size={20} />}
                    </button>
                  </div>
                  <div className="it-term-heading">
                    <div><h3>{item.word}</h3><small>{item.pos}</small></div>
                    <button className="it-audio-button" onClick={() => speak(item.word)} aria-label={`Nghe ${item.word}`}><Volume2 size={18} /></button>
                  </div>
                  <div className="it-term-meaning">{item.meaning}</div>
                  <div className="it-example">
                    <div><span>{item.example}</span><button onClick={() => speak(item.example)}><Volume2 size={15} /></button></div>
                    <p>{item.exampleVi}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {mode === 'roadmap' && (
        <div className="it-roadmap-grid">
          {itCareerCategories.map((item, index) => {
            const terms = itCareerVocabulary.filter((term) => term.category === item);
            const completed = terms.filter((term) => learnedSet.has(term.id)).length;
            return (
              <button key={item} className="it-roadmap-card" onClick={() => { setCategory(item); setMode('vocabulary'); }}>
                <span className="it-roadmap-number">{String(index + 1).padStart(2, '0')}</span>
                <div><strong>{item}</strong><span>{completed}/{terms.length} thuật ngữ đã học</span></div>
                <div className="it-mini-progress"><i style={{ width: `${(completed / terms.length) * 100}%` }} /></div>
              </button>
            );
          })}
        </div>
      )}

      {mode === 'phrases' && (
        <div className="it-phrases-list">
          <div className="it-phrases-intro"><BriefcaseBusiness size={22} /><div><strong>Cụm câu có thể dùng ngay</strong><span>Nghe, bắt chước rồi thay thông tin theo tình huống của bạn.</span></div></div>
          {itWorkPhrases.map((phrase) => (
            <article key={phrase.id} className="it-phrase-card">
              <span>{phrase.situation}</span>
              <div><strong>{phrase.en}</strong><button onClick={() => speak(phrase.en)}><Volume2 size={17} /></button></div>
              <p>{phrase.vi}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
