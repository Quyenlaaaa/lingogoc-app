import React, { useEffect, useState } from 'react';
import { LoaderCircle, RefreshCw, Volume2, X } from 'lucide-react';
import speechHelper from '../utils/speechHelper';

export default function SpeechStatus() {
  const [playback, setPlayback] = useState(() => speechHelper.getState().playback);
  const [dismissedRequestId, setDismissedRequestId] = useState(null);

  useEffect(() => speechHelper.subscribe((state) => setPlayback(state.playback)), []);

  if (!['loading', 'error'].includes(playback.status) || playback.requestId === dismissedRequestId) {
    return null;
  }

  const failed = playback.status === 'error';
  return (
    <div
      className="speech-status-toast"
      role={failed ? 'alert' : 'status'}
      aria-live={failed ? 'assertive' : 'polite'}
      style={{
        position: 'fixed',
        left: 'max(12px, env(safe-area-inset-left))',
        right: 'max(12px, env(safe-area-inset-right))',
        zIndex: 2600,
        maxWidth: '520px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 14px',
        borderRadius: '14px',
        border: `1px solid ${failed ? 'rgba(248, 113, 113, 0.55)' : 'var(--border-color)'}`,
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.3)',
      }}
    >
      {failed
        ? <Volume2 size={19} color="#f87171" aria-hidden="true" />
        : <LoaderCircle size={19} color="#38bdf8" style={{ animation: 'queue-spin 1s linear infinite' }} aria-hidden="true" />}
      <span style={{ flex: 1, fontSize: '0.86rem', lineHeight: 1.4 }}>
        {failed ? 'Không thể phát giọng đọc. Bạn có thể thử lại ngay.' : 'Đang chuẩn bị giọng đọc…'}
      </span>
      {failed && playback.retryable && (
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => speechHelper.retryLastSpeech()}
          style={{ padding: '7px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
        >
          <RefreshCw size={15} aria-hidden="true" />
          Thử lại
        </button>
      )}
      <button
        type="button"
        onClick={() => setDismissedRequestId(playback.requestId)}
        aria-label="Ẩn trạng thái giọng đọc"
        style={{ border: 0, background: 'transparent', color: 'var(--text-muted)', padding: '4px', cursor: 'pointer' }}
      >
        <X size={17} aria-hidden="true" />
      </button>
    </div>
  );
}
