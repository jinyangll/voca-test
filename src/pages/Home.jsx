import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <main className="kid-page home">
      <div className="home-card">
        <p className="home-word" aria-hidden="true">ABC</p>
        <h1>영어 단어 시험</h1>
        <p className="muted">단어를 보고 뜻을 한글로 써 보세요</p>
        <Link to="/exam" className="btn btn-big">시험 시작</Link>
      </div>
      <Link to="/admin/login" className="corner-link">선생님 로그인</Link>
    </main>
  )
}
