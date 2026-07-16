import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiCopy, FiEye, FiEyeOff, FiKey, FiPower, FiSave, FiSend, FiShield } from 'react-icons/fi'
import { toast } from 'react-hot-toast'

import { API_BASE } from '../config'

function authHeaders(json = false) {
  return {
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    ...(json ? { 'Content-Type': 'application/json' } : {})
  }
}

function indiaDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(date)
}

async function copyText(text, label = 'COPIED') {
  const value = String(text || '')
  if (!value) return toast.error('NOTHING TO COPY')

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
  } else {
    const area = document.createElement('textarea')
    area.value = value
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    document.body.removeChild(area)
  }

  toast.success(label)
}

function maskApiKey(value) {
  const key = String(value || '')
  if (!key) return '—'

  const visiblePrefix = key.slice(0, 14)
  const visibleSuffix = key.slice(-6)
  const hiddenLength = Math.max(key.length - visiblePrefix.length - visibleSuffix.length, 8)

  return `${visiblePrefix}${'•'.repeat(hiddenLength)}${visibleSuffix}`
}

function normalizeApiKey(payload) {
  if (payload?.key && typeof payload.key === 'object') return payload.key
  if (typeof payload?.key === 'string') return payload
  if (Array.isArray(payload?.keys)) return payload.keys.find((item) => !item.revoked_at) || null
  if (Array.isArray(payload)) return payload.find((item) => !item.revoked_at) || null
  return null
}

