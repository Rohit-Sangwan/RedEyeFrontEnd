import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { Toaster, toast } from 'react-hot-toast'
import { SiTelegram } from 'react-icons/si'
import { FiAlertTriangle, FiUserCheck } from 'react-icons/fi'
import Dashboard from './components/Dashboard'
import DeviceDetail from './components/DeviceDetail'
import Settings from './components/Settings'
import OwnerPanel from './components/OwnerPanel'
import { API_BASE } from './config'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('token'))
  const [isExpired, setIsExpired] = useState(false)
  const [isSuspended, setIsSuspended] = useState(false)
  const [showLoginPopup, setShowLoginPopup] = useState(false)
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })

  useEffect(() => {
    localStorage.setItem('redeye_theme', 'dark')
    document.documentElement.classList.remove('light')
    document.documentElement.classList.add('dark')
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return setIsAuthenticated(false)
    fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => {
        const text = await res.text()
        let data
        try { data = JSON.parse(text) } catch { throw new Error('server') }
        if (!res.ok) {
          if (data.suspended) { setIsSuspended(true); setIsAuthenticated(false); return }
          if (data.expired) { setIsExpired(true); setIsAuthenticated(false); return }
          throw new Error('expired')
        }
        setUser(data.user)
        localStorage.setItem('user', JSON.stringify(data.user))
        setIsExpired(false)
        setIsSuspended(false)
        setIsAuthenticated(true)
      })
      .catch(() => handleLogout(false))
  }, [])

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('redeye_theme', 'dark')
    setUser(userData)
    setIsExpired(false)
    setIsSuspended(false)
    setIsAuthenticated(true)
    toast.success('ROOT ACCESS GRANTED')

    if (userData.suspended) {
      setIsSuspended(true)
      setIsAuthenticated(false)
      return
    }

    if (userData.role !== 'owner' && userData.expires_at && new Date(userData.expires_at) < new Date()) {
      setShowLoginPopup(true)
      setTimeout(() => {
        window.open('https://t.me/NullCoder_404', '_blank')
        setShowLoginPopup(false)
      }, 1500)
    }
  }

  const handleLogout = (notify = true) => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setIsAuthenticated(false)
    setIsExpired(false)
    if (notify) toast.success('SESSION TERMINATED')
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 2400,
          style: {
            background: '#020617',
            color: '#d1fae5',
            border: '1px solid rgba(52,211,153,.35)',
            boxShadow: '0 20px 60px rgba(16,185,129,.18)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
          }
        }}
      />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={
            !isAuthenticated
              ? <LoginPage onLogin={handleLogin} />
              : <Navigate to="/" />
          } />
          <Route path="/signup" element={
            !isAuthenticated
              ? <SignupPage onLogin={handleLogin} />
              : <Navigate to="/" />
          } />
          <Route path="/" element={
            isAuthenticated
              ? <Dashboard onLogout={handleLogout} user={user} />
              : <Navigate to="/login" />
          } />
          <Route path="/settings" element={
            isAuthenticated
              ? <Settings onLogout={handleLogout} />
              : <Navigate to="/login" />
          } />
          <Route path="/owner" element={
            isAuthenticated && user?.role === 'owner'
              ? <OwnerPanel onLogout={handleLogout} />
              : <Navigate to="/" />
          } />
          <Route path="/device/:deviceId" element={
            isAuthenticated
              ? <DeviceDetail onLogout={handleLogout} />
              : <Navigate to="/login" />
          } />
        </Routes>
      </BrowserRouter>

      {isExpired && <ExpiredScreen onRetry={() => { setIsExpired(false); window.location.href = '/login' }} />}
      {isSuspended && <SuspendedScreen onRetry={() => { setIsSuspended(false); handleLogout(false) }} />}
      {showLoginPopup && <LoginPopup />}
    </>
  )
}

function LoginPopup() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="cyber-card w-full max-w-sm p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-400/10 font-mono text-2xl font-black text-emerald-300">RE</div>
        <h2 className="mb-2 text-xl font-black text-emerald-300">ACCESS GRANTED</h2>
        <p className="muted mb-4 text-sm">Connecting to secure channel…</p>
        <div className="mx-auto h-1 w-32 overflow-hidden rounded-full bg-emerald-400/20">
          <div className="h-full rounded-full bg-emerald-400" style={{ animation: 'loginProgress 1.5s linear forwards', width: '100%' }} />
        </div>
        <style>{`@keyframes loginProgress { from { width: 0% } to { width: 100% } }`}</style>
      </div>
    </div>
  )
}

