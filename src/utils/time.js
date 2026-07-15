export const INDIA_TZ = 'Asia/Kolkata'

export function formatIndiaDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: INDIA_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true
  }).format(d)
}

export function formatIndiaParts(value) {
  if (!value) return { date: '—', time: '—' }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return { date: '—', time: '—' }
  return {
    date: new Intl.DateTimeFormat('en-IN', { timeZone: INDIA_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d),
    time: new Intl.DateTimeFormat('en-IN', { timeZone: INDIA_TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).format(d)
  }
}
