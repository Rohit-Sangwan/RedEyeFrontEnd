import React, { useMemo, useState } from 'react'
import { FiPhone, FiSend } from 'react-icons/fi'
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

const QUICK_CODES = [
  { code: '*123#', label: 'Balance Check' },
  { code: '*121#', label: 'Data Balance' },
  { code: '*199#', label: 'Phone Number' },
  { code: '*#06#', label: 'IMEI Number' },
  { code: '##002#', label: 'Cancel All Forwarding' },
  { code: '*401#', label: 'Call Forward Status' }
]

export default function DialUSSD({ deviceId, device }) {
  const [ussdCode, setUssdCode] = useState('')
  const [simSlot, setSimSlot] = useState('0')
  const [sending, setSending] = useState(false)

  const simOptions = useMemo(() => ([
    { value: '0', label: simLabel(device?.phone_sim1, 'SIM 1') },
    { value: '1', label: simLabel(device?.phone_sim2, 'SIM 2') }
  ]), [device?.phone_sim1, device?.phone_sim2])

  async function sendUSSD(code) {
    const ussd = code || ussdCode
    if (!ussd.trim()) {
      return toast.error('USSD CODE REQUIRED')
    }

    setSending(true)
    try {
      const response = await fetch(`${API_BASE}/sms/ussd`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          deviceId,
          ussdCode: ussd.trim(),
          simSlot: Number(simSlot)
        })
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'USSD failed')

      toast.success('USSD COMMAND SENT')
      if (!code) setUssdCode('')
    } catch (error) {
      toast.error(`USSD FAILED: ${error.message}`)
    } finally {
      setSending(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    sendUSSD()
  }

  return (
    <section className="cyber-card p-4">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-black tracking-wide text-emerald-300">
        <FiPhone /> DIAL USSD
      </h2>

      <p className="mb-4 text-xs text-slate-400">
        Send USSD codes to the device. The response will appear on the device screen.
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
                name="ussdSimSlot"
                value={option.value}
                checked={simSlot === option.value}
                onChange={(event) => setSimSlot(event.target.value)}
                className="h-4 w-4 accent-emerald-400"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mb-5">
        <label className="mb-3 block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">USSD Code</span>
          <input
            value={ussdCode}
            onChange={(event) => setUssdCode(event.target.value)}
            className="w-full rounded-xl border border-emerald-500/30 bg-black/40 p-3 font-mono text-lg text-slate-100 outline-none focus:border-emerald-400"
            placeholder="*123#"
          />
        </label>

        <button
          type="submit"
          disabled={sending || !ussdCode.trim()}
          className="w-full rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-black hover:bg-emerald-300 disabled:opacity-60"
        >
          {sending ? 'DIALING…' : 'DIAL USSD CODE'}
        </button>
      </form>

      <div className="border-t border-emerald-500/20 pt-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Quick Codes</h3>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {QUICK_CODES.map((item) => (
            <button
              key={item.code}
              type="button"
              disabled={sending}
              onClick={() => { setUssdCode(item.code); sendUSSD(item.code) }}
              className="flex flex-col items-center gap-1 rounded-xl border border-emerald-500/20 bg-black/30 p-3 text-center hover:bg-emerald-500/10 transition-all"
            >
              <span className="font-mono text-sm font-bold text-emerald-300">{item.code}</span>
              <span className="text-[10px] text-slate-500">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
