import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { loadProgress } from '../progress'

export default function ExamSelect() {
  const [books, setBooks] = useState(null)
  const [error, setError] = useState('')
  const saved = loadProgress()

  useEffect(() => {
    api('/exam/wordbooks').then(setBooks).catch((e) => setError(e.message))
  }, [])

  return (
    <main className="kid-page">
      <Link to="/" className="back-link">처음으로</Link>
      <h1 className="page-title">어떤 단어장을 풀까요?</h1>

      {saved && (
        <Link to={`/exam/${saved.wordbookId}`} className="resume">
          <span>풀던 시험이 있어요: <b>{saved.name}</b> ({saved.index}/{saved.words.length})</span>
          <span className="btn btn-small">이어 풀기</span>
        </Link>
      )}

      {error && <p className="error">{error}</p>}
      {books === null && !error && <p className="muted center">불러오는 중…</p>}
      {books?.length === 0 && (
        <p className="empty">아직 풀 수 있는 단어장이 없어요.<br />선생님이 단어장을 열어 주시면 여기에 나타나요.</p>
      )}

      <ul className="book-list">
        {books?.map((b) => (
          <li key={b.id}>
            <Link to={`/exam/${b.id}`} className="book">
              <span className="book-name">{b.name}</span>
              <span className="book-meta">{b.word_count}문제 · 문제당 {b.time_limit}초</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
