import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, formatDate } from '../api'

const METHOD_LABEL = { rule: '규칙', llm: 'AI', manual: '선생님' }

export default function AdminAttempt() {
  const { id } = useParams()
  const [attempt, setAttempt] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api(`/admin/attempts/${id}`, { admin: true }).then(setAttempt).catch((e) => setError(e.message))
  }, [id])

  async function setCorrect(answer, isCorrect) {
    setError('')
    try {
      setAttempt(await api(`/admin/answers/${answer.id}`, {
        method: 'PATCH', body: { is_correct: isCorrect }, admin: true,
      }))
    } catch (e) { setError(e.message) }
  }

  if (!attempt) return error ? <p className="error">{error}</p> : <p className="muted">불러오는 중…</p>

  return (
    <>
      <Link to="/admin/attempts" className="back-link">응시 기록 목록</Link>
      <h1 className="admin-title">{attempt.wordbook_name}</h1>
      <p className="muted">
        {formatDate(attempt.finished_at)} · <b className="en">{attempt.correct_count} / {attempt.total}</b>
        {' '}({Math.round((attempt.correct_count / attempt.total) * 100)}%)
      </p>
      {error && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>영어</th><th>학생 답</th><th>등록된 뜻</th><th>채점</th><th>판정 이유</th><th>정정</th></tr>
          </thead>
          <tbody>
            {attempt.answers.map((x) => (
              <tr key={x.id} className={x.needs_review ? 'row-warn' : ''}>
                <td className="en">
                  {x.english}
                  {x.left_tab && <span className="badge badge-alert">탭 이탈</span>}
                </td>
                <td>{x.dont_know ? <span className="muted">모르겠어요</span> : x.user_answer || <span className="muted">(빈칸)</span>}</td>
                <td>{x.meanings}</td>
                <td>
                  <span className={x.is_correct ? 'ok' : 'no'}>{x.is_correct ? '정답' : '오답'}</span>
                  <span className="muted"> · {METHOD_LABEL[x.method]}</span>
                  {x.needs_review && <span className="badge badge-warn">확인 필요</span>}
                </td>
                <td className="muted small">{x.reason}</td>
                <td className="actions">
                  <button className="link-btn" disabled={x.is_correct && !x.needs_review} onClick={() => setCorrect(x, true)}>정답</button>
                  <button className="link-btn danger" disabled={!x.is_correct && !x.needs_review} onClick={() => setCorrect(x, false)}>오답</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
