import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { DB, Loan, NewsItem, Tx, User } from './types'
import { DEFAULT_LEVELS, seedDB } from './seed'
import { translate } from './i18n'
import { detectCurrency, FALLBACK_RATES } from './currencies'
import { fmtBDT } from './utils'
import { emiCalc, hashSecret, nowISO, rid, uid } from './utils'

const KEY = 'novawallet.db.v2'
const SESSION = 'novawallet.session'

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const db = JSON.parse(raw) as DB
      // migrate older saves: add account levels without wiping balances/history
      if (!db.levels) db.levels = DEFAULT_LEVELS
      if (!db.levelRequests) db.levelRequests = []
      if (!db.stakes) db.stakes = []
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
  currency: string; currencyIsAuto: boolean; detectedCurrency: string; setCurrency: (code: string | null) => void; fmtMoney: (bdt: number) => string
  toasts: Toast[]; toast: (t: Omit<Toast, 'id'>) => void; dismissToast: (id: string) => void
  login: (idOrEmail: string, password: string) => string | null
  register: (p: { name: string; username: string; email: string; phone: string; password: string; pin: string; referralCode?: string }) => string | null
  logout: () => void
  walletOf: (userId: string) => DB['wallets'][number]
  addDeposit: (p: { method: string; amount: number; trxId: string; receipt?: string }) => void
  decideDeposit: (id: string, ok: boolean) => void
  requestWithdraw: (p: { method: string; amount: number; destination: string; pin: string }) => string | null
  directWithdraw: (p: { method: string; amount: number; destination: string; pin: string }) => string | null
  stake: (amount: number, apy: number, termDays: number) => string | null
  unstake: (stakeId: string) => string | null
  swap: (fromSym: string, toSym: string, amountFrom: number, prices: Record<string, number>) => string | null
  decideWithdraw: (id: string, ok: boolean) => void
  sendMoney: (p: { toUserId: string; amount: number; note?: string; pin: string }) => string | Tx
  buyCrypto: (symbol: string, bdtAmount: number, priceUsd: number) => string | null
  sellCrypto: (symbol: string, coinAmount: number, priceUsd: number) => string | null
  applyLoan: (amount: number, months: number) => void
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
  addTicket: (subject: string, message: string) => void
  replyTicket: (ticketId: string, text: string) => void
  resolveTicket: (ticketId: string) => void
  resetDemo: () => void
}
const AppCtx = createContext<Ctx | null>(null)
export const useApp = () => { const c = useContext(AppCtx); if (!c) throw new Error('useApp outside provider'); return c }

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DB>(load)
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem(SESSION))
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

  const login: Ctx['login'] = (idOrEmail, password) => {
    const u = dbRef.current.users.find(x => x.email === idOrEmail || x.username === idOrEmail)
    if (!u) return 'No account found for that email / username.'
    if (u.passwordHash !== hashSecret(password)) return 'Wrong password. Please try again.'
    if (u.status === 'suspended') return 'This account is suspended. Contact support.'
    mutate(d => { const du = d.users.find(x => x.id === u.id)!; du.lastLogin = nowISO() })
    localStorage.setItem(SESSION, u.id); setUserId(u.id)
    return null
  }
  const register: Ctx['register'] = (p) => {
    const cur = dbRef.current
    if (cur.users.some(x => x.email === p.email)) return 'An account with this email already exists.'
    if (cur.users.some(x => x.username === p.username)) return 'That username is taken.'
    if (p.referralCode && !cur.users.some(x => x.referralCode === p.referralCode)) return 'Referral code not found.'
    if (p.referralCode && cur.users.find(x => x.referralCode === p.referralCode)?.email === p.email) return 'You cannot refer yourself.'
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
    localStorage.setItem(SESSION, nu.id); setUserId(nu.id)
    return null
  }
  const logout = () => { localStorage.removeItem(SESSION); setUserId(null) }

  const addDeposit: Ctx['addDeposit'] = (p) => {
    if (!user) return
    mutate(d => {
      const dep = { id: uid('DEP'), userId: user.id, ...p, status: 'pending' as const, createdAt: nowISO() }
      d.deposits.unshift(dep)
      recordTx(d, { userId: user.id, category: 'add_money', title: 'Add Money via ' + p.method, amount: p.amount, fee: 0, currency: 'BDT', status: 'pending', method: p.method })
      notify(d, user.id, 'Deposit request submitted', 'Your ' + p.method + ' deposit of ৳' + p.amount.toLocaleString() + ' is pending admin review.', 'deposit')
    })
  }
  const decideDeposit: Ctx['decideDeposit'] = (id, ok) => {
    mutate(d => {
      const dep = d.deposits.find(x => x.id === id); if (!dep || dep.status !== 'pending') return
      dep.status = ok ? 'approved' : 'rejected'
      const w = d.wallets.find(x => x.userId === dep.userId)!
      const tx = d.txs.find(t => t.category === 'add_money' && t.userId === dep.userId && t.status === 'pending' && t.amount === dep.amount)
      if (tx) tx.status = ok ? 'completed' : 'rejected'
      if (ok) {
        w.available += dep.amount
        audit(d, 'admin', 'deposit.approve', `Approved ${dep.id} ৳${dep.amount} for ${dep.userId}`)
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
      } else audit(d, 'admin', 'deposit.reject', `Rejected ${dep.id}`)
      notify(d, dep.userId, ok ? 'Deposit approved' : 'Deposit rejected', ok ? '৳' + dep.amount.toLocaleString() + ' has been credited to your wallet.' : 'Your deposit request was rejected. Check the transaction ID and try again.', 'deposit')
    })
  }
  const requestWithdraw: Ctx['requestWithdraw'] = (p) => {
    if (!user) return 'Not signed in'
    if (user.pinHash !== hashSecret(p.pin)) return 'Incorrect transaction PIN.'
    const w = walletOf(user.id)
    if (user.status === 'frozen') return 'Your wallet is frozen. Contact support.'
    if (p.amount > w.available) return 'Insufficient available balance.'
    const fee = Math.round(p.amount * dbRef.current.settings.cashoutFeePct / 100)
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
    if (user.pinHash !== hashSecret(p.pin)) return 'Incorrect transaction PIN.'
    const w = walletOf(user.id)
    if (user.status === 'frozen') return 'Your wallet is frozen. Contact support.'
    if (p.amount > w.available) return 'Insufficient available balance.'
    const fee = Math.round(p.amount * dbRef.current.settings.cashoutFeePct / 100)
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
    const w = walletOf(user.id)
    if (amount > w.available) return 'Insufficient available balance.'
    mutate(d => {
      const dw = d.wallets.find(x => x.userId === user.id)!
      dw.available -= amount; dw.locked += amount
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
    const w = walletOf(user.id)
    const rate = dbRef.current.settings.bdtPerUsd
    const priceOf = (sym: string) => sym === 'BDT' ? 1 / rate : (prices[sym] ?? 0)
    if (!priceOf(fromSym) || !priceOf(toSym)) return 'Live price unavailable for this pair.'
    if (fromSym === 'BDT' ? amountFrom > w.available : amountFrom > (w.holdings[fromSym] ?? 0)) return 'Insufficient ' + fromSym + ' balance.'
    const usdGross = amountFrom * priceOf(fromSym)
    const feeUsd = usdGross * 0.005
    const toAmt = (usdGross - feeUsd) / priceOf(toSym)
    mutate(d => {
      const dw = d.wallets.find(x => x.userId === user.id)!
      if (fromSym === 'BDT') dw.available -= amountFrom; else dw.holdings[fromSym] = (dw.holdings[fromSym] ?? 0) - amountFrom
      if (toSym === 'BDT') dw.available += toAmt; else dw.holdings[toSym] = (dw.holdings[toSym] ?? 0) + toAmt
      recordTx(d, { userId: user.id, category: 'swap', title: 'Swap ' + fromSym + ' → ' + toSym, amount: Math.round(usdGross * rate), fee: Math.round(feeUsd * rate), currency: 'BDT', status: 'completed', note: amountFrom + ' ' + fromSym + ' → ' + (toSym === 'BDT' ? Math.round(toAmt) : toAmt.toFixed(6)) + ' ' + toSym })
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
    if (user.pinHash !== hashSecret(p.pin)) return 'Incorrect transaction PIN.'
    if (p.toUserId === user.id) return 'You cannot send money to yourself.'
    const w = walletOf(user.id)
    const fee = Math.round(p.amount * dbRef.current.settings.sendFeePct / 100 * 100) / 100
    if (p.amount + fee > w.available) return 'Insufficient balance (amount + fee exceeds available balance).'
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
  const buyCrypto: Ctx['buyCrypto'] = (symbol, bdtAmount, priceUsd) => {
    if (!user) return 'Not signed in'
    const w = walletOf(user.id)
    if (bdtAmount > w.available) return 'Insufficient BDT balance.'
    const coins = bdtAmount / dbRef.current.settings.bdtPerUsd / priceUsd
    mutate(d => {
      const dw = d.wallets.find(x => x.userId === user.id)!
      dw.available -= bdtAmount; dw.holdings[symbol] = (dw.holdings[symbol] ?? 0) + coins
      recordTx(d, { userId: user.id, category: 'crypto_buy', title: 'Bought ' + symbol, amount: bdtAmount, fee: 0, currency: symbol, status: 'completed', note: coins.toFixed(6) + ' ' + symbol + ' @ $' + priceUsd })
    })
    return null
  }
  const sellCrypto: Ctx['sellCrypto'] = (symbol, coinAmount, priceUsd) => {
    if (!user) return 'Not signed in'
    const w = walletOf(user.id)
    if (coinAmount > (w.holdings[symbol] ?? 0)) return 'Insufficient ' + symbol + ' balance.'
    const bdt = coinAmount * priceUsd * dbRef.current.settings.bdtPerUsd
    mutate(d => {
      const dw = d.wallets.find(x => x.userId === user.id)!
      dw.holdings[symbol] -= coinAmount; dw.available += bdt
      recordTx(d, { userId: user.id, category: 'crypto_sell', title: 'Sold ' + symbol, amount: Math.round(bdt), fee: 0, currency: symbol, status: 'completed', note: coinAmount + ' ' + symbol + ' @ $' + priceUsd })
    })
    return null
  }
  const applyLoan: Ctx['applyLoan'] = (amount, months) => {
    if (!user) return
    const { emi, total } = emiCalc(amount, dbRef.current.settings.loanRatePct, months)
    mutate(d => {
      d.loans.unshift({ id: uid('LOAN'), userId: user.id, amount, months, ratePct: d.settings.loanRatePct, emi: Math.round(emi), totalPayable: Math.round(total), paid: 0, status: 'pending', createdAt: nowISO() })
      notify(d, user.id, 'Loan application submitted', 'Your loan application is under admin review. No loan is approved automatically.', 'loan')
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
    recordTx(d, { userId: userId2, category: 'adjustment', title: 'Admin adjustment', amount: Math.abs(amount), fee: 0, currency: 'BDT', status: 'completed', note: reason })
    audit(d, 'admin', 'wallet.adjust', `${userId2} ${amount > 0 ? '+' : ''}৳${amount} — ${reason}`)
    notify(d, userId2, 'Wallet adjustment', 'An admin adjusted your balance by ৳' + amount.toLocaleString() + '. Reason: ' + reason, 'info')
  })
  const updateProfile: Ctx['updateProfile'] = (p) => { if (user) mutate(d => { Object.assign(d.users.find(u => u.id === user.id)!, p) }) }
  const changePassword: Ctx['changePassword'] = (oldPw, newPw) => {
    if (!user) return 'Not signed in'
    if (user.passwordHash !== hashSecret(oldPw)) return 'Current password is incorrect.'
    mutate(d => { d.users.find(u => u.id === user.id)!.passwordHash = hashSecret(newPw) }); return null
  }
  const changePin: Ctx['changePin'] = (oldPin, newPin) => {
    if (!user) return 'Not signed in'
    if (user.pinHash !== hashSecret(oldPin)) return 'Current PIN is incorrect.'
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
  const replyTicket: Ctx['replyTicket'] = (ticketId, text) => {
    if (!user || !text.trim()) return
    mutate(d => {
      const tk = d.tickets.find(x => x.id === ticketId); if (!tk || tk.status === 'resolved') return
      const from = user.id === tk.userId ? 'user' : 'admin'
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
  const resetDemo = () => { const fresh = seedDB(); localStorage.setItem(KEY, JSON.stringify(fresh)); setDb(fresh) }

  const value: Ctx = {
    db, user, theme, toggleTheme, toasts, toast, dismissToast, login, register, logout, walletOf,
    addDeposit, decideDeposit, requestWithdraw, decideWithdraw, directWithdraw, stake, unstake, swap, sendMoney, buyCrypto, sellCrypto,
    applyLoan, decideLoan, repayLoan, submitKyc, decideKyc, setUserStatus, adjustBalance,
    updateProfile, changePassword, changePin, toggleWatch, markAllRead, markRead,
    publishNews, deleteNews, updateSettings, toggleBanner, addTicket, replyTicket, resolveTicket, resetDemo,
    requestUpgrade, decideUpgrade, updateLevelDef, setUserLevel,
    lang, setLanguage, t, currency, currencyIsAuto, detectedCurrency: detected.code, setCurrency, fmtMoney,
  }
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
