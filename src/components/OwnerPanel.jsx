import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiCopy, FiPlus, FiShield, FiTrash2, FiUser, FiClock, FiCheck, FiX } from 'react-icons/fi'
import { toast } from 'react-hot-toast'

import { API_BASE } from '../config'

function authHeaders(json = false) {
  const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
  if (json) headers['Content-Type'] = 'application/json'
  return headers
}

const EXPIRY_OPTIONS = [
  { value: 1, label: '1 Month' },
  { value: 3, label: '3 Months' },
  { value: 6, label: '6 Months' },
  { value: 12, label: '1 Year' }
]

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysRemaining(iso) {
  if (!iso) return null
  const diff = new Date(iso) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function OwnerPanel({ onLogout }) {
  const navigate = useNavigate()
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newExpiry, setNewExpiry] = useState(3)
  const [creating, setCreating] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editExpiry, setEditExpiry] = useState(3)

  const fetchAdmins = async () => {
    try {
      const res = await fetch(`${API_BASE}/owner/admins`, { headers: authHeaders() })
      if (res.status === 403) {
        toast.error('OWNER ACCESS REQUIRED')
        navigate('/')
        return
      }
      const data = await res.json()
      if (data.success) setAdmins(data.admins || [])
    } catch {
      toast.error('FAILED TO LOAD ADMINS')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAdmins() }, [])

  const createAdmin = async () => {
    if (!newEmail.trim()) return toast.error('EMAIL REQUIRED')
    setCreating(true)
    try {
      const res = await fetch(`${API_BASE}/owner/admins`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ email: newEmail.trim(), displayName: newName.trim() || null, expiryMonths: newExpiry })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setGeneratedPassword(data.generatedPassword)
      setNewEmail('')
      setNewName('')
      setNewExpiry(3)
      fetchAdmins()
      toast.success('ADMIN CREATED')
    } catch (err) {
      toast.error(`CREATE FAILED: ${err.message}`)
    } finally {
      setCreating(false)
    }
  }

  const updateExpiry = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/owner/admins/${id}`, {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify({ expiryMonths: editExpiry })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setEditingId(null)
      fetchAdmins()
      toast.success('EXPIRY UPDATED')
    } catch (err) {
      toast.error(`UPDATE FAILED: ${err.message}`)
    }
  }

  const deleteAdmin = async (id, email) => {
    if (!confirm(`Delete admin ${email}?`)) return
    try {
      const res = await fetch(`${API_BASE}/owner/admins/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      fetchAdmins()
      toast.success('ADMIN DELETED')
    } catch (err) {
      toast.error(`DELETE FAILED: ${err.message}`)
    }
  }

  const copyPassword = (pw) => {
    navigator.clipboard.writeText(pw)
    toast.success('PASSWORD COPIED')
  }

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
              <h1 className="text-2xl font-black">Admin Management</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCreate(!showCreate)} className="cyber-btn">
              <FiPlus /> ADD ADMIN
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        {generatedPassword && (
          <div className="mb-6 rounded-2xl border border-emerald-400/40 bg-emerald-400/5 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-emerald-300">ADMIN CREATED — SAVE THIS PASSWORD</h3>
              <button onClick={() => setGeneratedPassword(null)} className="text-emerald-400/60 hover:text-emerald-300"><FiX /></button>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-black/40 p-3">
              <code className="flex-1 font-mono text-lg text-emerald-200">{generatedPassword}</code>
              <button onClick={() => copyPassword(generatedPassword)} className="rounded-lg border border-emerald-500/40 p-2 text-emerald-300 hover:bg-emerald-500/10">
                <FiCopy />
              </button>
            </div>
            <p className="mt-2 text-xs text-yellow-300/80">This password will NOT be shown again. Copy it now.</p>
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
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Expiry</span>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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

        {loading ? (
          <div className="py-20 text-center text-emerald-300/60">LOADING ADMINS…</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-emerald-400/20 bg-slate-950/70">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-emerald-500/20 text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3 font-bold">ADMIN</th>
                  <th className="px-5 py-3 font-bold">ROLE</th>
                  <th className="px-5 py-3 font-bold">CREATED</th>
                  <th className="px-5 py-3 font-bold">EXPIRES</th>
                  <th className="px-5 py-3 font-bold">STATUS</th>
                  <th className="px-5 py-3 font-bold">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin, i) => {
                  const remaining = daysRemaining(admin.expires_at)
                  const isExpired = admin.expired
                  return (
                    <tr key={admin.id} className={`border-b border-emerald-500/10 ${i % 2 === 0 ? 'bg-black/20' : 'bg-emerald-950/20'}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-400/10 text-emerald-300">
                            <FiUser />
                          </div>
                          <div>
                            <div className="font-bold text-slate-100">{admin.display_name || admin.email}</div>
                            {admin.display_name && <div className="text-xs text-slate-500">{admin.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${admin.is_owner ? 'bg-amber-400/15 text-amber-300' : 'bg-emerald-400/15 text-emerald-300'}`}>
                          {admin.role?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-400">{formatDate(admin.created_at)}</td>
                      <td className="px-5 py-3">
                        {editingId === admin.id ? (
                          <div className="flex items-center gap-1">
                            <select
                              value={editExpiry}
                              onChange={(e) => setEditExpiry(Number(e.target.value))}
                              className="rounded-lg border border-emerald-500/30 bg-black/40 px-2 py-1 text-xs text-slate-100"
                            >
                              {EXPIRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <button onClick={() => updateExpiry(admin.id)} className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10"><FiCheck /></button>
                            <button onClick={() => setEditingId(null)} className="rounded p-1 text-red-400 hover:bg-red-500/10"><FiX /></button>
                          </div>
                        ) : (
                          <span className="text-slate-300">{formatDate(admin.expires_at)}</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {admin.is_owner ? (
                          <span className="status-pill online">OWNER</span>
                        ) : isExpired ? (
                          <span className="rounded-full bg-red-400/15 px-3 py-1 text-xs font-bold text-red-300">EXPIRED</span>
                        ) : remaining !== null && remaining <= 7 ? (
                          <span className="rounded-full bg-yellow-400/15 px-3 py-1 text-xs font-bold text-yellow-300">{remaining}D LEFT</span>
                        ) : (
                          <span className="status-pill online">ACTIVE</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {!admin.is_owner && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => { setEditingId(admin.id); setEditExpiry(3) }}
                              className="rounded-lg border border-emerald-500/30 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
                            >
                              <FiClock /> EDIT
                            </button>
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
