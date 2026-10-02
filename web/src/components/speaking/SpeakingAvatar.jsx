import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Bot } from 'lucide-react';
import { SPEAKING_STATUS_LABELS } from '../../utils/speakingConversationState';

const SpeakingAvatarCanvas = lazy(() => import('./SpeakingAvatarCanvas'));

function CssAvatarBust() {
  return (
    <div className="speaking-avatar-bust" aria-hidden="true">
      <div className="speaking-avatar-hair" />
      <div className="speaking-avatar-face">
        <span className="speaking-avatar-brow left" />
        <span className="speaking-avatar-brow right" />
        <span className="speaking-avatar-eye left" />
        <span className="speaking-avatar-eye right" />
        <span className="speaking-avatar-nose" />
        <span className="speaking-avatar-mouth" />
      </div>
      <div className="speaking-avatar-neck" />
      <div className="speaking-avatar-body"><Bot size={20} /></div>
    </div>
  );
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function constrainedDevice() {
  if (typeof navigator === 'undefined') return false;
  return Number(navigator.deviceMemory) > 0 && Number(navigator.deviceMemory) <= 4;
}

export default function SpeakingAvatar({ state = 'idle', partnerName = 'LingoGoc AI' }) {
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const [rendererFailure, setRendererFailure] = useState('');
  const lowMemory = useMemo(() => constrainedDevice(), []);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return undefined;
    const update = () => setReducedMotion(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  const animationLimited = reducedMotion || lowMemory;
  const useWebGl = !animationLimited && !rendererFailure;
  return (
    <div
      className={`speaking-avatar speaking-avatar--${state} ${animationLimited ? 'speaking-avatar--limited' : ''}`}
      data-avatar-renderer={useWebGl ? 'webgl-procedural' : 'css-fallback'}
      data-avatar-state={state}
      aria-label={`Gia sư AI hư cấu ${partnerName}: ${SPEAKING_STATUS_LABELS[state] || state}`}
    >
      <div className="speaking-avatar-halo" aria-hidden="true" />
      {useWebGl ? (
        <Suspense fallback={<CssAvatarBust />}>
          <SpeakingAvatarCanvas state={state} onFallback={setRendererFailure} />
        </Suspense>
      ) : <CssAvatarBust />}
      <div className="speaking-avatar-caption">
        <strong>{partnerName}</strong>
        <span>Gia sư AI hư cấu · {useWebGl ? '3D procedural' : '2D tối ưu'}</span>
      </div>
    </div>
  );
}
