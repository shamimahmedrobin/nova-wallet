import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ADS_PER_DAY, CHECKIN_REWARDS, EARN_TASKS, QUIZ_PER_CORRECT, SCRATCH_PER_DAY, SCRATCH_PRIZES, SPINS_PER_DAY, WHEEL_PRIZES } from './earn'
import type { DB, Loan, NewsItem, Tx, User , LoanInfo, EarnState } from './types'
import { DEFAULT_LEVELS, DEFAULT_PAY_METHODS, seedDB } from './seed'
import { translate } from './i18n'
import { detectCurrency, FALLBACK_RATES } from './currencies'
import { fmtBDT } from './utils'
import { hashSecret, nowISO, rid, uid } from './utils'
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut, updatePassword as fbUpdatePassword } from 'firebase/auth'
import { firebaseAuth } from './firebase'
import { apiBootstrap, apiMe, apiGet, apiPost } from './api'

const KEY = 'novawallet.db.v3'
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
  login: (idOrEmail: string, password: string) => Promise<string | null>
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
  register: (p: { name: string; username: string; email: string; phone: string; password: string; pin: string; referralCode?: string }) => Promise<string | null>
  walletOf: (userId: string) => DB['wallets'][number]
  addDeposit: (p: { method: string; amount: number; trxId: string; receipt?: string; methodId?: string; kind?: 'bank' | 'crypto'; verification?: 'manual' | 'auto' }) => Promise<string | null>
  decideDeposit: (id: string, ok: boolean) => Promise<void>
  /** AUTOMATION SEAM: a connected provider (bank API, gateway callback or
      SMS/webhook matcher) settles a pending deposit through the exact same
      server pipeline as an admin decision. */
  settleDepositExternal: (id: string, ok: boolean, providerRef?: string) => Promise<void>
  requestWithdraw: (p: { method: string; amount: number; destination: string; pin: string }) => Promise<string | null>
  directWithdraw: (p: { method: string; amount: number; destination: string }) => Promise<string | null>
  stake: (amount: number, apy: number, termDays: number) => Promise<string | null>
  unstake: (stakeId: string) => Promise<string | null>
  swap: (fromSym: string, toSym: string, amountFrom: number, prices: Record<string, number>) => Promise<string | null>
  decideWithdraw: (id: string, ok: boolean) => Promise<void>
  sendMoney: (p: { toUserId: string; amount: number; note?: string; pin: string }) => Promise<string | Tx>
  verifyTxPin: (pin: string) => string | null
  buyCrypto: (symbol: string, bdtAmount: number, priceUsd: number) => Promise<string | null>
  sellCrypto: (symbol: string, coinAmount: number, priceUsd: number) => Promise<string | null>
  applyLoan: (amount: number, months: number, info: LoanInfo) => Promise<void>
  earnInfo: () => EarnState
  claimCheckin: () => Promise<{ err?: string; amount?: number; streak?: number }>
  watchAdReward: () => Promise<{ err?: string; amount?: number; left?: number }>
  spinReward: () => Promise<{ err?: string; prize?: number; index?: number; left?: number }>
  scratchDraw: () => Promise<{ err?: string; prize?: number; left?: number }>
  completeEarnTask: (taskId: string) => Promise<{ err?: string; amount?: number }>
  submitQuiz: (correct: number) => Promise<{ err?: string; amount?: number }>
  setLoanFee: (loanId: string, amount: number) => Promise<void>
  submitLoanFee: (loanId: string, method: string, ref: string) => Promise<void>
  confirmLoanFee: (loanId: string) => Promise<void>
  decideLoan: (id: string, ok: boolean) => Promise<void>
  repayLoan: (loan: Loan, amount: number) => Promise<string | null>
  submitKyc: (p: { docType: string; docNumber: string; docPhoto?: string; facePhoto?: string }) => Promise<string | null>; decideKyc: (userId: string, ok: boolean) => Promise<string | null>
  setUserStatus: (userId: string, status: User['status']) => void
  adjustBalance: (userId: string, amount: number, title: string, note?: string) => Promise<void>
  /** Support-desk trading on a customer's account (server-settled). */
  adminBuyCrypto: (userId: string, symbol: string, usdtAmount: number, priceUsd: number) => Promise<string | null>
  adminSellCrypto: (userId: string, symbol: string, coinAmount: number, priceUsd: number) => Promise<string | null>
  /** Release one active stake early (principal + accrued interest), support action. */
  adminReleaseStake: (userId: string, stakeId: string) => Promise<void>
  /** Clear ALL locked holdings: closes stakes, cancels pending cash outs, releases the rest to Available. */
  adminClearLocked: (userId: string) => Promise<void>
  updateProfile: (p: Partial<User>) => void
  changePassword: (oldPw: string, newPw: string) => string | null
  changePin: (oldPin: string, newPin: string) => string | null
  toggleWatch: (symbol: string) => void
  markAllRead: () => void; markRead: (id: string) => void
  publishNews: (n: Omit<NewsItem, 'id' | 'date'> & { id?: string }) => void
  deleteNews: (id: string) => void
  updateSettings: (s: Partial<DB['settings']>) => void
  toggleBanner: (id: string) => void
  requestUpgrade: (toLevel: number) => Promise<string | null>
  decideUpgrade: (id: string, ok: boolean) => void
  updateLevelDef: (level: number, patch: Partial<DB['levels'][number]>) => void
  setUserLevel: (userId: string, level: number) => void
  setUserLoanLimit: (userId: string, bdt: number | null) => void
  addTicket: (subject: string, message: string) => Promise<string | null>
  replyTicket: (ticketId: string, text: string, as: 'user' | 'admin') => void
  resolveTicket: (ticketId: string) => void
  /** Send a notification to EVERY user (server broadcast). Returns an error string or null. */
  broadcast: (title: string, body: string) => Promise<string | null>
  /** RBAC: change an admin's scope, or promote/demote a user (owner only, server-enforced). */
  setAdminScope: (userId: string, scope: string) => void
  setAdminRole: (userId: string, role: 'admin' | 'user') => void
  /** Latest app crash reports from the server (admin overview), for the System Health tab. */
  adminErrors: { id: number; userId: string | null; message: string; url: string | null; createdAt: string }[]
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
  const [adminErrors, setAdminErrors] = useState<Ctx['adminErrors']>([])
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
  const walletOf = useCallback((id: string) => dbRef.current.wallets.find(w => w.userId === id) ?? { userId: id, available: 0, locked: 0, holdings: {} }, [])

  const notify = (draft: DB, userId2: string, title: string, body: string, kind: string, link?: string) => {
    draft.notifications.unshift({ id: rid(), userId: userId2, title, body, kind, read: false, createdAt: nowISO(), link })
  }
  /** Fan a notification out to every admin account, deep-linked into the exact Admin tab. */
  const notifyAdmins = (draft: DB, title: string, body: string, kind: string, link?: string) => {
    draft.users.filter(u => u.role === 'admin').forEach(a => notify(draft, a.id, title, body, kind, link))
  }
  const audit = (draft: DB, actor: string, action: string, detail: string) => {
    draft.audit.unshift({ id: rid(), actor, action, detail, createdAt: nowISO() })
  }
  const mutate = (fn: (draft: DB) => void) => {
    // Run the draft SYNCHRONOUSLY against the latest db (dbRef): several store
    // functions capture values inside the mutator and return them (e.g.
    // sendMoney returns the created Tx for its receipt modal). Passing an
    // updater to setDb defers execution to render time, so those captures
    // were still null when returned — the Send receipt modal never opened.
    const draft: DB = JSON.parse(JSON.stringify(dbRef.current))
    fn(draft)
    dbRef.current = draft
    setDb(draft)
  }
  // ---- Server state (Phase 2): D1 is the source of truth for balances and
  // transactions. The helpers below merge Worker responses into the local
  // store: own financial slices are replaced by /v1/state, the user
  // directory becomes stub records (for Send/Admin across devices), and
  // admins additionally replace every financial slice from the overview.
  const stubFrom = (su: any): User => ({
    id: su.id, fbUid: su.id, stub: true, name: su.name || su.username, username: su.username, email: su.email,
    phone: '', passwordHash: '', pinHash: '', role: su.role, status: su.status, kyc: su.kyc ?? 'unverified',
    ...(su.kycDocType ? { kycDocType: su.kycDocType, kycDocNumber: su.kycDocNumber, kycSubmittedAt: su.kycSubmittedAt } : {}),
    ...(su.adminScope ? { adminScope: su.adminScope } : {}),
    referralCode: su.referralCode || '', referredBy: null, twoFA: false, level: su.level || 1, language: 'en',
    createdAt: su.createdAt || nowISO(), lastLogin: su.createdAt || nowISO(), sessions: [],
  })
  const mergeDirectoryInto = (d: DB, users: any[]) => {
    for (const su of users) {
      // Match REAL local records first (by Firebase uid, then email),
      // stubs last (by server id). Matching a stub first was a trap:
      // the refresh landed on the stub, the drop-loop below then deleted
      // that stub for duplicating the real record, and the real record —
      // the one the UI binds to — kept its stale values forever.
      const existing = d.users.find(x => !x.stub && x.fbUid && x.fbUid === su.id)
        ?? d.users.find(x => !x.stub && x.email === su.email)
        ?? d.users.find(x => x.id === su.id)
        ?? d.users.find(x => x.email === su.email)
      if (existing) {
        if (!existing.fbUid) existing.fbUid = su.id
        // Refresh the server-owned fields on ANY matched record, stub or
        // real: KYC status, level, role/scope and account status all move
        // on the server after first sight. (Real records occur when the
        // account was created on this very device — gating the refresh
        // on stubs left those frozen at their registration-time values.)
        existing.kyc = su.kyc ?? existing.kyc
        existing.level = su.level ?? existing.level
        existing.status = su.status ?? existing.status
        existing.role = su.role ?? existing.role
        if (su.adminScope) existing.adminScope = su.adminScope; else if (existing.role !== 'admin') delete existing.adminScope
        if (su.kycDocType) { existing.kycDocType = su.kycDocType; existing.kycDocNumber = su.kycDocNumber; existing.kycSubmittedAt = su.kycSubmittedAt }
        continue
      }
      d.users.push(stubFrom(su))
    }
    // Drop any stub that duplicates a real local account (same server
    // uid): a self-stub poisons the uid map below, which once made the
    // signed-in user's own wallet/transactions vanish from their app.
    for (let i = d.users.length - 1; i >= 0; i--) {
      const u = d.users[i]
      if (u.stub && d.users.some(x => !x.stub && x.fbUid === u.id)) d.users.splice(i, 1)
    }
  }
  const uidResolver = (d: DB) => {
    const m = new Map<string, string>()
    // Stubs first, real records last — a real account's id mapping always
    // wins over a directory stub of the same person.
    d.users.filter(u => u.stub).forEach(u => { m.set(u.id, u.id); if (u.fbUid) m.set(u.fbUid, u.id) })
    d.users.filter(u => !u.stub).forEach(u => { m.set(u.id, u.id); if (u.fbUid) m.set(u.fbUid, u.id) })
    return (s: string) => m.get(s) ?? s
  }
  // The signed-in user can end up with duplicate local records (a real
  // record plus a directory stub of themselves, or two real records from
  // re-logging in after clearing site data). Server rows must ALWAYS be
  // filed under the session record's id — filed under any duplicate's
  // id, the user's own wallet and transactions vanish from their pages
  // (balance flips to 0, history shows empty). Absorb every duplicate
  // of the session user and re-key its rows to the session id.
  const canonicalizeSelf = (d: DB, sessionId: string | null) => {
    if (!sessionId) return
    const me = d.users.find(u => u.id === sessionId)
    if (!me) return
    const mine = new Set<string>([sessionId])
    if (me.fbUid) mine.add(me.fbUid)
    d.users = d.users.filter(u => {
      if (u.id === sessionId) return true
      const samePerson = (u.fbUid && me.fbUid && u.fbUid === me.fbUid) || (u.email && me.email && u.email.toLowerCase() === me.email.toLowerCase())
      if (samePerson) { mine.add(u.id); if (u.fbUid) mine.add(u.fbUid); return false }
      return true
    })
    const rekey = (rows: any[]) => rows.forEach(r => { if (r && mine.has(r.userId)) r.userId = sessionId })
    rekey(d.wallets); rekey(d.txs); rekey(d.deposits); rekey(d.withdrawals); rekey(d.loans)
    rekey(d.stakes); rekey(d.notifications); rekey(d.earnStates); rekey(d.levelRequests); rekey(d.tickets)
    for (const k of Object.keys(d.watchlist ?? {})) {
      if (k !== sessionId && mine.has(k)) {
        d.watchlist[sessionId] = [...new Set([...(d.watchlist[sessionId] ?? []), ...d.watchlist[k]])]
        delete d.watchlist[k]
      }
    }
  }
  const applyStateInto = (d: DB, localId: string, state: any) => {
    const resolve = uidResolver(d)
    const sw = { userId: localId, available: state.wallet.available, locked: state.wallet.locked, holdings: state.wallet.holdings || {} }
    const w = d.wallets.find(x => x.userId === localId)
    if (w) Object.assign(w, sw); else d.wallets.push(sw)
    const mine = (rows: any[]) => rows.map((r: any) => ({ ...r, userId: resolve(r.userId) }))
    d.txs = [...mine(state.transactions), ...d.txs.filter(t => t.userId !== localId)]
    d.deposits = [...mine(state.deposits), ...d.deposits.filter(x => x.userId !== localId)]
    d.withdrawals = [...mine(state.withdrawals), ...d.withdrawals.filter(x => x.userId !== localId)]
    d.loans = [...mine(state.loans), ...d.loans.filter(x => x.userId !== localId)]
    d.stakes = [...mine(state.stakes), ...d.stakes.filter(x => x.userId !== localId)]
    const lu = d.users.find(x => x.id === localId)
    if (lu && state.profile) {
      lu.role = state.profile.role; lu.level = state.profile.level; lu.status = state.profile.status
      if (state.profile.adminScope) lu.adminScope = state.profile.adminScope
      if (state.profile.kyc) lu.kyc = state.profile.kyc
      if (state.profile.kycDocType) { lu.kycDocType = state.profile.kycDocType; lu.kycDocNumber = state.profile.kycDocNumber; lu.kycSubmittedAt = state.profile.kycSubmittedAt }
      if (!lu.fbUid) lu.fbUid = state.profile.id
    }
    // Phase 3 slices: platform content is server-authoritative; own
    // tickets/level requests merge with any pre-migration local ones
    // (local-only chats stay readable; the server copy wins by id).
    if (state.content) {
      d.settings = { ...d.settings, ...state.content.settings }
      d.news = state.content.news
      d.banners = state.content.banners
      if (Array.isArray(state.content.levels) && state.content.levels.length) d.levels = state.content.levels
    }
    if (state.tickets) {
      const serverIds = new Set(state.tickets.map((t: any) => t.id))
      d.tickets = [...mine(state.tickets), ...d.tickets.filter(t => t.userId === localId && !serverIds.has(t.id)), ...d.tickets.filter(t => t.userId !== localId)]
    }
    if (state.levelRequests) {
      const serverIds = new Set(state.levelRequests.map((r: any) => r.id))
      d.levelRequests = [...mine(state.levelRequests), ...d.levelRequests.filter(r => r.userId === localId && !serverIds.has(r.id)), ...d.levelRequests.filter(r => r.userId !== localId)]
    }
    if (state.notifications) {
      const have = new Set(d.notifications.map(n => n.id))
      const fresh = state.notifications.filter((n: any) => !have.has(n.id)).map((n: any) => ({ ...n, userId: localId }))
      if (fresh.length) d.notifications = [...fresh, ...d.notifications]
    }
    canonicalizeSelf(d, localId)
  }
  const applyOverviewInto = (d: DB, ov: any) => {
    mergeDirectoryInto(d, ov.users)
    const resolve = uidResolver(d)
    d.wallets = ov.users.map((u: any) => {
      const w = ov.wallets[u.id]
      return { userId: resolve(u.id), available: w?.available ?? 0, locked: w?.locked ?? 0, holdings: w?.holdings ?? {} }
    })
    const mapRows = (rows: any[]) => rows.map((r: any) => ({ ...r, userId: resolve(r.userId) }))
    d.txs = mapRows(ov.transactions); d.deposits = mapRows(ov.deposits); d.withdrawals = mapRows(ov.withdrawals)
    d.loans = mapRows(ov.loans); d.stakes = mapRows(ov.stakes)
    // Final normalization: any row still keyed by a real user's server
    // uid is re-keyed to that user's local id, whatever the map said —
    // the signed-in user's own wallet and transactions must never end up
    // filed under an id their pages don't look up.
    const fix = (rows: any[]) => rows.map(r => {
      const real = d.users.find(x => !x.stub && x.fbUid && x.fbUid === r.userId)
      return real ? { ...r, userId: real.id } : r
    })
    d.wallets = fix(d.wallets); d.txs = fix(d.txs); d.deposits = fix(d.deposits)
    d.withdrawals = fix(d.withdrawals); d.loans = fix(d.loans); d.stakes = fix(d.stakes)
    // Phase 3 slices (admin view): all tickets + level requests, platform
    // content, and the crash-report list for the System Health tab.
    if (ov.content) {
      d.settings = { ...d.settings, ...ov.content.settings }
      d.news = ov.content.news
      d.banners = ov.content.banners
      if (Array.isArray(ov.content.levels) && ov.content.levels.length) d.levels = ov.content.levels
    }
    if (ov.tickets) {
      const serverIds = new Set(ov.tickets.map((t: any) => t.id))
      const ownLocal = d.tickets.filter(t => t.userId === userIdRef.current && !serverIds.has(t.id))
      d.tickets = [...fix(mapRows(ov.tickets)), ...ownLocal]
    }
    if (ov.levelRequests) d.levelRequests = fix(mapRows(ov.levelRequests))
    if (ov.errors) setAdminErrors(ov.errors)
    canonicalizeSelf(d, userIdRef.current)
  }
  const applyMoneyResult = (r: any) => {
    if (!user) return
    if (r?.state) mutate(d => applyStateInto(d, user.id, r.state))
    if (r?.overview) mutate(d => applyOverviewInto(d, r.overview))
  }
  const serverUidOf = (localId: string): string | null => {
    const u = dbRef.current.users.find(x => x.id === localId)
    return u?.fbUid ?? (u?.stub ? u.id : null)
  }
  const hydrateServer = async (u: User) => {
    try {
      const st = await apiGet('/v1/state')
      if (st?.state) mutate(d => applyStateInto(d, u.id, st.state))
      const dir = await apiGet('/v1/directory')
      if (dir?.users) mutate(d => mergeDirectoryInto(d, dir.users))
      if ((st?.state?.profile?.role ?? u.role) === 'admin') {
        const ov = await apiGet('/v1/admin/overview')
        if (ov?.overview) mutate(d => applyOverviewInto(d, ov.overview))
      }
    } catch { /* offline or not bootstrapped yet: keep local state */ }
  }
  const notifySelf = (title: string, body: string, kind: any, link?: string) => {
    if (user) mutate(d => notify(d, user.id, title, body, kind, link))
  }
  // ---- Server freshness: pull the server state when the app boots with a
  // saved session, whenever it returns to the foreground, and every 10s
  // while open — so money other people send appears within seconds, on its
  // own, without logging out and back in. Firebase restores its own
  // session asynchronously after a cold start, so also pull when it
  // reports one.
  const hydrateRef = useRef(hydrateServer); hydrateRef.current = hydrateServer
  const userIdRef = useRef(userId); userIdRef.current = userId
  useEffect(() => {
    if (!userId) return
    const pull = () => {
      if (lockedRef.current) return
      const u = dbRef.current.users.find(x => x.id === userIdRef.current)
      if (u && !u.stub) void hydrateRef.current(u)
    }
    pull()
    const iv = setInterval(pull, 10000)
    const onVis = () => { if (document.visibilityState === 'visible') pull() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', pull)
    const unsub = onAuthStateChanged(firebaseAuth, fb => { if (fb) pull() })
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', pull); unsub() }
  }, [userId, locked])
  // ---- Stake maturity: notify ONCE when a fixed-term stake reaches its term ----
  useEffect(() => {
    if (!userId) return
    const due = db.stakes.filter(st => st.userId === userId && st.status === 'active' && st.termDays > 0 && !st.maturedNotified && Date.now() >= new Date(st.startAt).getTime() + st.termDays * 86_400_000)
    if (!due.length) return
    mutate(d => {
      due.forEach(x => {
        const st = d.stakes.find(y => y.id === x.id); if (!st || st.maturedNotified) return
        st.maturedNotified = true
        const interest = Math.round(st.amount * st.apy / 100 * st.termDays / 365)
        notify(d, userId, '🎉 Stake matured', 'Your ' + st.termDays + '-day stake of ৳' + st.amount.toLocaleString() + ' has matured (interest ≈ ৳' + interest.toLocaleString() + '). You can unstake it now from Earn.', 'earn', '/earn')
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, db.stakes])
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
  // Sign-in is owned by Firebase Auth (Phase 1 of the backend integration).
  // Accounts created before Firebase existed (the seeded demo accounts and
  // any locally-registered ones) are migrated into Firebase automatically on
  // their first successful sign-in. The local profile still drives the app
  // until the data phase moves server-side; a successful Firebase sign-in
  // also re-syncs the local password copy so lock-screen unlock stays right.
  const login: Ctx['login'] = async (idOrEmail, password) => {
    const u = dbRef.current.users.find(x => !x.stub && (x.email === idOrEmail || x.username === idOrEmail))
    if (!u) {
      // Cross-device sign-in: the account exists on the server but this
      // device has no local profile yet. Authenticate with Firebase, then
      // rebuild the local profile from /v1/me and hydrate money from D1.
      if (!idOrEmail.includes('@')) return 'No account found for that email / username.'
      try {
        const cred = await signInWithEmailAndPassword(firebaseAuth, idOrEmail, password)
        const token = await cred.user.getIdToken()
        const me = await apiMe(token)
        if (!me?.user) return 'Account not found on the server.'
        if (me.user.status === 'suspended') { await fbSignOut(firebaseAuth).catch(() => {}); return 'This account is suspended. Contact support.' }
        const nu: User = {
          id: uid('USR'), fbUid: cred.user.uid, name: me.user.fullName || me.user.username, username: me.user.username,
          email: me.user.email, phone: me.user.phone || '', passwordHash: hashSecret(password), pinHash: me.user.pinHash || '',
          role: me.user.role, status: me.user.status, kyc: 'unverified', referralCode: me.user.referralCode || '',
          referredBy: null, twoFA: false, level: me.user.level || 1, language: 'en',
          createdAt: nowISO(), lastLogin: nowISO(), sessions: [{ id: 's1', device: 'Android · Chrome', at: nowISO(), current: true }],
        }
        mutate(d => { d.users.push(nu); d.wallets.push({ userId: nu.id, available: 0, locked: 0, holdings: {} }) })
        localStorage.setItem(SESSION, nu.id); setUserId(nu.id); setLocked(false)
        void hydrateServer(nu)
        return null
      } catch (e: any) {
        const code = e?.code || ''
        if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') return 'Invalid email or password.'
        if (code === 'auth/network-request-failed') return 'Could not reach the authentication server. Check your connection and try again.'
        if (code === 'auth/too-many-requests') return 'Too many failed attempts. Please wait a few minutes and try again.'
        return 'No account found for that email / username.'
      }
    }
    const lk = lockError(u.id); if (lk) return lk
    if (u.status === 'suspended') return 'This account is suspended. Contact support.'
    const localMatch = u.passwordHash === hashSecret(password)
    let fbOk = false
    let idToken: string | null = null
    let fbUid: string | null = null
    try {
      const cred = await signInWithEmailAndPassword(firebaseAuth, u.email, password)
      fbOk = true
      fbUid = cred.user.uid
      idToken = await cred.user.getIdToken()
    } catch (e: any) {
      const code = e?.code || ''
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        if (!localMatch) return recordFail(u.id, 'Wrong password. Please try again.')
        // First sign-in of a pre-Firebase account: migrate it into Firebase.
        try {
          const cred = await createUserWithEmailAndPassword(firebaseAuth, u.email, password)
          fbOk = true
          fbUid = cred.user.uid
          idToken = await cred.user.getIdToken()
        } catch (e2: any) {
          const code2 = e2?.code || ''
          if (code2 === 'auth/network-request-failed') return 'Could not reach the authentication server. Check your connection and try again.'
          // auth/email-already-in-use (password was reset locally via PIN/OTP,
          // so Firebase still holds the old one) or auth/weak-password:
          // fall through with the verified local credentials for this phase.
          if (code2 !== 'auth/email-already-in-use' && code2 !== 'auth/weak-password') return 'Sign-in failed. Please try again.'
        }
      } else if (code === 'auth/too-many-requests') {
        return 'Too many failed attempts. Please wait a few minutes and try again.'
      } else if (code === 'auth/network-request-failed') {
        return 'Could not reach the authentication server. Check your connection and try again.'
      } else if (code === 'auth/unauthorized-domain') {
        return 'This website domain is not authorized for sign-in yet.'
      } else if (!localMatch) {
        return recordFail(u.id, 'Wrong password. Please try again.')
      }
    }
    if (fbOk && !localMatch) {
      // Self-heal: keep the local copy in sync with the Firebase password.
      mutate(d => { const du = d.users.find(x => x.id === u.id)!; du.passwordHash = hashSecret(password) })
    }
    recordSuccess(u.id)
    mutate(d => { const du = d.users.find(x => x.id === u.id)!; du.lastLogin = nowISO(); if (fbUid) du.fbUid = fbUid })
    localStorage.setItem(SESSION, u.id); setUserId(u.id); setLocked(false)
    if (idToken) void syncServerProfile(idToken, u)
    return null
  }
  // After a Firebase sign-in: make sure the D1 rows exist (bootstrap), then
  // hydrate balances/transactions from the server — D1 is the source of
  // truth, including the role (promoting a user in D1 takes effect here).
  const syncServerProfile = async (token: string, u: User) => {
    await apiBootstrap(token, { username: u.username, fullName: u.name, pinHash: u.pinHash, phone: u.phone })
    await hydrateServer(u)
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
  const signOut = () => { setLocked(false); localStorage.removeItem(SESSION); setUserId(null); void fbSignOut(firebaseAuth).catch(() => {}) }
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
  const register: Ctx['register'] = async (p) => {
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
    // The account is created in Firebase Auth first — it is the real identity
    // store — then mirrored locally for the app, and bootstrapped into D1.
    let newFbUid: string | null = null
    try {
      const cred = await createUserWithEmailAndPassword(firebaseAuth, p.email, p.password)
      newFbUid = cred.user.uid
      const token = await cred.user.getIdToken()
      void apiBootstrap(token, { username: p.username, fullName: p.name, pinHash: hashSecret(p.pin), phone: p.phone, referralCode: p.referralCode })
    } catch (e: any) {
      const code = e?.code || ''
      if (code === 'auth/email-already-in-use') return 'An account with this email already exists.'
      if (code === 'auth/weak-password') return 'Password must be at least 6 characters.'
      if (code === 'auth/invalid-email') return 'Enter a valid email address.'
      if (code === 'auth/network-request-failed') return 'Could not reach the authentication server. Check your connection and try again.'
      if (code === 'auth/unauthorized-domain') return 'This website domain is not authorized for sign-up yet.'
      return 'Sign-up failed. Please try again.'
    }
    const referrer = p.referralCode ? cur.users.find(x => x.referralCode === p.referralCode) : undefined
    const nu: User = {
      id: uid('USR'), fbUid: newFbUid ?? undefined, name: p.name, username: p.username, email: p.email, phone: p.phone,
      passwordHash: hashSecret(p.password), pinHash: hashSecret(p.pin), role: 'user', status: 'active',
      kyc: 'unverified', level: 1, referralCode: 'NOVA-' + p.username.toUpperCase().slice(0, 6), referredBy: referrer?.id ?? null,
      twoFA: false, language: langPref, createdAt: nowISO(), lastLogin: nowISO(),
      sessions: [{ id: rid(), device: 'Web · Browser', at: nowISO(), current: true }],
    }
    mutate(d => {
      d.users.push(nu); d.wallets.push({ userId: nu.id, available: 0, locked: 0, holdings: {} })
      if (referrer) notify(d, referrer.id, 'New referral', nu.name + ' joined with your referral code.', 'referral')
      notifyAdmins(d, '👤 New user registered', nu.name + ' (' + nu.email + ') just created an account.', 'info', '/admin?tab=users&user=' + nu.id)
      notify(d, nu.id, 'Welcome to NovaWallet', 'Verify your KYC from your profile to unlock loans and higher limits.', 'info')
    })
    localStorage.setItem(SESSION, nu.id); setUserId(nu.id); setLocked(false)
    void hydrateServer(nu)
    return null
  }

  const addDeposit: Ctx['addDeposit'] = async (p) => {
    if (!user) return 'Not signed in'
    if (badAmount(p.amount)) return 'Enter a valid amount.'
    try {
      const r = await apiPost('/v1/deposit', { method: p.method, amount: p.amount, trxId: p.trxId, receipt: p.receipt, methodId: p.methodId, kind: p.kind, verification: p.verification ?? 'manual' })
      applyMoneyResult(r)
      mutate(d => {
        notifyAdmins(d, '💰 New deposit request', user.name + ' requested a ' + p.method + ' deposit of ৳' + p.amount.toLocaleString() + ' — review it in Finance.', 'deposit', '/admin?tab=finance')
        notify(d, user.id, 'Deposit request submitted', 'Your ' + p.method + ' deposit of ৳' + p.amount.toLocaleString() + (p.verification === 'auto' ? ' is queued for automatic verification — it settles as soon as the payment provider confirms it.' : ' is pending admin review.'), 'deposit')
      })
      return null
    } catch (e: any) { return e.message }
  }
  // Deposit settlement lives on the server now (admin decision and any
  // future provider/automation call the same Worker endpoint): balances,
  // the linked transaction and referral commission settle in D1 exactly once.
  const decideDeposit: Ctx['decideDeposit'] = async (id, ok) => {
    try { const r = await apiPost('/v1/admin/decide-deposit', { id, ok }); applyMoneyResult(r) }
    catch (e: any) { toast({ kind: 'error', title: e.message }) }
  }
  const settleDepositExternal: Ctx['settleDepositExternal'] = async (id, ok) => {
    try { const r = await apiPost('/v1/admin/decide-deposit', { id, ok }); applyMoneyResult(r) }
    catch (e: any) { toast({ kind: 'error', title: e.message }) }
  }
  const requestWithdraw: Ctx['requestWithdraw'] = async (p) => {
    if (!user) return 'Not signed in'
    const lk = lockError(user.id); if (lk) return lk
    if (user.pinHash !== hashSecret(p.pin)) return recordFail(user.id, 'Incorrect transaction PIN.')
    recordSuccess(user.id)
    if (badAmount(p.amount)) return 'Enter a valid amount.'
    if (user.status === 'frozen') return 'Your wallet is frozen. Contact support.'
    const lim = limitError(user, p.amount); if (lim) return lim
    try {
      const r = await apiPost('/v1/withdraw', { method: p.method, amount: p.amount, destination: p.destination, pin: p.pin })
      applyMoneyResult(r)
      mutate(d => {
        notifyAdmins(d, '💸 New cash out request', user.name + ' requested a cash out of ৳' + p.amount.toLocaleString() + ' to ' + p.destination + ' — review it in Finance.', 'withdraw', '/admin?tab=finance')
        notify(d, user.id, 'Cash out requested', 'Your cash out of ৳' + p.amount.toLocaleString() + ' is pending admin review.', 'withdraw')
      })
      return null
    } catch (e: any) { return e.message }
  }
  const directWithdraw: Ctx['directWithdraw'] = async (p) => {
    if (!user) return 'Not signed in'
    if (user.level < 2) return 'Direct Withdraw needs a Level 2 account. Please upgrade first.'
    if (badAmount(p.amount)) return 'Enter a valid amount.'
    if (user.status === 'frozen') return 'Your wallet is frozen. Contact support.'
    const lim = limitError(user, p.amount); if (lim) return lim
    try {
      const r = await apiPost('/v1/direct-withdraw', { method: p.method, amount: p.amount, destination: p.destination })
      applyMoneyResult(r)
      notifySelf('Withdrawal completed', 'Your direct withdrawal of ' + p.amount + ' BDT to ' + p.method + ' is complete.', 'transaction')
      return null
    } catch (e: any) { return e.message }
  }
  const stake: Ctx['stake'] = async (amount, apy, termDays) => {
    if (!user) return 'Not signed in'
    if (badAmount(amount)) return 'Enter a valid amount.'
    try {
      const r = await apiPost('/v1/stake', { amount, apy, termDays })
      applyMoneyResult(r)
      notifySelf('🌱 Stake started', 'You staked ৳' + amount.toLocaleString() + ' at ' + apy + '% APY (' + (termDays === 0 ? 'Flexible — unstake anytime' : termDays + ' days') + ').', 'earn', '/earn')
      return null
    } catch (e: any) { return e.message }
  }
  const unstake: Ctx['unstake'] = async (stakeId) => {
    if (!user) return 'Not signed in'
    try {
      const r = await apiPost('/v1/unstake', { stakeId })
      applyMoneyResult(r)
      notifySelf('💰 Unstaked', 'Your stake plus interest is back in your available balance.', 'earn', '/earn')
      return null
    } catch (e: any) { return e.message }
  }
  const swap: Ctx['swap'] = async (fromSym, toSym, amountFrom, prices) => {
    if (!user) return 'Not signed in'
    if (fromSym === toSym) return 'Choose two different assets.'
    try {
      const r = await apiPost('/v1/swap', { fromSym, toSym, amountFrom, prices })
      applyMoneyResult(r)
      return null
    } catch (e: any) { return e.message }
  }
  const decideWithdraw: Ctx['decideWithdraw'] = async (id, ok) => {
    try { const r = await apiPost('/v1/admin/decide-withdraw', { id, ok }); applyMoneyResult(r) }
    catch (e: any) { toast({ kind: 'error', title: e.message }) }
  }
  const verifyTxPin: Ctx['verifyTxPin'] = (pin) => {
    if (!user) return 'Not signed in'
    const lk = lockError(user.id); if (lk) return lk
    if (user.pinHash !== hashSecret(pin)) return recordFail(user.id, 'Incorrect transaction PIN.')
    recordSuccess(user.id)
    return null
  }
  const sendMoney: Ctx['sendMoney'] = async (p) => {
    if (!user) return 'Not signed in'
    const lk = lockError(user.id); if (lk) return lk
    if (user.pinHash !== hashSecret(p.pin)) return recordFail(user.id, 'Incorrect transaction PIN.')
    recordSuccess(user.id)
    if (badAmount(p.amount)) return 'Enter a valid amount.'
    if (p.toUserId === user.id) return 'You cannot send money to yourself.'
    if (user.status === 'frozen') return 'Your wallet is frozen.'
    const limS = limitError(user, p.amount); if (limS) return limS
    const toUid = serverUidOf(p.toUserId)
    if (!toUid) return 'Recipient is not available on the server yet.'
    try {
      const r = await apiPost('/v1/send', { toUserId: toUid, amount: p.amount, note: p.note, pin: p.pin })
      applyMoneyResult(r)
      return r.tx as Tx
    } catch (e: any) { return e.message }
  }
  const buyCrypto: Ctx['buyCrypto'] = async (symbol, amount, priceUsd) => {
    if (!user) return 'Not signed in'
    if (badAmount(amount) || badQty(priceUsd)) return 'Enter a valid amount.'
    try {
      const r = await apiPost('/v1/trade/buy', { symbol, amount, priceUsd })
      applyMoneyResult(r)
      return null
    } catch (e: any) { return e.message }
  }
  const sellCrypto: Ctx['sellCrypto'] = async (symbol, coinAmount, priceUsd) => {
    if (!user) return 'Not signed in'
    if (badQty(coinAmount) || badQty(priceUsd)) return 'Enter a valid amount.'
    try {
      const r = await apiPost('/v1/trade/sell', { symbol, coinAmount, priceUsd })
      applyMoneyResult(r)
      return null
    } catch (e: any) { return e.message }
  }
  const applyLoan: Ctx['applyLoan'] = async (amount, months, info) => {
    if (!user) return
    if (badAmount(amount)) return
    try {
      const r = await apiPost('/v1/loan/apply', { amount, months, info })
      applyMoneyResult(r)
      mutate(d => {
        notify(d, user.id, 'Loan application submitted', 'Your loan application is under admin review. No loan is approved automatically.', 'loan')
        notifyAdmins(d, '📄 New loan application', user.name + ' applied for a loan of ৳' + amount.toLocaleString() + ' over ' + months + ' months — review it in Loans.', 'loan', '/admin?tab=loans')
      })
    } catch (e: any) { toast({ kind: 'error', title: e.message }) }
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
  const claimEarn = async (kind: string, amount: number, title: string): Promise<string | null> => {
    try { const r = await apiPost('/v1/earn/claim', { kind, amount, title }); applyMoneyResult(r); return null }
    catch (e: any) { return e.message }
  }
  const earnInfo: Ctx['earnInfo'] = () => {
    if (!user) return freshEarn('')
    const st = db.earnStates.find(x => x.userId === user.id)
    return st ? normEarn({ ...st, tasksDone: [...st.tasksDone] }) : freshEarn(user.id)
  }
  const claimCheckin: Ctx['claimCheckin'] = async () => {
    if (!user) return { err: 'Not signed in' }
    let out: { err?: string; amount?: number; streak?: number } = {}
    const box: { credit: { amount: number; title: string } | null } = { credit: null }
    mutate(d => {
      const st = earnStateIn(d, user.id)
      const today = todayStr()
      if (st.lastCheckin === today) { out = { err: 'Already claimed today — come back tomorrow.' }; return }
      const y = new Date(); y.setDate(y.getDate() - 1)
      const yStr = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0')
      st.streak = st.lastCheckin === yStr ? st.streak + 1 : 1
      st.lastCheckin = today
      const amount = CHECKIN_REWARDS[(st.streak - 1) % CHECKIN_REWARDS.length]
      box.credit = { amount, title: 'Daily check-in reward (day ' + st.streak + ')' }
      out = { amount, streak: st.streak }
    })
    { const c = box.credit; if (c) { const err = await claimEarn('checkin', c.amount, c.title); if (err) return { err } } }
    return out
  }
  const watchAdReward: Ctx['watchAdReward'] = async () => {
    if (!user) return { err: 'Not signed in' }
    let out: { err?: string; amount?: number; left?: number } = {}
    const box: { credit: { amount: number; title: string } | null } = { credit: null }
    mutate(d => {
      const st = earnStateIn(d, user.id)
      if (st.ads >= ADS_PER_DAY) { out = { err: 'No ads left today — come back tomorrow.' }; return }
      st.ads++
      const amount = 2 + Math.floor(Math.random() * 7)
      box.credit = { amount, title: 'Watched ad reward' }
      out = { amount, left: ADS_PER_DAY - st.ads }
    })
    { const c = box.credit; if (c) { const err = await claimEarn('ad', c.amount, c.title); if (err) return { err } } }
    return out
  }
  const spinReward: Ctx['spinReward'] = async () => {
    if (!user) return { err: 'Not signed in' }
    let out: { err?: string; prize?: number; index?: number; left?: number } = {}
    const box: { credit: { amount: number; title: string } | null } = { credit: null }
    mutate(d => {
      const st = earnStateIn(d, user.id)
      if (st.spins >= SPINS_PER_DAY) { out = { err: 'No free spins left today — come back tomorrow.' }; return }
      st.spins++
      const index = Math.floor(Math.random() * WHEEL_PRIZES.length)
      const prize = WHEEL_PRIZES[index]
      if (prize > 0) box.credit = { amount: prize, title: 'Spin Wheel reward' }
      out = { prize, index, left: SPINS_PER_DAY - st.spins }
    })
    { const c = box.credit; if (c) { const err = await claimEarn('spin', c.amount, c.title); if (err) return { err } } }
    return out
  }
  const scratchDraw: Ctx['scratchDraw'] = async () => {
    if (!user) return { err: 'Not signed in' }
    let out: { err?: string; prize?: number; left?: number } = {}
    const box: { credit: { amount: number; title: string } | null } = { credit: null }
    mutate(d => {
      const st = earnStateIn(d, user.id)
      if (st.scratches >= SCRATCH_PER_DAY) { out = { err: 'No scratch cards left today — come back tomorrow.' }; return }
      st.scratches++
      const prize = SCRATCH_PRIZES[Math.floor(Math.random() * SCRATCH_PRIZES.length)]
      if (prize > 0) box.credit = { amount: prize, title: 'Scratch card reward' }
      out = { prize, left: SCRATCH_PER_DAY - st.scratches }
    })
    { const c = box.credit; if (c) { const err = await claimEarn('scratch', c.amount, c.title); if (err) return { err } } }
    return out
  }
  const completeEarnTask: Ctx['completeEarnTask'] = async (taskId) => {
    if (!user) return { err: 'Not signed in' }
    const task = EARN_TASKS.find(x => x.id === taskId)
    if (!task) return { err: 'Unknown task' }
    let out: { err?: string; amount?: number } = {}
    const box: { credit: { amount: number; title: string } | null } = { credit: null }
    mutate(d => {
      const st = earnStateIn(d, user.id)
      if (st.tasksDone.includes(taskId)) { out = { err: 'Task already completed' }; return }
      st.tasksDone.push(taskId)
      box.credit = { amount: task.reward, title: 'Task reward: ' + task.title }
      out = { amount: task.reward }
    })
    { const c = box.credit; if (c) { const err = await claimEarn('task', c.amount, c.title); if (err) return { err } } }
    return out
  }
  const submitQuiz: Ctx['submitQuiz'] = async (correct) => {
    if (!user) return { err: 'Not signed in' }
    let out: { err?: string; amount?: number } = {}
    const box: { credit: { amount: number; title: string } | null } = { credit: null }
    mutate(d => {
      const st = earnStateIn(d, user.id)
      if (st.quizDay === todayStr()) { out = { err: 'You already played the quiz today.' }; return }
      st.quizDay = todayStr()
      const amount = Math.max(0, Math.min(5, correct)) * QUIZ_PER_CORRECT
      if (amount > 0) box.credit = { amount, title: 'Daily quiz reward (' + correct + '/5 correct)' }
      out = { amount }
    })
    { const c = box.credit; if (c) { const err = await claimEarn('quiz', c.amount, c.title); if (err) return { err } } }
    return out
  }
  const setLoanFee: Ctx['setLoanFee'] = async (loanId, amount) => {
    try { const r = await apiPost('/v1/loan/fee', { loanId, action: 'set', amount }); applyMoneyResult(r) }
    catch (e: any) { toast({ kind: 'error', title: e.message }) }
  }
  const submitLoanFee: Ctx['submitLoanFee'] = async (loanId, method, ref) => {
    if (!user) return
    try { const r = await apiPost('/v1/loan/fee', { loanId, action: 'submit', method, ref }); applyMoneyResult(r) }
    catch (e: any) { toast({ kind: 'error', title: e.message }) }
  }
  const confirmLoanFee: Ctx['confirmLoanFee'] = async (loanId) => {
    try { const r = await apiPost('/v1/loan/fee', { loanId, action: 'confirm' }); applyMoneyResult(r) }
    catch (e: any) { toast({ kind: 'error', title: e.message }) }
  }
  const decideLoan: Ctx['decideLoan'] = async (id, ok) => {
    try { const r = await apiPost('/v1/admin/decide-loan', { id, ok }); applyMoneyResult(r) }
    catch (e: any) { toast({ kind: 'error', title: e.message }) }
  }
  const repayLoan: Ctx['repayLoan'] = async (loan, amount) => {
    if (!user) return 'Not signed in'
    if (badAmount(amount)) return 'Enter a valid amount.'
    try {
      const r = await apiPost('/v1/loan/repay', { loanId: loan.id, amount })
      applyMoneyResult(r)
      return null
    } catch (e: any) { return e.message }
  }
  const submitKyc: Ctx['submitKyc'] = async (p) => {
    if (!user) return 'Not signed in'
    try {
      const r = await apiPost('/v1/kyc/submit', p)
      // Mirror the submission onto the local record too, so the user sees
      // their own documents in Profile right away; the status itself is
      // synced back from the server state by applyMoneyResult.
      mutate(d => {
        const u = d.users.find(x => x.id === user.id)!
        u.kyc = 'pending'; u.kycDocType = p.docType; u.kycDocNumber = p.docNumber
        if (p.docPhoto) u.kycDocPhoto = p.docPhoto
        if (p.facePhoto) u.kycFacePhoto = p.facePhoto
        u.kycSubmittedAt = nowISO()
        notify(d, user.id, 'KYC submitted', 'Your documents and face scan were submitted for admin approval.', 'security')
        notifyAdmins(d, '🪪 New KYC submission', user.name + ' submitted KYC documents (' + p.docType + ') — review them in Users.', 'kyc', '/admin?tab=users&user=' + user.id)
      })
      applyMoneyResult(r)
      return null
    } catch (e: any) { return e.message }
  }
  const decideKyc: Ctx['decideKyc'] = async (userId2, ok) => {
    const target = serverUidOf(userId2)
    if (!target) return 'That user is not on the server yet'
    try {
      const r = await apiPost('/v1/admin/kyc/decide', { userId: target, ok })
      applyMoneyResult(r)
      mutate(d => {
        const u = d.users.find(x => x.id === userId2); if (!u) return
        u.kyc = ok ? 'verified' : 'unverified'
        audit(d, 'admin', ok ? 'kyc.verify' : 'kyc.reject', userId2)
        notify(d, userId2, ok ? 'KYC verified' : 'KYC rejected', ok ? 'Your identity is verified. All limits unlocked.' : 'Your KYC documents were not accepted. Please resubmit.', 'security')
      })
      return null
    } catch (e: any) { return e.message }
  }
  const setUserStatus: Ctx['setUserStatus'] = (userId2, status) => mutate(d => {
    const u = d.users.find(x => x.id === userId2); if (u) { u.status = status; audit(d, 'admin', 'user.' + status, userId2) }
  })
  const adjustBalance: Ctx['adjustBalance'] = async (userId2, amount, title, note) => {
    const tUid = serverUidOf(userId2)
    if (!tUid) { toast({ kind: 'error', title: 'That user is not on the server yet.' }); return }
    try {
      // The admin-given title IS the statement title — it shows verbatim in
      // the customer's Transactions (the server records it on the tx).
      const r = await apiPost('/v1/admin/adjust', { userId: tUid, amount, title: title || 'Admin adjustment', note })
      applyMoneyResult(r)
    } catch (e: any) { toast({ kind: 'error', title: e.message }) }
  }
  const adminBuyCrypto: Ctx['adminBuyCrypto'] = async (userId2, symbol, usdtAmount, priceUsd) => {
    if (badAmount(usdtAmount) || badQty(priceUsd)) return 'Enter a valid amount.'
    const tUid = serverUidOf(userId2)
    if (!tUid) return 'That user is not on the server yet.'
    // Server buy semantics: for USDT the amount is BDT (the on-ramp), for
    // other coins it is USDT-denominated — translate the admin's USDT input.
    const amount = symbol === 'USDT' ? Math.round(usdtAmount * dbRef.current.settings.bdtPerUsd) : usdtAmount
    try {
      const r = await apiPost('/v1/admin/trade', { forUserId: tUid, side: 'buy', symbol, amount, priceUsd })
      applyMoneyResult(r)
      return null
    } catch (e: any) { return e.message }
  }
  const adminSellCrypto: Ctx['adminSellCrypto'] = async (userId2, symbol, coinAmount, priceUsd) => {
    if (badQty(coinAmount) || badQty(priceUsd)) return 'Enter a valid amount.'
    const tUid = serverUidOf(userId2)
    if (!tUid) return 'That user is not on the server yet.'
    try {
      const r = await apiPost('/v1/admin/trade', { forUserId: tUid, side: 'sell', symbol, coinAmount, priceUsd })
      applyMoneyResult(r)
      return null
    } catch (e: any) { return e.message }
  }
  const adminReleaseStake: Ctx['adminReleaseStake'] = async (userId2, stakeId) => {
    const tUid = serverUidOf(userId2)
    if (!tUid) { toast({ kind: 'error', title: 'That user is not on the server yet.' }); return }
    try { const r = await apiPost('/v1/admin/release-stake', { userId: tUid, stakeId }); applyMoneyResult(r) }
    catch (e: any) { toast({ kind: 'error', title: e.message }) }
  }
  const adminClearLocked: Ctx['adminClearLocked'] = async (userId2) => {
    const tUid = serverUidOf(userId2)
    if (!tUid) { toast({ kind: 'error', title: 'That user is not on the server yet.' }); return }
    try { const r = await apiPost('/v1/admin/clear-locked', { userId: tUid }); applyMoneyResult(r) }
    catch (e: any) { toast({ kind: 'error', title: e.message }) }
  }
  const updateProfile: Ctx['updateProfile'] = (p) => { if (user) mutate(d => { Object.assign(d.users.find(u => u.id === user.id)!, p) }) }
  const changePassword: Ctx['changePassword'] = (oldPw, newPw) => {
    if (!user) return 'Not signed in'
    const lk = lockError(user.id); if (lk) return lk
    if (user.passwordHash !== hashSecret(oldPw)) return recordFail(user.id, 'Current password is incorrect.')
    recordSuccess(user.id)
    mutate(d => { d.users.find(u => u.id === user.id)!.passwordHash = hashSecret(newPw) })
    // Keep the Firebase password in sync too (best-effort: Firebase may ask
    // for a fresh sign-in on long-lived sessions; the next sign-in re-syncs
    // the local copy from Firebase, so a miss here cannot lock anyone out).
    if (firebaseAuth.currentUser) void fbUpdatePassword(firebaseAuth.currentUser, newPw).catch(() => {})
    return null
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
  // Phase 3: news, banners and settings are server-authoritative — the
  // admin's edits go to the Worker and come back inside the overview, so
  // every device and every user sees the same content within seconds.
  const publishNews: Ctx['publishNews'] = (n) => {
    void (async () => {
      try { const r = await apiPost('/v1/admin/news', { item: n }); applyMoneyResult(r) }
      catch (e: any) { toast({ kind: 'error', title: e.message }) }
    })()
  }
  const deleteNews = (id: string) => {
    void (async () => {
      try { const r = await apiPost('/v1/admin/news/delete', { id }); applyMoneyResult(r) }
      catch (e: any) { toast({ kind: 'error', title: e.message }) }
    })()
  }
  const updateSettings: Ctx['updateSettings'] = (s) => {
    const clean = { ...s }
    ;(['minLoan', 'maxLoan', 'loanLimit'] as const).forEach(k => { if (typeof clean[k] === 'number') clean[k] = Math.round(clean[k]) })
    void (async () => {
      try { const r = await apiPost('/v1/admin/settings', { settings: clean }); applyMoneyResult(r) }
      catch (e: any) { toast({ kind: 'error', title: e.message }) }
    })()
  }
  const toggleBanner = (id: string) => {
    void (async () => {
      try { const r = await apiPost('/v1/admin/banners/toggle', { id }); applyMoneyResult(r) }
      catch (e: any) { toast({ kind: 'error', title: e.message }) }
    })()
  }
  const addTicket: Ctx['addTicket'] = async (subject, message) => {
    if (!user) return 'Not signed in'
    try { const r = await apiPost('/v1/tickets', { subject, message }); applyMoneyResult(r); return null }
    catch (e: any) { return e.message }
  }
  const replyTicket: Ctx['replyTicket'] = (ticketId, text, as) => {
    if (!user || !text.trim()) return
    // Optimistic append: the bubble shows instantly in the open chat; the
    // server response then replaces the thread wholesale with the real row.
    const tempId = uid('MSG')
    mutate(d => {
      const tk = d.tickets.find(x => x.id === ticketId); if (!tk || tk.status === 'resolved') return
      tk.messages.push({ id: tempId, from: as, text: text.trim(), at: nowISO() })
      tk.updatedAt = nowISO()
      if (as === 'admin' && tk.status === 'pending') tk.status = 'processing'
    })
    void (async () => {
      try { const r = await apiPost('/v1/tickets/reply', { ticketId, text: text.trim(), asAdmin: as === 'admin' }); applyMoneyResult(r) }
      catch (e: any) {
        mutate(d => {
          const tk = d.tickets.find(x => x.id === ticketId); if (!tk) return
          tk.messages = tk.messages.filter(m => m.id !== tempId)
        })
        toast({ kind: 'error', title: 'Message not sent', body: e.message })
      }
    })()
  }
  const resolveTicket: Ctx['resolveTicket'] = (ticketId) => {
    void (async () => {
      try { const r = await apiPost('/v1/tickets/resolve', { ticketId }); applyMoneyResult(r) }
      catch {
        mutate(d => {
          const tk = d.tickets.find(x => x.id === ticketId); if (!tk || tk.status === 'resolved') return
          tk.status = 'resolved'; tk.updatedAt = nowISO()
        })
      }
    })()
  }
  const requestUpgrade: Ctx['requestUpgrade'] = async (toLevel) => {
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
    try { const r = await apiPost('/v1/levels/request', { toLevel }); applyMoneyResult(r); return null }
    catch (e: any) { return e.message }
  }
  const decideUpgrade: Ctx['decideUpgrade'] = (id, ok) => {
    void (async () => {
      try { const r = await apiPost('/v1/admin/levels/decide', { id, ok }); applyMoneyResult(r) }
      catch (e: any) { toast({ kind: 'error', title: e.message }) }
    })()
  }
  const broadcast: Ctx['broadcast'] = async (title, body) => {
    try { await apiPost('/v1/admin/broadcast', { title, body }); return null }
    catch (e: any) { return e.message }
  }
  const setAdminScope: Ctx['setAdminScope'] = (userId2, scope) => {
    const suid = serverUidOf(userId2); if (!suid) return
    void (async () => {
      try { const r = await apiPost('/v1/admin/set-scope', { userId: suid, scope }); applyMoneyResult(r) }
      catch (e: any) { toast({ kind: 'error', title: e.message }) }
    })()
  }
  const setAdminRole: Ctx['setAdminRole'] = (userId2, role) => {
    const suid = serverUidOf(userId2); if (!suid) return
    void (async () => {
      try { const r = await apiPost('/v1/admin/set-role', { userId: suid, role }); applyMoneyResult(r) }
      catch (e: any) { toast({ kind: 'error', title: e.message }) }
    })()
  }
  const updateLevelDef: Ctx['updateLevelDef'] = (level, patch) => {
    const clean = { ...patch }
    ;(['dailyLimit', 'monthlyLimit', 'loanLimit', 'depositRequired', 'feeDiscountPct'] as const).forEach(k => { if (typeof clean[k] === 'number') clean[k] = Math.round(clean[k] as number) })
    // Optimistic local mirror, then persist on the server so the edit
    // survives refresh and reaches every device.
    mutate(d => {
      const def = d.levels.find(x => x.level === level); if (!def) return
      Object.assign(def, clean); audit(d, 'admin', 'level.update', 'Level ' + level)
    })
    void (async () => {
      try { const r = await apiPost('/v1/admin/levels/def', { level, patch: clean }); applyMoneyResult(r) }
      catch (e: any) { toast({ kind: 'error', title: 'Level save failed', body: e.message }) }
    })()
  }
  const setUserLevel: Ctx['setUserLevel'] = (userId2, level) => {
    mutate(d => {
      const u = d.users.find(x => x.id === userId2); if (u) { u.level = level; audit(d, 'admin', 'level.set', `${userId2} → Level ${level}`); notify(d, userId2, 'Account level changed', 'An admin set your account to Level ' + level + '.', 'security') }
    })
    const suid = serverUidOf(userId2); if (!suid) return
    void (async () => {
      try { const r = await apiPost('/v1/admin/set-level', { userId: suid, level }); applyMoneyResult(r) }
      catch (e: any) { toast({ kind: 'error', title: 'Level change failed', body: e.message }) }
    })()
  }
  const setUserLoanLimit: Ctx['setUserLoanLimit'] = (userId2, bdt) => mutate(d => {
    const u = d.users.find(x => x.id === userId2); if (!u) return
    if (bdt === null) delete u.loanLimitOverride; else u.loanLimitOverride = bdt
    audit(d, 'admin', 'loanlimit.set', bdt === null ? userId2 + ' → level default' : userId2 + ' → ' + bdt + ' BDT')
    notify(d, userId2, 'Loan limit updated', bdt === null ? 'Your loan limit now follows your account level.' : 'An admin set a personal loan limit on your account. Check the Loan section for your new limit.', 'info')
  })
  const resetDemo = () => { const fresh = seedDB(); localStorage.setItem(KEY, JSON.stringify(fresh)); setDb(fresh) }

  const value: Ctx = {
    db, user, theme, toggleTheme, toasts, toast, dismissToast, login, register, walletOf,
    addDeposit, decideDeposit, settleDepositExternal, requestWithdraw, decideWithdraw, directWithdraw, stake, unstake, swap, sendMoney, verifyTxPin, buyCrypto, sellCrypto,
    applyLoan, earnInfo, claimCheckin, watchAdReward, spinReward, scratchDraw, completeEarnTask, submitQuiz, decideLoan, repayLoan, setLoanFee, submitLoanFee, confirmLoanFee, submitKyc, decideKyc, setUserStatus, adjustBalance, adminBuyCrypto, adminSellCrypto, adminReleaseStake, adminClearLocked,
    updateProfile, changePassword, changePin, toggleWatch, markAllRead, markRead,
    publishNews, deleteNews, updateSettings, toggleBanner, addTicket, replyTicket, resolveTicket, broadcast, setAdminScope, setAdminRole, adminErrors, resetDemo,
    requestUpgrade, decideUpgrade, updateLevelDef, setUserLevel, setUserLoanLimit,
    locked, appInstalled, devicePinSet, fingerprintSet, setDevicePin, clearDevicePin, setupFingerprint, clearFingerprint, unlockWithPin, unlockWithFingerprint, unlockWithPassword, lockNow, signOut, resetPassword, requestPasswordOtp, verifyPasswordOtp, resetPasswordWithOtp, addUserPayMethod, removeUserPayMethod, lang, setLanguage, t, currency, currencyIsAuto, detectedCurrency: detected.code, setCurrency, fmtMoney, fmtAmount, toBDT, fromBDT,
  }
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
