import { useState } from 'react'
import { Link } from 'react-router-dom'

// 첫 화면에 들어올 때마다 하나를 골라 보여준다 (public/gifs/)
const CHARACTERS = [
  'lemon_manju', 'book_chii', 'smile_sisa', 'magical_chii',
  'cute_chii', 'cute_chii_hachi', 'drink_manju', 'pizzamanju', 'ratko', 'sleeping_chii', 'strawberry_ratko',
]

export default function Home() {
  const [character] = useState(() => CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)])

  return (
    <main className="kid-page home">
      <div className="home-card">
        <img className="home-gif" src={`/gifs/${character}.gif`} alt="" />
        <h1>영어 단어 시험</h1>
        <p className="muted">단어를 보고 뜻을 한글로 써 보세요</p>
        <Link to="/exam" className="btn btn-big">시험 시작</Link>
      </div>
      <Link to="/admin/login" className="corner-link">선생님 로그인</Link>
    </main>
  )
}
