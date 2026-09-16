// WordDetailModal.jsx - Đối chiếu dữ liệu từ điển và bổ sung ngữ cảnh bằng Gemini.
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Volume2, 
  Sparkles, 
  BookOpen, 
  Lightbulb, 
  Layers
} from 'lucide-react';
import { fetchRealWordData, playNativeAudio } from '../utils/realDictionaryService';
import { enrichWordWithLLM } from '../utils/geminiService';
import { speakText } from '../utils/speechHelper';
import { getTrustedExamples, isLowQualityExample, isLowQualityMeaning } from '../utils/vocabularyQuality';

export default function WordDetailModal({ word, isOpen, onClose }) {
  const [realDictData, setRealDictData] = useState(null);
  const [aiEnrichData, setAiEnrichData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !word) return;

    let isMounted = true;
    setLoading(true);
    setRealDictData(null);
    setAiEnrichData(null);

    const loadDetails = async () => {
      try {
        const dictData = await fetchRealWordData(word.word);
        if (!isMounted) return;
        setRealDictData(dictData);

        const aiData = await enrichWordWithLLM(
          word.word,
          word.meaning,
          word.topic,
          dictData?.definitions || [],
        );
        if (!isMounted) return;
        setAiEnrichData(aiData);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDetails();

    return () => { isMounted = false; };
  }, [isOpen, word]);

  if (!isOpen || !word) return null;

  const storedExamples = getTrustedExamples(word);
  const dictionaryExamples = (realDictData?.examples || [])
    .filter((example) => !isLowQualityExample(example))
    .map((example) => ({ en: example, vi: '', context: 'Từ điển', source: 'dictionary' }));
  const aiExamples = (aiEnrichData?.contextExamples || [])
    .filter((example) => !isLowQualityExample(example.en))
    .map((example) => ({ ...example, source: 'ai' }));
  const contextExamples = [...aiExamples, ...dictionaryExamples, ...storedExamples]
    .filter((example, index, list) => list.findIndex((item) => item.en.toLowerCase() === example.en.toLowerCase()) === index)
    .slice(0, 7);
  const displayMeaning = aiEnrichData?.primaryMeaningVi || word.meaning;

  const handlePlayNativeOrTts = () => {
    if (realDictData?.audioUrl) {
      playNativeAudio(realDictData.audioUrl);
    } else {
      speakText(word.word, 0.85);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2500,
      padding: '16px'
    }}>
      <div className="card glass-card animate-fade-in" style={{
        maxWidth: '680px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '32px 28px',
        borderRadius: '24px',
        border: '1.5px solid rgba(56, 189, 248, 0.4)',
        position: 'relative',
        background: 'var(--bg-card)'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <X size={22} />
        </button>

        {/* Word Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              padding: '3px 10px',
              borderRadius: '6px',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8'
            }}>
              {word.level || 'A1'} • {word.topic}
            </span>

            {realDictData?.audioUrl ? (
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '6px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981'
              }}>
                🎧 Giọng Bản Xứ Thật (MP3)
              </span>
            ) : null}
          </div>

          <h1 style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--text-primary)', margin: '4px 0' }}>
            {word.word}
          </h1>

          <div style={{ fontSize: '1.25rem', color: '#818cf8', fontFamily: 'monospace', marginBottom: '8px' }}>
            {realDictData?.phonetic || word.ipa}
          </div>

          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#10b981', marginBottom: '6px' }}>
            {displayMeaning} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 400 }}>({word.pos || word.type})</span>
          </div>
          <div className="meaning-source-note">
            {aiEnrichData?.primaryMeaningVi
              ? 'Nghĩa tiếng Việt đã được AI đối chiếu với dữ liệu từ điển tiếng Anh'
              : isLowQualityMeaning(word.meaning)
                ? 'Nghĩa trong bộ dữ liệu cũ chưa đủ tin cậy — xem định nghĩa nguồn bên dưới'
                : 'Nghĩa từ bộ dữ liệu học tập'}
          </div>

          {/* Audio Button */}
          <button
            onClick={handlePlayNativeOrTts}
            className="btn btn-primary"
            style={{ borderRadius: '24px', padding: '10px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
          >
            <Volume2 size={20} />
            <span>{realDictData?.audioUrl ? 'Nghe Giọng Bản Xứ (Người Thật)' : 'Nghe Phát Âm Chuẩn'}</span>
          </button>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
            <Sparkles size={32} color="#38bdf8" className="animate-spin" style={{ margin: '0 auto 12px' }} />
            <div>Đang tải dữ liệu từ điển thật và phân tích bởi AI...</div>
          </div>
        ) : (
          <div>
            {aiEnrichData?.meaningNote && (
              <div className="meaning-usage-note"><strong>Lưu ý cách dùng:</strong> {aiEnrichData.meaningNote}</div>
            )}

            {(aiEnrichData?.senses?.length > 0 || realDictData?.definitions?.length > 0) && (
              <div className="dictionary-senses-section">
                <div className="word-detail-section-title"><BookOpen size={18} /> Các nghĩa và cách dùng</div>
                {aiEnrichData?.senses?.map((sense, index) => (
                  <div className="sense-row" key={`${sense.pos}-${index}`}>
                    <b>{sense.pos}</b><span>{sense.meaningVi}</span><small>{sense.usage}</small>
                  </div>
                ))}
                {realDictData?.definitions?.map((definition, index) => (
                  <div className="definition-row" key={`${definition.partOfSpeech}-${index}`}>
                    <b>{definition.partOfSpeech}</b><span>{definition.text}</span><small>Nguồn từ điển tiếng Anh</small>
                  </div>
                ))}
              </div>
            )}

            {/* 1. Mnemonic Golden Tip Box */}
            {aiEnrichData?.mnemonicTip && (
              <div style={{
                padding: '14px 18px',
                borderRadius: '14px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid #f59e0b',
                marginBottom: '20px',
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                lineHeight: '1.5'
              }}>
                <div style={{ fontWeight: 800, color: '#f59e0b', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lightbulb size={18} />
                  <span>Mẹo Ghi Nhớ Nhanh:</span>
                </div>
                {aiEnrichData.mnemonicTip}
              </div>
            )}

            {/* 2. Contextual Real Examples */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BookOpen size={18} color="#38bdf8" />
                <span>Ví dụ tự nhiên theo nhiều ngữ cảnh:</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {contextExamples.map((ex, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div className={`example-source-label ${ex.source}`}>{ex.context || (ex.source === 'dictionary' ? 'Từ điển' : 'Bộ dữ liệu')}</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                        "{ex.en}"
                      </div>
                      {ex.vi && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        🇻🇳 {ex.vi}
                      </div>}
                    </div>
                    <button
                      onClick={() => speakText(ex.en, 0.85)}
                      className="btn btn-outline"
                      style={{ padding: '6px 10px', borderRadius: '8px', flexShrink: 0 }}
                      title="Nghe câu này"
                    >
                      <Volume2 size={15} color="#38bdf8" />
                    </button>
                  </div>
                ))}
                {!contextExamples.length && (
                  <div className="no-trusted-examples">
                    Chưa có ví dụ đủ tin cậy cho từ này. Hãy thêm Gemini API key trong Cài đặt để tạo và đối chiếu 5 ngữ cảnh song ngữ.
                  </div>
                )}
              </div>
            </div>

            {/* 3. Collocations (Cụm từ hay gặp) */}
            {aiEnrichData?.collocations && aiEnrichData.collocations.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={18} color="#10b981" />
                  <span>Cụm Từ Hay Đi Kèm (Collocations):</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                  {aiEnrichData.collocations.map((col, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        fontSize: '0.85rem'
                      }}
                    >
                      <strong style={{ color: '#10b981', display: 'block' }}>{col.phrase}</strong>
                      <span style={{ color: 'var(--text-secondary)' }}>{col.meaning}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Synonyms & Antonyms from Real Dictionary API */}
            {realDictData?.synonyms && realDictData.synonyms.length > 0 && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '14px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                fontSize: '0.85rem'
              }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '6px' }}>
                  📚 Từ đồng nghĩa (Synonyms) từ điển quốc tế:
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {realDictData.synonyms.map((s, idx) => (
                    <span
                      key={idx}
                      style={{ padding: '3px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: '#38bdf8' }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
