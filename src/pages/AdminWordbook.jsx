import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'

function cleanMeanings(text) {
  return text.split(/[,，]/).map((m) => m.trim()).filter(Boolean).join(', ')
}

// "apple - 사과" / "run - 달리다, 운영하다" / "banana" (뜻 비움)
export function parseLines(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const m = line.match(/^(.+?)\s+-\s*(.*)$/)
    return m
      ? { english: m[1].trim(), meanings: cleanMeanings(m[2]) }
      : { english: line.replace(/\s*-\s*$/, '').trim(), meanings: '' }
  })
}

function WordRow({ word, onSaved, onError }) {
  const [editing, setEditing] = useState(false)
  const [english, setEnglish] = useState(word.english)
  const [meanings, setMeanings] = useState(word.meanings)

  async function save() {
    try {
      await api(`/admin/words/${word.id}`, {
        method: 'PATCH', body: { english, meanings: cleanMeanings(meanings) }, admin: true,
      })
      setEditing(false)
      onSaved()
    } catch (e) { onError(e.message) }
  }

  async function remove() {
    if (!window.confirm(`'${word.english}'을(를) 삭제할까요?`)) return
    try {
      await api(`/admin/words/${word.id}`, { method: 'DELETE', admin: true })
      onSaved()
    } catch (e) { onError(e.message) }
  }

  if (!editing) {
    return (
      <tr>
        <td className="en">{word.english}</td>
        <td>{word.meanings}</td>
        <td className="actions">
          <button className="link-btn" onClick={() => setEditing(true)}>수정</button>
          <button className="link-btn danger" onClick={remove}>삭제</button>
        </td>
      </tr>
    )
  }
  return (
    <tr>
      <td><input value={english} onChange={(e) => setEnglish(e.target.value)} aria-label="영어 단어" /></td>
      <td><input value={meanings} onChange={(e) => setMeanings(e.target.value)} aria-label="뜻" /></td>
      <td className="actions">
        <button className="link-btn" onClick={save} disabled={!english.trim() || !meanings.trim()}>저장</button>
        <button className="link-btn" onClick={() => { setEditing(false); setEnglish(word.english); setMeanings(word.meanings) }}>취소</button>
      </td>
    </tr>
  )
}

function BulkAdd({ wordbookId, onSaved }) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const setRow = (i, key, value) => setRows(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)))
  const blanks = rows?.filter((r) => r.english && !r.meanings.trim()) ?? []

  async function autofill() {
    setBusy(true)
    setError('')
    try {
      const { results } = await api('/admin/autofill', {
        method: 'POST', body: { words: blanks.map((r) => r.english) }, admin: true,
      })
      setRows(rows.map((r) => (!r.meanings.trim() && results[r.english] ? { ...r, meanings: results[r.english] } : r)))
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  async function save() {
    setBusy(true)
    setError('')
    try {
      const words = rows
        .map((r) => ({ english: r.english.trim(), meanings: cleanMeanings(r.meanings) }))
        .filter((r) => r.english)
      await api(`/admin/wordbooks/${wordbookId}/words`, { method: 'POST', body: { words }, admin: true })
      setText('')
      setRows(null)
      onSaved()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  if (!rows) {
    return (
      <section className="panel">
        <h2>단어 추가</h2>
        <p className="muted">한 줄에 하나씩 붙여넣으세요. 뜻이 여러 개면 쉼표로 구분하고, 뜻을 비워두면 자동으로 채울 수 있어요.</p>
        <textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'apple - 사과\nrun - 달리다, 운영하다\nbeautiful -'}
        />
        <button className="btn btn-small" disabled={!text.trim()} onClick={() => setRows(parseLines(text))}>
          확인하기
        </button>
      </section>
    )
  }

  return (
    <section className="panel">
      <h2>추가할 단어 확인 ({rows.length}개)</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>영어</th><th>뜻 (쉼표로 구분)</th><th /></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={r.meanings.trim() ? '' : 'row-warn'}>
                <td><input value={r.english} onChange={(e) => setRow(i, 'english', e.target.value)} aria-label="영어 단어" /></td>
                <td><input value={r.meanings} onChange={(e) => setRow(i, 'meanings', e.target.value)} placeholder="뜻 없음" aria-label="뜻" /></td>
                <td><button className="link-btn danger" onClick={() => setRows(rows.filter((_, j) => j !== i))}>빼기</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row-gap">
        <button className="btn btn-small btn-soft" onClick={() => setRows(null)} disabled={busy}>다시 붙여넣기</button>
        {blanks.length > 0 && (
          <button className="btn btn-small btn-soft" onClick={autofill} disabled={busy}>
            {busy ? '채우는 중…' : `뜻 자동 채우기 (${blanks.length}개)`}
          </button>
        )}
        <button
          className="btn btn-small"
          onClick={save}
          disabled={busy || rows.length === 0 || rows.some((r) => !r.english.trim() || !r.meanings.trim())}
        >
          단어 저장
        </button>
      </div>
      {rows.some((r) => !r.meanings.trim()) && <p className="muted">뜻이 빈 단어가 있으면 저장할 수 없어요.</p>}
    </section>
  )
}

export default function AdminWordbook() {
  const { id } = useParams()
  const [book, setBook] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api(`/admin/wordbooks/${id}`, { admin: true }).then(setBook).catch((e) => setError(e.message))
  }, [id])
  useEffect(load, [load])

  if (!book) return error ? <p className="error">{error}</p> : <p className="muted">불러오는 중…</p>

  return (
    <>
      <Link to="/admin" className="back-link">단어장 목록</Link>
      <h1 className="admin-title">
        {book.name}
        <span className={`badge ${book.is_active ? 'badge-on' : ''}`}>{book.is_active ? '공개 중' : '비공개'}</span>
      </h1>
      <p className="muted">
        단어 {book.words.length}개 · 문제당 {book.time_limit}초 ·{' '}
        <Link to={`/admin/attempts?wordbook=${book.id}`}>응시 기록 보기</Link>
      </p>
      {error && <p className="error">{error}</p>}

      <BulkAdd wordbookId={book.id} onSaved={load} />

      {book.words.length > 0 && (
        <section className="panel">
          <h2>단어 목록</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>영어</th><th>뜻</th><th /></tr></thead>
              <tbody>
                {book.words.map((w) => (
                  <WordRow key={`${w.id}-${w.english}-${w.meanings}`} word={w} onSaved={load} onError={setError} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