function ExpiredScreen({ onRetry }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05070c] p-4">
      <div className="cyber-card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-red-400/40 bg-red-400/10 font-mono text-3xl font-black text-red-300">!</div>
        <h1 className="mb-3 text-2xl font-black text-red-300">PLAN EXPIRED</h1>
        <p className="muted mb-6 text-sm">Your admin access has expired. Please repurchase to continue using RedEye.</p>
        <a
          href="https://t.me/NullCoder_404"
          target="_blank"
          rel="noreferrer"
          className="telegram-btn mb-4 w-full py-3"
        >
          <SiTelegram className="text-lg" />
          <span>CONTACT ON TELEGRAM</span>
        </a>
        <button onClick={onRetry} className="cyber-btn w-full py-3">
          RETRY LOGIN
        </button>
      </div>
    </div>
  )
}

function SuspendedScreen({ onRetry }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05070c] p-4">
      <div className="cyber-card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-red-400/40 bg-red-400/10 font-mono text-3xl font-black text-red-300">⛔</div>
        <h1 className="mb-3 text-2xl font-black text-red-300">ACCOUNT SUSPENDED</h1>
        <p className="muted mb-6 text-sm">Your account has been suspended by the owner. Contact the owner for more information.</p>
        <a
          href="https://t.me/NullCoder_404"
          target="_blank"
          rel="noreferrer"
          className="telegram-btn mb-4 w-full py-3"
        >
          <SiTelegram className="text-lg" />
          <span>CONTACT OWNER</span>
        </a>
        <button onClick={onRetry} className="cyber-btn w-full py-3">
          BACK TO LOGIN
        </button>
      </div>
    </div>
  )
}

