import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ADS_PER_DAY, CHECKIN_REWARDS, EARN_TASKS, QUIZ_PER_CORRECT, SCRATCH_PER_DAY, SCRATCH_PRIZES, SPINS_PER_DAY, WHEEL_PRIZES } from './earn'
import type { DB, DepositReq, Loan, NewsItem, Tx, User , LoanInfo, EarnState } from './types'
import { DEFAULT_LEVELS, DEFAULT_PAY_METHODS, seedDB } from './seed'
import { translate } from './i18n'
import { detectCurrency, FALLBACK_RATES } from './currencies'
import { fmtBDT } from './utils'
import { emiCalc, hashSecret, nowISO, rid, uid } from './utils'

const KEY = 'novawallet.db.v2'
const SESSION = 'novawallet.session'
const LASTSEEN = 'nova.lastseen'
const TABKEY = 'nova.tabopen'
const LOCKFLAG = 'nova.locked'
const IDLE_MS = 5 * 60 * 1000

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const db = JSON.parse(raw) as DB
      // migrate older saves: add account levels without wiping balances/history
      if (!db.levels) db.levels = DEFAULT_LEVELS
      else db.levels = db.levels.map(l => ({ ...l, depositRequired: l.depositRequired ?? DEFAULT_LEVELS.find(d2 => d2.level === l.level)?.depositRequired ?? 0 }))
      if (!db.levelRequests) db.levelRequests = []
      if (!db.stakes) db.stakes = []
      if (!db.earnStates) db.earnStates = []
      if (!db.sec) db.sec = {}
      if (!db.settings.payMethods) db.settings.payMethods = DEFAULT_PAY_METHODS
      // normalize payment methods to the structured model (bank / crypto kinds);
      // older saves carried free-text label+detail entries — infer the kind and
      // pull the account number / address out of the old detail text where possible
      db.settings.payMethods = db.settings.payMethods.map(pm => {
        const kind = (pm as any).kind ?? (/crypto|usdt|btc|eth|tron|binance|wallet/i.test(pm.label) ? 'crypto' : 'bank')
        const out: any = { ...pm, kind }
        if (!out.accountNumber && out.detail) {
          const m = kind === 'bank' ? out.detail.match(/A\/C\s*([0-9]+)/) : out.detail.match(/:\s*(\S+)$/)
          if (m) out.accountNumber = m[1]
        }
        if (kind === 'crypto' && !out.network) { const nm = pm.label.match(/\(([^)]+)\)/) ?? (out.detail ?? '').match(/\(([^)]+)\)/); if (nm) out.network = nm[1] === 'TRC20' ? 'Tron (TRC20)' : nm[1] }
        if (kind === 'crypto' && out.label === 'Crypto Deposit' && out.detail) { const cm = out.detail.match(/^(\S+)\s*\(/); if (cm) out.label = cm[1] }
        return out
      })
      if (!db.settings.payMethods.length) db.settings.payMethods = DEFAULT_PAY_METHODS
      db.tickets.forEach(tk => {
        if (!tk.messages) tk.messages = [{ id: tk.id + '-m1', from: 'user', text: tk.message ?? '', at: tk.createdAt }]
        if ((tk.status as any) === 'open') tk.status = 'pending'
        if ((tk.status as any) === 'closed') tk.status = 'resolved'
        if (!tk.updatedAt) tk.updatedAt = tk.createdAt
      })
      db.users.forEach(u => { if (!u.level) u.level = u.role === 'admin' ? 4 : u.kyc === 'verified' ? 2 : 1 })
      db.news.forEach(n => { if (!n.coin) n.coin = ({ Bitcoin: 'BTC', Ethereum: 'ETH' } as any)[n.category] ?? 'NOVA' })
      return db
    }
  } catch { /* fresh seed */ }
  const db = seedDB(); localStorage.setItem(KEY, JSON.stringify(db)); return db
}

