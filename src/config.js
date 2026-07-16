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

export const API_BASE = resolveUrl(import.meta.env.VITE_API_URL)
export const WS_BASE = resolveUrl(import.meta.env.VITE_WS_URL)
