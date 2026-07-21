import React, { useMemo, useRef, useState } from 'react'
import { FiClipboard, FiFileText, FiUpload, FiX } from 'react-icons/fi'
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

const MAX_CSV_ROWS = 100

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return { contacts: [], errors: [] }

  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase())
  const errors = []

  const phoneIdx = headers.findIndex((h) => ['phone', 'number', 'mobile', 'cell', 'tel', 'telephone'].includes(h))
  if (phoneIdx === -1) {
    return { contacts: [], errors: ['CSV must have a phone/number/mobile column'] }
  }

  const nameIdx = headers.findIndex((h) => ['name', 'contact', 'first_name', 'firstname', 'fname'].includes(h))

  const contacts = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''))
    const phone = (cols[phoneIdx] || '').replace(/[\s\-()]/g, '')
    const digits = phone.replace(/\D/g, '')

    if (!digits || digits.length < 7) {
      errors.push(`Row ${i + 1}: invalid phone "${cols[phoneIdx] || ''}"`)
      continue
    }

    contacts.push({
      phone: cols[phoneIdx] || '',
      name: nameIdx >= 0 ? (cols[nameIdx] || '') : '',
      _row: i + 1
    })
  }

  return { contacts, errors }
}

function applyTemplate(template, contact) {
  return template
    .replace(/\{name\}/gi, contact.name || '')
    .replace(/\{phone\}/gi, contact.phone || '')
}

