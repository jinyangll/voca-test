import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { clearProgress, loadProgress, saveProgress } from '../progress'

// progress: { wordbookId, name, timeLimit, words: [{id, english}], index, answers, startedAt, deadline, leftTab }

export default function Exam() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [progress, setProgress] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | question | submitting | error
  const [error, setError] = useState('')
  const [input, setInput] = useState('')
  const progressRef = useRef(null)
  const inputValueRef = useRef('')
  const inputRef = useRef(null)
  const submittingRef = useRef(false)

  const update = useCallback((next) => {
    progressRef.current = next
    saveProgress(next)
    setProgress(next)
  }, [])

  // 시험 시작: 저장된 진행 상황이 있으면 이어 풀고, 없으면 단어를 한 번에 받아온다 (NF-06)
  useEffect(() => {
    const saved = loadProgress()
    if (saved && saved.wordbookId === Number(id)) {
      progressRef.current = saved
      setProgress(saved)
      setPhase(saved.index >= saved.words.length ? 'submitting' : 'question')
      return
    }
    api(`/exam/wordbooks/${id}`)
      .then((d) => {
        update({
          wordbookId: d.id, name: d.name, timeLimit: d.time_limit, words: d.words,
          index: 0, answers: [], startedAt: new Date().toISOString(),
          deadline: Date.now() + d.time_limit * 1000, leftTab: false,
        })
        setPhase('question')
      })
      .catch((e) => { setError(e.message); setPhase('error') })
  }, [id, update])

  const advance = useCallback((answer, dontKnow) => {
    const p = progressRef.current
    if (!p || p.index >= p.words.length) return
    const word = p.words[p.index]
    const next = {
      ...p,
      answers: [...p.answers, { word_id: word.id, answer, dont_know: dontKnow, left_tab: p.leftTab }],
      index: p.index + 1,
      deadline: Date.now() + p.timeLimit * 1000,
      leftTab: false,
    }
    update(next)
    inputValueRef.current = ''
    setInput('')
    if (next.index >= next.words.length) setPhase('submitting')
  }, [update])

  // F-21: 시간이 끝나면 입력 중인 답을 그대로 제출
  useEffect(() => {
    if (phase !== 'question' || !progress) return
    const t = setTimeout(
      () => advance(inputValueRef.current.trim(), false),
      Math.max(0, progress.deadline - Date.now()),
    )
    inputRef.current?.focus()
    return () => clearTimeout(t)
  }, [phase, progress?.index, progress?.deadline, advance]) // eslint-disable-line react-hooks/exhaustive-deps

  // F-23: 시험 중 다른 탭·창으로 가면 현재 문항에 표시
  useEffect(() => {
    if (phase !== 'question') return
    const markLeft = () => {
      const p = progressRef.current
      if (p && !p.leftTab && p.index < p.words.length) update({ ...p, leftTab: true })
    }
    const onVisibility = () => { if (document.hidden) markLeft() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', markLeft)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', markLeft)
    }
  }, [phase, update])

  // 마지막 문제 뒤 서버 채점
  useEffect(() => {
    if (phase !== 'submitting' || submittingRef.current) return
    submittingRef.current = true
    const p = progressRef.current
    api('/exam/submit', {
      method: 'POST',
      body: { wordbook_id: p.wordbookId, started_at: p.startedAt, answers: p.answers },
    })
      .then((result) => {
        clearProgress()
        navigate('/result', { state: result, replace: true })
      })
      .catch((e) => {
        submittingRef.current = false
        setError(e.message)
        setPhase('submit-error')
      })
  }, [phase, navigate])

  function onKeyDown(e) {
    // NF-12: 한글 조합 중 Enter는 무시
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    const value = input.trim()
    if (!value) return // F-14: 빈칸 Enter는 무시
    advance(value, false)
  }

  if (phase === 'loading') return <main className="kid-page"><p className="muted center">시험지를 준비하는 중…</p></main>
  if (phase === 'error') {
    return (
      <main className="kid-page">
        <p className="error">{error}</p>
        <button className="btn" onClick={() => navigate('/exam')}>단어장 고르기로 돌아가기</button>
      </main>
    )
  }
  if (phase === 'submitting' || phase === 'submit-error') {
    return (
      <main className="kid-page center">
        {phase === 'submitting' ? (
          <p className="grading">채점하고 있어요<span className="dots" /></p>
        ) : (
          <>
            <p className="error">{error}</p>
            <button className="btn" onClick={() => setPhase('submitting')}>다시 채점하기</button>
          </>
        )}
      </main>
    )
  }

  const word = progress.words[progress.index]
  const total = progress.timeLimit * 1000
  const elapsed = Math.min(total, Math.max(0, total - (progress.deadline - Date.now())))

  return (
    <main className="kid-page exam">
      <header className="exam-head">
        <span className="exam-book">{progress.name}</span>
        <span className="exam-count">
          <b>{progress.index + 1}</b> / {progress.words.length}
        </span>
      </header>

      <div className="timer" role="presentation">
        <div
          key={`${progress.index}-${progress.deadline}`}
          className="timer-fill"
          style={{ animationDuration: `${total}ms`, animationDelay: `-${elapsed}ms` }}
        />
      </div>

      <section className="word-card" key={progress.index}>
        <p className="word">{word.english}</p>
      </section>

      <div className="answer-row">
        <input
          ref={inputRef}
          className="answer-input"
          value={input}
          onChange={(e) => { setInput(e.target.value); inputValueRef.current = e.target.value }}
          onKeyDown={onKeyDown}
          placeholder="뜻을 쓰고 Enter"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          aria-label={`${word.english}의 뜻`}
        />
        <button
          className="btn btn-soft"
          onClick={() => { advance('', true); inputRef.current?.focus() }}
        >
          모르겠어요
        </button>
      </div>
    </main>
  )
}
