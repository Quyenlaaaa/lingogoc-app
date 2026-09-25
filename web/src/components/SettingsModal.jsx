// SettingsModal.jsx - Cài đặt tài khoản, tùy chỉnh Avatar và sao lưu/khôi phục dữ liệu
import React, { useState, useRef } from 'react';
import { 
  Settings, 
  Download, 
  Upload, 
  Trash2, 
  X, 
  Play,
  Volume2
} from 'lucide-react';
import { resetUserData } from '../utils/storage';
import speechHelper, { VOICE_PRESETS } from '../utils/speechHelper';
import {
  createLocalBackup,
  parseLocalBackup,
  restoreLocalBackup,
  serializeLocalBackup,
} from '../utils/localBackupService';

const AVATARS = ['👤', '🦁', '🦄', '👑', '🌸', '🚀', '🐱', '⚽', '🎸', '⚡', '🦅', '💎'];

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  userData, 
  onUpdateUserData,
}) {
  const [name, setName] = useState(userData?.name || 'Học Viên LingoGoc');
  const [selectedAvatar, setSelectedAvatar] = useState(userData?.avatar || '👤');
  const [selectedVoice, setSelectedVoice] = useState(userData?.settings?.voicePreset || 'auto');
  const fileInputRef = useRef(null);
  const [notice, setNotice] = useState(null);

  if (!isOpen) return null;

  const handleSaveProfile = () => {
    const updated = {
      ...userData,
      name: name.trim() || 'Học Viên LingoGoc',
      avatar: selectedAvatar
    };
    onUpdateUserData(updated);
    setNotice({ type: 'success', text: 'Đã lưu hồ sơ học viên.' });
  };

  const handlePreviewVoice = () => {
    speechHelper.speak("Hello! Welcome to LingoGoc. Let's practice English together.", {
      rate: userData?.settings?.voiceSpeed || 0.85,
      voicePreset: selectedVoice,
    });
  };

  const handleSaveVoice = () => {
    onUpdateUserData({
      ...userData,
      settings: {
        ...(userData?.settings || {}),
        voicePreset: selectedVoice,
      },
    });
    setNotice({ type: 'success', text: 'Đã lưu giọng đọc cho toàn bộ ứng dụng.' });
  };

  // Xuất file JSON sao lưu
  const handleExportData = () => {
    const backupText = serializeLocalBackup(createLocalBackup());
    const fileName = `lingogoc_backup_${new Date().toISOString().split('T')[0]}.json`;
    if (typeof window !== 'undefined' && typeof window.LingoGocNative?.saveBackup === 'function') {
      window.LingoGocNative.saveBackup(fileName, backupText);
      setNotice({ type: 'success', text: 'Đã gửi bản sao lưu đầy đủ tới trình lưu tệp của thiết bị.' });
      return;
    }
    const objectUrl = URL.createObjectURL(new Blob([backupText], { type: 'application/json' }));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = objectUrl;
    downloadAnchor.download = fileName;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    setNotice({ type: 'success', text: 'Đã tạo bản sao lưu đầy đủ trên thiết bị.' });
  };

  // Nhập file JSON khôi phục
  const handleImportFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      setNotice({ type: 'error', text: 'Tệp sao lưu vượt quá giới hạn 2 MB.' });
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const restored = restoreLocalBackup(parseLocalBackup(e.target.result), { mode: 'merge' });
        onUpdateUserData(restored.userData);
        setName(restored.userData?.name || 'Học Viên LingoGoc');
        setSelectedAvatar(restored.userData?.avatar || '👤');
        setSelectedVoice(restored.userData?.settings?.voicePreset || 'auto');
        setNotice({ type: 'success', text: 'Đã hợp nhất bản sao lưu đầy đủ. Tiến độ hiện có không bị ghi đè bởi dữ liệu cũ hơn.' });
      } catch {
        setNotice({ type: 'error', text: 'Tệp sao lưu không hợp lệ hoặc đã bị hỏng.' });
      } finally {
        event.target.value = '';
      }
    };
    reader.onerror = () => {
      setNotice({ type: 'error', text: 'Không thể đọc tệp sao lưu trên thiết bị này.' });
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (confirm('Xóa toàn bộ tiến độ học và làm lại từ đầu?')) {
      const freshData = resetUserData();
      onUpdateUserData(freshData);
      setNotice({ type: 'success', text: 'Đã đặt lại toàn bộ tiến độ học.' });
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--scrim)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2500,
      padding: '16px'
    }}>
      <div className="card glass-card animate-fade-in" style={{
        maxWidth: '560px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '28px',
        borderRadius: '24px',
        position: 'relative',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)'
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
            cursor: 'pointer'
          }}
        >
          <X size={22} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Settings size={24} color="#38bdf8" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Cài Đặt & Quản Lý Dữ Liệu
          </h2>
        </div>

        {notice && (
          <div className={`settings-notice ${notice.type}`} role="status">
            {notice.text}
          </div>
        )}

        {/* Section 1: User Profile */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Tên học viên (sẽ in trên Chứng Chỉ):
          </label>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập họ tên của bạn..."
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1.5px solid var(--border-color)',
                background: 'var(--surface-soft)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem'
              }}
            />
            <button
              onClick={handleSaveProfile}
              className="btn btn-primary"
              style={{ padding: '0 20px', fontWeight: 700, borderRadius: '12px' }}
            >
              Lưu
            </button>
          </div>

          {/* Avatar Selector */}
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Chọn Avatar đại diện:
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {AVATARS.map((av) => (
              <button
                key={av}
                onClick={() => setSelectedAvatar(av)}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  fontSize: '1.4rem',
                  border: selectedAvatar === av ? '2px solid #38bdf8' : '1px solid var(--border-color)',
                  background: selectedAvatar === av ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {av}
              </button>
            ))}
          </div>
        </div>

        {/* Voice selection */}
        <div style={{
          background: 'var(--surface-soft)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '6px' }}>
            <Volume2 size={18} color="#38bdf8" />
            <span>Giọng đọc tiếng Anh</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
            Áp dụng cho từ vựng, ví dụ và các bài luyện nghe. Giọng thực tế phụ thuộc vào giọng có sẵn trên điện thoại hoặc máy tính.
          </div>
          <select
            value={selectedVoice}
            onChange={(event) => setSelectedVoice(event.target.value)}
            aria-label="Chọn giọng đọc tiếng Anh"
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '12px',
              border: '1.5px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.95rem',
              marginBottom: '8px'
            }}
          >
            {VOICE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>
          <div style={{ minHeight: '38px', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '12px' }}>
            {VOICE_PRESETS.find((preset) => preset.id === selectedVoice)?.description}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handlePreviewVoice}
              className="btn btn-outline"
              style={{ flex: '1 1 150px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Play size={16} />
              Nghe thử
            </button>
            <button
              type="button"
              onClick={handleSaveVoice}
              className="btn btn-primary"
              style={{ flex: '1 1 150px', padding: '10px 14px', fontWeight: 700 }}
            >
              Lưu giọng đọc
            </button>
          </div>
        </div>

        {/* Progress Backup & Restore */}
        <div style={{
          background: 'var(--surface-soft)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '24px'
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '12px' }}>
            Sao lưu & Chuyển đổi thiết bị:
          </div>
          <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>
            Bao gồm tiến độ, SRS, hàng đợi offline, lịch sử kiểm tra và các phiên học. Khi khôi phục, dữ liệu được hợp nhất an toàn với thiết bị hiện tại.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={handleExportData}
              className="btn btn-outline"
              style={{ flex: '1 1 180px', padding: '10px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Download size={16} />
              <span>Xuất Tệp Sao Lưu (.json)</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-outline"
              style={{ flex: '1 1 180px', padding: '10px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Upload size={16} />
              <span>Khôi Phục Dữ Liệu</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".json"
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* Danger Zone */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleResetData}
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              opacity: 0.8
            }}
          >
            <Trash2 size={14} />
            <span>Xóa dữ liệu & làm lại từ đầu</span>
          </button>
        </div>
      </div>
    </div>
  );
}