export default function BulkSMS({ deviceId, device, onSentSuccess }) {
  const [bulk, setBulk] = useState('')
  const [bulkSending, setBulkSending] = useState(false)
  const [bulkSimSlot, setBulkSimSlot] = useState('0')
  const [bulkMode, setBulkMode] = useState('manual')
  const [csvContacts, setCsvContacts] = useState([])
  const [csvErrors, setCsvErrors] = useState([])
  const [messageTemplate, setMessageTemplate] = useState('')
  const csvInputRef = useRef(null)

  const simOptions = useMemo(() => ([
    { value: '0', label: simLabel(device?.phone_sim1, 'SIM 1') },
    { value: '1', label: simLabel(device?.phone_sim2, 'SIM 2') }
  ]), [device?.phone_sim1, device?.phone_sim2])

  const bulkLines = useMemo(() => {
    return bulk
      .split('\n')
      .map((line) => parseNumberMessageLine(line))
      .filter(Boolean)
  }, [bulk])

  const csvPreview = useMemo(() => {
    if (!csvContacts.length || !messageTemplate) return []
    return csvContacts.map((c) => ({
      ...c,
      message: applyTemplate(messageTemplate, c)
    }))
  }, [csvContacts, messageTemplate])

  function handleCsvUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt') && file.type !== 'text/csv') {
      toast.error('UPLOAD A .CSV FILE')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text !== 'string') {
        toast.error('FAILED TO READ FILE')
        return
      }

      const { contacts, errors } = parseCsv(text)

      if (contacts.length > MAX_CSV_ROWS) {
        setCsvContacts(contacts.slice(0, MAX_CSV_ROWS))
        setCsvErrors([...errors, `Truncated to ${MAX_CSV_ROWS} rows (max limit)`])
        toast.warning(`CSV TRUNCATED TO ${MAX_CSV_ROWS} ROWS`)
      } else {
        setCsvContacts(contacts)
        setCsvErrors(errors)
      }

      if (contacts.length) {
        toast.success(`LOADED ${contacts.length} CONTACTS`)
      } else {
        toast.error('NO VALID CONTACTS FOUND')
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  function removeCsvContact(index) {
    setCsvContacts((prev) => prev.filter((_, i) => i !== index))
  }

  function clearCsv() {
    setCsvContacts([])
    setCsvErrors([])
    setMessageTemplate('')
  }

  async function pasteBulkNumberMessages() {
    try {
      const text = await readClipboardText()
      const parsedLines = String(text || '')
        .split('\n')
        .map((line) => parseNumberMessageLine(line))
        .filter(Boolean)

      if (!parsedLines.length) {
        toast.error('BULK FORMAT: number | message')
        return
      }

      setBulk(
        parsedLines
          .map((item) => `${item.phone} | ${item.message}`)
          .join('\n')
      )
      toast.success(`BULK PASTED: ${parsedLines.length}`)
    } catch (error) {
      toast.error(`PASTE FAILED: ${error.message}`)
    }
  }

  async function sendBulk() {
    if (!bulkLines.length) {
      return toast.error('BULK FORMAT: number | message per line')
    }

    setBulkSending(true)
    try {
      const response = await fetch(`${API_BASE}/sms/bulk`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          deviceId,
          messages: bulkLines,
          simSlot: Number(bulkSimSlot)
        })
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Bulk send failed')

      toast.success(`BULK SMS QUEUED: ${bulkLines.length}`)
      setBulk('')
      onSentSuccess?.()
    } catch (error) {
      toast.error(`BULK FAILED: ${error.message}`)
    } finally {
      setBulkSending(false)
    }
  }

  async function sendCsvBulk() {
    if (!csvPreview.length) {
      return toast.error('UPLOAD CSV AND ENTER A MESSAGE TEMPLATE')
    }

    const messages = csvPreview.map((c) => ({ phone: c.phone, message: c.message }))
    setBulkSending(true)
    try {
      const response = await fetch(`${API_BASE}/sms/bulk`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          deviceId,
          messages,
          simSlot: Number(bulkSimSlot)
        })
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'CSV bulk send failed')

      toast.success(`CSV BULK SMS QUEUED: ${messages.length}`)
      clearCsv()
      onSentSuccess?.()
    } catch (error) {
      toast.error(`CSV BULK FAILED: ${error.message}`)
    } finally {
      setBulkSending(false)
    }
  }

  return (
    <section className="cyber-card p-4">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-black tracking-wide text-emerald-300">
        <FiFileText /> BULK SMS
      </h2>

      <div className="mb-4 flex flex-col gap-2 md:flex-row">
        <button
          type="button"
          onClick={() => setBulkMode('manual')}
          className={`w-full justify-center rounded-xl border px-4 py-2.5 text-xs font-bold transition md:w-auto md:py-2 ${bulkMode === 'manual' ? 'border-emerald-300/60 bg-emerald-400/25 text-emerald-50' : 'border-emerald-500/30 text-emerald-300/60 hover:bg-emerald-500/10'}`}
        >
          <FiClipboard className="mr-1 inline" /> MANUAL
        </button>
        <button
          type="button"
          onClick={() => setBulkMode('csv')}
          className={`w-full justify-center rounded-xl border px-4 py-2.5 text-xs font-bold transition md:w-auto md:py-2 ${bulkMode === 'csv' ? 'border-emerald-300/60 bg-emerald-400/25 text-emerald-50' : 'border-emerald-500/30 text-emerald-300/60 hover:bg-emerald-500/10'}`}
        >
          <FiFileText className="mr-1 inline" /> CSV IMPORT
        </button>
      </div>

      <div className="mb-4 rounded-xl border border-emerald-500/20 bg-black/30 p-3">
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Select SIM</div>
        <div className="grid gap-2 md:grid-cols-2">
          {simOptions.map((option) => (
            <label
              key={`bulk-${option.value}`}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-500/20 bg-slate-950/70 p-3 text-sm text-slate-200 hover:bg-emerald-500/10"
            >
              <input
                type="radio"
                name="bulkSimSlot"
                value={option.value}
                checked={bulkSimSlot === option.value}
                onChange={(event) => setBulkSimSlot(event.target.value)}
                className="h-4 w-4 accent-emerald-400"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {bulkMode === 'manual' ? (
        <>
          <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-sm font-black text-emerald-300">MANUAL BULK SMS</h3>
            <button
              type="button"
              onClick={pasteBulkNumberMessages}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 px-4 py-2 text-sm font-bold text-emerald-200 hover:bg-emerald-500/10"
            >
              <FiClipboard /> PASTE BULK NUMBER | MESSAGE
            </button>
          </div>

          <textarea
            value={bulk}
            onChange={(event) => setBulk(event.target.value)}
            rows={8}
            className="w-full rounded-xl border border-emerald-500/30 bg-black/40 p-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
            placeholder={`Format:\n+919999999999 | message one\n+918888888888 | message two`}
          />

          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <span className="text-xs text-slate-500">{bulkLines.length} message{bulkLines.length !== 1 ? 's' : ''} parsed</span>
            <button
              type="button"
              disabled={bulkSending || !bulkLines.length}
              onClick={sendBulk}
              className="w-full rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-black text-black hover:bg-emerald-300 disabled:opacity-60 md:w-auto"
            >
              {bulkSending ? 'QUEUEING…' : `SEND BULK SMS (${bulkLines.length})`}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-black text-emerald-300">CSV IMPORT</h3>
            {csvContacts.length > 0 && (
              <button
                type="button"
                onClick={clearCsv}
                className="inline-flex items-center gap-1 rounded-xl border border-red-500/30 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/10"
              >
                <FiX /> CLEAR
              </button>
            )}
          </div>

          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleCsvUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            className="mb-3 inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 px-4 py-2.5 text-sm font-bold text-emerald-200 hover:bg-emerald-500/10"
          >
            <FiUpload /> UPLOAD CSV
          </button>

          <div className="mb-3 rounded-xl border border-emerald-500/20 bg-black/30 p-3 text-xs text-slate-400">
            <span className="font-bold text-emerald-300">Format:</span> CSV with <code className="text-emerald-400">phone</code> column (required) and <code className="text-emerald-400">name</code> column (optional).<br />
            <span className="muted">Example:</span> <code className="text-slate-300">phone,name</code><br />
            <code className="text-slate-300">+919999999999,Rahul</code><br />
            <code className="text-slate-300">+918888888888,Priya</code>
          </div>

          {csvErrors.length > 0 && (
            <div className="mb-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-300">
              {csvErrors.map((err, i) => <div key={i}>{err}</div>)}
            </div>
          )}

          {csvContacts.length > 0 && (
            <>
              <label className="mb-3 block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Message Template</span>
                <textarea
                  value={messageTemplate}
                  onChange={(event) => setMessageTemplate(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-emerald-500/30 bg-black/40 p-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  placeholder={`Example: Hello {name}, this is an important update. Your number is {phone}.`}
                />
                <span className="mt-1 block text-[11px] text-slate-500">Variables: {'{name}'} {'{phone}'}</span>
              </label>

              <div className="mb-3 text-xs font-bold text-emerald-300">
                PREVIEW — {csvPreview.length} MESSAGE{csvPreview.length !== 1 ? 'S' : ''}
              </div>

              <div className="mb-3 max-h-64 overflow-y-auto rounded-xl border border-emerald-500/20">
                <div className="hidden md:block">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-900/95">
                      <tr className="border-b border-emerald-500/20 text-left text-slate-400">
                        <th className="px-3 py-2 font-bold">#</th>
                        <th className="px-3 py-2 font-bold">PHONE</th>
                        <th className="px-3 py-2 font-bold">NAME</th>
                        <th className="px-3 py-2 font-bold">MESSAGE</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, i) => (
                        <tr key={i} className={`border-b border-emerald-500/10 ${i % 2 === 0 ? 'bg-black/20' : 'bg-emerald-950/20'}`}>
                          <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                          <td className="px-3 py-2 font-mono text-emerald-300">{row.phone}</td>
                          <td className="px-3 py-2 text-slate-300">{row.name || '—'}</td>
                          <td className="max-w-xs truncate px-3 py-2 text-slate-300">{messageTemplate ? row.message : '—'}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => removeCsvContact(i)}
                              className="text-red-400/60 hover:text-red-300"
                            >
                              <FiX />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-2 md:hidden">
                  {csvPreview.map((row, i) => (
                    <div key={i} className="flex items-start gap-2 border-b border-emerald-500/10 px-3 py-2">
                      <span className="shrink-0 text-xs text-slate-500">{i + 1}.</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs text-emerald-300">{row.phone}</div>
                        <div className="text-xs text-slate-300">{row.name || '—'}</div>
                        <div className="mt-1 truncate text-xs text-slate-400">{messageTemplate ? row.message : '—'}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCsvContact(i)}
                        className="shrink-0 text-red-400/60 hover:text-red-300"
                      >
                        <FiX />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                disabled={bulkSending || !csvPreview.length}
                onClick={sendCsvBulk}
                className="w-full rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-black text-black hover:bg-emerald-300 disabled:opacity-60 md:w-auto"
              >
                {bulkSending ? 'QUEUEING…' : `SEND CSV BULK SMS (${csvPreview.length})`}
              </button>
            </>
          )}
        </>
      )}
    </section>
  )
}
