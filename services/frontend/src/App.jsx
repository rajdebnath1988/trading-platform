import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Markets from './pages/Markets'
import Portfolio from './pages/Portfolio'
import Orders from './pages/Orders'
import Layout from './components/Layout'

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('tradex_token'))
  const [user, setUser]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('tradex_user') || 'null') }
    catch { return null }
  })

  const handleLogin = (t, u) => {
    localStorage.setItem('tradex_token', t)
    localStorage.setItem('tradex_user', JSON.stringify(u))
    setToken(t); setUser(u)
  }
  const handleLogout = () => {
    localStorage.removeItem('tradex_token')
    localStorage.removeItem('tradex_user')
    setToken(null); setUser(null)
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={token ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} />
        {token ? (
          <Route element={<Layout user={user} onLogout={handleLogout} />}>
            <Route path="/"          element={<Dashboard user={user} />} />
            <Route path="/markets"   element={<Markets />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/orders"    element={<Orders />} />
            <Route path="*"          element={<Navigate to="/" />} />
          </Route>
        ) : (
          <Route path="*" element={<Navigate to="/login" />} />
        )}
      </Routes>
    </BrowserRouter>
  )
}
