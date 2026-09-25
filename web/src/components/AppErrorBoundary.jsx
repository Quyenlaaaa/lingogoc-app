import React from 'react';
import { AlertTriangle, Copy, Home, RefreshCw } from 'lucide-react';

function createErrorId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ui-${Date.now().toString(36)}`;
}
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorId: '' };
  }

  static getDerivedStateFromError(error) {
    return { error, errorId: createErrorId() };
  }

  componentDidCatch(error, info) {
    console.error(JSON.stringify({
      event: 'frontend_render_error',
      errorId: this.state.errorId,
      name: error?.name || 'Error',
      message: String(error?.message || 'Unknown render error').slice(0, 300),
      componentStack: String(info?.componentStack || '').slice(0, 1200),
    }));
  }

  render() {
    if (!this.state.error) return this.props.children;
    const { errorId } = this.state;
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: 'var(--bg-primary, #0f172a)' }}>
        <section className="card glass-card" style={{ width: 'min(560px, 100%)', padding: '32px', textAlign: 'center' }}>
          <AlertTriangle size={52} color="#f59e0b" />
          <h1>Ứng dụng vừa gặp lỗi hiển thị</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Tiến độ đã lưu trên thiết bị không bị xóa. Bạn có thể tải lại hoặc quay về trang chính.
          </p>
          <code style={{ display: 'block', margin: '18px 0', overflowWrap: 'anywhere' }}>Mã lỗi: {errorId}</code>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn btn-outline" onClick={() => navigator.clipboard?.writeText(errorId)}>
              <Copy size={16} /> Sao chép mã lỗi
            </button>
            <button className="btn btn-outline" onClick={() => { window.location.href = window.location.pathname; }}>
              <Home size={16} /> Trang chính
            </button>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              <RefreshCw size={16} /> Tải lại
            </button>
          </div>
        </section>
      </main>
    );
  }
}
