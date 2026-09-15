// CertificateView.jsx - Chứng Chỉ Tốt Nghiệp Năng Lực Quốc Tế (Certificate of Completion)
import React, { useState } from 'react';
import { 
  Award, 
  Printer, 
  Share2, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle, 
  Crown,
  Download
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CertificateView({ userData }) {
  const studentName = userData?.name || 'Học Viên Xuất Sắc';
  const certificateId = `LG-AI-${(userData?.xp || 789).toString().padStart(6, '0')}`;
  const issueDate = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const handlePrint = () => {
    try {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    } catch (e) {}
    window.print();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Chứng chỉ tốt nghiệp LingoGoc AI',
        text: `Tôi vừa hoàn thành xuất sắc Khóa học Tiếng Anh Cho Người Mất Gốc trên LingoGoc AI với mã chứng chỉ ${certificateId}!`,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`Tôi vừa hoàn thành xuất sắc Khóa học Tiếng Anh Cho Người Mất Gốc trên LingoGoc AI! Mã chứng chỉ: ${certificateId}`);
      alert('Đã sao chép nội dung chia sẻ vào bộ nhớ tạm!');
    }
  };

  return (
    <div className="certificate-view animate-fade-in" style={{ maxWidth: '880px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Top Actions Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={26} color="#f59e0b" />
            <span>Chứng Chỉ Năng Lực Tốt Nghiệp</span>
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Ghi nhận nỗ lực vượt qua lộ trình xóa mất gốc và làm chủ phản xạ giao tiếp
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleShare}
            className="btn btn-outline"
            style={{ padding: '10px 18px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Share2 size={16} />
            <span>Chia Sẻ</span>
          </button>
          <button
            onClick={handlePrint}
            className="btn btn-primary"
            style={{
              padding: '10px 22px',
              fontSize: '0.9rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: 'none'
            }}
          >
            <Printer size={16} />
            <span>In / Lưu PDF</span>
          </button>
        </div>
      </div>

      {/* Main Certificate Frame (Printable Area) */}
      <div className="certificate-paper" style={{
        background: 'linear-gradient(145deg, #0f172a, #1e293b)',
        border: '6px double #d97706',
        borderRadius: '24px',
        padding: '48px 40px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        position: 'relative',
        textAlign: 'center',
        overflow: 'hidden'
      }}>
        {/* Decorative Inner Border */}
        <div style={{
          position: 'absolute',
          top: '12px', left: '12px', right: '12px', bottom: '12px',
          border: '1px dashed rgba(245, 158, 11, 0.35)',
          borderRadius: '16px',
          pointerEvents: 'none'
        }} />

        {/* Certificate Header Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ fontSize: '2rem' }}>🌱</div>
          <div style={{ letterSpacing: '4px', fontSize: '0.9rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>
            LINGOGOC AI EDUCATIONAL ACADEMY
          </div>
        </div>

        <h1 style={{
          fontSize: '2.6rem',
          fontWeight: 900,
          color: '#f8fafc',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          margin: '0 0 4px 0',
          fontFamily: 'serif'
        }}>
          CERTIFICATE OF COMPLETION
        </h1>
        <div style={{ fontSize: '1.1rem', color: '#94a3b8', fontStyle: 'italic', marginBottom: '28px' }}>
          Chứng Chỉ Hoàn Thành Khóa Học Tiếng Anh Cho Người Mất Gốc
        </div>

        <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Chứng nhận danh dự này được trao tặng cho:
        </div>

        {/* Student Name */}
        <div style={{
          fontSize: '2.4rem',
          fontWeight: 900,
          color: '#38bdf8',
          margin: '8px 0 20px 0',
          textDecoration: 'underline',
          textUnderlineOffset: '8px',
          textDecorationColor: '#f59e0b',
          fontFamily: 'sans-serif'
        }}>
          {studentName}
        </div>

        <p style={{
          fontSize: '1rem',
          color: '#cbd5e1',
          maxWidth: '640px',
          margin: '0 auto 32px',
          lineHeight: '1.7'
        }}>
          Đã nỗ lực rèn luyện và hoàn thành xuất sắc toàn bộ 4 chặng học cốt lõi: 
          <strong> Xóa mù 44 âm ngữ âm IPA</strong>, làm chủ <strong>3000 từ vựng Oxford thông dụng</strong>, 
          phản xạ thành thạo <strong>50 mẫu câu 3 giây</strong> và vượt qua các thử thách đối thoại thực chiến cùng <strong>Gia sư AI</strong>.
        </p>

        {/* 3 Skill Proof Pills */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '36px' }}>
          <span style={{ padding: '6px 16px', borderRadius: '20px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', color: '#38bdf8', fontSize: '0.85rem', fontWeight: 600 }}>
            ✓ Trình Độ: A2 Giao Tiếp
          </span>
          <span style={{ padding: '6px 16px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>
            ✓ Điểm Tích Lũy: {userData?.xp || 500} XP
          </span>
          <span style={{ padding: '6px 16px', borderRadius: '20px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 }}>
            ✓ Chuỗi Ngày Học: {userData?.streak || 7} ngày
          </span>
        </div>

        {/* Footer Signatures & Official Stamp */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '20px', padding: '0 20px', flexWrap: 'wrap', gap: '20px' }}>
          {/* Left: Issue Date & Cert ID */}
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Ngày cấp: <strong>{issueDate}</strong></div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Mã xác thực: <strong style={{ color: '#38bdf8' }}>{certificateId}</strong></div>
          </div>

          {/* Center: Gold Stamp */}
          <div style={{
            width: '88px',
            height: '88px',
            borderRadius: '50%',
            border: '3px dashed #f59e0b',
            background: 'rgba(245, 158, 11, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f59e0b',
            fontWeight: 800,
            fontSize: '0.65rem',
            textAlign: 'center',
            boxShadow: '0 0 20px rgba(245, 158, 11, 0.2)'
          }}>
            <ShieldCheck size={28} />
            <span>BẢO CHỨNG</span>
            <span>VERIFIED</span>
          </div>

          {/* Right: Signature */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontStyle: 'italic', color: '#38bdf8', fontSize: '1.2rem', fontFamily: 'serif', marginBottom: '4px' }}>
              Lily Nguyen
            </div>
            <div style={{ height: '1px', width: '140px', background: '#94a3b8', margin: '4px 0 4px auto' }} />
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
              Hội Đồng Đào Tạo LingoGoc AI
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
