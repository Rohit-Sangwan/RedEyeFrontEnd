import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiCopy, FiPlus, FiShield, FiTrash2, FiUser, FiClock, FiCheck, FiX, FiDollarSign, FiSmartphone, FiMessageSquare, FiActivity, FiUnlock, FiKey, FiLogOut, FiAlertTriangle, FiGlobe, FiEdit2, FiRefreshCw, FiDatabase } from 'react-icons/fi'
import { SiTelegram } from 'react-icons/si'
import { toast } from 'react-hot-toast'

import { API_BASE } from '../config'

function authHeaders(json = false) {
  const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
  if (json) headers['Content-Type'] = 'application/json'
  return headers
}

const EXPIRY_OPTIONS = [
  { value: 0.033, label: '1 Day' },
  { value: 1, label: '1 Month' },
  { value: 3, label: '3 Months' },
  { value: 6, label: '6 Months' },
  { value: 12, label: '1 Year' }
]

const TIER_OPTIONS = [
  { value: 'basic', label: 'Basic', price: 299 },
  { value: 'premium', label: 'Premium', price: 599 },
  { value: 'enterprise', label: 'Enterprise', price: 999 }
]

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function daysRemaining(iso) {
  if (!iso) return null
  const diff = new Date(iso) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function OwnerPanel({ onLogout }) {
  const navigate = useNavigate()
  const [admins, setAdmins] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newExpiry, setNewExpiry] = useState(3)
  const [newTier, setNewTier] = useState('basic')
  const [creating, setCreating] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState(null)
  const [generatedEmail, setGeneratedEmail] = useState(null)
  const [brandedCopy, setBrandedCopy] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editExpiry, setEditExpiry] = useState(3)
  const [editTier, setEditTier] = useState('basic')
  const [expandedStats, setExpandedStats] = useState(null)
  const [controlAdmin, setControlAdmin] = useState(null)
  const [loginHistory, setLoginHistory] = useState(null)
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false)
  const [resetPwResult, setResetPwResult] = useState(null)
  const [showBlockedIps, setShowBlockedIps] = useState(false)
  const [blockedIps, setBlockedIps] = useState([])
  const [blockedIpsLoading, setBlockedIpsLoading] = useState(false)
  const [editingName, setEditingName] = useState(null)
  const [editNameValue, setEditNameValue] = useState('')

  const fetchAll = async () => {
    try {
      const [adminsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/owner/admins`, { headers: authHeaders() }),
        fetch(`${API_BASE}/owner/stats`, { headers: authHeaders() })
      ])
      if (adminsRes.status === 403) {
        toast.error('OWNER ACCESS REQUIRED')
        navigate('/')
        return
      }
      const adminsData = await adminsRes.json()
      const statsData = await statsRes.json()
      if (adminsData.success) setAdmins(adminsData.admins || [])
      if (statsData.success) setStats(statsData)
    } catch {
      toast.error('FAILED TO LOAD DATA')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const createAdmin = async () => {
    if (!newEmail.trim()) return toast.error('EMAIL REQUIRED')
    setCreating(true)
    try {
      const res = await fetch(`${API_BASE}/owner/admins`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ email: newEmail.trim(), displayName: newName.trim() || null, expiryMonths: newExpiry, pricingTier: newTier })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setGeneratedPassword(data.generatedPassword)
      setGeneratedEmail(newEmail.trim())
      setBrandedCopy(data.brandedCopy || null)
      setNewEmail('')
      setNewName('')
      setNewExpiry(3)
      setNewTier('basic')
      fetchAll()
      toast.success('ADMIN CREATED')
    } catch (err) {
      toast.error(`CREATE FAILED: ${err.message}`)
    } finally {
      setCreating(false)
    }
  }

  const updateAdmin = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/owner/admins/${id}`, {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify({ expiryMonths: editExpiry, pricingTier: editTier })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setEditingId(null)
      fetchAll()
      toast.success('ADMIN UPDATED')
    } catch (err) {
      toast.error(`UPDATE FAILED: ${err.message}`)
    }
  }

  const updateAdminName = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/owner/admins/${id}`, {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify({ displayName: editNameValue.trim() || null })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setEditingName(null)
      fetchAll()
      toast.success('NAME UPDATED')
    } catch (err) {
      toast.error(`UPDATE FAILED: ${err.message}`)
    }
  }

  const toggleSuspend = async (id, current) => {
    try {
      const res = await fetch(`${API_BASE}/owner/admins/${id}`, {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify({ suspended: !current })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      fetchAll()
      toast.success(current ? 'ADMIN RESUMED' : 'ADMIN SUSPENDED')
    } catch (err) {
      toast.error(`FAILED: ${err.message}`)
    }
  }

  const deleteAdmin = async (id, email) => {
    if (!confirm(`Delete admin ${email}? This cannot be undone.`)) return
    try {
      const res = await fetch(`${API_BASE}/owner/admins/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      fetchAll()
      toast.success('ADMIN DELETED')
    } catch (err) {
      toast.error(`DELETE FAILED: ${err.message}`)
    }
  }

  const resetPassword = async (id, email) => {
    if (!confirm(`Reset password for ${email}? Their old sessions will be invalidated.`)) return
    try {
      const res = await fetch(`${API_BASE}/owner/admins/${id}/reset-password`, {
        method: 'POST',
        headers: authHeaders()
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setResetPwResult({ email, password: data.generatedPassword, brandedCopy: data.brandedCopy })
      toast.success('PASSWORD RESET')
    } catch (err) {
      toast.error(`RESET FAILED: ${err.message}`)
    }
  }

  const unlockAccount = async (id, email) => {
    if (!confirm(`Unlock account for ${email}? This clears failed login attempts and lockout.`)) return
    try {
      const res = await fetch(`${API_BASE}/owner/admins/${id}/unlock`, {
        method: 'POST',
        headers: authHeaders()
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      fetchAll()
      toast.success('ACCOUNT UNLOCKED')
    } catch (err) {
      toast.error(`UNLOCK FAILED: ${err.message}`)
    }
  }

  const invalidateSessions = async (id, email) => {
    if (!confirm(`Force logout ${email}? All active sessions will be terminated.`)) return
    try {
      const res = await fetch(`${API_BASE}/owner/admins/${id}/invalidate-sessions`, {
        method: 'POST',
        headers: authHeaders()
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      fetchAll()
      toast.success('SESSIONS INVALIDATED')
    } catch (err) {
      toast.error(`FAILED: ${err.message}`)
    }
  }

  const fetchLoginHistory = async (id, email) => {
    setLoginHistoryLoading(true)
    setLoginHistory(null)
    try {
      const res = await fetch(`${API_BASE}/owner/admins/${id}/login-history`, { headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setLoginHistory({ email, attempts: data.attempts || [] })
    } catch (err) {
      toast.error(`FAILED: ${err.message}`)
    } finally {
      setLoginHistoryLoading(false)
    }
  }

  const fetchBlockedIps = async () => {
    setBlockedIpsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/owner/blocked-ips`, { headers: authHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setBlockedIps(data.blocked_ips || [])
    } catch (err) {
      toast.error(`FAILED: ${err.message}`)
    } finally {
      setBlockedIpsLoading(false)
    }
  }

  const unblockIp = async (ip) => {
    try {
      const res = await fetch(`${API_BASE}/owner/blocked-ips/${encodeURIComponent(ip)}`, {
        method: 'DELETE',
        headers: authHeaders()
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      fetchBlockedIps()
      toast.success('IP UNBLOCKED')
    } catch (err) {
      toast.error(`FAILED: ${err.message}`)
    }
  }

  const o = stats?.overview || {}
  const r = stats?.revenue || {}

  return (
    <div className="cyber-bg min-h-screen">
      <header className="border-b border-emerald-400/20 bg-black/30 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="rounded-xl border border-emerald-500/30 p-2 text-emerald-300 hover:bg-emerald-500/10">
              <FiArrowLeft />
            </Link>
            <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-amber-300"><FiShield /></div>
            <div>
              <p className="terminal-title">owner control</p>
              <h1 className="text-2xl font-black">Full Admin Control</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowBlockedIps(!showBlockedIps); if (!showBlockedIps) fetchBlockedIps() }} className="flex items-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-500/20">
              <FiGlobe /> BLOCKED IPs
            </button>
            <button onClick={() => setShowCreate(!showCreate)} className="cyber-btn">
              <FiPlus /> ADD ADMIN
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6">
        {stats && (
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-emerald-400/20 bg-slate-950/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <FiUser className="text-emerald-400" /> Total Admins
              </div>
              <div className="text-3xl font-black text-slate-100">{o.admins || 0}</div>
              <div className="mt-1 flex gap-2 text-xs">
                <span className="text-emerald-400">{o.active || 0} active</span>
                <span className="text-yellow-400">{o.suspended || 0} suspended</span>
                <span className="text-red-400">{o.expired || 0} expired</span>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-400/20 bg-slate-950/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <FiDollarSign className="text-emerald-400" /> Est. Revenue
              </div>
              <div className="text-3xl font-black text-emerald-300">₹{r.estimated_monthly?.toLocaleString('en-IN') || 0}</div>
              <div className="mt-1 text-xs text-slate-500">per month</div>
            </div>

            <div className="rounded-2xl border border-emerald-400/20 bg-slate-950/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <FiMessageSquare className="text-emerald-400" /> Total SMS
              </div>
              <div className="text-3xl font-black text-slate-100">{o.total_sms?.toLocaleString('en-IN') || 0}</div>
            </div>

            <div className="rounded-2xl border border-emerald-400/20 bg-slate-950/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <FiSmartphone className="text-emerald-400" /> Devices
              </div>
              <div className="text-3xl font-black text-slate-100">{o.total_devices || 0}</div>
              <div className="mt-1 flex gap-2 text-xs">
                <span className="text-emerald-400">{o.online_devices || 0} online</span>
                <span className="text-slate-500">{(o.total_devices || 0) - (o.online_devices || 0)} offline</span>
              </div>
            </div>
          </div>
        )}

        {generatedPassword && (
          <div className="mb-6 rounded-2xl border border-emerald-400/40 bg-emerald-400/5 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-emerald-300">ADMIN CREATED — SAVE THIS PASSWORD</h3>
              <button onClick={() => { setGeneratedPassword(null); setGeneratedEmail(null); setBrandedCopy(null) }} className="text-emerald-400/60 hover:text-emerald-300"><FiX /></button>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-black/40 p-3">
              <code className="flex-1 font-mono text-lg text-emerald-200">{generatedPassword}</code>
              <button onClick={() => { navigator.clipboard.writeText(generatedPassword); toast.success('PASSWORD COPIED') }} className="rounded-lg border border-emerald-500/40 p-2 text-emerald-300 hover:bg-emerald-500/10">
                <FiCopy />
              </button>
            </div>
            {brandedCopy && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Branded Copy (for Telegram)</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { navigator.clipboard.writeText(brandedCopy); toast.success('BRANDED COPY COPIED') }}
                      className="flex items-center gap-1 rounded-lg border border-emerald-500/30 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
                    >
                      <FiCopy /> COPY
                    </button>
                    <a
                      href={`https://t.me/share/url?text=${encodeURIComponent(brandedCopy)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 rounded-lg border border-sky-500/30 px-2 py-1 text-xs text-sky-300 hover:bg-sky-500/10"
                    >
                      <SiTelegram /> SHARE
                    </a>
                  </div>
                </div>
                <pre className="whitespace-pre-wrap rounded-xl border border-emerald-500/20 bg-black/50 p-3 font-mono text-xs text-emerald-100/80">{brandedCopy}</pre>
              </div>
            )}
            <p className="mt-2 text-xs text-yellow-300/80">This password will NOT be shown again. Copy it now.</p>
          </div>
        )}

        {resetPwResult && (
          <div className="mb-6 rounded-2xl border border-amber-400/40 bg-amber-400/5 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-amber-300">PASSWORD RESET — {resetPwResult.email}</h3>
              <button onClick={() => setResetPwResult(null)} className="text-amber-400/60 hover:text-amber-300"><FiX /></button>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-black/40 p-3">
              <code className="flex-1 font-mono text-lg text-amber-200">{resetPwResult.password}</code>
              <button onClick={() => { navigator.clipboard.writeText(resetPwResult.password); toast.success('PASSWORD COPIED') }} className="rounded-lg border border-amber-500/40 p-2 text-amber-300 hover:bg-amber-500/10">
                <FiCopy />
              </button>
            </div>
            {resetPwResult.brandedCopy && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Branded Copy</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { navigator.clipboard.writeText(resetPwResult.brandedCopy); toast.success('COPIED') }}
                      className="flex items-center gap-1 rounded-lg border border-amber-500/30 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/10"
                    >
                      <FiCopy /> COPY
                    </button>
                    <a
                      href={`https://t.me/share/url?text=${encodeURIComponent(resetPwResult.brandedCopy)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 rounded-lg border border-sky-500/30 px-2 py-1 text-xs text-sky-300 hover:bg-sky-500/20"
                    >
                      <SiTelegram /> SHARE
                    </a>
                  </div>
                </div>
                <pre className="whitespace-pre-wrap rounded-xl border border-amber-500/20 bg-black/50 p-3 font-mono text-xs text-amber-100/80">{resetPwResult.brandedCopy}</pre>
              </div>
            )}
            <p className="mt-2 text-xs text-yellow-300/80">Old sessions have been invalidated. This password will NOT be shown again.</p>
          </div>
        )}

        {showBlockedIps && (
          <div className="mb-6 rounded-2xl border border-red-400/20 bg-slate-950/70 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-black text-red-300 flex items-center gap-2"><FiGlobe /> BLOCKED IPs</h3>
              <button onClick={() => setShowBlockedIps(false)} className="text-red-400/60 hover:text-red-300"><FiX /></button>
            </div>
            {blockedIpsLoading ? (
              <div className="py-4 text-center text-slate-500">Loading...</div>
            ) : blockedIps.length === 0 ? (
              <div className="py-4 text-center text-slate-500">No blocked IPs</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-red-500/20 text-left uppercase tracking-wider text-slate-400">
                      <th className="px-3 py-2 font-bold">IP Address</th>
                      <th className="px-3 py-2 font-bold">Reason</th>
                      <th className="px-3 py-2 font-bold">Blocked Until</th>
                      <th className="px-3 py-2 font-bold">Type</th>
                      <th className="px-3 py-2 font-bold">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedIps.map((b, i) => (
                      <tr key={b.ip_address} className={`border-b border-red-500/10 ${i % 2 === 0 ? 'bg-black/20' : 'bg-red-950/10'}`}>
                        <td className="px-3 py-2 font-mono text-red-200">{b.ip_address}</td>
                        <td className="px-3 py-2 text-slate-300">{b.reason}</td>
                        <td className="px-3 py-2 text-slate-400">{b.blocked_until ? formatDateTime(b.blocked_until) : 'Permanent'}</td>
                        <td className="px-3 py-2">
                          {b.permanent ? (
                            <span className="rounded bg-red-400/15 px-1.5 py-0.5 text-red-300 font-bold">PERMANENT</span>
                          ) : (
                            <span className="rounded bg-yellow-400/15 px-1.5 py-0.5 text-yellow-300">TEMP</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => unblockIp(b.ip_address)}
                            className="rounded-lg border border-emerald-500/30 px-2 py-1 text-emerald-300 hover:bg-emerald-500/10"
                          >
                            <FiUnlock /> UNBLOCK
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {showCreate && (
          <div className="mb-6 rounded-2xl border border-emerald-400/20 bg-slate-950/70 p-5">
            <h3 className="mb-4 text-sm font-black text-emerald-300">NEW ADMIN</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Email</span>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="cyber-input"
                  placeholder="admin@example.com"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">Display Name (optional)</span>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="cyber-input"
                  placeholder="John Doe"
                />
              </label>
            </div>
            <div className="mt-3">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Pricing Tier</span>
              <div className="grid grid-cols-3 gap-2">
                {TIER_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-500/20 bg-slate-950/70 p-3 text-sm text-slate-200 hover:bg-emerald-500/10"
                  >
                    <input
                      type="radio"
                      name="newTier"
                      value={opt.value}
                      checked={newTier === opt.value}
                      onChange={(e) => setNewTier(e.target.value)}
                      className="h-4 w-4 accent-emerald-400"
                    />
                    <span>{opt.label} <span className="text-xs text-slate-500">₹{opt.price}/mo</span></span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Expiry</span>
              <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
                {EXPIRY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-500/20 bg-slate-950/70 p-3 text-sm text-slate-200 hover:bg-emerald-500/10"
                  >
                    <input
                      type="radio"
                      name="newExpiry"
                      value={opt.value}
                      checked={newExpiry === opt.value}
                      onChange={(e) => setNewExpiry(Number(e.target.value))}
                      className="h-4 w-4 accent-emerald-400"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={createAdmin} disabled={creating} className="rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-black text-black hover:bg-emerald-300 disabled:opacity-60">
                {creating ? 'CREATING…' : 'CREATE ADMIN'}
              </button>
              <button onClick={() => setShowCreate(false)} className="danger-btn">
                CANCEL
              </button>
            </div>
          </div>
        )}

        {loginHistory && (
          <div className="mb-6 rounded-2xl border border-sky-400/20 bg-slate-950/70 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-black text-sky-300 flex items-center gap-2"><FiDatabase /> LOGIN HISTORY — {loginHistory.email}</h3>
              <button onClick={() => setLoginHistory(null)} className="text-sky-400/60 hover:text-sky-300"><FiX /></button>
            </div>
            {loginHistoryLoading ? (
              <div className="py-4 text-center text-slate-500">Loading...</div>
            ) : loginHistory.attempts.length === 0 ? (
              <div className="py-4 text-center text-slate-500">No login attempts found</div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-950">
                    <tr className="border-b border-sky-500/20 text-left uppercase tracking-wider text-slate-400">
                      <th className="px-3 py-2 font-bold">Time</th>
                      <th className="px-3 py-2 font-bold">IP</th>
                      <th className="px-3 py-2 font-bold">Status</th>
                      <th className="px-3 py-2 font-bold">Reason</th>
                      <th className="px-3 py-2 font-bold">User Agent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginHistory.attempts.map((a, i) => (
                      <tr key={i} className={`border-b border-sky-500/10 ${a.success ? 'bg-emerald-950/10' : 'bg-red-950/10'}`}>
                        <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{formatDateTime(a.created_at)}</td>
                        <td className="px-3 py-2 font-mono text-slate-300">{a.ip_address}</td>
                        <td className="px-3 py-2">
                          {a.success ? (
                            <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-emerald-300 font-bold">OK</span>
                          ) : (
                            <span className="rounded bg-red-400/15 px-1.5 py-0.5 text-red-300 font-bold">FAIL</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-400">{a.failure_reason || '—'}</td>
                        <td className="px-3 py-2 text-slate-500 max-w-[200px] truncate">{a.user_agent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-emerald-300/60">LOADING ADMINS…</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-emerald-400/20 bg-slate-950/70">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-emerald-500/20 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3 font-bold">ADMIN</th>
                  <th className="px-4 py-3 font-bold">TIER</th>
                  <th className="px-4 py-3 font-bold">EXPIRES</th>
                  <th className="px-4 py-3 font-bold">STATUS</th>
                  <th className="px-4 py-3 font-bold">USAGE</th>
                  <th className="px-4 py-3 font-bold">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin, i) => {
                  const remaining = daysRemaining(admin.expires_at)
                  const isExpired = admin.expired
                  const isSuspended = admin.suspended && !admin.is_owner
                  const isLocked = admin.is_locked
                  const tierInfo = TIER_OPTIONS.find(t => t.value === admin.pricing_tier) || TIER_OPTIONS[0]
                  const statsExpanded = expandedStats === admin.id
                  const controlExpanded = controlAdmin === admin.id
                  return (
                    <React.Fragment key={admin.id}>
                      <tr className={`border-b border-emerald-500/10 ${isSuspended ? 'bg-red-950/10 opacity-60' : isLocked ? 'bg-yellow-950/10' : i % 2 === 0 ? 'bg-black/20' : 'bg-emerald-950/20'}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-400/10 text-emerald-300">
                              <FiUser />
                            </div>
                            <div>
                              {editingName === admin.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    value={editNameValue}
                                    onChange={(e) => setEditNameValue(e.target.value)}
                                    className="rounded border border-emerald-500/30 bg-black/40 px-2 py-0.5 text-xs text-slate-100 w-32"
                                    autoFocus
                                    onKeyDown={(e) => { if (e.key === 'Enter') updateAdminName(admin.id); if (e.key === 'Escape') setEditingName(null) }}
                                  />
                                  <button onClick={() => updateAdminName(admin.id)} className="rounded p-0.5 text-emerald-400 hover:bg-emerald-500/10"><FiCheck /></button>
                                  <button onClick={() => setEditingName(null)} className="rounded p-0.5 text-red-400 hover:bg-red-500/10"><FiX /></button>
                                </div>
                              ) : (
                                <>
                                  <div className="font-bold text-slate-100 flex items-center gap-1">
                                    {admin.display_name || admin.email}
                                    {!admin.is_owner && (
                                      <button
                                        onClick={() => { setEditingName(admin.id); setEditNameValue(admin.display_name || '') }}
                                        className="text-slate-500 hover:text-emerald-300"
                                      >
                                        <FiEdit2 className="text-[10px]" />
                                      </button>
                                    )}
                                  </div>
                                  {admin.display_name && <div className="text-xs text-slate-500">{admin.email}</div>}
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            admin.pricing_tier === 'enterprise' ? 'bg-purple-400/15 text-purple-300' :
                            admin.pricing_tier === 'premium' ? 'bg-amber-400/15 text-amber-300' :
                            'bg-slate-400/15 text-slate-300'
                          }`}>
                            {tierInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {editingId === admin.id ? (
                            <div className="flex flex-col gap-1">
                              <select
                                value={editExpiry}
                                onChange={(e) => setEditExpiry(Number(e.target.value))}
                                className="rounded-lg border border-emerald-500/30 bg-black/40 px-2 py-1 text-xs text-slate-100"
                              >
                                {EXPIRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                              <select
                                value={editTier}
                                onChange={(e) => setEditTier(e.target.value)}
                                className="rounded-lg border border-emerald-500/30 bg-black/40 px-2 py-1 text-xs text-slate-100"
                              >
                                {TIER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label} ₹{o.price}/mo</option>)}
                              </select>
                              <div className="flex gap-1">
                                <button onClick={() => updateAdmin(admin.id)} className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10"><FiCheck /></button>
                                <button onClick={() => setEditingId(null)} className="rounded p-1 text-red-400 hover:bg-red-500/10"><FiX /></button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-300">{formatDate(admin.expires_at)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {admin.is_owner ? (
                            <span className="status-pill online">OWNER</span>
                          ) : isSuspended ? (
                            <span className="rounded-full bg-red-400/15 px-3 py-1 text-xs font-bold text-red-300">SUSPENDED</span>
                          ) : isExpired ? (
                            <span className="rounded-full bg-red-400/15 px-3 py-1 text-xs font-bold text-red-300">EXPIRED</span>
                          ) : isLocked ? (
                            <span className="rounded-full bg-yellow-400/15 px-3 py-1 text-xs font-bold text-yellow-300">LOCKED</span>
                          ) : remaining !== null && remaining <= 7 ? (
                            <span className="rounded-full bg-yellow-400/15 px-3 py-1 text-xs font-bold text-yellow-300">{remaining}D LEFT</span>
                          ) : (
                            <span className="status-pill online">ACTIVE</span>
                          )}
                          {admin.failed_login_attempts > 0 && !admin.is_owner && (
                            <div className="mt-1 text-[10px] text-red-400">{admin.failed_login_attempts} failed attempt{admin.failed_login_attempts > 1 ? 's' : ''}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!admin.is_owner ? (
                            <button
                              onClick={() => setExpandedStats(statsExpanded ? null : admin.id)}
                              className="flex items-center gap-2 rounded-lg border border-emerald-500/20 px-2 py-1 text-xs text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                            >
                              <FiActivity />
                              <span>{admin.sms_total || 0} SMS</span>
                              <span>/ {admin.devices_total || 0} DEV</span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                          {statsExpanded && (
                            <div className="mt-2 rounded-lg border border-emerald-500/15 bg-black/30 p-3 text-xs text-slate-400">
                              <div className="grid grid-cols-2 gap-2">
                                <div><span className="text-slate-500">SMS Sent:</span> <span className="text-emerald-300">{admin.sms_sent || 0}</span></div>
                                <div><span className="text-slate-500">SMS Received:</span> <span className="text-emerald-300">{admin.sms_received || 0}</span></div>
                                <div><span className="text-slate-500">Devices Online:</span> <span className="text-emerald-300">{admin.devices_online || 0}/{admin.devices_total || 0}</span></div>
                                <div><span className="text-slate-500">API Keys:</span> <span className="text-emerald-300">{admin.api_keys || 0}</span></div>
                                <div><span className="text-slate-500">Last Login:</span> <span className="text-slate-300">{formatDateTime(admin.last_login)}</span></div>
                                <div><span className="text-slate-500">Created:</span> <span className="text-slate-300">{formatDate(admin.created_at)}</span></div>
                                {admin.signup_ip && <div><span className="text-slate-500">Signup IP:</span> <span className="font-mono text-sky-300">{admin.signup_ip}</span></div>}
                                {admin.signup_fingerprint && <div><span className="text-slate-500">Fingerprint:</span> <span className="font-mono text-sky-300 text-[10px]">{admin.signup_fingerprint.slice(0, 20)}...</span></div>}
                                <div><span className="text-slate-500">Failed Attempts:</span> <span className={admin.failed_login_attempts > 0 ? 'text-red-300' : 'text-emerald-300'}>{admin.failed_login_attempts || 0}</span></div>
                                <div><span className="text-slate-500">Locked:</span> <span className={isLocked ? 'text-yellow-300' : 'text-emerald-300'}>{isLocked ? 'YES' : 'No'}</span></div>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!admin.is_owner && (
                            <div className="flex flex-wrap gap-1">
                              <button
                                onClick={() => setControlExpanded(controlExpanded ? null : admin.id)}
                                className={`rounded-lg border px-2 py-1 text-xs font-bold ${controlExpanded ? 'border-amber-500/50 bg-amber-500/10 text-amber-300' : 'border-amber-500/30 text-amber-300 hover:bg-amber-500/10'}`}
                              >
                                <FiShield /> CONTROL
                              </button>
                              <button
                                onClick={() => toggleSuspend(admin.id, admin.suspended)}
                                className={`rounded-lg border px-2 py-1 text-xs font-bold ${
                                  admin.suspended
                                    ? 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10'
                                    : 'border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10'
                                }`}
                              >
                                {admin.suspended ? 'RESUME' : 'SUSPEND'}
                              </button>
                              {editingId === admin.id ? null : (
                                <button
                                  onClick={() => { setEditingId(admin.id); setEditExpiry(3); setEditTier(admin.pricing_tier || 'basic') }}
                                  className="rounded-lg border border-emerald-500/30 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
                                >
                                  <FiClock /> EDIT
                                </button>
                              )}
                              <button
                                onClick={() => deleteAdmin(admin.id, admin.email)}
                                className="rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
                              >
                                <FiTrash2 />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {controlExpanded && !admin.is_owner && (
                        <tr>
                          <td colSpan={6} className="px-4 py-0">
                            <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-950/10 p-4">
                              <div className="mb-3 text-xs font-black uppercase tracking-wider text-amber-300">FULL CONTROL — {admin.email}</div>
                              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                <button
                                  onClick={() => resetPassword(admin.id, admin.email)}
                                  className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-black/30 p-3 text-xs font-bold text-amber-300 hover:bg-amber-500/10 transition-all"
                                >
                                  <FiKey /> RESET PASSWORD
                                </button>
                                <button
                                  onClick={() => unlockAccount(admin.id, admin.email)}
                                  disabled={!isLocked && (!admin.failed_login_attempts || admin.failed_login_attempts === 0)}
                                  className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-black/30 p-3 text-xs font-bold text-emerald-300 hover:bg-emerald-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <FiUnlock /> UNLOCK ACCOUNT
                                </button>
                                <button
                                  onClick={() => invalidateSessions(admin.id, admin.email)}
                                  className="flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-black/30 p-3 text-xs font-bold text-red-300 hover:bg-red-500/10 transition-all"
                                >
                                  <FiLogOut /> FORCE LOGOUT
                                </button>
                                <button
                                  onClick={() => fetchLoginHistory(admin.id, admin.email)}
                                  disabled={loginHistoryLoading}
                                  className="flex items-center justify-center gap-2 rounded-xl border border-sky-500/30 bg-black/30 p-3 text-xs font-bold text-sky-300 hover:bg-sky-500/10 transition-all"
                                >
                                  <FiDatabase /> LOGIN HISTORY
                                </button>
                              </div>
                              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-slate-500">
                                <div>Token Version: <span className="text-slate-300">{admin.token_version || 0}</span></div>
                                <div>Failed Attempts: <span className={admin.failed_login_attempts > 0 ? 'text-red-300' : 'text-slate-300'}>{admin.failed_login_attempts || 0}</span></div>
                                <div>Last Attempt: <span className="text-slate-300">{formatDateTime(admin.last_login_attempt)}</span></div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
                {!admins.length && (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-500">No admins found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
