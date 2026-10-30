import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, setToken } from '../api'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { token } = await api('/admin/login', { method: 'POST', body: { password } })
      setToken(token)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err.message)
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="kid-page">
      <Link to="/" className="back-link">처음으로</Link>
      <form className="login" onSubmit={submit}>
        <h1 className="page-title">선생님 로그인</h1>
        <input
          type="password"
          className="answer-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          autoFocus
          aria-label="비밀번호"
        />
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy || !password}>로그인</button>
      </form>
    </main>
  )
}
