import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './styles.css'
import { getToken } from './api'
import Home from './pages/Home'
import ExamSelect from './pages/ExamSelect'
import Exam from './pages/Exam'
import Result from './pages/Result'
import AdminLogin from './pages/AdminLogin'
import AdminLayout from './pages/AdminLayout'
import AdminWordbooks from './pages/AdminWordbooks'
import AdminWordbook from './pages/AdminWordbook'
import AdminAttempts from './pages/AdminAttempts'
import AdminAttempt from './pages/AdminAttempt'

function RequireAdmin({ children }) {
  return getToken() ? children : <Navigate to="/admin/login" replace />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/exam" element={<ExamSelect />} />
        <Route path="/exam/:id" element={<Exam />} />
        <Route path="/result" element={<Result />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index element={<AdminWordbooks />} />
          <Route path="wordbooks/:id" element={<AdminWordbook />} />
          <Route path="attempts" element={<AdminAttempts />} />
          <Route path="attempts/:id" element={<AdminAttempt />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
