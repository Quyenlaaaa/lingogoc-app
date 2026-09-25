// scoreEvaluator.js - Evaluates pronunciation accuracy and word-level alignment

// Standardize string: lowercase, remove punctuation, normalize spaces
export function cleanText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein distance between two words
export function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],    // deletion
          dp[i][j - 1],    // insertion
          dp[i - 1][j - 1] // substitution
        );
      }
    }
  }
  return dp[m][n];
}

// Word similarity ratio between 0 and 1
export function wordSimilarity(w1, w2) {
  const c1 = cleanText(w1);
  const c2 = cleanText(w2);
  if (c1 === c2) return 1.0;
  if (!c1 || !c2) return 0;
  const maxLen = Math.max(c1.length, c2.length);
  const dist = levenshteinDistance(c1, c2);
  return Math.max(0, 1 - dist / maxLen);
}

// Full evaluation of user speech vs target text
export function evaluatePronunciation(targetText, spokenText) {
  const cleanTarget = cleanText(targetText);
  const cleanSpoken = cleanText(spokenText);

  if (!cleanSpoken) {
    return {
      score: 0,
      feedback: 'Chưa nghe thấy giọng nói của bạn. Vui lòng bấm mic và nói to, rõ ràng hơn nhé!',
      status: 'poor',
      words: cleanTarget.split(' ').map(w => ({ word: w, status: 'missing', score: 0 }))
    };
  }

  const targetWords = cleanTarget.split(' ').filter(Boolean);
  const spokenWords = cleanSpoken.split(' ').filter(Boolean);

  const wordEvaluations = targetWords.map((targetWord) => {
    // Find best match in spoken words
    let bestSim = 0;
    let matchedWord = '';

    for (const spokenWord of spokenWords) {
      const sim = wordSimilarity(targetWord, spokenWord);
      if (sim > bestSim) {
        bestSim = sim;
        matchedWord = spokenWord;
      }
    }

    let status = 'incorrect';
    if (bestSim >= 0.85) {
      status = 'correct'; // green
    } else if (bestSim >= 0.55) {
      status = 'close'; // yellow
    }

    return {
      word: targetWord,
      matchedWith: matchedWord,
      score: Math.round(bestSim * 100),
      status
    };
  });

  // Calculate overall score
  const totalScore = wordEvaluations.reduce((sum, item) => sum + item.score, 0);
  const averageScore = Math.round(totalScore / (targetWords.length || 1));

  let feedback = '';
  let status = 'poor';

  if (averageScore >= 85) {
    feedback = 'Xuất sắc! Phát âm của bạn rất chuẩn và rõ ràng! 🎉👏';
    status = 'excellent';
  } else if (averageScore >= 65) {
    feedback = 'Khá tốt! Bạn đã phát âm đúng phần lớn, hãy chú ý nhấn âm và nhả âm cuối nhé! 👍';
    status = 'good';
  } else if (averageScore >= 40) {
    feedback = 'Đã tiến bộ! Hãy nghe lại mẫu audio và thử phát âm chậm rãi từng từ một nhé. 💪';
    status = 'average';
  } else {
    feedback = 'Đừng nản lòng! Hãy bấm nghe lại audio mẫu ở tốc độ 0.75x rồi đọc to theo nhé! 🌱';
    status = 'poor';
  }

  return {
    score: averageScore,
    feedback,
    status,
    words: wordEvaluations,
    spokenText
  };
}
