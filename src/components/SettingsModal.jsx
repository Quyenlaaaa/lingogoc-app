// SettingsModal.jsx - Cài đặt tài khoản, tùy chỉnh Avatar và sao lưu/khôi phục dữ liệu
import React, { useState, useRef } from 'react';
import { 
  Settings, 
  Download, 
  Upload, 
  Trash2, 
  X, 
  Crown
} from 'lucide-react';
import { loadUserData, saveUserData, resetUserData } from '../utils/storage';
import {
  clearPrivateVocabulary,
  downloadVocabulary,
  getVocabularyMeta,
  parseVocabularyFile,
  savePrivateVocabulary,
} from '../utils/privateVocabulary';

const AVATARS = ['👤', '🦁', '🦄', '👑', '🌸', '🚀', '🐱', '⚽', '🎸', '⚡', '🦅', '💎'];

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  userData, 
  onUpdateUserData, 
  onOpenVipModal,
  vocabulary = [],
  usesPrivateVocabulary = false,
  onVocabularyChange,
}) {
  const [name, setName] = useState(userData?.name || 'Học Viên LingoGoc');
  const [selectedAvatar, setSelectedAvatar] = useState(userData?.avatar || '👤');
  const fileInputRef = useRef(null);
  const vocabInputRef = useRef(null);
  const [notice, setNotice] = useState(null);
  const vocabularyMeta = getVocabularyMeta(vocabulary, usesPrivateVocabulary);

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

  // Xuất file JSON sao lưu
  const handleExportData = () => {
    const fullData = loadUserData();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `lingogoc_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Nhập file JSON khôi phục
  const handleImportFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (importedData && typeof importedData.xp === 'number') {
          saveUserData(importedData);
          onUpdateUserData(importedData);
          alert('Khôi phục dữ liệu thành công!');
          onClose();
        } else {
          alert('Tệp dữ liệu không hợp lệ!');
        }
      } catch (err) {
        alert('Lỗi khi đọc tệp dữ liệu: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (confirm('Xóa toàn bộ tiến độ học? Kho từ vựng cá nhân của bạn vẫn được giữ lại.')) {
      const freshData = resetUserData();
      onUpdateUserData(freshData);
      setNotice({ type: 'success', text: 'Đã đặt lại tiến độ. Kho từ riêng vẫn an toàn.' });
    }
  };

  const handleImportVocabulary = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const words = parseVocabularyFile(await file.text(), file.name);
      const savedWords = savePrivateVocabulary(words);
      onVocabularyChange?.(savedWords, true);
      setNotice({ type: 'success', text: `Đã nhập ${savedWords.length.toLocaleString('vi-VN')} từ vào kho riêng trên thiết bị này.` });
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Không thể đọc tệp từ vựng.' });
    } finally {
      event.target.value = '';
    }
  };

  const handleClearVocabulary = () => {
    if (!confirm('Xóa kho từ cá nhân trên trình duyệt này và quay về dữ liệu mẫu?')) return;
    clearPrivateVocabulary();
    window.location.reload();
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

        {/* Section 2: VIP Status */}
        <div style={{
          background: userData?.isVip ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
          border: `1px solid ${userData?.isVip ? '#10b981' : '#f59e0b'}`,
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: userData?.isVip ? '#10b981' : '#f59e0b' }}>
              <Crown size={18} />
              <span>{userData?.isVip ? 'Tài Khoản VIP Pro Đã Kích Hoạt' : 'Tài Khoản Miễn Phí (Free)'}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {userData?.isVip ? 'Bạn đang có toàn quyền sử dụng tất cả tính năng cao cấp.' : 'Nâng cấp để mở khóa 3000 từ và AI luyện nói không giới hạn.'}
            </div>
          </div>

          {!userData?.isVip && onOpenVipModal && (
            <button
              onClick={() => { onClose(); onOpenVipModal(); }}
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: 700, borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none' }}
            >
              Nâng Cấp
            </button>
          )}
        </div>

        {/* Section 3: Private vocabulary */}
        <section className="private-data-card">
          <div className="private-data-heading">
            <div>
              <span className="eyebrow">Kho dữ liệu cá nhân</span>
              <h3>{vocabularyMeta.count.toLocaleString('vi-VN')} từ · {vocabularyMeta.topics} chủ đề</h3>
            </div>
            <span className={`data-source-badge ${usesPrivateVocabulary ? 'private' : ''}`}>
              {usesPrivateVocabulary ? 'Chỉ lưu trên máy' : 'Dữ liệu mẫu'}
            </span>
          </div>
          <p>
            Nhập tệp JSON hoặc CSV. Dữ liệu được lưu trong trình duyệt của bạn, không tải lên máy chủ và không nằm trong Git.
          </p>
          <div className="private-data-actions">
            <button className="btn btn-primary" onClick={() => vocabInputRef.current?.click()}>
              <Upload size={16} /> Nhập kho từ riêng
            </button>
            <button className="btn btn-outline" onClick={() => downloadVocabulary(vocabulary)} disabled={!vocabulary.length}>
              <Download size={16} /> Xuất kho hiện tại
            </button>
            {usesPrivateVocabulary && (
              <button className="btn btn-quiet-danger" onClick={handleClearVocabulary}>
                <Trash2 size={16} /> Xóa kho riêng
              </button>
            )}
          </div>
          <input ref={vocabInputRef} type="file" accept=".json,.csv,text/csv,application/json" onChange={handleImportVocabulary} hidden />
          <details className="data-format-help">
            <summary>Định dạng dữ liệu hỗ trợ</summary>
            <code>word, meaning, ipa, level, topic, example, exampleVi</code>
            <span>Chỉ bắt buộc hai cột <b>word</b> và <b>meaning</b>.</span>
          </details>
        </section>

        {/* Section 4: Progress Backup & Restore */}
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
