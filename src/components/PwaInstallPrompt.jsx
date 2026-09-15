// PwaInstallPrompt.jsx - Nút nhắc cài đặt ứng dụng PWA lên màn hình điện thoại & máy tính
import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, Check } from 'lucide-react';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert('Để cài đặt: Trên iPhone/iPad bấm nút Chia sẻ (Share) -> chọn "Thêm vào MH chính" (Add to Home Screen). Trên Android/Chrome bấm menu 3 chấm -> "Cài đặt ứng dụng".');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled || isDismissed) return null;

  return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.2), rgba(56, 189, 248, 0.2))',
      borderBottom: '1px solid rgba(56, 189, 248, 0.3)',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      fontSize: '0.85rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
        <Smartphone size={16} color="#38bdf8" />
        <span>
          <strong>Cài đặt LingoGoc AI</strong> lên màn hình chính điện thoại / máy tính để học offline mượt mà!
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={handleInstallClick}
          className="btn btn-primary"
          style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Download size={14} />
          <span>Cài Đặt Ngay</span>
        </button>
        <button
          onClick={() => setIsDismissed(true)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
