function resolveUrl(raw) {
  if (!raw) return ''
  const isBrowser = typeof window !== 'undefined' && window.location
  const isHttps = isBrowser && window.location.protocol === 'https:'
  const host = raw.replace(/^ws[s]?:\/\//, '').replace(/^https?:\/\//, '')
  if (raw.startsWith('ws')) {
    return `${isHttps ? 'wss' : 'ws'}://${host}`
  }
  if (raw.startsWith('http')) {
    return `${isHttps ? 'https' : 'http'}://${host}`
  }
  return raw
}

export const API_BASE = resolveUrl(import.meta.env.VITE_API_URL)
export const WS_BASE = resolveUrl(import.meta.env.VITE_WS_URL)
