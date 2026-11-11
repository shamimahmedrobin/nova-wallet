export const uid = (p = 'NW') =>
  p + '-' + Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).slice(2, 6).toUpperCase()
export const rid = () => Math.random().toString(36).slice(2, 10)
export const nowISO = () => new Date().toISOString()

/** Demo-mode password hashing (FNV-1a + salt). Production uses Supabase Auth (bcrypt) — see supabase/ migrations. */
export function hashSecret(s: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193
  const str = 'nova::' + s
  for (let i = 0; i < str.length; i++) {
    h1 ^= str.charCodeAt(i); h1 = Math.imul(h1, 0x01000193)
    h2 = Math.imul(h2 ^ str.charCodeAt(i), 0x811c9dc5)
  }
  return 'h$' + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16)
}

export const fmtBDT = (n: number, dec = 0) =>
  '৳' + n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
export const fmtUSD = (n: number, dec = 2) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
export const fmtUSDT = (n: number, dec = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + ' USDT'
export const fmtCrypto = (n: number, sym: string) =>
  n.toLocaleString('en-US', { maximumFractionDigits: sym === 'BTC' ? 6 : sym === 'ETH' ? 5 : 2 }) + ' ' + sym
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
export const timeAgo = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}
export const emiCalc = (principal: number, annualRatePct: number, months: number) => {
  const r = annualRatePct / 100 / 12
  if (r === 0) return { emi: principal / months, total: principal, interest: 0 }
  const emi = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
  const total = emi * months
  return { emi, total, interest: total - principal }
}
export function downloadFile(name: string, content: string, type = 'text/plain') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type }))
  a.download = name; a.click(); URL.revokeObjectURL(a.href)
}
export const AVATAR_GRADIENTS = [
  'from-violet-500 to-indigo-600', 'from-cyan-500 to-blue-600', 'from-fuchsia-500 to-purple-600',
  'from-emerald-500 to-teal-600', 'from-amber-500 to-orange-600', 'from-rose-500 to-pink-600',
]
export const gradientFor = (seed: string) => {
  let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]
}
export const initials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

/** Read an image file and downscale it to a compact JPEG data URL (for KYC photos stored locally). */
export function fileToScaledDataUrl(file: File, maxW = 720): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.72))
    }
    img.onerror = reject
    img.src = url
  })
}