export default function Settings({ onLogout }) {
  const navigate = useNavigate()

  const [busy, setBusy] = useState(false)
  const [apiKey, setApiKey] = useState(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [settings, setSettings] = useState({
    telegram_chat_id: '',
    telegram_bot_token_masked: ''
  })
  const [botToken, setBotToken] = useState('')
  const [logs, setLogs] = useState([])
  const [pw, setPw] = useState({
    currentPassword: '',
    newPassword: ''
  })

  const hasApiKey = useMemo(() => Boolean(apiKey?.key), [apiKey])

  async function load() {
    try {
      const [keyRes, settingsRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/apikeys`, { headers: authHeaders() }),
        fetch(`${API_BASE}/settings`, { headers: authHeaders() }),
        fetch(`${API_BASE}/settings/wake-logs`, { headers: authHeaders() })
      ])

      const keyPayload = await keyRes.json().catch(() => ({}))
      const settingsPayload = await settingsRes.json().catch(() => ({}))
      const logsPayload = await logsRes.json().catch(() => ({}))

      if (keyRes.ok) {
        setApiKey(normalizeApiKey(keyPayload))
      }

      if (settingsRes.ok) {
        const nextSettings = settingsPayload.settings || settingsPayload || {}
        setSettings({
          telegram_chat_id: nextSettings.telegram_chat_id || '',
          telegram_bot_token_masked: nextSettings.telegram_bot_token_masked || ''
        })
      }

      if (logsRes.ok) {
        setLogs(Array.isArray(logsPayload.logs) ? logsPayload.logs : [])
      }
    } catch (error) {
      toast.error(`SETTINGS LOAD FAILED: ${error.message}`)
    }
  }

  useEffect(() => {
    load()

    // Browser password managers can inject saved admin email/password into unrelated fields.
    // Keep sensitive settings fields blank unless the admin types them manually.
    const clearAutofillNoise = () => {
      setBotToken('')
      setPw({ currentPassword: '', newPassword: '' })
    }

    clearAutofillNoise()
    const t1 = window.setTimeout(clearAutofillNoise, 150)
    const t2 = window.setTimeout(clearAutofillNoise, 600)

    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [])

  async function generateOnce() {
    if (hasApiKey) {
      toast.error('API KEY ALREADY EXISTS')
      return
    }

    setBusy(true)
    try {
      const response = await fetch(`${API_BASE}/apikeys`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ label: 'RedEye Android API key' })
      })

      const payload = await response.json().catch(() => ({}))

      if (response.status === 409) {
        const existing = normalizeApiKey(payload)
        if (existing) setApiKey(existing)
        throw new Error(payload.error || 'API key already generated')
      }

      if (!response.ok) throw new Error(payload.error || 'API key generation failed')

      const created = normalizeApiKey(payload)
      setApiKey(created)
      toast.success('ONE-TIME API KEY GENERATED')
    } catch (error) {
      toast.error(`KEYGEN FAILED: ${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function saveSettings() {
    setBusy(true)
    try {
      const cleanToken = botToken.trim()

      const response = await fetch(`${API_BASE}/settings`, {
        method: 'PATCH',
        headers: authHeaders(true),
        body: JSON.stringify({
          telegram_chat_id: settings.telegram_chat_id.trim(),
          ...(cleanToken ? { telegram_bot_token: cleanToken } : {})
        })
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Settings save failed')

      toast.success('SETTINGS SAVED')
      setBotToken('')
      await load()
    } catch (error) {
      toast.error(`SAVE FAILED: ${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function wakeAll() {
    setBusy(true)
    try {
      const response = await fetch(`${API_BASE}/devices/wake-offline`, {
        method: 'POST',
        headers: authHeaders()
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Wake all failed')

      const sentCount = Number(payload.sent ?? payload.count ?? 0)
      const attemptedCount = Number(payload.attempted ?? 0)

      if (sentCount <= 0) {
        toast('NO OFFLINE DEVICE TO WAKE', {
          icon: '🟢'
        })
      } else {
        toast.success(`WAKE SIGNALS SENT: ${sentCount}`)
      }

      await load()
    } catch (error) {
      toast.error(`WAKE ALL FAILED: ${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function changePassword() {
    if (!pw.currentPassword || !pw.newPassword) {
      toast.error('CURRENT AND NEW PASSWORD REQUIRED')
      return
    }

    setBusy(true)
    try {
      const response = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(pw)
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Password change failed')

      toast.success('PASSWORD CHANGED — LOGGING OUT')
      localStorage.removeItem('token')
      setTimeout(() => {
        onLogout?.()
        navigate('/login', { replace: true })
      }, 700)
    } catch (error) {
      toast.error(`PASSWORD FAILED: ${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="cyber-bg min-h-screen text-slate-100">
      <header className="border-b border-emerald-500/20 bg-black/50 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 px-3 py-2 text-sm font-bold text-emerald-200 hover:bg-emerald-500/10"
          >
            <FiArrowLeft /> Back
          </button>

          <div className="text-right">
            <h1 className="text-xl font-black text-emerald-300">SYSTEM SETTINGS</h1>
            <p className="text-xs text-slate-400">Secure admin controls</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-5 p-5 xl:grid-cols-2">
        <form className="hidden" autoComplete="off" aria-hidden="true">
          <input type="text" name="fs_decoy_username" autoComplete="username" tabIndex={-1} />
          <input type="password" name="fs_decoy_password" autoComplete="current-password" tabIndex={-1} />
        </form>
        <section className="cyber-card p-5">
          <p className="terminal-title mb-4 flex items-center gap-2 text-emerald-300">
            <FiKey /> ANDROID API KEY
          </p>

          {hasApiKey ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/20 bg-black/40 p-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  One permanent API key
                </div>
                <div className="flex items-stretch gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-lg border border-emerald-500/20 bg-slate-950 p-3 text-sm text-emerald-200">
                    {showApiKey ? apiKey.key : maskApiKey(apiKey.key)}
                  </code>
                  <button
                    type="button"
                    onClick={() => setShowApiKey((previous) => !previous)}
                    className="inline-flex shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 px-3 text-emerald-200 hover:bg-emerald-500/10"
                    title={showApiKey ? 'Hide API key' : 'Show API key'}
                    aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showApiKey ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Created: {indiaDateTime(apiKey.created_at)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => copyText(apiKey.key, 'API KEY COPIED')}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 px-4 py-2 text-sm font-bold text-emerald-200 hover:bg-emerald-500/10"
              >
                <FiCopy /> Copy API key
              </button>

              <p className="text-xs text-slate-500">
                Regenerate, rotate, delete, and multiple API key generation are disabled.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                No API key exists yet. Generate it once, then set it inside the Android client.
              </p>

              <button
                type="button"
                disabled={busy}
                onClick={generateOnce}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2 text-sm font-black text-black hover:bg-emerald-300 disabled:opacity-60"
              >
                <FiKey /> {busy ? 'GENERATING…' : 'GENERATE ONE API KEY'}
              </button>
            </div>
          )}
        </section>

        <section className="cyber-card p-5">
          <p className="terminal-title mb-4 flex items-center gap-2 text-emerald-300">
            <FiSend /> TELEGRAM ALERTS
          </p>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                Telegram chat ID
              </span>
              <input
                value={settings.telegram_chat_id}
                onChange={(event) => setSettings((previous) => ({ ...previous, telegram_chat_id: event.target.value }))}
                className="w-full rounded-xl border border-emerald-500/30 bg-black/40 p-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                placeholder="Enter your Telegram chat ID"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                Bot token
              </span>
              <input
                type="password"
                name="fs_manual_telegram_bot_token"
                value={botToken}
                onChange={(event) => setBotToken(event.target.value)}
                onFocus={() => {
                  if (botToken.includes('@')) setBotToken('')
                }}
                className="w-full rounded-xl border border-emerald-500/30 bg-black/40 p-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                placeholder={settings.telegram_bot_token_masked || 'Paste bot token only when updating'}
                autoComplete="new-password"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                data-form-type="other"
              />
              <p className="mt-2 text-xs text-slate-500">
                Saved token is never printed here. Admin email will not appear in this field.
              </p>
            </label>

            <button
              type="button"
              disabled={busy}
              onClick={saveSettings}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2 text-sm font-black text-black hover:bg-emerald-300 disabled:opacity-60"
            >
              <FiSave /> SAVE TELEGRAM SETTINGS
            </button>
          </div>
        </section>

        <section className="cyber-card p-5">
          <p className="terminal-title mb-4 flex items-center gap-2 text-emerald-300">
            <FiPower /> WAKE OFFLINE DEVICES
          </p>

          <button
            type="button"
            disabled={busy}
            onClick={wakeAll}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 px-4 py-2 text-sm font-bold text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-60"
          >
            <FiPower /> WAKE ALL OFFLINE
          </button>

          <div className="max-h-72 space-y-2 overflow-auto pr-1">
            {logs.length ? logs.map((log, index) => (
              <div key={log.id || index} className="rounded-xl border border-emerald-500/20 bg-black/30 p-3">
                <div className="text-sm font-bold text-slate-200">
                  {log.model || log.device_model || 'Unknown device'} — {log.device_uid || log.device_id || '—'}
                </div>
                <div className="text-xs text-slate-500">
                  {indiaDateTime(log.created_at || log.waked_at || log.timestamp)}
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-500">No wake logs yet.</p>
            )}
          </div>
        </section>

        <section className="cyber-card p-5">
          <p className="terminal-title mb-4 flex items-center gap-2 text-emerald-300">
            <FiShield /> ADMIN PASSWORD
          </p>

          <div className="space-y-4">
            <input
              type="password"
              name="fs_manual_current_password"
              value={pw.currentPassword}
              onChange={(event) => setPw((previous) => ({ ...previous, currentPassword: event.target.value }))}
              onFocus={() => {
                if (pw.currentPassword.includes('@')) setPw((previous) => ({ ...previous, currentPassword: '' }))
              }}
              className="w-full rounded-xl border border-emerald-500/30 bg-black/40 p-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
              placeholder="Current password"
              autoComplete="new-password"
              autoCorrect="off"
              spellCheck={false}
              data-lpignore="true"
              data-form-type="other"
            />

            <input
              type="password"
              name="fs_manual_new_password"
              value={pw.newPassword}
              onChange={(event) => setPw((previous) => ({ ...previous, newPassword: event.target.value }))}
              className="w-full rounded-xl border border-emerald-500/30 bg-black/40 p-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
              placeholder="New password"
              autoComplete="new-password"
              autoCorrect="off"
              spellCheck={false}
              data-lpignore="true"
              data-form-type="other"
            />

            <button
              type="button"
              disabled={busy}
              onClick={changePassword}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/50 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-60"
            >
              <FiShield /> CHANGE PASSWORD & LOGOUT
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
