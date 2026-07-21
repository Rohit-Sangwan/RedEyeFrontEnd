import React, { useMemo, useState } from 'react'
import { FiClipboard, FiSend } from 'react-icons/fi'
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

function parseNumberMessageLine(value) {
  const text = String(value || '').trim()
  if (!text) return null

  const match = text.match(/^(.+?)\s*\|\s*([\s\S]+)$/)
  if (!match) return null

  const phone = String(match[1] || '').trim()
  const message = String(match[2] || '').trim()

  if (!phone || !message) return null
  return { phone, message }
}

async function readClipboardText() {
  if (!navigator.clipboard?.readText) {
    throw new Error('Clipboard read is blocked by browser permission')
  }
  return navigator.clipboard.readText()
}

export default function SendSMS({ deviceId, device, onSentSuccess }) {
  const [to, setTo] = useState('')
  const [message, setMessage] = useState('')
  const [simSlot, setSimSlot] = useState('0')
  const [sending, setSending] = useState(false)

  const simOptions = useMemo(() => ([
    { value: '0', label: simLabel(device?.phone_sim1, 'SIM 1') },
    { value: '1', label: simLabel(device?.phone_sim2, 'SIM 2') }
  ]), [device?.phone_sim1, device?.phone_sim2])

  async function pasteNormalNumberMessage() {
    try {
      const text = await readClipboardText()
      const parsed = parseNumberMessageLine(text)

      if (parsed) {
        setTo(parsed.phone)
        setMessage(parsed.message)
        toast.success('NUMBER | MESSAGE PASTED')
        return
      }

      const cleanText = String(text || '').trim()
      if (!cleanText) {
        toast.error('CLIPBOARD EMPTY')
        return
      }

      setMessage(cleanText)
      toast.success('MESSAGE BODY PASTED')
    } catch (error) {
      toast.error(`PASTE FAILED: ${error.message}`)
    }
  }

  async function submit(event) {
    event.preventDefault()

    if (!to.trim() || !message.trim()) {
      return toast.error('TARGET AND PAYLOAD REQUIRED')
    }

    setSending(true)
    try {
      const response = await fetch(`${API_BASE}/sms/send`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          deviceId,
          to: to.trim(),
          message: message.trim(),
          simSlot: Number(simSlot)
        })
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'SMS send failed')

      toast.success('SMS COMMAND SENT')
      setTo('')
      setMessage('')
      onSentSuccess?.()
    } catch (error) {
      toast.error(`SMS SEND FAILED: ${error.message}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="cyber-card p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="flex items-center gap-2 text-lg font-black tracking-wide text-emerald-300">
          <FiSend /> SEND SMS COMMAND
        </h2>

        <button
          type="button"
          onClick={pasteNormalNumberMessage}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 px-4 py-2.5 text-sm font-bold text-emerald-200 hover:bg-emerald-500/10 md:w-auto md:py-2"
        >
          <FiClipboard /> PASTE NUMBER | MESSAGE
        </button>
      </div>

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
                name="simSlot"
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

      <form onSubmit={submit} className="grid gap-3">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Recipient number</span>
          <input
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="w-full rounded-xl border border-emerald-500/30 bg-black/40 p-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
            placeholder="+91..."
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">SMS body</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={5}
            className="w-full rounded-xl border border-emerald-500/30 bg-black/40 p-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
            placeholder="Message payload..."
          />
        </label>

        <button
          type="submit"
          disabled={sending}
          className="w-full rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-black hover:bg-emerald-300 disabled:opacity-60 md:w-auto"
        >
          {sending ? 'TRANSMITTING…' : 'SEND SMS COMMAND'}
        </button>
      </form>
    </section>
  )
}