export interface Toast { id: string; title: string; body?: string; kind: 'success' | 'error' | 'info' }
interface Ctx {
  db: DB; user: User | null; theme: 'light' | 'dark'; toggleTheme: () => void
  lang: string; setLanguage: (code: string) => void; t: (key: string) => string
  currency: string; currencyIsAuto: boolean; detectedCurrency: string; setCurrency: (code: string | null) => void; fmtMoney: (bdt: number) => string; fmtAmount: (bdt: number) => string; toBDT: (amount: number) => number; fromBDT: (bdt: number) => number
  toasts: Toast[]; toast: (t: Omit<Toast, 'id'>) => void; dismissToast: (id: string) => void
  login: (idOrEmail: string, password: string) => string | null
  locked: boolean
  appInstalled: boolean
  devicePinSet: boolean
  fingerprintSet: boolean
  setDevicePin: (pin: string) => string | null
  clearDevicePin: () => void
  setupFingerprint: () => Promise<string | null>
  clearFingerprint: () => void
  unlockWithPin: (pin: string) => string | null
  unlockWithFingerprint: () => Promise<string | null>
  unlockWithPassword: (password: string) => string | null
  lockNow: () => void
  signOut: () => void
  resetPassword: (email: string, pin: string, newPassword: string) => string | null
  addUserPayMethod: (type: 'bank' | 'crypto', label: string, detail: string) => void
  removeUserPayMethod: (id: string) => void
  requestPasswordOtp: (email: string) => { error: string | null; otp: string | null }
  verifyPasswordOtp: (email: string, otp: string) => string | null
  resetPasswordWithOtp: (email: string, otp: string, newPassword: string) => string | null
  register: (p: { name: string; username: string; email: string; phone: string; password: string; pin: string; referralCode?: string }) => string | null
  walletOf: (userId: string) => DB['wallets'][number]
  addDeposit: (p: { method: string; amount: number; trxId: string; receipt?: string; methodId?: string; kind?: 'bank' | 'crypto'; verification?: 'manual' | 'auto' }) => void
  decideDeposit: (id: string, ok: boolean) => void
  /** AUTOMATION SEAM: a connected provider (bank API, gateway callback or
      SMS/webhook matcher) settles a pending deposit through the exact same
      pipeline as an admin decision. providerRef is stored on the deposit. */
  settleDepositExternal: (id: string, ok: boolean, providerRef?: string) => void
  requestWithdraw: (p: { method: string; amount: number; destination: string; pin: string }) => string | null
  directWithdraw: (p: { method: string; amount: number; destination: string }) => string | null
  stake: (amount: number, apy: number, termDays: number) => string | null
  unstake: (stakeId: string) => string | null
  swap: (fromSym: string, toSym: string, amountFrom: number, prices: Record<string, number>) => string | null
  decideWithdraw: (id: string, ok: boolean) => void
  sendMoney: (p: { toUserId: string; amount: number; note?: string; pin: string }) => string | Tx
  buyCrypto: (symbol: string, bdtAmount: number, priceUsd: number) => string | null
  sellCrypto: (symbol: string, coinAmount: number, priceUsd: number) => string | null
  applyLoan: (amount: number, months: number, info: LoanInfo) => void
  earnInfo: () => EarnState
  claimCheckin: () => { err?: string; amount?: number; streak?: number }
  watchAdReward: () => { err?: string; amount?: number; left?: number }
  spinReward: () => { err?: string; prize?: number; index?: number; left?: number }
  scratchDraw: () => { err?: string; prize?: number; left?: number }
  completeEarnTask: (taskId: string) => { err?: string; amount?: number }
  submitQuiz: (correct: number) => { err?: string; amount?: number }
  setLoanFee: (loanId: string, amount: number) => void
  submitLoanFee: (loanId: string, method: string, ref: string) => void
  confirmLoanFee: (loanId: string) => void
  decideLoan: (id: string, ok: boolean) => void
  repayLoan: (loan: Loan, amount: number) => string | null
  submitKyc: (p: { docType: string; docNumber: string; docPhoto?: string; facePhoto?: string }) => void; decideKyc: (userId: string, ok: boolean) => void
  setUserStatus: (userId: string, status: User['status']) => void
  adjustBalance: (userId: string, amount: number, reason: string) => void
  updateProfile: (p: Partial<User>) => void
  changePassword: (oldPw: string, newPw: string) => string | null
  changePin: (oldPin: string, newPin: string) => string | null
  toggleWatch: (symbol: string) => void
  markAllRead: () => void; markRead: (id: string) => void
  publishNews: (n: Omit<NewsItem, 'id' | 'date'> & { id?: string }) => void
  deleteNews: (id: string) => void
  updateSettings: (s: Partial<DB['settings']>) => void
  toggleBanner: (id: string) => void
  requestUpgrade: (toLevel: number) => string | null
  decideUpgrade: (id: string, ok: boolean) => void
  updateLevelDef: (level: number, patch: Partial<DB['levels'][number]>) => void
  setUserLevel: (userId: string, level: number) => void
  setUserLoanLimit: (userId: string, bdt: number | null) => void
  addTicket: (subject: string, message: string) => void
  replyTicket: (ticketId: string, text: string, as: 'user' | 'admin') => void
  resolveTicket: (ticketId: string) => void
  resetDemo: () => void
}
const AppCtx = createContext<Ctx | null>(null)
export const useApp = () => { const c = useContext(AppCtx); if (!c) throw new Error('useApp outside provider'); return c }

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(load)
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem(SESSION))
  // A quick refresh inside the SAME tab goes straight back in (no lock) — UNLESS
  // the app was explicitly locked (Log out, idle or away lock): that lock is
  // PERSISTED (nova.locked), so refreshing on the lock screen can never bypass
  // it. The saved session also starts LOCKED in a fresh tab (the previous tab
  // was closed — sessionStorage is per-tab) or when the last visit was 5+ min ago.
  const [locked, setLocked] = useState<boolean>(() => {
    if (!localStorage.getItem(SESSION)) return false
    try { if (localStorage.getItem(LOCKFLAG)) return true } catch { /* ignore */ }
    let newTab = false
    try { newTab = !sessionStorage.getItem(TABKEY) } catch { newTab = false }
    const seen = Number(localStorage.getItem(LASTSEEN) ?? 0)
    return newTab || (seen > 0 && Date.now() - seen > IDLE_MS)
  })
  const lockedRef = useRef(false)
  useEffect(() => { lockedRef.current = locked }, [locked])
  // Persist every lock/unlock so a reload restores exactly the same state.
  useEffect(() => {
    try {
      if (locked && userId) localStorage.setItem(LOCKFLAG, '1')
      else localStorage.removeItem(LOCKFLAG)
    } catch { /* ignore */ }
  }, [locked, userId])
  const [, setQuickTick] = useState(0)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('nova.theme') as any) || 'dark')
  const [langPref, setLangPref] = useState<string>(() => localStorage.getItem('nova.lang') || 'en')
  const [currencyPref, setCurrencyPref] = useState<string | null>(() => localStorage.getItem('nova.currency'))
  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES)
  const detected = useMemo(() => detectCurrency(), [])
  useEffect(() => {
    let alive = true
    fetch('https://open.er-api.com/v6/latest/USD').then(r => r.json()).then(j => { if (alive && j && j.rates) setRates(j.rates) }).catch(() => { /* keep fallback rates */ })
    return () => { alive = false }
  }, [])
  const [toasts, setToasts] = useState<Toast[]>([])
  const dbRef = useRef(db); dbRef.current = db

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(db)) }, [db])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('nova.theme', theme)
  }, [theme])
  const toggleTheme = useCallback(() => setTheme(t => (t === 'dark' ? 'light' : 'dark')), [])

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = rid(); setToasts(x => [...x, { ...t, id }])
    setTimeout(() => setToasts(x => x.filter(y => y.id !== id)), 4200)
  }, [])
  const dismissToast = useCallback((id: string) => setToasts(x => x.filter(y => y.id !== id)), [])
  // ---- Security: LOCK after 5 minutes away or idle (session stays saved) ----
  // The last-seen time is persisted, so the 5 minutes are measured across app
  // switches, phone screen locks and even full page reloads — not just while
  // this page happens to sit open in the foreground.
  const lastActiveRef = useRef(Date.now())
  useEffect(() => {
    if (!userId) return
    lastActiveRef.current = Date.now()
    try { sessionStorage.setItem(TABKEY, '1') } catch { /* ignore */ }
    const stamp = () => { try { localStorage.setItem(LASTSEEN, String(Date.now())) } catch { /* ignore */ } }
    stamp()
    const bump = () => { lastActiveRef.current = Date.now() }
    const evs = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const
    evs.forEach(e => window.addEventListener(e, bump, { passive: true }))
    const lockAway = () => {
      lastActiveRef.current = Date.now()
      setLocked(true)
      toast({ kind: 'error', title: 'Locked for security', body: 'Away for over 5 minutes — unlock with your PIN, fingerprint or password.' })
    }
    const onVis = () => {
      if (document.hidden) { stamp(); return }
      const seen = Number(localStorage.getItem(LASTSEEN) ?? 0)
      if (!lockedRef.current && seen > 0 && Date.now() - seen > IDLE_MS) lockAway()
      lastActiveRef.current = Date.now(); stamp()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', stamp)
    const iv = setInterval(() => {
      if (!document.hidden) stamp()
      if (!lockedRef.current && Date.now() - lastActiveRef.current > IDLE_MS) {
        lastActiveRef.current = Date.now()
        setLocked(true)
        toast({ kind: 'error', title: 'Locked for security', body: 'Inactive for 5 minutes — unlock with your PIN, fingerprint or password.' })
      }
    }, 20000)
    return () => { evs.forEach(e => window.removeEventListener(e, bump)); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', stamp); clearInterval(iv) }
  }, [userId, toast])

  const user = useMemo(() => db.users.find(u => u.id === userId) ?? null, [db, userId])
  const lang = user?.language || langPref
  const t = useCallback((key: string) => translate(lang, key), [lang])
  const currency = user?.currency || currencyPref || detected.code
  const currencyIsAuto = !user?.currency && !currencyPref
  const setCurrency = useCallback((code: string | null) => {
    setCurrencyPref(code); try { code ? localStorage.setItem('nova.currency', code) : localStorage.removeItem('nova.currency') } catch { /* ignore */ }
    setDb(d => userId ? { ...d, users: d.users.map(u => u.id === userId ? { ...u, currency: code ?? undefined } : u) } : d)
  }, [userId])
  const fmtMoney = useCallback((bdt: number) => {
    if (currency === 'BDT') return fmtBDT(bdt)
    const rate = rates[currency]
    if (!rate) return fmtBDT(bdt)
    const value = (bdt / dbRef.current.settings.bdtPerUsd) * rate
    try {
      return new Intl.NumberFormat(lang === 'en' ? 'en-US' : lang, { style: 'currency', currency }).format(value)
    } catch { return currency + ' ' + value.toLocaleString('en-US', { maximumFractionDigits: 2 }) }
  }, [currency, rates, lang])
  const toBDT = useCallback((amount: number) => {
    if (currency === 'BDT') return amount
    const rate = rates[currency]
    if (!rate) return amount
    return amount / rate * dbRef.current.settings.bdtPerUsd
  }, [currency, rates])
  const fromBDT = useCallback((bdt: number) => {
    if (currency === 'BDT') return bdt
    const rate = rates[currency]
    if (!rate) return bdt
    return (bdt / dbRef.current.settings.bdtPerUsd) * rate
  }, [currency, rates])
  const fmtAmount = useCallback((bdt: number) => {
    if (currency === 'BDT') return Math.round(bdt).toLocaleString('en-US')
    const rate = rates[currency]
    if (!rate) return Math.round(bdt).toLocaleString('en-US')
    const value = (bdt / dbRef.current.settings.bdtPerUsd) * rate
    try {
      return new Intl.NumberFormat(lang === 'en' ? 'en-US' : lang, { style: 'currency', currency }).formatToParts(value)
        .filter(part => part.type !== 'currency').map(part => part.value).join('').trim()
    } catch { return value.toLocaleString('en-US', { maximumFractionDigits: 2 }) }
  }, [currency, rates, lang])
  const setLanguage = useCallback((code: string) => {
    setLangPref(code); try { localStorage.setItem('nova.lang', code) } catch { /* ignore */ }
    setDb(d => userId ? { ...d, users: d.users.map(u => u.id === userId ? { ...u, language: code } : u) } : d)
  }, [userId])
  const walletOf = useCallback((id: string) => dbRef.current.wallets.find(w => w.userId === id)!, [])

  const notify = (draft: DB, userId2: string, title: string, body: string, kind: string) => {
    draft.notifications.unshift({ id: rid(), userId: userId2, title, body, kind, read: false, createdAt: nowISO() })
  }
  const audit = (draft: DB, actor: string, action: string, detail: string) => {
    draft.audit.unshift({ id: rid(), actor, action, detail, createdAt: nowISO() })
  }
  const recordTx = (draft: DB, tx: Omit<Tx, 'id' | 'createdAt'> & { id?: string }) => {
    const full: Tx = { ...tx, id: tx.id ?? uid('TXN'), createdAt: nowISO() }
    draft.txs.unshift(full)
    // double-entry: every movement writes a balanced debit+credit pair
    draft.ledger.unshift(
      { id: uid('LED'), txId: full.id, account: 'wallet:' + full.userId, debit: full.amount, credit: 0, createdAt: full.createdAt },
      { id: uid('LED'), txId: full.id, account: 'platform:clearing', debit: 0, credit: full.amount, createdAt: full.createdAt },
    )
    return full
  }
  const mutate = (fn: (draft: DB) => void) => {
    setDb(prev => { const draft: DB = JSON.parse(JSON.stringify(prev)); fn(draft); return draft })
  }
  // ---- Security: failed-attempt lockout (5 fails → 5-minute lock) + validation ----
  const MAX_FAILS = 5
  const LOCK_MS = 5 * 60 * 1000
  const lockError = (id: string): string | null => {
    const left = (dbRef.current.sec?.[id]?.lockedUntil ?? 0) - Date.now()
    return left > 0 ? 'Too many failed attempts. This account is locked for ' + Math.ceil(left / 60000) + ' more minute(s). Please try again later.' : null
  }
  const recordFail = (id: string, base: string): string => {
    const fails = (dbRef.current.sec?.[id]?.fails ?? 0) + 1
    const locking = fails >= MAX_FAILS
    mutate(d => {
      if (!d.sec) d.sec = {}
      d.sec[id] = locking ? { fails: 0, lockedUntil: Date.now() + LOCK_MS } : { fails, lockedUntil: 0 }
      if (locking) notify(d, id, '🔒 Account temporarily locked', 'Too many wrong password/PIN attempts. Sign-in and PIN actions are locked for 5 minutes.', 'security')
    })
    return locking ? 'Too many failed attempts. This account is now locked for 5 minutes.' : base + ' (' + (MAX_FAILS - fails) + ' attempt(s) left before a 5-minute lock)'
  }
  const recordSuccess = (id: string) => mutate(d => { if (d.sec?.[id]) d.sec[id] = { fails: 0, lockedUntil: 0 } })
  const MAX_AMOUNT = 100000000
  const badAmount = (n: number) => !Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT
  const badQty = (n: number) => !Number.isFinite(n) || n <= 0
  const TRX_RE = /^[A-Za-z0-9-]{6,64}$/

  const levelDefOf = (u: User) => dbRef.current.levels.find(l => l.level === (u.level ?? 1))
  const outgoingSum = (userId: string, period: 'day' | 'month') => {
    const now = new Date()
    return dbRef.current.txs.filter(tx => {
      if (tx.userId !== userId || !['send', 'cash_out', 'direct_withdraw'].includes(tx.category)) return false
      if (!['completed', 'pending', 'processing', 'approved'].includes(tx.status)) return false
      const d = new Date(tx.createdAt)
      return period === 'day' ? d.toDateString() === now.toDateString() : (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear())
    }).reduce((a, tx) => a + tx.amount, 0)
  }
  const limitError = (u: User, amount: number): string | null => {
    const def = levelDefOf(u); if (!def) return null
    const day = outgoingSum(u.id, 'day')
    if (day + amount > def.dailyLimit) return 'Daily limit exceeded — Level ' + u.level + ' allows ' + def.dailyLimit.toLocaleString() + ' BDT/day and you have already used ' + day.toLocaleString() + ' BDT today.'
    const mon = outgoingSum(u.id, 'month')
    if (mon + amount > def.monthlyLimit) return 'Monthly limit exceeded — Level ' + u.level + ' allows ' + def.monthlyLimit.toLocaleString() + ' BDT/month and you have already used ' + mon.toLocaleString() + ' BDT this month.'
    return null
  }
  const feePctFor = (base: number, u: User) => base * (1 - (levelDefOf(u)?.feeDiscountPct ?? 0) / 100)
  const login: Ctx['login'] = (idOrEmail, password) => {
    const u = dbRef.current.users.find(x => x.email === idOrEmail || x.username === idOrEmail)
    if (!u) return 'No account found for that email / username.'
    const lk = lockError(u.id); if (lk) return lk
    if (u.passwordHash !== hashSecret(password)) return recordFail(u.id, 'Wrong password. Please try again.')
    recordSuccess(u.id)
    if (u.status === 'suspended') return 'This account is suspended. Contact support.'
    mutate(d => { const du = d.users.find(x => x.id === u.id)!; du.lastLogin = nowISO() })
    localStorage.setItem(SESSION, u.id); setUserId(u.id); setLocked(false)
    return null
  }
  // ---- Device quick login: PIN + fingerprint (WebAuthn), stored ONLY on this device ----
  const pinKey = (id: string) => 'nova.loginpin.' + id
  const fpKey = (id: string) => 'nova.webauthn.' + id
  const appInstalled = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true
  const devicePinSet = !!userId && !!localStorage.getItem(pinKey(userId))
  const fingerprintSet = !!userId && !!localStorage.getItem(fpKey(userId))
  const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const fromB64url = (s: string) => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u.buffer }
  const setDevicePin: Ctx['setDevicePin'] = (pin) => {
    if (!user) return 'Not signed in'
    if (!/^\d{4}$/.test(pin)) return 'Login PIN must be exactly 4 digits.'
    localStorage.setItem(pinKey(user.id), hashSecret(pin)); setQuickTick(x => x + 1)
    mutate(d => notify(d, user.id, 'Login PIN set', 'Quick login with a device PIN is now on for this device.', 'security'))
    return null
  }
  const clearDevicePin = () => { if (!userId) return; localStorage.removeItem(pinKey(userId)); setQuickTick(x => x + 1) }
  const clearFingerprint = () => { if (!userId) return; localStorage.removeItem(fpKey(userId)); setQuickTick(x => x + 1) }
  const setupFingerprint: Ctx['setupFingerprint'] = async () => {
    if (!user) return 'Not signed in'
    if (!appInstalled) return 'Fingerprint login needs the installed app. Install NovaWallet first (Profile \u2192 Install App), open the installed app, then set it up here.'
    if (!window.PublicKeyCredential) return 'This device or browser does not support fingerprint login.'
    try {
      const cred = await navigator.credentials.create({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'NovaWallet', id: location.hostname },
        user: { id: new TextEncoder().encode(user.id), name: user.email, displayName: user.name },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000,
      } } as any) as PublicKeyCredential | null
      if (!cred) return 'Fingerprint setup was cancelled.'
      localStorage.setItem(fpKey(user.id), b64url(cred.rawId)); setQuickTick(x => x + 1)
      mutate(d => notify(d, user.id, 'Fingerprint login on', 'Fingerprint unlock is now set up on this device.', 'security'))
      return null
    } catch { return 'Fingerprint setup failed or was cancelled. Please try again.' }
  }
  const unlockWithPin: Ctx['unlockWithPin'] = (pin) => {
    if (!user) return 'Not signed in'
    const lk = lockError(user.id); if (lk) return lk
    const stored = localStorage.getItem(pinKey(user.id))
    if (!stored) return 'No login PIN is set on this device.'
    if (hashSecret(pin) !== stored) return recordFail(user.id, 'Incorrect login PIN.')
    recordSuccess(user.id); lastActiveRef.current = Date.now(); setLocked(false)
    return null
  }
  const unlockWithFingerprint: Ctx['unlockWithFingerprint'] = async () => {
    if (!user) return 'Not signed in'
    const credId = localStorage.getItem(fpKey(user.id))
    if (!credId) return 'Fingerprint is not set up on this device.'
    try {
      const assertion = await navigator.credentials.get({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: fromB64url(credId) }],
        userVerification: 'required',
        timeout: 60000,
      } } as any)
      if (!assertion) return 'Fingerprint verification was cancelled.'
      lastActiveRef.current = Date.now(); setLocked(false)
      return null
    } catch { return 'Fingerprint verification failed or was cancelled.' }
  }
  const unlockWithPassword: Ctx['unlockWithPassword'] = (password) => {
    if (!user) return 'Not signed in'
    const lk = lockError(user.id); if (lk) return lk
    if (user.passwordHash !== hashSecret(password)) return recordFail(user.id, 'Wrong password. Please try again.')
    recordSuccess(user.id); lastActiveRef.current = Date.now(); setLocked(false)
    return null
  }
  const lockNow = () => { lastActiveRef.current = Date.now(); setLocked(true) }
  const signOut = () => { setLocked(false); localStorage.removeItem(SESSION); setUserId(null) }
  const resetPassword: Ctx['resetPassword'] = (email, pin, newPassword) => {
    const u = dbRef.current.users.find(x => x.email === email.trim().toLowerCase())
    if (!u) return 'No account found for that email.'
    const lk3 = lockError(u.id); if (lk3) return lk3
    if (u.pinHash !== hashSecret(pin)) return recordFail(u.id, 'Incorrect transaction PIN — identity could not be verified.')
    recordSuccess(u.id)
    if (newPassword.length < 6) return 'Password must be at least 6 characters.'
    mutate(d => { const du = d.users.find(x => x.id === u.id)!; du.passwordHash = hashSecret(newPassword); notify(d, u.id, 'Password reset', 'Your password was reset using your transaction PIN. If this was not you, contact support immediately.', 'security') })
    return null
  }
  // Email-OTP password reset. DEMO delivery: the OTP is returned so the UI can
  // show it on screen — when SMTP is connected, requestPasswordOtp should send
  // it by email instead and stop returning it. The OTP itself is stored hashed
  // with a 10-minute expiry, and wrong guesses share the 5-fail / 5-min lockout.
  const requestPasswordOtp: Ctx['requestPasswordOtp'] = (email) => {
    const u = dbRef.current.users.find(x => x.email === email.trim().toLowerCase())
    if (!u) return { error: 'No account found for that email.', otp: null }
    const lk = lockError(u.id); if (lk) return { error: lk, otp: null }
    const otp = String(Math.floor(100000 + Math.random() * 900000))
    mutate(d => { const du = d.users.find(x => x.id === u.id)!; du.resetOtpHash = hashSecret(otp); du.resetOtpExpires = Date.now() + 10 * 60 * 1000 })
    return { error: null, otp }
  }
  const verifyPasswordOtp: Ctx['verifyPasswordOtp'] = (email, otp) => {
    const u = dbRef.current.users.find(x => x.email === email.trim().toLowerCase())
    if (!u) return 'No account found for that email.'
    const lk = lockError(u.id); if (lk) return lk
    if (!u.resetOtpHash || !u.resetOtpExpires) return 'No code was requested for this email yet. Tap “Send code” first.'
    if (Date.now() > u.resetOtpExpires) return 'That code has expired. Please request a new one.'
    if (u.resetOtpHash !== hashSecret(otp.trim())) return recordFail(u.id, 'Incorrect code — please check and try again.')
    return null
  }
  const resetPasswordWithOtp: Ctx['resetPasswordWithOtp'] = (email, otp, newPassword) => {
    const bad = verifyPasswordOtp(email, otp)
    if (bad) return bad
    if (newPassword.length < 6) return 'Password must be at least 6 characters.'
    const u = dbRef.current.users.find(x => x.email === email.trim().toLowerCase())!
    recordSuccess(u.id)
    mutate(d => { const du = d.users.find(x => x.id === u.id)!; du.passwordHash = hashSecret(newPassword); delete du.resetOtpHash; delete du.resetOtpExpires; notify(d, u.id, 'Password reset', 'Your password was reset using an email verification code. If this was not you, contact support immediately.', 'security') })
    return null
  }
  // The user's OWN linked payment methods (their bank account / crypto wallet),
  // managed from Profile → Linked payment methods.
  const addUserPayMethod: Ctx['addUserPayMethod'] = (type, label, detail) => {
    if (!user) return
    mutate(d => { const du = d.users.find(x => x.id === user.id)!; du.payMethods = [...(du.payMethods ?? []), { id: uid('PM'), type, label: label.trim(), detail: detail.trim() }] })
  }
  const removeUserPayMethod: Ctx['removeUserPayMethod'] = (id) => {
    if (!user) return
    mutate(d => { const du = d.users.find(x => x.id === user.id)!; du.payMethods = (du.payMethods ?? []).filter(m => m.id !== id) })
  }
  const register: Ctx['register'] = (p) => {
    const cur = dbRef.current
    if (cur.users.some(x => x.email === p.email)) return 'An account with this email already exists.'
    if (cur.users.some(x => x.username === p.username)) return 'That username is taken.'
    if (p.referralCode && !cur.users.some(x => x.referralCode === p.referralCode)) return 'Referral code not found.'
    if (p.referralCode && cur.users.find(x => x.referralCode === p.referralCode)?.email === p.email) return 'You cannot refer yourself.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return 'Enter a valid email address.'
    if (!/^[a-zA-Z0-9_.]{3,20}$/.test(p.username)) return 'Username must be 3–20 characters: letters, numbers, dot or underscore only.'
    if (p.password.length < 6) return 'Password must be at least 6 characters.'
    if (!/^\d{4}$/.test(p.pin)) return 'PIN must be exactly 4 digits.'
    if (p.name.trim().length < 3) return 'Enter your full name.'
    const referrer = p.referralCode ? cur.users.find(x => x.referralCode === p.referralCode) : undefined
    const nu: User = {
      id: uid('USR'), name: p.name, username: p.username, email: p.email, phone: p.phone,
      passwordHash: hashSecret(p.password), pinHash: hashSecret(p.pin), role: 'user', status: 'active',
      kyc: 'unverified', level: 1, referralCode: 'NOVA-' + p.username.toUpperCase().slice(0, 6), referredBy: referrer?.id ?? null,
      twoFA: false, language: langPref, createdAt: nowISO(), lastLogin: nowISO(),
      sessions: [{ id: rid(), device: 'Web · Browser', at: nowISO(), current: true }],
    }
    mutate(d => {
      d.users.push(nu); d.wallets.push({ userId: nu.id, available: 0, locked: 0, holdings: {} })
      if (referrer) notify(d, referrer.id, 'New referral', nu.name + ' joined with your referral code.', 'referral')
      notify(d, nu.id, 'Welcome to NovaWallet', 'Verify your KYC from your profile to unlock loans and higher limits.', 'info')
    })
    localStorage.setItem(SESSION, nu.id); setUserId(nu.id); setLocked(false)
    return null
  }

  const addDeposit: Ctx['addDeposit'] = (p) => {
    if (!user) return
    if (badAmount(p.amount)) return
    if (p.trxId && !TRX_RE.test(p.trxId.trim())) return
    mutate(d => {
      // Normalized reference = the match key any future automation (bank API,
      // gateway callback, SMS/webhook matcher) will look deposits up by.
      const reference = p.trxId.trim().toUpperCase()
      const dep = { id: uid('DEP'), userId: user.id, method: p.method, amount: p.amount, trxId: p.trxId, receipt: p.receipt, methodId: p.methodId, kind: p.kind, verification: p.verification ?? 'manual', reference, status: 'pending' as const, createdAt: nowISO() }
      d.deposits.unshift(dep)
      recordTx(d, { userId: user.id, category: 'add_money', title: 'Add Money via ' + p.method, amount: p.amount, fee: 0, currency: 'BDT', status: 'pending', method: p.method })
      notify(d, user.id, 'Deposit request submitted', 'Your ' + p.method + ' deposit of ৳' + p.amount.toLocaleString() + (dep.verification === 'auto' ? ' is queued for automatic verification — it settles as soon as the payment provider confirms it.' : ' is pending admin review.'), 'deposit')
    })
  }
  // ONE settlement path for every deposit, whoever settles it — admin review
  // today, a provider/automation tomorrow. Balances, the linked transaction,
  // referral commission, audit and notifications all live here exactly once.
  const applyDepositDecision = (d: DB, dep: DepositReq, ok: boolean, source: 'admin' | 'provider') => {
      dep.status = ok ? 'approved' : 'rejected'
      const w = d.wallets.find(x => x.userId === dep.userId)!
      const tx = d.txs.find(t => t.category === 'add_money' && t.userId === dep.userId && t.status === 'pending' && t.amount === dep.amount)
      if (tx) tx.status = ok ? 'completed' : 'rejected'
      if (ok) {
        w.available += dep.amount
        audit(d, source, 'deposit.approve', `Approved ${dep.id} ৳${dep.amount} for ${dep.userId}`)
        // referral commission on first approved deposit
        const depUser = d.users.find(u => u.id === dep.userId)
        if (depUser?.referredBy) {
          const commission = Math.round(dep.amount * d.settings.referralPct / 100 * 0.1)
          if (commission > 0) {
            const rw = d.wallets.find(x => x.userId === depUser.referredBy)!
            rw.available += commission
            d.referralEarnings.unshift({ id: rid(), userId: depUser.referredBy, fromUser: depUser.name, amount: commission, createdAt: nowISO() })
            recordTx(d, { userId: depUser.referredBy, category: 'referral', title: 'Referral commission', amount: commission, fee: 0, currency: 'BDT', status: 'completed' })
            notify(d, depUser.referredBy, 'Referral reward', 'You earned ৳' + commission + ' from ' + depUser.name + "'s deposit.", 'referral')
          }
        }
      } else audit(d, source, 'deposit.reject', `Rejected ${dep.id}`)
      notify(d, dep.userId, ok ? 'Deposit approved' : 'Deposit rejected', ok ? '৳' + dep.amount.toLocaleString() + ' has been credited to your wallet.' : 'Your deposit request was rejected. Check the transaction ID and try again.', 'deposit')
  }
  const decideDeposit: Ctx['decideDeposit'] = (id, ok) => {
    mutate(d => { const dep = d.deposits.find(x => x.id === id); if (!dep || dep.status !== 'pending') return; applyDepositDecision(d, dep, ok, 'admin') })
  }
  const settleDepositExternal: Ctx['settleDepositExternal'] = (id, ok, providerRef) => {
    mutate(d => { const dep = d.deposits.find(x => x.id === id); if (!dep || dep.status !== 'pending') return; if (providerRef) dep.providerRef = providerRef; applyDepositDecision(d, dep, ok, 'provider') })
  }
  const requestWithdraw: Ctx['requestWithdraw'] = (p) => {
    if (!user) return 'Not signed in'
    const lk = lockError(user.id); if (lk) return lk
    if (user.pinHash !== hashSecret(p.pin)) return recordFail(user.id, 'Incorrect transaction PIN.')
    recordSuccess(user.id)
    if (badAmount(p.amount)) return 'Enter a valid amount.'
    const w = walletOf(user.id)
    if (user.status === 'frozen') return 'Your wallet is frozen. Contact support.'
    if (p.amount > w.available) return 'Insufficient available balance.'
    const lim = limitError(user, p.amount); if (lim) return lim
    const fee = Math.round(p.amount * feePctFor(dbRef.current.settings.cashoutFeePct, user) / 100)
    mutate(d => {
      const dw = d.wallets.find(x => x.userId === user.id)!
      dw.available -= p.amount; dw.locked += p.amount
      d.withdrawals.unshift({ id: uid('WDR'), userId: user.id, method: p.method, amount: p.amount, fee, destination: p.destination, status: 'pending', createdAt: nowISO() })
      recordTx(d, { userId: user.id, category: 'cash_out', title: 'Cash Out to ' + p.method, amount: p.amount, fee, currency: 'BDT', status: 'pending', method: p.method })
    })
    return null
  }
  const directWithdraw: Ctx['directWithdraw'] = (p) => {
    if (!user) return 'Not signed in'
    if (user.level < 2) return 'Direct Withdraw needs a Level 2 account. Please upgrade first.'
    if (badAmount(p.amount)) return 'Enter a valid amount.'
    const w = walletOf(user.id)
    if (user.status === 'frozen') return 'Your wallet is frozen. Contact support.'
    if (p.amount > w.available) return 'Insufficient available balance.'
    const lim = limitError(user, p.amount); if (lim) return lim
    const fee = Math.round(p.amount * feePctFor(dbRef.current.settings.cashoutFeePct, user) / 100)
    mutate(d => {
      const dw = d.wallets.find(x => x.userId === user.id)!
      dw.available -= p.amount
      d.withdrawals.unshift({ id: uid('WDR'), userId: user.id, method: p.method, amount: p.amount, fee, destination: p.destination, status: 'completed', createdAt: nowISO() })
      recordTx(d, { userId: user.id, category: 'direct_withdraw', title: 'Direct Withdraw to ' + p.method, amount: p.amount, fee, currency: 'BDT', status: 'completed', method: p.method, note: 'Instant withdrawal — no admin review' })
      notify(d, user.id, 'Withdrawal completed', 'Your direct withdrawal of ' + p.amount + ' BDT to ' + p.method + ' is complete.', 'transaction')
    })
    return null
  }
  const stake: Ctx['stake'] = (amount, apy, termDays) => {
    if (!user) return 'Not signed in'
    if (badAmount(amount)) return 'Enter a valid amount.'
    const w = walletOf(user.id)
    const rate = dbRef.current.settings.bdtPerUsd
    // Stake from the same combined balance as Buy/Swap (and as Home's
    // "Available"): the USDT holding first, the cash balance covers the rest.
    const heldUsdt = w.holdings.USDT ?? 0
    const usdtPart = Math.min(heldUsdt, amount / rate)
    const cashPart = amount - Math.round(usdtPart * rate)
    if (cashPart > w.available) return 'Insufficient balance. Add money first.'
    mutate(d => {
      const dw = d.wallets.find(x => x.userId === user.id)!
      dw.holdings.USDT = heldUsdt - usdtPart
      dw.available -= cashPart; dw.locked += amount
      d.stakes.unshift({ id: uid('STK'), userId: user.id, amount, apy, termDays, startAt: nowISO(), status: 'active' })
      recordTx(d, { userId: user.id, category: 'earn', title: 'Staked in Earn (' + apy + '% APY)', amount, fee: 0, currency: 'BDT', status: 'completed' })
    })
    return null
  }
  const unstake: Ctx['unstake'] = (stakeId) => {
    if (!user) return 'Not signed in'
    const st = dbRef.current.stakes.find(x => x.id === stakeId && x.userId === user.id)
    if (!st || st.status !== 'active') return 'Stake not found.'
    const days = Math.max(0, (Date.now() - new Date(st.startAt).getTime()) / 86_400_000)
    const interest = Math.round(st.amount * st.apy / 100 * days / 365)
    mutate(d => {
      const dw = d.wallets.find(x => x.userId === user.id)!
      dw.locked -= st.amount; dw.available += st.amount + interest
      d.stakes.find(x => x.id === stakeId)!.status = 'closed'
      recordTx(d, { userId: user.id, category: 'earn', title: 'Earn unstaked + interest', amount: st.amount + interest, fee: 0, currency: 'BDT', status: 'completed', note: 'Interest earned: ' + interest + ' BDT over ' + days.toFixed(2) + ' days' })
    })
    return null
  }
  const swap: Ctx['swap'] = (fromSym, toSym, amountFrom, prices) => {
    if (!user) return 'Not signed in'
    if (fromSym === toSym) return 'Choose two different assets.'
    if (badQty(amountFrom)) return 'Enter a valid amount.'
    const w = walletOf(user.id)
    const rate = dbRef.current.settings.bdtPerUsd
    const priceOf = (sym: string) => sym === 'BDT' ? 1 / rate : sym === 'USDT' ? 1 : (prices[sym] ?? 0)
    if (!priceOf(fromSym) || !priceOf(toSym)) return 'Live price unavailable for this pair.'
    const heldFrom = w.holdings[fromSym] ?? 0
    // USDT is the trading balance: the USDT holding spends first, and any
    // shortfall converts automatically from the added-money (BDT) balance,
    // so money from Add Money is always usable in Swap and Buy Crypto.
    const spendableFrom = fromSym === 'BDT' ? w.available : fromSym === 'USDT' ? heldFrom + w.available / rate : heldFrom
    if (amountFrom > spendableFrom) return 'Insufficient ' + fromSym + ' balance.'
    const usdGross = amountFrom * priceOf(fromSym)
    const feeUsd = usdGross * 0.005
    const toAmt = (usdGross - feeUsd) / priceOf(toSym)
    mutate(d => {
      const dw = d.wallets.find(x => x.userId === user.id)!
      if (fromSym === 'BDT') dw.available -= amountFrom
      else if (fromSym === 'USDT') { const fromHeld = Math.min(amountFrom, heldFrom); dw.holdings.USDT = heldFrom - fromHeld; dw.available -= Math.round((amountFrom - fromHeld) * rate) }
      else dw.holdings[fromSym] = heldFrom - amountFrom
      if (toSym === 'BDT') dw.available += toAmt; else dw.holdings[toSym] = (dw.holdings[toSym] ?? 0) + toAmt
      recordTx(d, { userId: user.id, category: 'swap', title: 'Swap ' + fromSym + ' → ' + toSym, amount: Math.round(usdGross * rate), fee: Math.round(feeUsd * rate), currency: 'BDT', status: 'completed', note: amountFrom + ' ' + fromSym + ' → ' + (toSym === 'BDT' ? Math.round(toAmt) : toSym === 'USDT' ? toAmt.toFixed(2) : toAmt.toFixed(6)) + ' ' + toSym })
    })
    return null
  }
  const decideWithdraw: Ctx['decideWithdraw'] = (id, ok) => {
    mutate(d => {
      const wd = d.withdrawals.find(x => x.id === id); if (!wd || wd.status !== 'pending') return
      wd.status = ok ? 'completed' : 'rejected'
      const w = d.wallets.find(x => x.userId === wd.userId)!
      w.locked -= wd.amount; if (!ok) w.available += wd.amount
      const tx = d.txs.find(t => t.category === 'cash_out' && t.userId === wd.userId && t.status === 'pending' && t.amount === wd.amount)
      if (tx) tx.status = ok ? 'completed' : 'rejected'
      audit(d, 'admin', ok ? 'withdraw.complete' : 'withdraw.reject', `${wd.id} ৳${wd.amount}`)
      notify(d, wd.userId, ok ? 'Cash out completed' : 'Cash out rejected', ok ? '৳' + (wd.amount - wd.fee).toLocaleString() + ' sent to ' + wd.destination + '.' : 'Your cash out was rejected and the amount returned to your wallet.', 'withdraw')
    })
  }
  const sendMoney: Ctx['sendMoney'] = (p) => {
    if (!user) return 'Not signed in'
    const lk = lockError(user.id); if (lk) return lk
    if (user.pinHash !== hashSecret(p.pin)) return recordFail(user.id, 'Incorrect transaction PIN.')
    recordSuccess(user.id)
    if (badAmount(p.amount)) return 'Enter a valid amount.'
    if (p.toUserId === user.id) return 'You cannot send money to yourself.'
    const w = walletOf(user.id)
    const fee = Math.round(p.amount * feePctFor(dbRef.current.settings.sendFeePct, user) / 100 * 100) / 100
    if (p.amount + fee > w.available) return 'Insufficient balance (amount + fee exceeds available balance).'
    const limS = limitError(user, p.amount); if (limS) return limS
    if (user.status === 'frozen') return 'Your wallet is frozen.'
    let created: Tx | null = null
    mutate(d => {
      const sw = d.wallets.find(x => x.userId === user.id)!; const rw = d.wallets.find(x => x.userId === p.toUserId)!
      const to = d.users.find(x => x.id === p.toUserId)!
      sw.available -= p.amount + fee; rw.available += p.amount
      created = recordTx(d, { userId: user.id, category: 'send', title: 'Sent to ' + to.name, amount: p.amount, fee, currency: 'BDT', status: 'completed', note: p.note, counterparty: to.name })
      recordTx(d, { userId: p.toUserId, category: 'receive', title: 'Received from ' + user.name, amount: p.amount, fee: 0, currency: 'BDT', status: 'completed', counterparty: user.name })
      notify(d, p.toUserId, 'Money received', 'You received ৳' + p.amount.toLocaleString() + ' from ' + user.name + '.', 'receive')
    })
    return created!
  }
  const buyCrypto: Ctx['buyCrypto'] = (symbol, amount, priceUsd) => {
    if (!user) return 'Not signed in'
    if (badAmount(amount) || badQty(priceUsd)) return 'Enter a valid amount.'
    const w = walletOf(user.id)
    const rate = dbRef.current.settings.bdtPerUsd
    // Buying USDT itself converts the BDT balance into USDT (the on-ramp);
    // every other coin is bought with the USDT holding.
    if (symbol === 'USDT') {
      if (amount > w.available) return 'Insufficient BDT balance.'
      const coins = amount / rate
      mutate(d => {
        const dw = d.wallets.find(x => x.userId === user.id)!
        dw.available -= amount; dw.holdings.USDT = (dw.holdings.USDT ?? 0) + coins
        recordTx(d, { userId: user.id, category: 'crypto_buy', title: 'Bought USDT', amount, fee: 0, currency: 'USDT', status: 'completed', note: coins.toFixed(2) + ' USDT @ 1.00 USDT' })
      })
      return null
    }
    const heldUsdt = w.holdings.USDT ?? 0
    const shortfall = Math.max(0, amount - heldUsdt)
    if (shortfall * rate > w.available) return 'Insufficient balance. Add money first.'
    const coins = amount / priceUsd
    mutate(d => {
      const dw = d.wallets.find(x => x.userId === user.id)!
      dw.holdings.USDT = heldUsdt - Math.min(amount, heldUsdt); dw.available -= Math.round(shortfall * rate); dw.holdings[symbol] = (dw.holdings[symbol] ?? 0) + coins
      recordTx(d, { userId: user.id, category: 'crypto_buy', title: 'Bought ' + symbol, amount: Math.round(amount * rate), fee: 0, currency: symbol, status: 'completed', note: coins.toFixed(6) + ' ' + symbol + ' @ ' + priceUsd + ' USDT' })
    })
    return null
  }
  const sellCrypto: Ctx['sellCrypto'] = (symbol, coinAmount, priceUsd) => {
    if (!user) return 'Not signed in'
    if (badQty(coinAmount) || badQty(priceUsd)) return 'Enter a valid amount.'
    const w = walletOf(user.id)
    if (coinAmount > (w.holdings[symbol] ?? 0)) return 'Insufficient ' + symbol + ' balance.'
    const rate = dbRef.current.settings.bdtPerUsd
    // Selling USDT converts it back into the BDT balance; every other coin
    // is sold for USDT, which lands in the USDT holding.
    if (symbol === 'USDT') {
      const bdt = coinAmount * rate
      mutate(d => {
        const dw = d.wallets.find(x => x.userId === user.id)!
        dw.holdings.USDT = (dw.holdings.USDT ?? 0) - coinAmount; dw.available += bdt
        recordTx(d, { userId: user.id, category: 'crypto_sell', title: 'Sold USDT', amount: Math.round(bdt), fee: 0, currency: 'USDT', status: 'completed', note: coinAmount + ' USDT @ 1.00 USDT' })
      })
      return null
    }
    const usdt = coinAmount * priceUsd
    mutate(d => {
      const dw = d.wallets.find(x => x.userId === user.id)!
      dw.holdings[symbol] -= coinAmount; dw.holdings.USDT = (dw.holdings.USDT ?? 0) + usdt
      recordTx(d, { userId: user.id, category: 'crypto_sell', title: 'Sold ' + symbol, amount: Math.round(usdt * rate), fee: 0, currency: symbol, status: 'completed', note: coinAmount + ' ' + symbol + ' @ ' + priceUsd + ' USDT' })
    })
    return null
  }
  const applyLoan: Ctx['applyLoan'] = (amount, months, info) => {
    if (!user) return
    if (badAmount(amount)) return
    const { emi, total } = emiCalc(amount, dbRef.current.settings.loanRatePct, months)
    mutate(d => {
      d.loans.unshift({ id: uid('LOAN'), userId: user.id, amount, months, ratePct: d.settings.loanRatePct, emi: Math.round(emi), totalPayable: Math.round(total), paid: 0, status: 'pending', createdAt: nowISO(), ...info })
      notify(d, user.id, 'Loan application submitted', 'Your loan application is under admin review. No loan is approved automatically.', 'loan')
    })
  }
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
  const freshEarn = (userId: string): EarnState => ({ userId, day: todayStr(), lastCheckin: '', streak: 0, ads: 0, spins: 0, scratches: 0, tasksDone: [], quizDay: '' })
  const normEarn = (st: EarnState): EarnState => st.day === todayStr() ? st : { ...st, day: todayStr(), ads: 0, spins: 0, scratches: 0 }
  const earnStateIn = (d: DB, userId: string): EarnState => {
    let st = d.earnStates.find(x => x.userId === userId)
    if (!st) { st = freshEarn(userId); d.earnStates.push(st) }
    Object.assign(st, normEarn(st))
    return st
  }
  const creditEarn = (d: DB, userId: string, amount: number, title: string) => {
    const w = d.wallets.find(x => x.userId === userId)!; w.available += amount
    recordTx(d, { userId, category: 'earn', title, amount, fee: 0, currency: 'BDT', status: 'completed' })
  }
  const earnInfo: Ctx['earnInfo'] = () => {
    if (!user) return freshEarn('')
    const st = db.earnStates.find(x => x.userId === user.id)
    return st ? normEarn({ ...st, tasksDone: [...st.tasksDone] }) : freshEarn(user.id)
  }
  const claimCheckin: Ctx['claimCheckin'] = () => {
    if (!user) return { err: 'Not signed in' }
    let out: { err?: string; amount?: number; streak?: number } = {}
    mutate(d => {
      const st = earnStateIn(d, user.id)
      const today = todayStr()
      if (st.lastCheckin === today) { out = { err: 'Already claimed today — come back tomorrow.' }; return }
      const y = new Date(); y.setDate(y.getDate() - 1)
      const yStr = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0')
      st.streak = st.lastCheckin === yStr ? st.streak + 1 : 1
      st.lastCheckin = today
      const amount = CHECKIN_REWARDS[(st.streak - 1) % CHECKIN_REWARDS.length]
      creditEarn(d, user.id, amount, 'Daily check-in reward (day ' + st.streak + ')')
      out = { amount, streak: st.streak }
    })
    return out
  }
  const watchAdReward: Ctx['watchAdReward'] = () => {
    if (!user) return { err: 'Not signed in' }
    let out: { err?: string; amount?: number; left?: number } = {}
    mutate(d => {
      const st = earnStateIn(d, user.id)
      if (st.ads >= ADS_PER_DAY) { out = { err: 'No ads left today — come back tomorrow.' }; return }
      st.ads++
      const amount = 2 + Math.floor(Math.random() * 7)
      creditEarn(d, user.id, amount, 'Watched ad reward')
      out = { amount, left: ADS_PER_DAY - st.ads }
    })
    return out
  }
  const spinReward: Ctx['spinReward'] = () => {
    if (!user) return { err: 'Not signed in' }
    let out: { err?: string; prize?: number; index?: number; left?: number } = {}
    mutate(d => {
      const st = earnStateIn(d, user.id)
      if (st.spins >= SPINS_PER_DAY) { out = { err: 'No free spins left today — come back tomorrow.' }; return }
      st.spins++
      const index = Math.floor(Math.random() * WHEEL_PRIZES.length)
      const prize = WHEEL_PRIZES[index]
      if (prize > 0) creditEarn(d, user.id, prize, 'Spin Wheel reward')
      out = { prize, index, left: SPINS_PER_DAY - st.spins }
    })
    return out
  }
  const scratchDraw: Ctx['scratchDraw'] = () => {
    if (!user) return { err: 'Not signed in' }
    let out: { err?: string; prize?: number; left?: number } = {}
    mutate(d => {
      const st = earnStateIn(d, user.id)
      if (st.scratches >= SCRATCH_PER_DAY) { out = { err: 'No scratch cards left today — come back tomorrow.' }; return }
      st.scratches++
      const prize = SCRATCH_PRIZES[Math.floor(Math.random() * SCRATCH_PRIZES.length)]
      if (prize > 0) creditEarn(d, user.id, prize, 'Scratch card reward')
      out = { prize, left: SCRATCH_PER_DAY - st.scratches }
    })
    return out
  }
  const completeEarnTask: Ctx['completeEarnTask'] = (taskId) => {
    if (!user) return { err: 'Not signed in' }
    const task = EARN_TASKS.find(x => x.id === taskId)
    if (!task) return { err: 'Unknown task' }
    let out: { err?: string; amount?: number } = {}
    mutate(d => {
      const st = earnStateIn(d, user.id)
      if (st.tasksDone.includes(taskId)) { out = { err: 'Task already completed' }; return }
      st.tasksDone.push(taskId)
      creditEarn(d, user.id, task.reward, 'Task reward: ' + task.title)
      out = { amount: task.reward }
    })
    return out
  }
  const submitQuiz: Ctx['submitQuiz'] = (correct) => {
    if (!user) return { err: 'Not signed in' }
    let out: { err?: string; amount?: number } = {}
    mutate(d => {
      const st = earnStateIn(d, user.id)
      if (st.quizDay === todayStr()) { out = { err: 'You already played the quiz today.' }; return }
      st.quizDay = todayStr()
      const amount = Math.max(0, Math.min(5, correct)) * QUIZ_PER_CORRECT
      if (amount > 0) creditEarn(d, user.id, amount, 'Daily quiz reward (' + correct + '/5 correct)')
      out = { amount }
    })
    return out
  }
  const setLoanFee: Ctx['setLoanFee'] = (loanId, amount) => {
    mutate(d => {
      const loan = d.loans.find(x => x.id === loanId); if (!loan) return
      loan.processingFee = amount; loan.feeStatus = 'unpaid'
      audit(d, 'admin', 'loan.fee_set', loanId + ' processing fee ' + amount + ' BDT')
      notify(d, loan.userId, 'Loan processing fee', 'A processing fee of ' + amount + ' BDT was set for your loan ' + loanId + '. Pay it from the Loan section to continue.', 'loan')
    })
  }
  const submitLoanFee: Ctx['submitLoanFee'] = (loanId, method, ref) => {
    if (!user) return
    mutate(d => {
      const loan = d.loans.find(x => x.id === loanId && x.userId === user.id); if (!loan) return
      loan.feeStatus = 'submitted'; loan.feeMethod = method; loan.feeTxRef = ref
      d.users.filter(u => u.role === 'admin').forEach(a => notify(d, a.id, 'Processing fee payment submitted', user.name + ' submitted a fee payment for ' + loanId + ' via ' + method + ' (ref: ' + ref + ').', 'loan'))
    })
  }
  const confirmLoanFee: Ctx['confirmLoanFee'] = (loanId) => {
    mutate(d => {
      const loan = d.loans.find(x => x.id === loanId); if (!loan) return
      loan.feeStatus = 'paid'
      audit(d, 'admin', 'loan.fee_paid', loanId + ' processing fee confirmed paid')
      notify(d, loan.userId, 'Processing fee confirmed', 'Your processing fee payment for loan ' + loanId + ' has been confirmed. Thank you.', 'loan')
    })
  }
  const decideLoan: Ctx['decideLoan'] = (id, ok) => {
    mutate(d => {
      const loan = d.loans.find(x => x.id === id); if (!loan || loan.status !== 'pending') return
      loan.status = ok ? 'active' : 'rejected'
      if (ok) {
        const w = d.wallets.find(x => x.userId === loan.userId)!; w.available += loan.amount
        recordTx(d, { userId: loan.userId, category: 'loan_disbursement', title: 'Loan disbursed', amount: loan.amount, fee: 0, currency: 'BDT', status: 'completed' })
        audit(d, 'admin', 'loan.approve', `${loan.id} ৳${loan.amount} disbursed`)
      } else audit(d, 'admin', 'loan.reject', loan.id)
      notify(d, loan.userId, ok ? 'Loan approved' : 'Loan rejected', ok ? '৳' + loan.amount.toLocaleString() + ' has been disbursed to your wallet.' : 'Your loan application was not approved this time.', 'loan')
    })
  }
  const repayLoan: Ctx['repayLoan'] = (loan, amount) => {
    if (!user) return 'Not signed in'
    if (badAmount(amount)) return 'Enter a valid amount.'
    const w = walletOf(user.id)
    if (amount > w.available) return 'Insufficient balance.'
    const remaining = loan.totalPayable - loan.paid
    if (amount > remaining) return 'Amount exceeds outstanding balance of ৳' + remaining.toLocaleString() + '.'
    mutate(d => {
      const dw = d.wallets.find(x => x.userId === user.id)!
      dw.available -= amount
      const dl = d.loans.find(x => x.id === loan.id)!; dl.paid += amount
      if (dl.paid >= dl.totalPayable) dl.status = 'repaid'
      recordTx(d, { userId: user.id, category: 'loan_repayment', title: 'Loan repayment', amount, fee: 0, currency: 'BDT', status: 'completed' })
    })
    return null
  }
  const submitKyc: Ctx['submitKyc'] = (p) => {
    if (!user) return
    mutate(d => {
      const u = d.users.find(x => x.id === user.id)! 
      u.kyc = 'pending'; u.kycDocType = p.docType; u.kycDocNumber = p.docNumber
      if (p.docPhoto) u.kycDocPhoto = p.docPhoto
      if (p.facePhoto) u.kycFacePhoto = p.facePhoto
      u.kycSubmittedAt = nowISO()
      notify(d, user.id, 'KYC submitted', 'Your documents and face scan were submitted for admin approval.', 'security')
    })
  }
  const decideKyc: Ctx['decideKyc'] = (userId2, ok) => mutate(d => {
    const u = d.users.find(x => x.id === userId2); if (!u) return
    u.kyc = ok ? 'verified' : 'unverified'
    audit(d, 'admin', ok ? 'kyc.verify' : 'kyc.reject', userId2)
    notify(d, userId2, ok ? 'KYC verified' : 'KYC rejected', ok ? 'Your identity is verified. All limits unlocked.' : 'Your KYC documents were not accepted. Please resubmit.', 'security')
  })
  const setUserStatus: Ctx['setUserStatus'] = (userId2, status) => mutate(d => {
    const u = d.users.find(x => x.id === userId2); if (u) { u.status = status; audit(d, 'admin', 'user.' + status, userId2) }
  })
  const adjustBalance: Ctx['adjustBalance'] = (userId2, amount, reason) => mutate(d => {
    const w = d.wallets.find(x => x.userId === userId2); if (!w) return
    w.available += amount
    recordTx(d, { userId: userId2, category: 'adjustment', title: 'Admin adjustment', amount, fee: 0, currency: 'BDT', status: 'completed', note: reason })
    audit(d, 'admin', 'wallet.adjust', `${userId2} ${amount > 0 ? '+' : ''}৳${amount} — ${reason}`)
    notify(d, userId2, 'Wallet adjustment', 'An admin adjusted your balance by ৳' + amount.toLocaleString() + '. Reason: ' + reason, 'info')
  })
  const updateProfile: Ctx['updateProfile'] = (p) => { if (user) mutate(d => { Object.assign(d.users.find(u => u.id === user.id)!, p) }) }
  const changePassword: Ctx['changePassword'] = (oldPw, newPw) => {
    if (!user) return 'Not signed in'
    const lk = lockError(user.id); if (lk) return lk
    if (user.passwordHash !== hashSecret(oldPw)) return recordFail(user.id, 'Current password is incorrect.')
    recordSuccess(user.id)
    mutate(d => { d.users.find(u => u.id === user.id)!.passwordHash = hashSecret(newPw) }); return null
  }
  const changePin: Ctx['changePin'] = (oldPin, newPin) => {
    if (!user) return 'Not signed in'
    const lk = lockError(user.id); if (lk) return lk
    if (user.pinHash !== hashSecret(oldPin)) return recordFail(user.id, 'Current PIN is incorrect.')
    recordSuccess(user.id)
    if (!/^\d{4}$/.test(newPin)) return 'PIN must be exactly 4 digits.'
    mutate(d => { d.users.find(u => u.id === user.id)!.pinHash = hashSecret(newPin) }); return null
  }
  const toggleWatch: Ctx['toggleWatch'] = (symbol) => {
    if (!user) return
    mutate(d => {
      const list = d.watchlist[user.id] ?? []
      d.watchlist[user.id] = list.includes(symbol) ? list.filter(s => s !== symbol) : [...list, symbol]
    })
  }
  const markAllRead = () => { if (user) mutate(d => d.notifications.forEach(n => { if (n.userId === user.id) n.read = true })) }
  const markRead = (id: string) => mutate(d => { const n = d.notifications.find(x => x.id === id); if (n) n.read = true })
  const publishNews: Ctx['publishNews'] = (n) => mutate(d => {
    if (n.id) { const ex = d.news.find(x => x.id === n.id); if (ex) Object.assign(ex, n) }
    else d.news.unshift({ ...n, id: uid('NEWS'), date: nowISO() })
    audit(d, 'admin', 'news.publish', n.title)
  })
  const deleteNews = (id: string) => mutate(d => { d.news = d.news.filter(x => x.id !== id) })
  const updateSettings: Ctx['updateSettings'] = (s) => mutate(d => { Object.assign(d.settings, s); audit(d, 'admin', 'settings.update', JSON.stringify(s)) })
  const toggleBanner = (id: string) => mutate(d => { const b = d.banners.find(x => x.id === id); if (b) b.active = !b.active })
  const addTicket: Ctx['addTicket'] = (subject, message) => {
    if (!user) return
    mutate(d => {
      d.tickets.unshift({ id: uid('TKT'), userId: user.id, subject, status: 'pending', createdAt: nowISO(), updatedAt: nowISO(), messages: [{ id: uid('MSG'), from: 'user', text: message, at: nowISO() }] })
      d.users.filter(u => u.role === 'admin').forEach(a => notify(d, a.id, 'New support chat', user.name + ' opened a support chat: ' + subject, 'support'))
    })
  }
  const replyTicket: Ctx['replyTicket'] = (ticketId, text, as) => {
    if (!user || !text.trim()) return
    mutate(d => {
      const tk = d.tickets.find(x => x.id === ticketId); if (!tk || tk.status === 'resolved') return
      const from = as
      tk.messages.push({ id: uid('MSG'), from, text: text.trim(), at: nowISO() })
      tk.updatedAt = nowISO()
      if (from === 'admin' && tk.status === 'pending') tk.status = 'processing'
      if (from === 'admin') notify(d, tk.userId, 'Support replied', 'The support team replied to your chat: ' + tk.subject, 'support')
      else d.users.filter(u => u.role === 'admin').forEach(a => notify(d, a.id, 'Support chat reply', user.name + ' replied in: ' + tk.subject, 'support'))
    })
  }
  const resolveTicket: Ctx['resolveTicket'] = (ticketId) => {
    mutate(d => {
      const tk = d.tickets.find(x => x.id === ticketId); if (!tk || tk.status === 'resolved') return
      tk.status = 'resolved'; tk.updatedAt = nowISO()
      notify(d, tk.userId, 'Support chat resolved', 'Your support chat "' + tk.subject + '" was marked resolved and closed.', 'support')
    })
  }
  const requestUpgrade: Ctx['requestUpgrade'] = (toLevel) => {
    if (!user) return 'Not signed in'
    if (toLevel === 2 && user.kyc === 'unverified') return 'KYC required: submit your ID first (Profile → KYC verification).'
    if (toLevel !== user.level + 1) return 'You can only request the next level.'
    if (toLevel > 4) return 'You are already at the highest level.'
    if (dbRef.current.levelRequests.some(r => r.userId === user.id && r.status === 'pending')) return 'You already have a pending upgrade request.'
    const depReq = dbRef.current.levels.find(l => l.level === toLevel)?.depositRequired ?? 0
    if (depReq > 0) {
      const deposited = dbRef.current.deposits.filter(x => x.userId === user.id && x.status === 'approved').reduce((s2, x) => s2 + x.amount, 0)
      if (deposited < depReq) return 'Level ' + toLevel + ' requires total deposits of ' + fmtMoney(depReq) + '. You have deposited ' + fmtMoney(deposited) + ' so far — deposit ' + fmtMoney(depReq - deposited) + ' more from Add Money, then request again.'
    }
    mutate(d => {
      d.levelRequests.unshift({ id: uid('LVR'), userId: user.id, fromLevel: user.level, toLevel, status: 'pending', createdAt: nowISO() })
      notify(d, user.id, 'Upgrade requested', 'Your request to reach Level ' + toLevel + ' is pending admin review.', 'security')
    })
    return null
  }
  const decideUpgrade: Ctx['decideUpgrade'] = (id, ok) => mutate(d => {
    const r = d.levelRequests.find(x => x.id === id); if (!r || r.status !== 'pending') return
    r.status = ok ? 'approved' : 'rejected'
    if (ok) { const u = d.users.find(x => x.id === r.userId); if (u) u.level = r.toLevel }
    audit(d, 'admin', ok ? 'level.approve' : 'level.reject', `${r.userId} → Level ${r.toLevel}`)
    notify(d, r.userId, ok ? '🎉 Level upgraded' : 'Upgrade request rejected', ok ? 'Your account is now Level ' + r.toLevel + '. Higher limits are active.' : 'Your upgrade request was not approved. Check the level requirements and try again.', 'security')
  })
  const updateLevelDef: Ctx['updateLevelDef'] = (level, patch) => mutate(d => {
    const def = d.levels.find(x => x.level === level); if (def) { Object.assign(def, patch); audit(d, 'admin', 'level.update', 'Level ' + level) }
  })
  const setUserLevel: Ctx['setUserLevel'] = (userId2, level) => mutate(d => {
    const u = d.users.find(x => x.id === userId2); if (u) { u.level = level; audit(d, 'admin', 'level.set', `${userId2} → Level ${level}`); notify(d, userId2, 'Account level changed', 'An admin set your account to Level ' + level + '.', 'security') }
  })
  const setUserLoanLimit: Ctx['setUserLoanLimit'] = (userId2, bdt) => mutate(d => {
    const u = d.users.find(x => x.id === userId2); if (!u) return
    if (bdt === null) delete u.loanLimitOverride; else u.loanLimitOverride = bdt
    audit(d, 'admin', 'loanlimit.set', bdt === null ? userId2 + ' → level default' : userId2 + ' → ' + bdt + ' BDT')
    notify(d, userId2, 'Loan limit updated', bdt === null ? 'Your loan limit now follows your account level.' : 'An admin set a personal loan limit on your account. Check the Loan section for your new limit.', 'info')
  })
  const resetDemo = () => { const fresh = seedDB(); localStorage.setItem(KEY, JSON.stringify(fresh)); setDb(fresh) }

  const value: Ctx = {
    db, user, theme, toggleTheme, toasts, toast, dismissToast, login, register, walletOf,
    addDeposit, decideDeposit, settleDepositExternal, requestWithdraw, decideWithdraw, directWithdraw, stake, unstake, swap, sendMoney, buyCrypto, sellCrypto,
    applyLoan, earnInfo, claimCheckin, watchAdReward, spinReward, scratchDraw, completeEarnTask, submitQuiz, decideLoan, repayLoan, setLoanFee, submitLoanFee, confirmLoanFee, submitKyc, decideKyc, setUserStatus, adjustBalance,
    updateProfile, changePassword, changePin, toggleWatch, markAllRead, markRead,
    publishNews, deleteNews, updateSettings, toggleBanner, addTicket, replyTicket, resolveTicket, resetDemo,
    requestUpgrade, decideUpgrade, updateLevelDef, setUserLevel, setUserLoanLimit,
    locked, appInstalled, devicePinSet, fingerprintSet, setDevicePin, clearDevicePin, setupFingerprint, clearFingerprint, unlockWithPin, unlockWithFingerprint, unlockWithPassword, lockNow, signOut, resetPassword, requestPasswordOtp, verifyPasswordOtp, resetPasswordWithOtp, addUserPayMethod, removeUserPayMethod, lang, setLanguage, t, currency, currencyIsAuto, detectedCurrency: detected.code, setCurrency, fmtMoney, fmtAmount, toBDT, fromBDT,
  }
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