function LoginMatrix() {
  return <div className="login-matrix" aria-hidden="true">{Array.from({ length: 46 }).map((_, i) => <i key={i} style={{ left: `${(i * 7) % 100}%`, animationDelay: `${(i % 9) * -0.55}s` }}>{i % 3 === 0 ? 'REDEYE' : i % 3 === 1 ? 'ACCESS' : '0101'}</i>)}</div>
}

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorModal, setErrorModal] = useState(null)

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    setErrorModal(null)
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const text = await res.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        setErrorModal('Server unreachable. The backend may be starting up — try again in a few seconds.')
        return
      }
      if (!res.ok) {
        if (data.suspended) {
          onLogin(null, { suspended: true })
          return
        }
        if (data.expired) {
          setErrorModal(data.error || 'Your plan has expired. Please contact admin to renew.')
          return
        }
        setErrorModal(data.error || 'Authentication failed. Check your credentials and try again.')
        return
      }
      onLogin(data.token, data.user)
    } catch (err) {
      setErrorModal('Cannot connect to server. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  if (errorModal) {
    const isExpired = errorModal.includes('expired') || errorModal.includes('Expired')
    return (
      <div className="cyber-bg flex items-center justify-center p-4">
        <LoginMatrix />
        <div className="cyber-card w-full max-w-sm p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/40 bg-red-400/10">
            <FiAlertTriangle className="text-red-300 text-2xl" />
          </div>
          <h2 className="mb-2 text-lg font-black text-red-300 uppercase tracking-wider">
            {isExpired ? 'PLAN EXPIRED' : 'Access Denied'}
          </h2>
          <div className="my-4 rounded-xl border border-red-500/20 bg-red-950/30 px-4 py-3">
            <p className="text-sm text-red-200 font-mono leading-relaxed text-left">{errorModal}</p>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => setErrorModal(null)}
              className="w-full rounded-xl bg-red-400/10 border border-red-400/30 py-2.5 text-sm font-bold text-red-300 hover:bg-red-400/20 transition-all"
            >
              TRY AGAIN
            </button>
            <a
              href="https://t.me/NullCoder_404"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-sky-500/30 bg-sky-500/10 py-2.5 text-sm font-bold text-sky-300 hover:bg-sky-500/20 transition-all"
            >
              <SiTelegram className="text-base" />
              {isExpired ? 'RENEW ON TELEGRAM' : 'CONTACT SUPPORT'}
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cyber-bg flex items-center justify-center p-4">
      <LoginMatrix />
      <div className="login-shell cyber-card w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-400/10 font-mono text-2xl font-black text-emerald-300 shadow-lg shadow-emerald-900/30">RE</div>
          <p className="terminal-title">secure command gateway</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">RedEye Admin</h1>
          <p className="muted mt-2 text-sm">Encrypted control interface</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <input type="email" name="fs_admin_login_email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin email" className="cyber-input" required />
          <input type="password" name="fs_admin_login_password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="access password" className="cyber-input" required />
          <button disabled={loading} className="cyber-btn w-full py-3">
            {loading ? 'VERIFYING CREDENTIALS…' : 'ENTER PANEL'}
          </button>
          <a
            href="https://t.me/NullCoder_404"
            target="_blank"
            rel="noreferrer"
            className="telegram-btn w-full py-3"
          >
            <SiTelegram className="text-lg" aria-hidden="true" />
            <span>GET ADMIN KEY</span>
          </a>
          <p className="text-center text-sm text-slate-400 mt-4">
            Don't have an account?{' '}
            <Link to="/signup" className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
              Sign Up Free
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

function SignupPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorModal, setErrorModal] = useState(null)
  const [fieldError, setFieldError] = useState('')

  function validateFields() {
    if (!email.trim()) { setFieldError('Email address is required.'); return false }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError('Please enter a valid email address.'); return false }
    if (!password) { setFieldError('Password is required.'); return false }
    if (password.length < 8) { setFieldError('Password must be at least 8 characters.'); return false }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) { setFieldError('Password must contain at least one uppercase letter and one number.'); return false }
    setFieldError('')
    return true
  }

  const handleSubmit = async e => {
    e.preventDefault()
    if (!validateFields()) return
    setLoading(true)
    setErrorModal(null)
    setFieldError('')
    try {
      const { generateFingerprint } = await import('./utils/fingerprint')
      const fingerprint = await generateFingerprint()
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, display_name: displayName.trim(), fingerprint })
      })
      const text = await res.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        setErrorModal({ message: 'Server unreachable. The backend may be starting up — try again in a few seconds.' })
        return
      }
      if (!res.ok) {
        setErrorModal({ message: data.error || 'Signup failed. Please try again.', hint: data.hint || null })
        return
      }
      onLogin(data.token, data.user)
    } catch (err) {
      setErrorModal({ message: 'Cannot connect to server. Please try again later.' })
    } finally {
      setLoading(false)
    }
  }

  if (errorModal) {
    const isExisting = errorModal.hint && errorModal.hint.includes('first time')
    return (
      <div className="cyber-bg flex items-center justify-center p-4">
        <LoginMatrix />
        <div className="cyber-card w-full max-w-sm p-8 text-center">
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border ${isExisting ? 'border-amber-400/40 bg-amber-400/10' : 'border-red-400/40 bg-red-400/10'}`}>
            {isExisting ? <FiUserCheck className="text-amber-300 text-2xl" /> : <FiAlertTriangle className="text-red-300 text-2xl" />}
          </div>
          <h2 className={`mb-2 text-lg font-black uppercase tracking-wider ${isExisting ? 'text-amber-300' : 'text-red-300'}`}>
            {isExisting ? 'Existing Customer' : 'Signup Failed'}
          </h2>
          <div className={`my-4 rounded-xl border px-4 py-3 ${isExisting ? 'border-amber-500/20 bg-amber-950/30' : 'border-red-500/20 bg-red-950/30'}`}>
            <p className={`text-sm font-mono leading-relaxed text-left ${isExisting ? 'text-amber-200' : 'text-red-200'}`}>{errorModal.message}</p>
            {errorModal.hint && (
              <p className="mt-2 text-xs text-slate-400 font-mono leading-relaxed text-left border-t border-red-500/10 pt-2">{errorModal.hint}</p>
            )}
          </div>
          <div className="space-y-2">
            <button
              onClick={() => setErrorModal(null)}
              className="w-full rounded-xl bg-red-400/10 border border-red-400/30 py-2.5 text-sm font-bold text-red-300 hover:bg-red-400/20 transition-all"
            >
              TRY AGAIN
            </button>
            <a
              href="https://t.me/NullCoder_404"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-sky-500/30 bg-sky-500/10 py-2.5 text-sm font-bold text-sky-300 hover:bg-sky-500/20 transition-all"
            >
              <SiTelegram className="text-base" />
              CONTACT ON TELEGRAM
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cyber-bg flex items-center justify-center p-4">
      <LoginMatrix />
      <div className="login-shell cyber-card w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-400/10 font-mono text-2xl font-black text-emerald-300 shadow-lg shadow-emerald-900/30">RE</div>
          <p className="terminal-title">create secure account</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Sign Up</h1>
          <p className="muted mt-2 text-sm">1-day free trial — no payment required</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <input type="text" name="fs_signup_name" autoComplete="name" value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="display name (optional)" className="cyber-input" />
          <div>
            <input type="email" name="fs_signup_email" autoComplete="username" value={email} onChange={e=>{setEmail(e.target.value); setFieldError('')}} placeholder="email address" className="cyber-input" required />
          </div>
          <div>
            <input type="password" name="fs_signup_password" autoComplete="new-password" value={password} onChange={e=>{setPassword(e.target.value); setFieldError('')}} placeholder="create password (8+ chars)" className="cyber-input" required minLength={8} />
            <p className="mt-1.5 text-xs text-slate-500">Must be 8+ characters with at least one uppercase letter and one number.</p>
          </div>
          {fieldError && (
            <div className="rounded-xl border border-red-500/20 bg-red-950/30 px-3 py-2">
              <p className="text-xs text-red-300 font-mono">{fieldError}</p>
            </div>
          )}
          <button disabled={loading} className="cyber-btn w-full py-3">
            {loading ? 'CREATING ACCOUNT…' : 'START FREE TRIAL'}
          </button>
          <p className="text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors">
              Login
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

export default App
