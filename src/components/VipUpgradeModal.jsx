// VipUpgradeModal.jsx - Nâng cấp tài khoản VIP Pro & Cổng thanh toán VietQR tự động
import React, { useState } from 'react';
import { 
  Crown, 
  Check, 
  X, 
  Sparkles, 
  QrCode, 
  Copy, 
  CheckCircle2, 
  ShieldCheck, 
  Zap,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function VipUpgradeModal({ isOpen, onClose, userData, onUpdateUserData }) {
  const [selectedPlan, setSelectedPlan] = useState('lifetime'); // 'monthly', 'lifetime'
  const [isQrStep, setIsQrStep] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const plans = {
    monthly: {
      id: 'monthly',
      name: 'Gói VIP Tháng',
      price: 99000,
      priceFormatted: '99.000đ',
      period: '/ tháng',
      desc: 'Luyện tập linh hoạt hàng tháng, hủy bất kỳ lúc nào',
      code: 'LINGO THANG'
    },
    lifetime: {
      id: 'lifetime',
      name: 'Gói VIP Trọn Đời',
      price: 599000,
      priceFormatted: '599.000đ',
      period: 'mãi mãi (Ưu đãi 70%)',
      desc: 'Mở khóa toàn bộ tính năng và cập nhật trọn đời',
      code: 'LINGO TRON DOI',
      isPopular: true
    }
  };

  const currentPlan = plans[selectedPlan];
  const qrCodeUrl = `https://img.vietqr.io/image/MB-0345678999-compact2.png?amount=${currentPlan.price}&addInfo=${encodeURIComponent(currentPlan.code)}&accountName=LINGOGOC%20AI%20EDTECH`;

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleConfirmPayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      const updated = {
        ...userData,
        isVip: true,
        vipPlan: selectedPlan,
        vipActivatedAt: new Date().toISOString()
      };
      onUpdateUserData(updated);
      try {
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.5 }
        });
      } catch (e) {}
      onClose();
      alert('🎉 Chúc mừng bạn đã nâng cấp thành công tài khoản VIP Pro! Toàn bộ quyền lợi cao cấp đã được kích hoạt!');
    }, 1200);
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
      zIndex: 2000,
      padding: '16px'
    }}>
      <div className="card glass-card animate-fade-in" style={{
        maxWidth: '680px',
        width: '100%',
        maxHeight: '92vh',
        overflowY: 'auto',
        padding: '32px',
        borderRadius: '24px',
        border: '1.5px solid rgba(245, 158, 11, 0.4)',
        position: 'relative',
        background: 'var(--bg-card)'
      }}>
        {/* Close button */}
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

        {!isQrStep ? (
          // Bước 1: Chọn gói học & So sánh quyền lợi
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                display: 'inline-flex',
                padding: '16px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                marginBottom: '12px'
              }}>
                <Crown size={42} />
              </div>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                Nâng Cấp LingoGoc VIP Pro
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '460px', margin: '0 auto' }}>
                Bứt phá phản xạ giao tiếp không giới hạn cùng trợ lý ảo AI và trọn bộ 3000 từ vựng Oxford
              </p>
            </div>

            {/* Plan Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {/* Monthly Plan */}
              <div
                onClick={() => setSelectedPlan('monthly')}
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  border: `2px solid ${selectedPlan === 'monthly' ? '#f59e0b' : 'var(--border-color)'}`,
                  background: selectedPlan === 'monthly' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {plans.monthly.name}
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f59e0b' }}>
                  {plans.monthly.priceFormatted} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{plans.monthly.period}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  {plans.monthly.desc}
                </div>
              </div>

              {/* Lifetime Plan */}
              <div
                onClick={() => setSelectedPlan('lifetime')}
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  border: `2px solid ${selectedPlan === 'lifetime' ? '#f59e0b' : 'var(--border-color)'}`,
                  background: selectedPlan === 'lifetime' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '16px',
                  background: 'linear-gradient(90deg, #ef4444, #f59e0b)',
                  color: '#fff',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '2px 10px',
                  borderRadius: '10px'
                }}>
                  TIẾT KIỆM 70% 🔥
                </span>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {plans.lifetime.name}
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f59e0b' }}>
                  {plans.lifetime.priceFormatted} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{plans.lifetime.period}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  {plans.lifetime.desc}
                </div>
              </div>
            </div>

            {/* VIP Features Checklist */}
            <div style={{
              background: 'var(--surface-soft)',
              padding: '18px 20px',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              marginBottom: '28px'
            }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '12px' }}>
                Đặc quyền thành viên VIP Pro:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="#10b981" /> Mở khóa trọn bộ 3000 từ vựng Oxford
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="#10b981" /> Luyện nói AI không giới hạn lượt/ngày
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="#10b981" /> Báo cáo sửa ngữ pháp tiếng Việt từ Gemini
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="#10b981" /> Chứng chỉ tốt nghiệp bản quyền có mã xác thực
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="#10b981" /> Huy hiệu VIP Hoàng Gia trên Bảng Xếp Hạng
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="#10b981" /> Hỗ trợ học viên 1-1 qua Zalo/Hotline
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={() => setIsQrStep(true)}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '1.1rem',
                fontWeight: 800,
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)'
              }}
            >
              <span>Thanh Toán Ngay Bằng VietQR ({currentPlan.priceFormatted})</span>
              <ArrowRight size={20} />
            </button>
          </div>
        ) : (
          // Bước 2: Quét mã VietQR chuẩn Napas 247
          <div className="animate-fade-in" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              <QrCode size={24} color="#f59e0b" />
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Quét Mã VietQR Kích Hoạt Trong 3 Giây
              </h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Mở ứng dụng ngân hàng bất kỳ (Vietcombank, MB, Techcombank, Momo...) để quét mã
            </p>

            {/* VietQR Dynamic Image */}
            <div style={{
              background: '#fff',
              padding: '14px',
              borderRadius: '20px',
              display: 'inline-block',
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
              marginBottom: '20px'
            }}>
              <img
                src={qrCodeUrl}
                alt="VietQR Payment"
                style={{ width: '220px', height: '220px', display: 'block' }}
              />
            </div>

            {/* Payment Details Box */}
            <div style={{
              background: 'var(--surface-soft)',
              padding: '16px',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              textAlign: 'left',
              marginBottom: '24px',
              maxWidth: '480px',
              margin: '0 auto 24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Ngân hàng:</span>
                <strong style={{ color: 'var(--text-primary)' }}>MB Bank (Quân Đội)</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Số tài khoản:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <strong style={{ color: '#38bdf8', fontSize: '1rem' }}>0345678999</strong>
                  <button
                    onClick={() => handleCopy('0345678999', 'stk')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    title="Sao chép"
                  >
                    {copiedField === 'stk' ? <CheckCircle2 size={15} color="#10b981" /> : <Copy size={15} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Chủ tài khoản:</span>
                <strong style={{ color: 'var(--text-primary)' }}>LINGOGOC AI EDTECH</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Số tiền:</span>
                <strong style={{ color: '#f59e0b', fontSize: '1.1rem' }}>{currentPlan.priceFormatted}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Nội dung chuyển:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <strong style={{ color: '#10b981' }}>{currentPlan.code}</strong>
                  <button
                    onClick={() => handleCopy(currentPlan.code, 'code')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    title="Sao chép"
                  >
                    {copiedField === 'code' ? <CheckCircle2 size={15} color="#10b981" /> : <Copy size={15} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                onClick={() => setIsQrStep(false)}
                className="btn btn-outline"
                style={{ padding: '12px 20px', fontSize: '0.9rem' }}
              >
                Chọn Lại Gói
              </button>

              <button
                onClick={handleConfirmPayment}
                disabled={isProcessing}
                className="btn btn-primary"
                style={{
                  padding: '12px 28px',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none'
                }}
              >
                {isProcessing ? 'Đang kích hoạt...' : 'Tôi Đã Chuyển Khoản Thành Công'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
