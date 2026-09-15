// AudioWave.jsx - Visual audio waveform animation when speaking/recording
import React from 'react';

export default function AudioWave({ isActive, color = 'var(--primary)', label = '' }) {
  if (!isActive) return null;

  return (
    <div className="audio-wave-container">
      {label && <span className="audio-wave-label">{label}</span>}
      <div className="audio-wave-bars">
        <span className="wave-bar" style={{ backgroundColor: color, animationDelay: '0.1s' }}></span>
        <span className="wave-bar" style={{ backgroundColor: color, animationDelay: '0.3s' }}></span>
        <span className="wave-bar" style={{ backgroundColor: color, animationDelay: '0.2s' }}></span>
        <span className="wave-bar" style={{ backgroundColor: color, animationDelay: '0.5s' }}></span>
        <span className="wave-bar" style={{ backgroundColor: color, animationDelay: '0.4s' }}></span>
        <span className="wave-bar" style={{ backgroundColor: color, animationDelay: '0.25s' }}></span>
      </div>
    </div>
  );
}
