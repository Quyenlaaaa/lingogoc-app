import { useCallback, useState } from 'react';
import { getBackendUrl, readBackendError, readJsonResponse } from '../utils/backendApi.js';

export default function VocabularyAdminView() {
  const [adminKey, setAdminKey] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [correctionJson, setCorrectionJson] = useState('');
  const [offset, setOffset] = useState(0);
  const pageSize = 25;

  const request = useCallback(async (path, options = {}) => {
    if (!adminKey) throw new Error('Nhập khóa quản trị cho phiên làm việc này.');
    const response = await fetch(getBackendUrl(path), {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${adminKey}`,
        ...options.headers,
      },
    });
    if (!response.ok) throw new Error(await readBackendError(response, 'Không thể tải dữ liệu quản trị.'));
    return readJsonResponse(response);
  }, [adminKey]);

  const refresh = useCallback(async (targetOffset = offset) => {
    setLoading(true);
    setError('');
    try {
      const payload = await request(`/api/admin/vocabulary?limit=${pageSize}&offset=${targetOffset}`);
      setData(payload?.data || null);
      setOffset(targetOffset);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [offset, request]);

  const queueRetry = async (word) => {
    setError('');
    try {
      await request('/api/admin/vocabulary/retry', {
        method: 'POST',
        body: JSON.stringify({ word }),
      });
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const saveCorrection = async () => {
    setError('');
    try {
      const correction = JSON.parse(correctionJson);
      await request('/api/admin/vocabulary/correction', {
        method: 'POST',
        body: JSON.stringify(correction),
      });
      setCorrectionJson('');
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof SyntaxError ? 'JSON chỉnh sửa không hợp lệ.' : requestError.message);
    }
  };

  return (
    <section className="vocab-admin" aria-labelledby="vocab-admin-title">
      <header className="vocab-admin-header">
        <div>
          <p className="eyebrow">Operator only</p>
          <h1 id="vocab-admin-title">Quản trị kho từ vựng</h1>
          <p>Khóa chỉ được giữ trong bộ nhớ của tab và mất khi tải lại trang.</p>
        </div>
        <button type="button" className="btn" onClick={() => { setAdminKey(''); setData(null); }}>Khóa phiên</button>
      </header>

      <div className="vocab-admin-auth">
        <label htmlFor="admin-key">Khóa quản trị</label>
        <input id="admin-key" type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} autoComplete="off" />
        <button type="button" className="btn btn-primary" disabled={loading || !adminKey} onClick={() => refresh(0)}>
          {loading ? 'Đang tải…' : 'Tải trạng thái'}
        </button>
      </div>

      {error && <p className="vocab-admin-error" role="alert">{error}</p>}
      {data && (
        <>
          <div className="vocab-admin-stats">
            <article><strong>{data.enrichmentCounts?.complete || 0}</strong><span>Hoàn chỉnh</span></article>
            <article><strong>{data.enrichmentCounts?.partial || 0}</strong><span>Chưa đủ</span></article>
            <article><strong>{data.jobCounts?.retry_pending || 0}</strong><span>Chờ thử lại</span></article>
            <article><strong>{data.manualReview?.length || 0}</strong><span>Cần duyệt</span></article>
          </div>

          <div className="vocab-admin-list">
            <h2>Từ cần xử lý</h2>
            {[...(data.manualReview || []), ...(data.issues || [])].map((item) => (
              <article key={`${item.word}-${item.reason || item.status}`}>
                <div><strong>{item.word}</strong><span>{item.reason || `${item.example_count || 0}/5 ví dụ`}</span></div>
                <button type="button" className="btn" onClick={() => queueRetry(item.word)}>Xếp hàng thử lại</button>
              </article>
            ))}
            {!data.manualReview?.length && !data.issues?.length && <p>Không có bản ghi cần xử lý trong trang này.</p>}
            <div className="vocab-admin-pagination">
              <button type="button" className="btn" disabled={loading || offset === 0} onClick={() => refresh(Math.max(0, offset - pageSize))}>Trang trước</button>
              <span>Trang {Math.floor(offset / pageSize) + 1}</span>
              <button type="button" className="btn" disabled={loading || ((data.manualReview?.length || 0) + (data.issues?.length || 0)) < pageSize} onClick={() => refresh(offset + pageSize)}>Trang sau</button>
            </div>
          </div>

          <div className="vocab-admin-correction">
            <h2>Sửa thủ công đã kiểm định</h2>
            <p>JSON phải có word, enrichment.primaryMeaningVi và đúng 5 contextExamples khác nhau.</p>
            <textarea value={correctionJson} onChange={(event) => setCorrectionJson(event.target.value)} rows="10" spellCheck="false" />
            <button type="button" className="btn btn-primary" disabled={!correctionJson.trim()} onClick={saveCorrection}>Kiểm định và lưu</button>
          </div>
        </>
      )}
    </section>
  );
}
