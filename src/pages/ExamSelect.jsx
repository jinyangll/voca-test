import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { clearProgress, loadProgress } from '../progress'

export default function ExamSelect() {
  const [books, setBooks] = useState(null)
  const [error, setError] = useState('')
  const saved = loadProgress()
  const navigate = useNavigate()
  const dialogRef = useRef(null)

  // 풀던 단어장을 목록에서 다시 누르면 이어 풀지 새로 볼지 묻는다
  function startBook(e, b) {
    if (saved?.wordbookId !== b.id) return
    e.preventDefault()
    dialogRef.current.showModal()
  }

  function startNew() {
    clearProgress()
    navigate(`/exam/${saved.wordbookId}`)
  }

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
            <Link to={`/exam/${b.id}`} className="book" onClick={(e) => startBook(e, b)}>
              <span className="book-name">{b.name}</span>
              <span className="book-meta">{b.word_count}문제 · 문제당 {b.time_limit}초</span>
            </Link>
          </li>
        ))}
      </ul>

      {saved && (
        // 바깥(어두운 배경)을 누르거나 Esc를 누르면 닫힘
        <dialog ref={dialogRef} className="modal" onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close() }}>
          <div className="modal-body">
            <img className="modal-gif" src="/gifs/pop_hamnyangto.gif" alt="" />
            <p className="modal-title">풀던 시험이 있어요</p>
            <p className="muted">
              <b>{saved.name}</b> {saved.words.length}문제 중 {saved.index}문제를 풀었어요.<br />
              새로 시작하면 풀던 내용은 사라져요.
            </p>
            <div className="modal-actions">
              <button className="btn btn-soft" onClick={() => navigate(`/exam/${saved.wordbookId}`)}>이어서 풀기</button>
              <button className="btn" onClick={startNew}>새로 시작하기</button>
            </div>
          </div>
        </dialog>
      )}
    </main>
  )
}
