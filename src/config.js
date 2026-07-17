const PROD_API = 'https://redeye-production.up.railway.app/api'
const PROD_WS = 'wss://redeye-production.up.railway.app'

function resolveUrl(raw, defaultPath = '') {
  if (!raw) return ''
  const isBrowser = typeof window !== 'undefined' && window.location
  const isHttps = isBrowser && window.location.protocol === 'https:'
  const host = raw.replace(/^ws[s]?:\/\//, '').replace(/^https?:\/\//, '')
  if (raw.startsWith('ws')) {
    const proto = isHttps ? 'wss' : 'ws'
    return `${proto}://${host}${defaultPath}`
  }
  if (raw.startsWith('http')) {
    const proto = isHttps ? 'https' : 'http'
    return `${proto}://${host}${defaultPath}`
  }
  return raw
}

function getUrl(raw, fallback) {
  if (raw) return resolveUrl(raw)
  const isBrowser = typeof window !== 'undefined' && window.location
  const isProd = isBrowser && window.location.hostname !== 'localhost'
  return isProd ? fallback : ''
}

export const API_BASE = getUrl(import.meta.env.VITE_API_URL, PROD_API)
export const WS_BASE = getUrl(import.meta.env.VITE_WS_URL, PROD_WS)
