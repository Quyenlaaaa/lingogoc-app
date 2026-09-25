const QUOTA_PATTERN = /(?:quota|rate.?limit|429)/i;
const NETWORK_PATTERN = /(?:network|fetch|timeout|http_50[234]|backend_unavailable)/i;

export function shouldApplyVocabularyBatchResult(batchVersion, latestManualRetryVersion = 0) {
  return Number(latestManualRetryVersion || 0) <= Number(batchVersion || 0);
}

export function getVocabularyEnrichmentMessage(state) {
  if (!state?.unavailableReason) return '';
  const code = String(state.unavailableCode || state.unavailableReason || '').toUpperCase();
  if (code === 'SYSTEM_ENRICHMENT_PENDING') {
    return 'Hệ thống chưa có đủ 5 ví dụ. Bạn có thể thử lại ngay.';
  }
  if (code === 'RETRY_COOLDOWN' || code === 'ENRICHMENT_COOLDOWN') {
    return 'Lần gọi trước chưa thành công. Hệ thống sẽ tự thử lại sau, hoặc bạn có thể thử thủ công ngay.';
  }
  if (QUOTA_PATTERN.test(code)) {
    return 'Các model miễn phí đang hết hạn mức. Hệ thống sẽ chuyển nhà cung cấp hoặc tự thử lại sau.';
  }
  if (code.includes('INSUFFICIENT_BILINGUAL_EXAMPLES') || code.includes('INVALID_AI_JSON')) {
    return 'AI đã phản hồi nhưng dữ liệu chưa đủ 5 ngữ cảnh hợp lệ. Hãy thử lại sau.';
  }
  if (code.startsWith('AI_PROVIDER_')) {
    return 'Nhà cung cấp AI tạm thời không phản hồi. Bạn có thể thử lại với nhà cung cấp khác.';
  }
  if (NETWORK_PATTERN.test(code)) {
    return 'Kết nối tới API bị gián đoạn hoặc quá thời gian chờ. Vui lòng kiểm tra mạng rồi thử lại.';
  }
  if (code === 'BACKEND_NOT_CONFIGURED') return 'Backend AI chưa được cấu hình.';
  return String(state.unavailableReason || 'Không thể tạo ví dụ vào lúc này.');
}
