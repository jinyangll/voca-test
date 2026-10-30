import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, formatDate } from '../api'

export default function AdminAttempts() {
  const [params] = useSearchParams()
  const wordbookId = params.get('wordbook')
  const [attempts, setAttempts] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const q = wordbookId ? `?wordbook_id=${wordbookId}` : ''
    api(`/admin/attempts${q}`, { admin: true }).then(setAttempts).catch((e) => setError(e.message))
  }, [wordbookId])

  return (
    <>
      <h1 className="admin-title">응시 기록</h1>
      {wordbookId && attempts?.[0] && (
        <p className="muted">
          {attempts[0].wordbook_name} 기록만 보는 중 · <Link to="/admin/attempts">전체 보기</Link>
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {attempts?.length === 0 && <p className="empty">아직 응시 기록이 없습니다.</p>}
      {attempts?.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>응시 일시</th><th>단어장</th><th>점수</th><th>확인할 것</th><th /></tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id}>
                  <td>{formatDate(a.finished_at)}</td>
                  <td>{a.wordbook_name}</td>
                  <td className="en">
                    {a.correct_count} / {a.total}{' '}
                    <span className="muted">({Math.round((a.correct_count / a.total) * 100)}%)</span>
                  </td>
                  <td>
                    {a.needs_review && <span className="badge badge-warn">채점 확인 필요</span>}
                    {a.left_tab_count > 0 && <span className="badge badge-alert">탭 이탈 {a.left_tab_count}문항</span>}
                  </td>
                  <td><Link to={`/admin/attempts/${a.id}`} className="strong-link">자세히</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
