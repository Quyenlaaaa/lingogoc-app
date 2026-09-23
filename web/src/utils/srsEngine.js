// srsEngine.js - Thuật toán Lặp lại Ngắt quãng SuperMemo-2 (SM-2 Spaced Repetition)
// Tối ưu hóa ghi nhớ vĩnh viễn 3000 từ vựng Oxford theo đường cong quên lãng Ebbinghaus

const SRS_STORAGE_KEY = 'lingogoc_srs_records_v1';

// Lấy ngày hôm nay định dạng YYYY-MM-DD
export function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

// Tính ngày cộng thêm số ngày (days)
export function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Tải toàn bộ bản ghi SRS từ LocalStorage
export function loadSrsRecords() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SRS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to load SRS records', e);
    return {};
  }
}

// Lưu bản ghi SRS vào LocalStorage
export function saveSrsRecords(records) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save SRS records', e);
  }
}

/**
 * Cập nhật trạng thái từ vựng theo thuật toán SuperMemo-2 (SM-2)
 * @param {number} wordId - ID của từ trong vocabData
 * @param {number} quality - Đánh giá độ nhớ:
 *   1 = "Lại" (Again - Quên hoàn toàn)
 *   2 = "Khó" (Hard - Nhớ nhưng rất khó khăn)
 *   3 = "Tốt" (Good - Nhớ chính xác sau suy nghĩ)
 *   4 = "Dễ" (Easy - Nhớ tức thì, rất tự tin)
 */
export function recordWordReview(wordId, quality) {
  const records = loadSrsRecords();
  const today = getTodayString();

  // Bản ghi hiện tại hoặc giá trị mặc định cho từ mới
  const current = records[wordId] || {
    wordId,
    repetition: 0,
    interval: 0,
    easeFactor: 2.5, // Mặc định trong SM-2
    lastReviewed: null,
    nextReview: today,
    reviewCount: 0
  };

  let repetition = current.repetition;
  let interval = current.interval;
  let easeFactor = current.easeFactor;

  // Thuật toán SM-2:
  if (quality < 3) {
    // Nếu quên hoặc quá khó khăn: Reset lại chuỗi lặp
    repetition = 0;
    interval = 1; // Ôn lại vào ngày mai
  } else {
    // Nếu nhớ tốt hoặc dễ:
    if (repetition === 0) {
      interval = 1; // Lần đầu nhớ: 1 ngày
    } else if (repetition === 1) {
      interval = 3; // Lần 2 nhớ: 3 ngày
    } else if (repetition === 2) {
      interval = 7; // Lần 3 nhớ: 7 ngày
    } else {
      // Các lần sau: nhân theo hệ số Ease Factor
      interval = Math.round(interval * easeFactor);
    }
    repetition += 1;
  }

  // Cập nhật Ease Factor (độ dễ):
  // Công thức chuẩn: EF' = EF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  // Chuyển scale quality 1..4 tương đương 2..5 trong SM-2:
  const sm2Quality = quality + 1; // 1->2, 2->3, 3->4, 4->5
  easeFactor = easeFactor + (0.1 - (5 - sm2Quality) * (0.08 + (5 - sm2Quality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3; // Min ease factor

  // Thưởng thêm ngày cho câu trả lời "Dễ" (quality = 4)
  if (quality === 4) {
    interval = Math.max(interval + 1, Math.round(interval * 1.25));
  }

  const nextReview = addDays(today, interval);

  const updatedRecord = {
    wordId,
    repetition,
    interval,
    easeFactor: Number(easeFactor.toFixed(2)),
    lastReviewed: today,
    nextReview,
    reviewCount: (current.reviewCount || 0) + 1
  };

  records[wordId] = updatedRecord;
  saveSrsRecords(records);
  return updatedRecord;
}

/**
 * Lấy danh sách các từ vựng đến hạn ôn tập hôm nay
 * @param {Array} allWords - Toàn bộ mảng vocabData (3000 từ)
 * @param {number} maxNewWordsPerSession - Số từ mới thêm vào nếu không có từ nào quá hạn (mặc định 15)
 */
export function getDueWords(allWords = [], maxNewWordsPerSession = 15) {
  const records = loadSrsRecords();
  const today = getTodayString();

  const dueList = [];
  const reviewedIds = new Set(Object.keys(records).map(Number));

  // 1. Tìm các từ đã học và đã đến hạn hoặc quá hạn ôn (nextReview <= today)
  allWords.forEach(word => {
    const rec = records[word.id];
    if (rec && rec.nextReview <= today) {
      dueList.push({
        ...word,
        srsRecord: rec,
        isNew: false
      });
    }
  });

  // 2. Nếu danh sách từ đến hạn ít hơn mục tiêu ngày (15 từ), nạp thêm từ mới chưa từng học
  if (dueList.length < maxNewWordsPerSession) {
    const remaining = maxNewWordsPerSession - dueList.length;
    let addedCount = 0;

    for (let i = 0; i < allWords.length && addedCount < remaining; i++) {
      const word = allWords[i];
      if (!reviewedIds.has(word.id)) {
        dueList.push({
          ...word,
          srsRecord: null,
          isNew: true
        });
        addedCount++;
      }
    }
  }

  return dueList;
}

/**
 * Thống kê tổng quan trạng thái SRS
 */
export function getSrsStats(allWords = []) {
  const records = loadSrsRecords();
  const today = getTodayString();

  let dueCount = 0;
  let learningCount = 0; // Đang học (interval < 21 ngày)
  let matureCount = 0;   // Thuộc sâu (interval >= 21 ngày)
  const totalTracked = Object.keys(records).length;

  allWords.forEach(word => {
    const rec = records[word.id];
    if (rec) {
      if (rec.nextReview <= today) {
        dueCount++;
      }
      if (rec.interval >= 21) {
        matureCount++;
      } else {
        learningCount++;
      }
    }
  });

  return {
    dueCount,
    learningCount,
    matureCount,
    totalTracked,
    totalWords: allWords.length
  };
}
