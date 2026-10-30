import { Link, Navigate, useLocation } from 'react-router-dom'

function stampText(pct) {
  if (pct >= 90) return '참 잘했어요'
  if (pct >= 70) return '잘했어요'
  if (pct >= 50) return '조금만 더!'
  return '다시 도전!'
}

export default function Result() {
  const { state: result } = useLocation()
  if (!result) return <Navigate to="/" replace />

  const pct = Math.round((result.correct_count / result.total) * 100)
  const needsReview = result.items.some((x) => x.needs_review)

  return (
    <main className="kid-page result">
      <section className="score-sheet">
        <p className="muted">{result.wordbook_name}</p>
        <p className="score">
          <span className="score-num">{result.correct_count}</span>
          <span className="score-total">/ {result.total}</span>
        </p>
        <p className="score-pct">{pct}점</p>
        <div className={`stamp ${pct >= 70 ? 'stamp-good' : 'stamp-try'}`} aria-label={stampText(pct)}>
          {stampText(pct)}
        </div>
      </section>

      {needsReview && (
        <p className="notice">몇 문제는 자동 채점이 안 됐어요. 선생님이 확인해 주실 거예요.</p>
      )}

      <ol className="marks">
        {result.items.map((x) => (
          <li key={x.id} className={x.is_correct ? 'mark-ok' : 'mark-no'}>
            <span className="mark" aria-label={x.is_correct ? '정답' : '오답'} />
            <span className="mark-word">{x.english}</span>
            <span className={`mark-answer ${x.dont_know || !x.user_answer ? 'mark-blank' : ''}`}>
              {x.dont_know ? '모르겠어요' : x.user_answer || '(빈칸)'}
            </span>
            <span className="mark-key">{x.meanings}</span>
            {x.needs_review && <span className="badge badge-warn">확인 필요</span>}
          </li>
        ))}
      </ol>

      <div className="result-actions">
        <Link to="/exam" className="btn">다른 시험 보기</Link>
        <Link to="/" className="btn btn-soft">처음으로</Link>
      </div>
    </main>
  )
}
