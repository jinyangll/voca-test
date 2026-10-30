// NF-15: 시험 중 새로고침해도 이어 풀 수 있게 진행 상황을 브라우저에 임시 저장
const KEY = 'voca_exam_progress'

export function loadProgress() {
  try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null }
}

export function saveProgress(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* 저장 불가 환경 */ }
}

export function clearProgress() {
  try { localStorage.removeItem(KEY) } catch { /* 저장 불가 환경 */ }
}
