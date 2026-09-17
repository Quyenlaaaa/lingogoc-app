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
import { fetchRealWordData, playNativeAudio, preloadNativeAudio } from '../utils/realDictionaryService';
import { fetchCambridgeWordData } from '../utils/cambridgeDictionaryService';
import { enrichWordWithLLM, getCachedWordEnrichment } from '../utils/geminiService';
import { speakText, speechHelper } from '../utils/speechHelper';
import { getTrustedExamples, isLowQualityExample, isLowQualityMeaning } from '../utils/vocabularyQuality';

export default function WordDetailModal({ word, initialEnrichment, isOpen, onClose }) {
  const [realDictData, setRealDictData] = useState(null);
  const [cambridgeData, setCambridgeData] = useState(null);
  const [cambridgeError, setCambridgeError] = useState('');
  const [aiEnrichData, setAiEnrichData] = useState(initialEnrichment || null);
  const [loading, setLoading] = useState(!initialEnrichment);

  useEffect(() => {
    if (!isOpen || !word) return;

    let isMounted = true;
    const readyAiData = initialEnrichment || getCachedWordEnrichment(word.word);
    setLoading(!readyAiData);
    setRealDictData(null);
    setCambridgeData(null);
    setCambridgeError('');
    setAiEnrichData(readyAiData);

    const loadDetails = async () => {
      try {
        const [dictionaryResult, cambridgeResult] = await Promise.allSettled([
          fetchRealWordData(word.word),
          fetchCambridgeWordData(word.word),
        ]);
        const dictData = dictionaryResult.status === 'fulfilled' ? dictionaryResult.value : null;
        const officialData = cambridgeResult.status === 'fulfilled' ? cambridgeResult.value : null;
        if (!isMounted) return;
        setRealDictData(dictData);
        setCambridgeData(officialData);
        if (cambridgeResult.status === 'rejected') setCambridgeError(cambridgeResult.reason?.message || 'Không thể tải Cambridge API.');

        if (!readyAiData?.contextExamples?.length) {
          const aiData = await enrichWordWithLLM(
            word.word,
            word.meaning,
            word.topic,
            [
              ...(officialData?.definitions || []).map((text) => ({ partOfSpeech: '', text, source: 'Cambridge' })),
              ...(dictData?.definitions || []),
            ],
            undefined,
            { retryUntilSuccess: true, keepAlive: true },
          );
          if (!isMounted) return;
          setAiEnrichData(aiData);
        }
      } catch (error) {
        if (error?.name !== 'AbortError' && isMounted) {
          setAiEnrichData({
            isAiGenerated: false,
            contextExamples: [],
            unavailableReason: error?.message || 'Không thể tạo ví dụ đa ngữ cảnh.',
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDetails();

    return () => {
      isMounted = false;
    };
  }, [initialEnrichment, isOpen, word]);

  useEffect(() => {
    if (realDictData?.audioUrl && !speechHelper.isMobileDevice()) {
      preloadNativeAudio(realDictData.audioUrl);
    }
  }, [realDictData?.audioUrl]);

  if (!isOpen || !word) return null;

  const storedExamples = getTrustedExamples(word);
  const dictionaryExamples = (realDictData?.examples || [])
    .filter((example) => !isLowQualityExample(example))
    .map((example) => ({ en: example, vi: '', context: 'Từ điển', source: 'dictionary' }));
  const cambridgeExamples = (cambridgeData?.examples || [])
    .filter((example) => !isLowQualityExample(example))
    .map((example) => ({ en: example, vi: '', context: 'Cambridge Dictionary API', source: 'cambridge' }));
  const aiExamples = (aiEnrichData?.contextExamples || [])
    .filter((example) => !isLowQualityExample(example.en))
    .map((example) => ({ ...example, source: 'ai' }));
  const contextExamples = [...cambridgeExamples, ...aiExamples, ...dictionaryExamples, ...storedExamples]
    .filter((example, index, list) => list.findIndex((item) => item.en.toLowerCase() === example.en.toLowerCase()) === index)
    .slice(0, 10);
  const displayMeaning = aiEnrichData?.primaryMeaningVi || word.meaning;

  const handlePlayNativeOrTts = () => {
    // Native speech starts synchronously inside the tap on mobile. Fetching or
    // awaiting an MP3 first can consume Safari/Chrome's user-activation token.
    if (speechHelper.isMobileDevice() && speakText(word.word, 0.85)) {
      return;
    }

    if (realDictData?.audioUrl) {
      playNativeAudio(realDictData.audioUrl).then((played) => {
        if (!played) speakText(word.word, 0.85);
      });
    } else {
      speakText(word.word, 0.85);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--scrim)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2500,
      padding: '16px'
    }}>
      <div className="card glass-card animate-fade-in word-detail-modal-card" style={{
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

        {cambridgeError && <div className="cambridge-api-error">{cambridgeError}</div>}

        {/* Loading Spinner */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
            <Sparkles size={32} color="#38bdf8" className="animate-spin" style={{ margin: '0 auto 12px' }} />
            <div>Đang tải dữ liệu từ điển và ví dụ đa ngữ cảnh…</div>
          </div>
        ) : (
          <div>
            {aiEnrichData?.meaningNote && (
              <div className="meaning-usage-note"><strong>Lưu ý cách dùng:</strong> {aiEnrichData.meaningNote}</div>
            )}

            {(aiEnrichData?.senses?.length > 0 || realDictData?.definitions?.length > 0 || cambridgeData?.definitions?.length > 0) && (
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
                {cambridgeData?.definitions?.map((definition, index) => (
                  <div className="definition-row cambridge-definition" key={`cambridge-${index}`}>
                    <b>Cambridge</b><span>{definition}</span><small>Cambridge Dictionary API • {cambridgeData.dictionaryCode}</small>
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
                    className="word-detail-example-row"
                    style={{
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: 'var(--surface-soft)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div className="word-detail-example-content">
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
                    Chưa có ví dụ đủ tin cậy cho từ này. Máy chủ AI chưa trả về dữ liệu đa ngữ cảnh.
                  </div>
                )}
                {cambridgeData?.entryUrl && (
                  <a className="cambridge-attribution" href={cambridgeData.entryUrl} target="_blank" rel="noreferrer">Xem mục từ gốc trên Cambridge Dictionary ↗</a>
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
                background: 'var(--surface-soft)',
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
                      style={{ padding: '3px 10px', borderRadius: '12px', background: 'var(--sky-light)', color: 'var(--sky)' }}
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
