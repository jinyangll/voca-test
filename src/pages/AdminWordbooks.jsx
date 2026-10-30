import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, formatDate } from '../api'

export default function AdminWordbooks() {
  const [books, setBooks] = useState(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api('/admin/wordbooks', { admin: true }).then(setBooks).catch((e) => setError(e.message))
  }, [])
  useEffect(load, [load])

  async function run(fn) {
    setError('')
    try { await fn(); load() } catch (e) { setError(e.message) }
  }

  const create = (e) => {
    e.preventDefault()
    run(async () => {
      await api('/admin/wordbooks', { method: 'POST', body: { name }, admin: true })
      setName('')
    })
  }

  const patch = (b, body) => run(() => api(`/admin/wordbooks/${b.id}`, { method: 'PATCH', body, admin: true }))

  const rename = (b) => {
    const next = window.prompt('새 단어장 이름', b.name)?.trim()
    if (next && next !== b.name) patch(b, { name: next })
  }

  const copy = (b) => {
    const next = window.prompt('복사해서 만들 단어장 이름', `${b.name} (복사본)`)?.trim()
    if (next) run(() => api(`/admin/wordbooks/${b.id}/copy`, { method: 'POST', body: { name: next }, admin: true }))
  }

  const remove = (b) => {
    if (window.confirm(`'${b.name}' 단어장을 삭제할까요? 응시 기록은 남습니다.`)) {
      run(() => api(`/admin/wordbooks/${b.id}`, { method: 'DELETE', admin: true }))
    }
  }

  const setTimeLimit = (b, value) => {
    const n = Number(value)
    if (n !== b.time_limit && n >= 3 && n <= 120) patch(b, { time_limit: n })
  }

  return (
    <>
      <h1 className="admin-title">단어장</h1>
      <form className="inline-form" onSubmit={create}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="새 단어장 이름 (예: 10월 5주차)" />
        <button className="btn btn-small" disabled={!name.trim()}>단어장 만들기</button>
      </form>
      {error && <p className="error">{error}</p>}

      {books?.length === 0 && <p className="empty">단어장이 없습니다. 위에서 첫 단어장을 만드세요.</p>}
      {books?.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>학생에게 공개</th><th>이름</th><th>단어 수</th><th>문제당 시간(초)</th><th>만든 날</th><th />
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.id} className={b.is_active ? 'row-on' : ''}>
                  <td>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={b.is_active}
                        onChange={(e) => patch(b, { is_active: e.target.checked })}
                        aria-label={`${b.name} 공개`}
                      />
                      <span />
                    </label>
                  </td>
                  <td><Link to={`/admin/wordbooks/${b.id}`} className="strong-link">{b.name}</Link></td>
                  <td>{b.word_count}</td>
                  <td>
                    <input
                      type="number" min="3" max="120" className="num-input"
                      defaultValue={b.time_limit} key={b.time_limit}
                      onBlur={(e) => setTimeLimit(b, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      aria-label={`${b.name} 문제당 시간`}
                    />
                  </td>
                  <td className="muted">{formatDate(b.created_at)}</td>
                  <td className="actions">
                    <Link to={`/admin/attempts?wordbook=${b.id}`}>기록</Link>
                    <button className="link-btn" onClick={() => rename(b)}>이름 변경</button>
                    <button className="link-btn" onClick={() => copy(b)}>복사</button>
                    <button className="link-btn danger" onClick={() => remove(b)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
