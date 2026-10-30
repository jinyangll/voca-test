import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { clearToken } from '../api'

export default function AdminLayout() {
  const navigate = useNavigate()

  function logout() {
    clearToken()
    navigate('/', { replace: true })
  }

  return (
    <div className="admin">
      <header className="admin-bar">
        <nav>
          <NavLink to="/admin" end>단어장</NavLink>
          <NavLink to="/admin/attempts">응시 기록</NavLink>
        </nav>
        <button className="link-btn" onClick={logout}>로그아웃</button>
      </header>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
