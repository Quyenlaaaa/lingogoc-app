import React from 'react';
import { Award, CheckCircle2, Lock, Printer, Share2 } from 'lucide-react';
import { getCertificateProgress } from '../config/features';

export default function CertificateView({ userData }) {
  const studentName = userData?.name || 'Học viên LingoGoc';
  const progress = getCertificateProgress(userData);

  if (!progress.eligible) {
    return (
      <div className="certificate-view animate-fade-in" style={{ maxWidth: '760px', margin: '0 auto', padding: '24px 16px' }}>
        <div className="card glass-card" style={{ padding: '36px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Lock size={34} color="#f59e0b" />
            <div>
              <div className="module-tag">Ghi nhận tiến độ cục bộ</div>
              <h2 style={{ margin: '8px 0 0' }}>Chưa đủ điều kiện hoàn thành lộ trình</h2>
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Bản ghi nhận này chỉ được mở khi bạn hoàn thành các mục dưới đây. Dữ liệu hiện được
            tính trên thiết bị và chưa phải chứng chỉ được xác thực bởi máy chủ.
          </p>
          <div style={{ display: 'grid', gap: '12px', marginTop: '24px' }}>
            {progress.requirements.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)',
                  background: item.complete ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-soft)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {item.complete ? <CheckCircle2 size={18} color="#10b981" /> : <Lock size={18} />}
                  {item.label}
                </span>
                <strong>{Math.min(item.current, item.target)} / {item.target}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const issueDate = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const shareText = `${studentName} đã hoàn thành lộ trình học cốt lõi trên thiết bị LingoGoc.`;

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Hoàn thành lộ trình LingoGoc', text: shareText }).catch(() => {});
      return;
    }
    await navigator.clipboard?.writeText(shareText);
  };

  return (
    <div className="certificate-view animate-fade-in" style={{ maxWidth: '880px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div>
          <div className="module-tag">Hoàn thành trên thiết bị</div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={26} color="#f59e0b" /> Ghi Nhận Hoàn Thành Lộ Trình
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Đây là bản ghi nhận tiến độ cục bộ, không phải chứng chỉ có mã xác thực từ máy chủ.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline" onClick={handleShare}><Share2 size={16} /> Chia sẻ</button>
          <button className="btn btn-primary" onClick={() => window.print()}><Printer size={16} /> In / Lưu PDF</button>
        </div>
      </div>

      <div className="certificate-paper" style={{
        background: 'linear-gradient(145deg, #0f172a, #1e293b)',
        border: '6px double #d97706',
        borderRadius: '24px',
        padding: '48px 40px',
        textAlign: 'center',
        color: '#f8fafc',
      }}>
        <div style={{ fontSize: '2rem' }}>🌱</div>
        <div style={{ letterSpacing: '3px', color: '#f59e0b', fontWeight: 800 }}>LINGOGOC</div>
        <h1 style={{ fontSize: '2.3rem', marginBottom: '8px' }}>RECORD OF COMPLETION</h1>
        <p style={{ color: '#94a3b8' }}>Ghi nhận hoàn thành lộ trình học cốt lõi trên thiết bị</p>
        <div style={{ fontSize: '2.2rem', color: '#38bdf8', fontWeight: 900, margin: '28px 0' }}>
          {studentName}
        </div>
        <p style={{ maxWidth: '620px', margin: '0 auto', lineHeight: 1.7, color: '#cbd5e1' }}>
          Đã hoàn thành các mục tiêu IPA, từ vựng, phản xạ và luyện nói theo dữ liệu tiến độ
          đang lưu trên thiết bị này.
        </p>
        <div style={{ marginTop: '32px', color: '#94a3b8' }}>Ngày ghi nhận: <strong>{issueDate}</strong></div>
        <div style={{ marginTop: '8px', color: '#f59e0b', fontWeight: 800 }}>LOCAL PROGRESS • NOT SERVER VERIFIED</div>
      </div>
    </div>
  );
}
