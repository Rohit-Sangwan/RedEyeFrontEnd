import React, { useEffect, useMemo, useRef, useState } from 'react'
import { FiClipboard, FiMessageSquare, FiSearch, FiTrash2 } from 'react-icons/fi'
import { toast } from 'react-hot-toast'

import { API_BASE } from '../config'
const INITIAL_LIMIT = 80
const POLL_LIMIT = 50
const SMS_POLL_MS = 2000
const MAX_CACHED_SMS = 250

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
}

function getMessageTime(message) {
  const raw = message?.timestamp || message?.created_at || message?.time
  const date = raw ? new Date(raw) : null
  return date && Number.isFinite(date.getTime()) ? date : null
}

function getMessageTimeValue(message) {
  const date = getMessageTime(message)
  return date ? date.getTime() : 0
}

function formatIndiaDateTime(message) {
  const date = getMessageTime(message)
  if (!date) return '—'
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

function messageKey(message) {
  if (message?.id !== undefined && message?.id !== null) return `id:${message.id}`
  return [
    message?.device_uid || message?.device_id || '',
    message?.sender || message?.recipient || '',
    message?.type || '',
    message?.timestamp || message?.created_at || '',
    message?.body || ''
  ].join('|')
}

function normalizeMessages(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.messages)) return payload.messages
  if (Array.isArray(payload?.sms)) return payload.sms
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function mergeMessages(previous, incoming) {
  const map = new Map()
  for (const message of previous || []) map.set(messageKey(message), message)
  for (const message of incoming || []) map.set(messageKey(message), message)
  return Array.from(map.values())
    .sort((a, b) => getMessageTimeValue(b) - getMessageTimeValue(a))
    .slice(0, MAX_CACHED_SMS)
}

function latestIso(messages, fallback = null) {
  let max = 0
  for (const message of messages || []) {
    max = Math.max(max, getMessageTimeValue(message))
  }
  return max > 0 ? new Date(max).toISOString() : fallback
}

