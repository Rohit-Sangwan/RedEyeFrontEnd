export async function generateFingerprint() {
  const parts = []

  parts.push(navigator.userAgent || '')
  parts.push(`${screen.width}x${screen.height}`)
  parts.push(`${screen.colorDepth}-bit`)
  parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '')
  parts.push(navigator.language || '')
  parts.push(navigator.hardwareConcurrency || 0)
  parts.push(navigator.maxTouchPoints || 0)

  try {
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 50
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillStyle = '#f60'
      ctx.fillRect(0, 0, 200, 50)
      ctx.fillStyle = '#000'
      ctx.fillText('RedEye', 2, 2)
      parts.push(canvas.toDataURL())
    }
  } catch {}

  try {
    const gl = document.createElement('canvas').getContext('webgl')
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (ext) {
        parts.push(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL))
        parts.push(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      }
    }
  } catch {}

  const raw = parts.join('|||')
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return 'fp_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36)
}
