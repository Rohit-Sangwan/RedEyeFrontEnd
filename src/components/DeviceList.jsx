import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiBattery, FiClock, FiSearch, FiStar, FiTrash2, FiWifi, FiCheckSquare, FiPhone } from 'react-icons/fi'
import { toast } from 'react-hot-toast'
import { formatIndiaDateTime } from '../utils/time'

import { API_BASE } from '../config'

const displayName = (d) => {
  const base = d.model || d.device_uid || 'Unknown device'
  return d.nickname ? `${base} (${d.nickname})` : base
}

function FolderLabel({ kind, label }) {
  if (kind === 'online') return <><span className="folder-dot online" />{label}</>
  if (kind === 'offline') return <><span className="folder-dot offline" />{label}</>
  if (kind === 'upipin') return <><span className="folder-dot amber" />{label}</>
  return label
}

export default function DeviceList({ devices, loading, onUpdated, onDeleted }) {
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')

  const headers = (json=false) => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, ...(json ? { 'Content-Type': 'application/json' } : {}) })

  const quickPatch = async (device, patch) => {
    try {
      const res = await fetch(`${API_BASE}/devices/${device.device_uid}`, { method: 'PATCH', headers: headers(true), body: JSON.stringify(patch) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'update failed')
      onUpdated?.(data.device)
    } catch (e) {
      toast.error(`UPDATE FAILED: ${e.message}`)
    }
  }

  const deleteDevice = async (device, e) => {
    e.preventDefault(); e.stopPropagation()
    const typed = window.prompt(`Permanent delete ${displayName(device)}? Type YES to delete.`)
    if (typed !== 'YES') return
    try {
      const res = await fetch(`${API_BASE}/devices/${device.device_uid}`, { method: 'DELETE', headers: headers() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'delete failed')
      onDeleted?.(device.device_uid)
      toast.success('DEVICE PURGED')
    } catch (e) { toast.error(`DELETE FAILED: ${e.message}`) }
  }

  const filtered = useMemo(() => devices.filter(d => {
    if (tab === 'online' && !d.online) return false
    if (tab === 'offline' && d.online) return false
    if (tab === 'fav' && !d.favorite) return false
    if (tab === 'upipin' && !d.has_upipin_sms) return false
    const q = search.toLowerCase()
    return !q || [d.device_uid, d.model, d.nickname, d.network, d.phone_number, d.status_text].some(v => String(v || '').toLowerCase().includes(q))
  }), [devices, tab, search])

  if (loading) return <div className="cyber-card p-10 text-center font-mono text-emerald-300">SCANNING DEVICE MATRIX…</div>

  const folders = [
    ['all','All devices'],['online','Online devices'],['offline','Offline devices'],['fav','Fav devices'],['upipin','UPIPIN folder']
  ]

  return <section className="cyber-card overflow-hidden">
    <div className="border-b border-emerald-400/20 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="terminal-title">device folders</p><h2 className="text-xl font-black">Managed Devices</h2></div>
        <div className="relative w-full max-w-sm"><FiSearch className="absolute left-3 top-3.5 text-emerald-300/60"/><input className="cyber-input pl-10" value={search} onChange={e=>setSearch(e.target.value)} placeholder="search uid/model/nickname/phone" /></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {folders.map(([k,label]) => <button key={k} onClick={()=>setTab(k)} className={`cyber-btn compact ${tab===k?'active':''}`}><FolderLabel kind={k} label={label}/></button>)}
      </div>
    </div>
    <div className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2 2xl:grid-cols-3">
      {filtered.map(device => <DeviceCard key={device.device_uid} device={device} quickPatch={quickPatch} deleteDevice={deleteDevice} />)}
      {filtered.length === 0 && <div className="col-span-full p-12 text-center muted">NO DEVICES IN THIS FOLDER</div>}
    </div>
  </section>
}

function DeviceCard({ device, quickPatch, deleteDevice }) {
  return <Link to={`/device/${device.device_uid}`} className="device-card device-card-compact">
    <div className="mb-2 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="truncate text-base font-black text-emerald-50">{device.device_sequence ? `#${device.device_sequence} ` : ''}{displayName(device)}</h3>
        <p className="truncate font-mono text-xs text-emerald-200/55">{device.device_uid}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2" onClick={e=>e.preventDefault()}>
        <label title="Checked device" className="flex items-center gap-1 text-emerald-300/80"><input type="checkbox" checked={!!device.is_device_checked} onChange={e=>quickPatch(device,{is_device_checked:e.target.checked})}/><FiCheckSquare /></label>
        <button title="Favorite" onClick={()=>quickPatch(device,{favorite:!device.favorite})} className={device.favorite?'text-yellow-300':'text-emerald-200/55'}><FiStar /></button>
        <span className={`status-pill ${device.online ? 'online' : 'offline'}`}>{device.online ? 'ONLINE' : 'OFFLINE'}</span>
        <button onClick={(e)=>deleteDevice(device,e)} className="danger-btn compact" title="Delete"><FiTrash2 /></button>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2 text-xs">
      <Info icon={<FiBattery/>} label="Battery" value={device.battery != null ? `${device.battery}%${device.charging ? ' charging' : ''}` : '—'} />
      <Info icon={<FiWifi/>} label="Network" value={device.network || '—'} />
      <Info icon={<FiPhone/>} label="Phone" value={device.phone_number || '—'} />
      <Info icon={<FiClock/>} label="Last seen" value={formatIndiaDateTime(device.last_seen)} />
    </div>
    {device.status_text && <div className="mt-2 rounded-xl border border-emerald-400/15 bg-black/25 p-2 text-xs"><span className="terminal-title">status</span><p className="mt-1 line-clamp-2 text-emerald-100">{device.status_text}</p></div>}
    {device.has_upipin_sms && <div className="mt-2 rounded-xl border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-xs font-bold text-yellow-200">UPIPIN SMS: {device.upipin_sms_count || 1}</div>}
  </Link>
}
function Info({ icon, label, value }) { return <div className="rounded-xl border border-emerald-400/10 bg-black/20 p-2"><div className="mb-1 flex items-center gap-1 muted">{icon}{label}</div><div className="break-words font-mono font-bold">{value}</div></div> }