async function copyToClipboard(text) {
  const value = String(text || '')
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

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

export default function SMSInbox({ deviceId }) {
  const [messages, setMessages] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const mountedRef = useRef(false)
  const pollingRef = useRef(false)
  const cursorRef = useRef(null)
  const knownKeysRef = useRef(new Set())
  const toastedKeysRef = useRef(new Set())

  async function fetchMessages({ initial = false } = {}) {
    if (pollingRef.current) return
    pollingRef.current = true

    try {
      const params = new URLSearchParams()
      params.set('limit', String(initial ? INITIAL_LIMIT : POLL_LIMIT))
      if (deviceId) params.set('deviceId', deviceId)
      if (!initial && cursorRef.current) params.set('since', cursorRef.current)

      const response = await fetch(`${API_BASE}/sms?${params.toString()}`, {
        headers: authHeaders()
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'SMS fetch failed')

      const incoming = normalizeMessages(payload)
      const incomingKeys = incoming.map(messageKey)

      if (initial) {
        knownKeysRef.current = new Set(incomingKeys)
        cursorRef.current = latestIso(incoming, cursorRef.current)
        setMessages(mergeMessages([], incoming))
        return
      }

      const trulyNew = incoming.filter((message) => {
        const key = messageKey(message)
        const isNew = !knownKeysRef.current.has(key)
        knownKeysRef.current.add(key)
        return isNew
      })

      if (incoming.length) {
        cursorRef.current = latestIso(incoming, cursorRef.current)
      }

      if (trulyNew.length) {
        setMessages((previous) => mergeMessages(previous, trulyNew))

        const newest = [...trulyNew].sort((a, b) => getMessageTimeValue(b) - getMessageTimeValue(a))[0]
        const newestKey = messageKey(newest)
        if (!toastedKeysRef.current.has(newestKey)) {
          toastedKeysRef.current.add(newestKey)
          toast.success(`NEW SMS PACKET: ${newest?.sender || newest?.recipient || 'UNKNOWN'}`)
        }
      }
    } catch (error) {
      if (initial) toast.error(`SMS LOAD FAILED: ${error.message}`)
    } finally {
      pollingRef.current = false
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    cursorRef.current = null
    knownKeysRef.current = new Set()
    toastedKeysRef.current = new Set()
    setMessages([])
    setLoading(true)

    fetchMessages({ initial: true })

    const interval = setInterval(() => {
      if (!mountedRef.current || document.hidden) return
      fetchMessages({ initial: false })
    }, SMS_POLL_MS)

    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [deviceId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return messages
    return messages.filter((message) => {
      return [message.sender, message.recipient, message.body, message.device_model, message.device_uid]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    })
  }, [messages, search])

  async function refreshNow() {
    setRefreshing(true)
    await fetchMessages({ initial: false })
  }

  async function copyBody(message) {
    try {
      await copyToClipboard(message?.body || '')
      toast.success('SMS BODY COPIED')
    } catch {
      toast.error('COPY BLOCKED')
    }
  }

  async function removeMessage(message, event) {
    event.stopPropagation()
    const id = message?.id
    if (!id) return toast.error('SMS ID MISSING')
    if (!window.confirm('Delete this SMS permanently?')) return

    try {
      const response = await fetch(`${API_BASE}/sms/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders()
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Delete failed')

      const key = messageKey(message)
      knownKeysRef.current.delete(key)
      toastedKeysRef.current.delete(key)
      setMessages((previous) => previous.filter((item) => messageKey(item) !== key))
      toast.success('SMS DELETED')
    } catch (error) {
      toast.error(`DELETE FAILED: ${error.message}`)
    }
  }

  return (
    <section className="cyber-card p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black tracking-wide text-emerald-300">
            <FiMessageSquare /> INCOMING SMS
          </h2>
        </div>

        <button
          type="button"
          onClick={refreshNow}
          disabled={refreshing}
          className="rounded-xl border border-emerald-500/40 px-4 py-2 text-sm font-bold text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-60"
        >
          {refreshing ? 'SYNCING…' : 'REFRESH'}
        </button>
      </div>

      <label className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-black/30 px-3 py-2">
        <FiSearch className="text-emerald-300" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search sender, body, device..."
          className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
      </label>

      {loading ? (
        <div className="rounded-xl border border-emerald-500/20 p-8 text-center text-sm text-emerald-200">
          LOADING SMS CACHE…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-emerald-500/20 p-8 text-center text-sm text-slate-400">
          NO SMS FOUND
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-emerald-500/20">
          {filtered.map((message, index) => {
            const sender = message.type === 'sent'
              ? (message.recipient || 'Unknown recipient')
              : (message.sender || 'Unknown sender')

            return (
              <button
                key={messageKey(message)}
                type="button"
                onClick={() => copyBody(message)}
                className={`flex w-full items-start justify-between gap-3 border-b border-emerald-500/10 p-3 text-left transition hover:bg-emerald-500/10 ${
                  index % 2 === 0 ? 'bg-slate-950/70' : 'bg-slate-900/70'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="rounded-lg border border-emerald-500/30 px-2 py-0.5 text-emerald-200">
                      {message.type || 'received'}
                    </span>
                    <span>{formatIndiaDateTime(message)}</span>
                    {message.device_uid && <span>Device: {message.device_uid}</span>}
                  </div>
                  <div className="mt-1 truncate font-bold text-slate-100">{sender}</div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-300">{message.body || 'No body'}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2 pt-1">
                  <span className="hidden rounded-xl border border-emerald-500/30 p-2 text-emerald-200 md:inline-flex" title="Tap row to copy">
                    <FiClipboard />
                  </span>
                  <button
                    type="button"
                    onClick={(event) => removeMessage(message, event)}
                    className="rounded-xl border border-red-500/40 p-2 text-red-300 hover:bg-red-500/10"
                    title="Delete SMS"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
