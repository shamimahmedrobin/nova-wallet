import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowLeft, ArrowLeftRight, BarChart3, Bell, Check, CheckCheck, Copy, CreditCard, Download, LayoutDashboard, Megaphone, Menu, MessageCircle, Newspaper, Search, Send, Settings as SettingsIcon, ShieldCheck, Users, Wallet, X, HandCoins, Gift, ScrollText, Award } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApp } from '../lib/store'
import { apiGet } from '../lib/api'
import { Avatar, Badge, Btn, Card, Empty, Input, Modal, Select, TxDirIcon, statusTone } from '../components/ui'
import { fmtDateTime, fmtPrice, fmtUSDT, txAmountCls, txDirection, txSign } from '../lib/utils'
import { COIN_META, useMarket } from '../lib/market'
import { CRYPTO_NETWORK_LABELS } from '../lib/localPayments'
import type { PayMethod, Tx } from '../lib/types'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'finance', label: 'Deposits & Withdrawals', icon: Wallet },
  { id: 'txs', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'users', label: 'Users & KYC', icon: Users },
  { id: 'loans', label: 'Loans', icon: HandCoins },
  { id: 'referrals', label: 'Referrals', icon: Gift },
  { id: 'levels', label: 'Levels', icon: Award },
  { id: 'support', label: 'Support Chat', icon: MessageCircle },
  { id: 'content', label: 'News & Banners', icon: Newspaper },
  { id: 'audit', label: 'Audit Log', icon: ScrollText },
  { id: 'reports', label: 'Reports & Export', icon: BarChart3 },
  { id: 'health', label: 'System Health', icon: Activity },
  { id: 'payments', label: 'Payment Methods', icon: CreditCard },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
] as const

/** Which tabs each admin scope may see. 'full' (the owner) sees all.
 * The Worker enforces the same boundaries on the API itself. */
const SCOPE_TABS: Record<string, string[]> = {
  finance: ['overview', 'finance', 'txs', 'users', 'loans', 'referrals', 'levels', 'reports', 'audit'],
  content: ['overview', 'users', 'support', 'content', 'audit'],
  support: ['overview', 'users', 'support'],
}

export default function Admin() {
  const { user, db, decideDeposit, decideWithdraw, decideLoan, setLoanFee, confirmLoanFee, decideKyc, setUserStatus, adjustBalance, publishNews, deleteNews, updateSettings, toggleBanner, toast, resetDemo, decideUpgrade, updateLevelDef, setUserLevel, setUserLoanLimit, adminBuyCrypto, adminSellCrypto, adminReleaseStake, adminClearLocked , markRead, markAllRead, broadcast, setAdminScope, setAdminRole, adminErrors } = useApp()
  const usdt = (bdt: number) => fmtUSDT(bdt / db.settings.bdtPerUsd)
  const byDateDesc = <T extends { createdAt: string }>(arr: T[]): T[] => [...arr].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const { coins } = useMarket(30_000)
  const priceOfA = (sym: string) => sym === 'USDT' ? 1 : coins.find(c => c.symbol === sym)?.priceUsd ?? 0
  const [tab, setTab] = useState<string>('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  // RBAC: a scoped admin only sees their tabs (the server enforces too).
  const myScope = user?.adminScope ?? 'full'
  const visibleTabs = TABS.filter(t => myScope === 'full' || (SCOPE_TABS[myScope] ?? []).includes(t.id))
  useEffect(() => { if (!visibleTabs.some(t => t.id === tab)) setTab('overview') }, [tab, myScope])
  // Phase 3 UI state: feature switches, broadcast composer, global
  // search and the System Health API probe.
  const [feat, setFeat] = useState<any>(null)
  useEffect(() => { if (tab === 'settings' && feat === null) setFeat({ deposits: true, withdrawals: true, trading: true, loans: true, registration: true, ...(db.settings.features ?? {}) }) }, [tab, feat, db.settings.features])
  const [bcTitle, setBcTitle] = useState(''); const [bcBody, setBcBody] = useState(''); const [bcBusy, setBcBusy] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false); const [searchQ, setSearchQ] = useState('')
  const [apiHealth, setApiHealth] = useState<any>(null)
  useEffect(() => { if (tab !== 'health') return; setApiHealth(null); apiGet('/health').then(r => setApiHealth(r)).catch(() => setApiHealth({ ok: false })) }, [tab])
  const downloadCsv = (name: string, rows: Record<string, any>[]) => {
    if (!rows.length) return toast({ kind: 'error', title: 'Nothing to export yet' })
    const keys = Object.keys(rows[0])
    const csv = [keys.join(','), ...rows.map(r => keys.map(k => '"' + String(r[k] ?? '').replace(/"/g, '""') + '"').join(','))].join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click(); URL.revokeObjectURL(a.href)
  }
  const [notifOpen, setNotifOpen] = useState(false)
  const [userQ, setUserQ] = useState('')
  const [txQ, setTxQ] = useState(''); const [selTx, setSelTx] = useState<Tx | null>(null)
  const copyTxId = async (id: string) => { try { await navigator.clipboard.writeText(id); toast({ kind: 'success', title: 'Transaction ID copied', body: id }) } catch { toast({ kind: 'error', title: 'Copy failed', body: id }) } }
  const txq = txQ.trim().toLowerCase()
  const filteredTxs = !txq ? byDateDesc(db.txs) : byDateDesc(db.txs).filter(tx => tx.id.toLowerCase().includes(txq) || tx.title.toLowerCase().includes(txq) || (tx.counterparty ?? '').toLowerCase().includes(txq) || (db.users.find(u => u.id === tx.userId)?.name.toLowerCase().includes(txq) ?? false))
  const [selUserId, setSelUserId] = useState<string | null>(null)
  const [mAdjAmt, setMAdjAmt] = useState(''); const [mLoanLimit, setMLoanLimit] = useState('')
  const [mAdjDir, setMAdjDir] = useState<'add' | 'deduct'>('add'); const [mAdjTitle, setMAdjTitle] = useState('Charge'); const [mAdjNote, setMAdjNote] = useState('')
  const [mSym, setMSym] = useState('BTC'); const [mSide, setMSide] = useState<'buy' | 'sell'>('buy'); const [mTradeAmt, setMTradeAmt] = useState('')
  const [mClearArm, setMClearArm] = useState(false)
  const openUser = (u: any) => { setSelUserId(u.id); setMAdjAmt(''); setMAdjTitle('Charge'); setMAdjNote(''); setMAdjDir('add'); setMTradeAmt(''); setMSide('buy'); setMSym('BTC'); setMClearArm(false); setMLoanLimit(u.loanLimitOverride ? String(Math.round(u.loanLimitOverride / db.settings.bdtPerUsd * 100) / 100) : '') }
  const selUser = selUserId ? db.users.find(x => x.id === selUserId) ?? null : null
  const selWallet = selUser ? db.wallets.find(x => x.userId === selUser.id) : null
  // KYC photos live on the server (too heavy for the directory sync) —
  // fetch them on demand when reviewing a pending submission.
  const [kycDocs, setKycDocs] = useState<{ docPhoto?: string; facePhoto?: string } | null>(null)
  useEffect(() => {
    setKycDocs(null)
    if (!selUser || selUser.kyc !== 'pending' || selUser.kycDocPhoto) return
    const uid = (selUser as any).fbUid ?? selUser.id
    apiGet('/v1/admin/kyc/' + uid).then(r => { if (r?.kyc) setKycDocs({ docPhoto: r.kyc.docPhoto ?? undefined, facePhoto: r.kyc.facePhoto ?? undefined }) }).catch(() => { /* ignore */ })
  }, [selUser?.id, selUser?.kyc])
  // Deep links from notifications: /admin?tab=finance|loans|levels|users|support — and
  // ?user=<id> opens that customer's Manage modal straight away (KYC / new-user alerts).
  useEffect(() => {
    let q: URLSearchParams
    try { q = new URLSearchParams(window.location.search) } catch { return }
    const t = q.get('tab')
    if (t && TABS.some(x => x.id === t)) setTab(t)
    const uidParam = q.get('user')
    if (uidParam) { const du = db.users.find(x => x.id === uidParam); if (du) openUser(du) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const pendingLevels = db.levelRequests.filter(r => r.status === 'pending').length
  const [newsForm, setNewsForm] = useState<any>(null)
  const [setForm, setSetForm] = useState({ ...db.settings })
  const [pmList, setPmList] = useState<PayMethod[] | null>(null)
  useEffect(() => { if (tab === 'payments' && pmList === null) setPmList(db.settings.payMethods.map(m => ({ ...m }))) }, [tab, pmList, db.settings.payMethods])
  const [levelForms, setLevelForms] = useState<Record<number, any>>({})
  const [feeInputs, setFeeInputs] = useState<Record<string, string>>({})

  const stats = useMemo(() => {
    const plain = db.users.filter(u => u.role === 'user')
    return {
      users: plain.length, active: plain.filter(u => u.status === 'active').length,
      totalBalance: db.wallets.reduce((s, w) => s + w.available + w.locked, 0),
      deposits: db.deposits.filter(d => d.status === 'approved').reduce((s, d) => s + d.amount, 0),
      withdrawals: db.withdrawals.filter(d => d.status === 'completed').reduce((s, d) => s + d.amount, 0),
      transfers: db.txs.filter(t => t.category === 'send' && t.status === 'completed').reduce((s, t) => s + t.amount, 0),
      fees: db.txs.reduce((s, t) => s + (t.status === 'completed' ? t.fee : 0), 0),
      refPaid: db.referralEarnings.reduce((sum, r) => sum + Math.round(r.amount / db.settings.bdtPerUsd * 100) / 100 * db.settings.bdtPerUsd, 0),
      pendingDeposits: db.deposits.filter(d => d.status === 'pending'),
      pendingWithdrawals: db.withdrawals.filter(d => d.status === 'pending'),
      pendingLoans: db.loans.filter(d => d.status === 'pending'),
      pendingKyc: db.users.filter(u => u.kyc === 'pending'),
    }
  }, [db])
  const tabBadges: Record<string, number> = {
    finance: stats.pendingDeposits.length + stats.pendingWithdrawals.length,
    users: stats.pendingKyc.length,
    loans: stats.pendingLoans.length,
    levels: pendingLevels,
    support: db.tickets.filter(t => t.status === 'pending').length,
  }
  const chartData = useMemo(() => {
    const days: Record<string, { ts: number; volume: number }> = {}
    db.txs.forEach(t => { if (t.status !== 'completed') return; const d = new Date(t.createdAt); const k = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); const dayTs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); days[k] = days[k] ?? { ts: dayTs, volume: 0 }; days[k].volume += t.amount })
    return Object.entries(days).sort((a, b) => a[1].ts - b[1].ts).slice(-7).map(([name, v]) => ({ name, volume: v.volume }))
  }, [db.txs])
  const myNotifs = byDateDesc(db.notifications.filter(n => n.userId === user?.id))
  const myUnread = myNotifs.filter(n => !n.read).length
  const openNotif = (n: typeof myNotifs[number]) => {
    markRead(n.id); setNotifOpen(false)
    const link = n.link ?? ''
    const tabM = link.match(/tab=([a-z]+)/); const userM = link.match(/user=([A-Za-z0-9-]+)/)
    const kindTab: Record<string, string> = { support: 'support', deposit: 'finance', withdraw: 'finance', loan: 'loans', kyc: 'users', upgrade: 'levels' }
    const target = tabM?.[1] ?? kindTab[n.kind] ?? 'overview'
    if (TABS.some(x => x.id === target)) setTab(target)
    if (userM) { const du = db.users.find(x => x.id === userM[1]); if (du) openUser(du) }
  }
  if (!user) return null
  const nameOf = (id: string) => db.users.find(u => u.id === id)?.name ?? id

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800 lg:hidden"><Menu size={18} /></button>
          <h1 className="font-extrabold text-lg flex items-center gap-2"><ShieldCheck className="text-amber-500" /> Admin Panel</h1>
          <Badge tone="amber">Secure · RBAC</Badge>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setSearchOpen(true)} aria-label="Search" className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800"><Search size={18} /></button>
            <button onClick={() => setNotifOpen(true)} aria-label="Notifications" className="relative p-2.5 rounded-full bg-slate-100 dark:bg-slate-800"><Bell size={18} />{myUnread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold inline-flex items-center justify-center">{myUnread}</span>}</button>
            <Link to="/" className="hidden sm:inline-flex lg:hidden items-center rounded-2xl px-4 py-2.5 text-sm font-semibold bg-violet-600 text-white">User app</Link>
          </div>
        </div>
      </header>

      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Search everything">
        {(() => {
          const sq = searchQ.trim().toLowerCase()
          const sUsers = sq ? db.users.filter(u => (u.name + ' ' + u.email + ' ' + u.username + ' ' + u.id).toLowerCase().includes(sq)).slice(0, 5) : []
          const sTxs = sq ? db.txs.filter(t => (t.id + ' ' + t.title + ' ' + (t.method ?? '') + ' ' + (t.counterparty ?? '')).toLowerCase().includes(sq)).slice(0, 5) : []
          return (
            <div className="space-y-4">
              <Input placeholder="Name, email, username, transaction ID…" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              {sq && sUsers.length === 0 && sTxs.length === 0 && <Empty title="No matches" body="Try a name, an email or a transaction ID like TXN-…" />}
              {sUsers.length > 0 && <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">Users</p>
                <div className="space-y-1.5">{sUsers.map(u => (
                  <button key={u.id} onClick={() => { setSearchOpen(false); setSearchQ(''); openUser(u) }} className="w-full flex items-center gap-3 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-3 text-left hover:border-violet-300 transition">
                    <Avatar name={u.name} photo={u.photo} />
                    <span className="flex-1 min-w-0"><span className="block font-bold text-sm truncate">{u.name}</span><span className="block text-xs text-slate-400 truncate">{u.email} · @{u.username}</span></span>
                    <Badge tone={u.role === 'admin' ? 'amber' : 'slate'}>{u.role === 'admin' ? 'Admin' : 'Level ' + u.level}</Badge>
                  </button>
                ))}</div>
              </div>}
              {sTxs.length > 0 && <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-slate-400 mb-2">Transactions</p>
                <div className="space-y-1.5">{sTxs.map(t => (
                  <button key={t.id} onClick={() => { setSearchOpen(false); setSearchQ(''); setSelTx(t) }} className="w-full flex items-center gap-3 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-3 text-left hover:border-violet-300 transition">
                    <TxDirIcon dir={txDirection(t.category, t.amount)} />
                    <span className="flex-1 min-w-0"><span className="block font-bold text-sm truncate">{t.title}</span><span className="block text-xs text-slate-400 truncate">{t.id} · {fmtDateTime(t.createdAt)}</span></span>
                    <span className={`font-extrabold text-sm ${txAmountCls(txDirection(t.category, t.amount))}`}>{txSign(txDirection(t.category, t.amount))}{usdt(Math.abs(t.amount))}</span>
                  </button>
                ))}</div>
              </div>}
            </div>
          )
        })()}
      </Modal>

      <Modal open={notifOpen} onClose={() => setNotifOpen(false)} title="Admin notifications">
        <div className="space-y-2">
          {myUnread > 0 && <button onClick={markAllRead} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-bold text-violet-600 dark:text-violet-400 active:scale-95 transition"><CheckCheck size={14} /> Mark all read ({myUnread})</button>}
          {myNotifs.length === 0 ? <Empty title="No notifications" body="Deposit, KYC, upgrade, loan and support alerts will appear here." /> : myNotifs.map(n => (
            <button key={n.id} onClick={() => openNotif(n)} className="w-full text-left">
              <div className={`rounded-2xl border border-slate-200/70 dark:border-slate-800 p-3.5 flex gap-3 items-start ${!n.read ? 'border-l-4 border-l-violet-500 bg-violet-50/50 dark:bg-violet-500/5' : 'opacity-75'}`}>
                <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-500/15 text-violet-600 shrink-0"><Bell size={15} /></div>
                <div className="flex-1 min-w-0"><p className="font-bold text-sm">{n.title} {!n.read && <span className="ml-1 inline-block w-2 h-2 rounded-full bg-rose-500" />}</p><p className="text-sm text-slate-500">{n.body}</p><p className="text-[11px] text-slate-400 mt-1 capitalize">{n.kind} · {fmtDateTime(n.createdAt)}</p></div>
              </div>
            </button>
          ))}
        </div>
      </Modal>

      {menuOpen && <div className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)} />}
      <div className="lg:flex lg:items-start lg:max-w-[1440px] lg:mx-auto">
        {/* Sidebar menu — a slide-in drawer on mobile (hamburger in the header), a fixed sidebar on desktop */}
        <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col overflow-y-auto border-r border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xl transition-transform duration-300 lg:sticky lg:top-16 lg:z-auto lg:h-[calc(100vh-4rem)] lg:bg-white/70 lg:dark:bg-slate-900/40 lg:backdrop-blur-xl lg:shadow-none ${menuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
          <div className="flex items-center justify-between px-3 pb-2">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Menu</p>
            <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 lg:hidden"><X size={15} /></button>
          </div>
          <nav className="space-y-1">
            {visibleTabs.map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setMenuOpen(false) }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-bold transition active:scale-[0.98] ${tab === t.id ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100'}`}>
                <t.icon size={18} className="shrink-0" /> <span className="flex-1 text-left">{t.label}</span>
                {(tabBadges[t.id] ?? 0) > 0 && <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-extrabold inline-flex items-center justify-center">{tabBadges[t.id]}</span>}
              </button>
            ))}
          </nav>
          <div className="mt-auto pt-4">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 p-3">
              <Avatar name={user.name} photo={user.photo} />
              <div className="flex-1 min-w-0"><p className="font-extrabold text-sm truncate">{user.name}</p><p className="text-xs text-slate-400 truncate">{user.email}</p></div>
              <Badge tone="amber">Admin</Badge>
            </div>
            <Link to="/" className="mt-2 flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900"><ArrowLeft size={16} /> User app</Link>
          </div>
        </aside>
        <main className="flex-1 min-w-0 w-full max-w-5xl mx-auto px-4 py-6 pb-16">
        {tab === 'overview' && (
          <div className="space-y-4 anim-fade-up">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[['Registered customers', stats.users], ['Active users', stats.active], ['Total wallet balance', usdt(stats.totalBalance)], ['Revenue (fees)', usdt(Math.round(stats.fees))],
                ['Total deposits', usdt(stats.deposits)], ['Total withdrawals', usdt(stats.withdrawals)], ['Total transfers', usdt(stats.transfers)], ['Referral commissions paid', usdt(stats.refPaid)],
                ['Pending deposits', stats.pendingDeposits.length], ['Pending withdrawals', stats.pendingWithdrawals.length], ['Pending loans', stats.pendingLoans.length], ['Pending KYC', stats.pendingKyc.length],
              ].map(([k, v]) => (
                <Card key={k as string} className="p-4"><p className="text-[11px] uppercase font-bold text-slate-400">{k}</p><p className="text-xl font-extrabold mt-1">{v}</p></Card>
              ))}
            </div>
            <Card className="p-5">
              <h3 className="font-extrabold mb-3">Transaction volume (completed)</h3>
              <div className="h-52"><ResponsiveContainer><BarChart data={chartData}><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: any) => usdt(Number(v))} /><Bar dataKey="volume" fill="#8b5cf6" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
            </Card>
            <Card className="p-5">
              <h3 className="font-extrabold mb-2">Recent transactions</h3>
              {byDateDesc(db.txs).slice(0, 8).map(t => (
                <div key={t.id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 text-sm">
                  <div className="flex-1 min-w-0"><p className="font-semibold truncate">{t.title}</p><p className="text-xs text-slate-400">{nameOf(t.userId)} · {t.id} · {fmtDateTime(t.createdAt)}</p></div>
                  <span className="font-bold">{usdt(t.amount)}</span><Badge tone={statusTone(t.status)}>{t.status}</Badge>
                </div>
              ))}
            </Card>
          </div>
        )}

        {tab === 'finance' && (
          <div className="space-y-6 anim-fade-up">
            <section>
              <h3 className="font-extrabold mb-3">Deposit requests</h3>
              {db.deposits.length === 0 ? <Card><Empty title="No deposit requests" /></Card> : db.deposits.map(d => (
                <Card key={d.id} className="p-4 mb-2 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[180px]"><p className="font-bold">{usdt(d.amount)} · {d.method} — {nameOf(d.userId)}</p><p className="text-xs text-slate-400">{d.id} · TrxID {d.trxId}{d.receipt ? ' · 📎 ' + d.receipt : ''} · {fmtDateTime(d.createdAt)}</p><p className="mt-1 flex gap-1.5 flex-wrap"><span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${d.verification === 'auto' ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{d.verification === 'auto' ? '⚡ AUTO-VERIFY' : '👤 MANUAL REVIEW'}</span>{d.providerRef && <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">PROVIDER {d.providerRef}</span>}</p></div>
                  <Badge tone={statusTone(d.status)}>{d.status}</Badge>
                  {d.status === 'pending' && <><Btn variant="success" className="!py-2" onClick={() => { decideDeposit(d.id, true); toast({ kind: 'success', title: 'Deposit approved & credited' }) }}><Check size={15} /> Approve</Btn><Btn variant="danger" className="!py-2" onClick={() => { decideDeposit(d.id, false); toast({ kind: 'info', title: 'Deposit rejected' }) }}><X size={15} /> Reject</Btn></>}
                </Card>
              ))}
            </section>
            <section>
              <h3 className="font-extrabold mb-3">Withdrawal requests</h3>
              {db.withdrawals.length === 0 ? <Card><Empty title="No withdrawal requests" /></Card> : db.withdrawals.map(d => (
                <Card key={d.id} className="p-4 mb-2 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[180px]"><p className="font-bold">{usdt(d.amount)} · {d.method} — {nameOf(d.userId)}</p><p className="text-xs text-slate-400">{d.id} → {d.destination} · fee {usdt(d.fee)} · payable {usdt(d.amount - d.fee)} · {fmtDateTime(d.createdAt)}</p></div>
                  <Badge tone={statusTone(d.status)}>{d.status}</Badge>
                  {d.status === 'pending' && <><Btn variant="success" className="!py-2" onClick={() => { decideWithdraw(d.id, true); toast({ kind: 'success', title: 'Withdrawal completed' }) }}><Check size={15} /> Complete</Btn><Btn variant="danger" className="!py-2" onClick={() => { decideWithdraw(d.id, false); toast({ kind: 'info', title: 'Withdrawal rejected & refunded' }) }}><X size={15} /> Reject</Btn></>}
                </Card>
              ))}
            </section>
            <Card className="p-5">
              <h3 className="font-extrabold mb-2">Ledger integrity (double-entry)</h3>
              <p className="text-sm text-slate-500">Total ledger entries: <b>{db.ledger.length}</b> · Debits = Credits check: <b className="text-emerald-600">{db.ledger.reduce((s, l) => s + l.debit, 0) - db.ledger.reduce((s, l) => s + l.credit, 0) === 0 ? 'Not applicable per-entry (paired)' : 'Review'} — every transaction writes a balanced pair.</b></p>
              <p className="text-sm text-slate-500 mt-1">Balances are never edited directly outside audited adjustments (see Users tab), which also write ledger entries.</p>
            </Card>
          </div>
        )}

        {tab === 'users' && (
          <div className="anim-fade-up">
            <input value={userQ} onChange={e => setUserQ(e.target.value)} placeholder="Search users by name, email, username, ID…" className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/70 px-4 py-3 mb-4 outline-none focus:ring-2 focus:ring-violet-500" />
            <div className="space-y-2">
              {db.users.filter(u => (u.name + u.email + u.username + u.id).toLowerCase().includes(userQ.toLowerCase())).map(u => {
                const w = db.wallets.find(x => x.userId === u.id)
                return (
                  <Card key={u.id} className="p-4">
                    <div className="flex flex-wrap items-center gap-3 cursor-pointer" onClick={() => openUser(u)} title="Click to manage this account">
                      <Avatar name={u.name} photo={u.photo} />
                      <div className="flex-1 min-w-[170px]"><p className="font-bold">{u.name} {u.role === 'admin' && <Badge tone="amber">admin</Badge>}</p><p className="text-xs text-slate-400">@{u.username} · {u.email} · {u.phone} · {u.id}</p><p className="text-xs text-slate-400">Balance {usdt((w?.available ?? 0) + (w?.locked ?? 0))} · Joined {fmtDateTime(u.createdAt)} · {db.txs.filter(t => t.userId === u.id).length} txns</p></div>
                      <Badge tone={statusTone(u.kyc)}>KYC {u.kyc}</Badge><Badge tone="violet">Level {u.level}</Badge><Badge tone={u.status === 'active' ? 'green' : 'red'}>{u.status}</Badge>
                    </div>
                    {u.kycDocType && (
                      <div className="mt-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3">
                        <p className="text-xs font-bold text-slate-500">📄 {u.kycDocType === 'passport' ? 'Passport' : u.kycDocType === 'driving' ? 'Driving Licence' : 'National ID'} · <span className="font-mono">{u.kycDocNumber}</span>{u.kycSubmittedAt ? ' · submitted ' + fmtDateTime(u.kycSubmittedAt) : ''}</p>
                        <div className="flex gap-2 mt-2">
                          {u.kycDocPhoto && <a href={u.kycDocPhoto} target="_blank" rel="noreferrer"><img src={u.kycDocPhoto} alt="KYC document" className="h-16 w-24 object-cover rounded-xl border border-slate-200 dark:border-slate-700" /></a>}
                          {u.kycFacePhoto && <a href={u.kycFacePhoto} target="_blank" rel="noreferrer"><img src={u.kycFacePhoto} alt="KYC face scan" className="h-16 w-16 object-cover rounded-xl border border-slate-200 dark:border-slate-700" /></a>}
                        </div>
                        {u.kyc === 'pending' && <div className="flex gap-2 mt-2"><Btn variant="success" className="!py-1.5 !text-xs" onClick={() => decideKyc(u.id, true)}>Verify KYC</Btn><Btn variant="danger" className="!py-1.5 !text-xs" onClick={() => decideKyc(u.id, false)}>Reject KYC</Btn></div>}
                      </div>
                    )}
                    {u.role === 'user' && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {u.status !== 'frozen' ? <Btn variant="outline" className="!py-1.5 !text-xs" onClick={() => setUserStatus(u.id, 'frozen')}>Freeze wallet</Btn> : <Btn variant="outline" className="!py-1.5 !text-xs" onClick={() => setUserStatus(u.id, 'active')}>Unfreeze</Btn>}
                        {u.status !== 'suspended' ? <Btn variant="danger" className="!py-1.5 !text-xs" onClick={() => setUserStatus(u.id, 'suspended')}>Suspend</Btn> : <Btn variant="success" className="!py-1.5 !text-xs" onClick={() => setUserStatus(u.id, 'active')}>Activate</Btn>}
                        <Btn variant="ghost" className="!py-1.5 !text-xs" onClick={() => openUser(u)}>Manage account</Btn>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'loans' && (
          <div className="anim-fade-up space-y-2">
            {db.loans.length === 0 ? <Card><Empty title="No loan applications" /></Card> : db.loans.map(l => (
              <Card key={l.id} className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[190px]"><p className="font-bold">{l.id} · {usdt(l.amount)} — {nameOf(l.userId)}</p><p className="text-xs text-slate-400">{l.months} mo · {l.ratePct}% · EMI {usdt(l.emi)} · Total {usdt(l.totalPayable)} · Paid {usdt(l.paid)} · {fmtDateTime(l.createdAt)}</p>
                    {l.status === 'active' && l.paid < l.totalPayable * 0.3 && <p className="text-xs text-amber-600 font-bold mt-0.5">Watch: low repayment progress</p>}</div>
                  <Badge tone={statusTone(l.status)}>{l.status}</Badge>
                  {l.status === 'pending' && <><Btn variant="success" className="!py-2" onClick={() => { decideLoan(l.id, true); toast({ kind: 'success', title: 'Loan approved & disbursed' }) }}>Approve & disburse</Btn><Btn variant="danger" className="!py-2" onClick={() => decideLoan(l.id, false)}>Reject</Btn></>}
                </div>
                {l.applicantName && (
                  <div className="mt-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 flex gap-3.5">
                    <div className="flex flex-col gap-2 shrink-0">
                      {l.photo && <img src={l.photo} alt={l.applicantName} title="Applicant photo" className="w-16 h-16 rounded-2xl object-cover" />}
                      {l.idPhoto && <img src={l.idPhoto} alt="ID document" title={l.idType ?? 'ID'} className="w-16 h-16 rounded-2xl object-cover" />}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-x-5 gap-y-1 text-[13px] flex-1 min-w-0">
                      <p><span className="text-slate-400">Name:</span> <b>{l.applicantName}</b></p>
                      <p><span className="text-slate-400">Phone:</span> <b>{l.phone}</b></p>
                      <p><span className="text-slate-400">WhatsApp:</span> <b>{l.whatsapp}</b></p>
                      <p><span className="text-slate-400">{l.idType ?? 'NID'}:</span> <b>{l.nid}</b></p>
                      <p><span className="text-slate-400">Guarantor:</span> <b>{l.guarantorName}</b></p>
                      <p><span className="text-slate-400">Guarantor mobile:</span> <b>{l.guarantorPhone}</b></p>
                    </div>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2.5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 px-3.5 py-3">
                  <p className="font-extrabold text-sm">Processing fee</p>
                  {l.processingFee ? <>
                    <span className="font-bold">{usdt(l.processingFee)}</span>
                    <Badge tone={l.feeStatus === 'paid' ? 'green' : l.feeStatus === 'submitted' ? 'violet' : 'amber'}>{l.feeStatus === 'paid' ? '✓ Paid' : l.feeStatus === 'submitted' ? 'Submitted — check & confirm' : 'Unpaid'}</Badge>
                    {l.feeStatus === 'submitted' && <span className="text-xs text-slate-500">via {l.feeMethod} · Ref: <b className="font-mono">{l.feeTxRef}</b></span>}
                    {l.feeStatus === 'submitted' && <Btn className="!py-1.5 !text-xs !bg-emerald-500" onClick={() => { confirmLoanFee(l.id); toast({ kind: 'success', title: 'Fee marked as paid' }) }}>Confirm fee paid</Btn>}
                  </> : <>
                    <div className="w-[150px]"><Input type="number" placeholder="Amount (USDT)" value={feeInputs[l.id] ?? ''} onChange={e => setFeeInputs(f => ({ ...f, [l.id]: e.target.value }))} /></div>
                    <Btn variant="outline" className="!py-2 !text-xs" onClick={() => { const a = Number(feeInputs[l.id]); if (!a || a <= 0) return toast({ kind: 'error', title: 'Enter a fee amount' }); setLoanFee(l.id, Math.round(a * db.settings.bdtPerUsd)); toast({ kind: 'success', title: 'Processing fee set', body: 'It now shows in the Loan section with a Pay button.' }) }}>Set fee</Btn>
                  </>}
                </div>
              </Card>
            ))}
            <Card className="p-5 text-sm text-slate-500">Loan config (limits, rate) lives in Settings. The payment options customers see for processing fees also live in Settings — one shared list with the main website (Add Money).</Card>
          </div>
        )}

        {tab === 'referrals' && (
          <div className="anim-fade-up space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-4 text-center"><p className="text-[11px] uppercase font-bold text-slate-400">Commission rate</p><p className="text-xl font-extrabold mt-1">{db.settings.referralPct}%</p></Card>
              <Card className="p-4 text-center"><p className="text-[11px] uppercase font-bold text-slate-400">Total paid</p><p className="text-xl font-extrabold mt-1">{usdt(stats.refPaid)}</p></Card>
              <Card className="p-4 text-center"><p className="text-[11px] uppercase font-bold text-slate-400">Referred users</p><p className="text-xl font-extrabold mt-1">{db.users.filter(u => u.referredBy).length}</p></Card>
            </div>
            <Card className="p-5">
              <h3 className="font-extrabold mb-2">Suspicious referral check</h3>
              <p className="text-sm text-slate-500">Self-referrals are blocked at registration. Duplicate email/username signups are rejected. Accounts flagged: <b>{db.users.filter(u => u.status === 'suspended').length}</b> suspended.</p>
              <div className="mt-3 space-y-1.5">{db.referralEarnings.map(r => <p key={r.id} className="text-sm">{nameOf(r.userId)} earned {usdt(r.amount)} from {r.fromUser} · {fmtDateTime(r.createdAt)}</p>)}</div>
            </Card>
          </div>
        )}

        {tab === 'content' && (
          <div className="anim-fade-up space-y-6">
            <Card className="p-5">
              <h3 className="font-extrabold flex items-center gap-2"><Send size={17} className="text-violet-500" /> Broadcast to all users</h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">Sends a notification to every account ({db.users.length} users). It appears in their notification list on every device — use it for maintenance notices and announcements.</p>
              <div className="space-y-3">
                <Input label="Title" placeholder="Scheduled maintenance tonight" value={bcTitle} onChange={e => setBcTitle(e.target.value)} />
                <Input label="Message" placeholder="The app will be unavailable from 2:00–2:30 AM. Your funds are safe." value={bcBody} onChange={e => setBcBody(e.target.value)} />
                <Btn className="w-full" disabled={bcBusy} onClick={async () => { if (!bcTitle.trim() || !bcBody.trim()) return toast({ kind: 'error', title: 'Write a title and a message' }); setBcBusy(true); const e = await broadcast(bcTitle.trim(), bcBody.trim()); setBcBusy(false); if (e) return toast({ kind: 'error', title: e }); setBcTitle(''); setBcBody(''); toast({ kind: 'success', title: 'Broadcast sent', body: 'Every user will see it in their notifications.' }) }}>{bcBusy ? 'Sending…' : 'Send broadcast'}</Btn>
              </div>
            </Card>
            <section>
              <div className="flex items-center justify-between mb-3"><h3 className="font-extrabold">News</h3><Btn onClick={() => setNewsForm({ title: '', category: 'Bitcoin', excerpt: '', body: '', source: 'Nova Market Desk', featured: false, gradient: 'from-violet-500 to-purple-700', coin: 'BTC' })}>+ Publish news</Btn></div>
              {db.news.map(n => (
                <Card key={n.id} className="p-4 mb-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0"><p className="font-bold truncate">{n.title}</p><p className="text-xs text-slate-400">{n.category} · {n.source} · {fmtDateTime(n.date)}{n.featured ? ' · ⭐ Featured' : ''}</p></div>
                  <Btn variant="ghost" className="!py-1.5 !text-xs" onClick={() => setNewsForm({ ...n })}>Edit</Btn>
                  <Btn variant="danger" className="!py-1.5 !text-xs" onClick={() => { deleteNews(n.id); toast({ kind: 'info', title: 'News deleted' }) }}>Delete</Btn>
                </Card>
              ))}
            </section>
            <section>
              <h3 className="font-extrabold mb-3 flex items-center gap-2"><Megaphone size={17} /> Promotional banners</h3>
              {db.banners.map(b => (
                <div key={b.id} className={`rounded-3xl bg-gradient-to-br ${b.gradient} text-white p-4 mb-2 flex items-center gap-3`}>
                  <div className="flex-1"><p className="font-extrabold">{b.title}</p><p className="text-white/80 text-sm">{b.subtitle}</p></div>
                  <button onClick={() => toggleBanner(b.id)} className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold">{b.active ? 'Active — tap to hide' : 'Hidden — tap to show'}</button>
                </div>
              ))}
            </section>
          </div>
        )}

        {tab === 'levels' && (
          <div className="anim-fade-up space-y-6">
            <section>
              <h3 className="font-extrabold mb-3">Upgrade requests</h3>
              {db.levelRequests.length === 0 ? <Card><Empty title="No upgrade requests" /></Card> : db.levelRequests.map(r => (
                <Card key={r.id} className="p-4 mb-2 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[180px]"><p className="font-bold">{nameOf(r.userId)} — Level {r.fromLevel} → Level {r.toLevel}</p><p className="text-xs text-slate-400">{r.id} · {fmtDateTime(r.createdAt)}</p></div>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  {r.status === 'pending' && <><Btn variant="success" className="!py-2" onClick={() => { decideUpgrade(r.id, true); toast({ kind: 'success', title: 'Level upgraded' }) }}><Check size={15} /> Approve</Btn><Btn variant="danger" className="!py-2" onClick={() => decideUpgrade(r.id, false)}><X size={15} /> Reject</Btn></>}
                </Card>
              ))}
            </section>
            <section>
              <h3 className="font-extrabold mb-3">Level definitions (managed here, applied everywhere)</h3>
              {db.levels.map(l => {
                const f = levelForms[l.level] ?? l
                const upd = (k: string, v: any) => setLevelForms(prev => ({ ...prev, [l.level]: { ...f, [k]: v } }))
                return (
                  <Card key={l.level} className="p-4 mb-3">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${l.gradient} text-white flex items-center justify-center font-extrabold`}>{l.level}</span>
                      <p className="font-extrabold">Level {l.level}</p>
                      <Badge tone="slate">{db.users.filter(u => u.level === l.level && u.role === 'user').length} users</Badge>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Input label="Tagline" value={f.tagline} onChange={e => upd('tagline', e.target.value)} />
                      <Input label="Daily limit (USDT)" type="number" value={Math.round(f.dailyLimit / db.settings.bdtPerUsd * 100) / 100} onChange={e => upd('dailyLimit', Math.round(Number(e.target.value) * db.settings.bdtPerUsd))} />
                      <Input label="Monthly limit (USDT)" type="number" value={Math.round(f.monthlyLimit / db.settings.bdtPerUsd * 100) / 100} onChange={e => upd('monthlyLimit', Math.round(Number(e.target.value) * db.settings.bdtPerUsd))} />
                      <Input label="Loan limit (USDT)" type="number" value={Math.round(f.loanLimit / db.settings.bdtPerUsd * 100) / 100} onChange={e => upd('loanLimit', Math.round(Number(e.target.value) * db.settings.bdtPerUsd))} />
                      <Input label="Required total deposit (USDT)" type="number" value={Math.round((f.depositRequired ?? 0) / db.settings.bdtPerUsd * 100) / 100} onChange={e => upd('depositRequired', Math.round(Number(e.target.value) * db.settings.bdtPerUsd))} />
                      <Input label="Fee discount %" type="number" value={f.feeDiscountPct} onChange={e => upd('feeDiscountPct', Number(e.target.value))} />
                    </div>
                    <Input label="Requirement" className="mt-3" value={f.requirement} onChange={e => upd('requirement', e.target.value)} />
                    <Btn className="mt-3" onClick={() => { updateLevelDef(l.level, f); toast({ kind: 'success', title: 'Level ' + l.level + ' updated' }) }}>Save Level {l.level}</Btn>
                  </Card>
                )
              })}
            </section>
            <section>
              <h3 className="font-extrabold mb-3">Set a user's level directly</h3>
              {db.users.filter(u => u.role === 'user').map(u => (
                <Card key={u.id} className="p-3.5 mb-2 flex items-center gap-3">
                  <Avatar name={u.name} size={36} photo={u.photo} />
                  <div className="flex-1 min-w-[120px]"><p className="font-bold text-sm">{u.name}</p><p className="text-xs text-slate-400">@{u.username} · KYC {u.kyc}</p></div>
                  <select value={u.level} onChange={e => { setUserLevel(u.id, Number(e.target.value)); toast({ kind: 'success', title: u.name + ' → Level ' + e.target.value }) }} className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold">
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>Level {n}</option>)}
                  </select>
                </Card>
              ))}
            </section>
          </div>
        )}

        {tab === 'support' && <SupportChat />}
        {tab === 'txs' && (
          <div className="space-y-3">
            <Card className="p-4">
              <Input label="Search by Transaction ID" placeholder="Paste or type the Transaction ID, e.g. TXN-…" value={txQ} onChange={e => setTxQ(e.target.value)} />
              <p className="text-xs text-slate-400 mt-2">Built for customer support — every transaction carries its own ID. Search also matches the customer name, title or counterparty. {filteredTxs.length} transaction(s) found.</p>
            </Card>
            {filteredTxs.length === 0 ? <Card><Empty title="No transactions match that search" /></Card> : filteredTxs.slice(0, 100).map(tx => { const tu = db.users.find(u => u.id === tx.userId); const dir = txDirection(tx.category, tx.amount); return (
              <button key={tx.id} onClick={() => setSelTx(tx)} className="w-full text-left">
                <Card className="p-4 hover:border-violet-300 transition">
                  <div className="flex items-start gap-3">
                    <TxDirIcon dir={dir} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{tx.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{tu?.name ?? tx.userId} · {fmtDateTime(tx.createdAt)}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{tx.id}</p>
                    </div>
                    <div className="text-right shrink-0"><p className={`font-extrabold ${txAmountCls(dir)}`}>{txSign(dir)}{usdt(Math.abs(tx.amount))}</p><div className="mt-1"><Badge tone={statusTone(tx.status)}>{tx.status}</Badge></div></div>
                  </div>
                </Card>
              </button>
            ) })}
          </div>
        )}
        {tab === 'audit' && (
          <div className="anim-fade-up space-y-2">
            {db.audit.map(a => (
              <Card key={a.id} className="p-4 text-sm"><p className="font-bold">{a.action} <span className="text-slate-400 font-normal">by {a.actor}</span></p><p className="text-slate-500">{a.detail}</p><p className="text-[11px] text-slate-400">{fmtDateTime(a.createdAt)}</p></Card>
            ))}
          </div>
        )}

        {tab === 'payments' && pmList && (
          <div className="anim-fade-up space-y-4">
            <Card className="p-5">
              <h3 className="font-extrabold">Payment Methods</h3>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">The bank accounts and crypto wallets customers send money to. This one list is shown in <b>Add Money</b> (with copy buttons), in loan-fee payments and in Profile — the same in every country. Bank accounts can carry Routing No, SWIFT Code and branch; crypto entries carry the coin, network and wallet address.</p>
            </Card>
            {pmList.map((pm, i) => {
              const setPm = (patch: Partial<PayMethod>) => setPmList(list => (list ?? []).map((x, j) => j === i ? { ...x, ...patch } : x))
              return (
                <Card key={pm.id} className="p-5 space-y-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold ${pm.kind === 'crypto' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'}`}>{pm.kind === 'crypto' ? '₿ Crypto wallet' : '🏦 Bank account'}</span>
                    <button onClick={() => setPmList(list => (list ?? []).filter((_, j) => j !== i))} className="text-rose-500 font-extrabold text-sm">Remove ✕</button>
                  </div>
                  <Select label="Type" value={pm.kind} onChange={(e: any) => setPm({ kind: e.target.value })}>
                    <option value="bank">🏦 Bank account</option>
                    <option value="crypto">₿ Crypto wallet</option>
                  </Select>
                  <Select label="Verification" value={pm.verification ?? 'manual'} onChange={(e: any) => setPm({ verification: e.target.value })}>
                    <option value="manual">👤 Manual review — admin approves each deposit</option>
                    <option value="auto">⚡ Auto-verify — settles automatically once a provider is connected</option>
                  </Select>
                  {(pm.verification ?? 'manual') === 'auto' && <p className="-mt-1 text-xs text-slate-400 leading-relaxed">Auto deposits are tagged and routed separately in the Finance queue with their normalized reference, ready for a bank API / gateway / SMS-webhook matcher. Until a provider is connected they still wait in the queue — nothing is auto-approved yet.</p>}
                  {pm.kind === 'bank' ? (
                    <div className="grid sm:grid-cols-2 gap-3.5">
                      <Input label="Bank name" placeholder="e.g. BRAC Bank" value={pm.label} onChange={e => setPm({ label: e.target.value })} />
                      <Input label="Account name / title" placeholder="e.g. NovaWallet" value={pm.accountName ?? ''} onChange={e => setPm({ accountName: e.target.value })} />
                      <Input label="Account number" placeholder="e.g. 1501200000001" value={pm.accountNumber ?? ''} onChange={e => setPm({ accountNumber: e.target.value })} />
                      <Input label="Branch" placeholder="e.g. Sylhet Branch" value={pm.branch ?? ''} onChange={e => setPm({ branch: e.target.value })} />
                      <Input label="Routing No" placeholder="e.g. 060261234" value={pm.routing ?? ''} onChange={e => setPm({ routing: e.target.value })} />
                      <Input label="SWIFT Code" placeholder="e.g. BRAKBDDH" value={pm.swift ?? ''} onChange={e => setPm({ swift: e.target.value })} />
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3.5">
                      <Input label="Coin / asset" placeholder="e.g. USDT" value={pm.label} onChange={e => setPm({ label: e.target.value })} />
                      <Select label="Network / transfer system" value={pm.network ?? CRYPTO_NETWORK_LABELS[3]} onChange={(e: any) => setPm({ network: e.target.value })}>
                        {CRYPTO_NETWORK_LABELS.map(n => <option key={n}>{n}</option>)}
                      </Select>
                      <Input label="Wallet name (optional)" placeholder="e.g. NovaWallet" value={pm.accountName ?? ''} onChange={e => setPm({ accountName: e.target.value })} />
                      <Input label="Wallet address" placeholder="Paste the receiving address" value={pm.accountNumber ?? ''} onChange={e => setPm({ accountNumber: e.target.value })} />
                    </div>
                  )}
                </Card>
              )
            })}
            <div className="flex flex-wrap gap-2">
              <Btn variant="outline" className="!py-2.5 !text-sm" onClick={() => setPmList(list => [...(list ?? []), { id: 'pm' + Date.now(), kind: 'bank', label: '', accountName: '', accountNumber: '', routing: '', swift: '', branch: '' }])}>＋ Add bank account</Btn>
              <Btn variant="outline" className="!py-2.5 !text-sm" onClick={() => setPmList(list => [...(list ?? []), { id: 'pm' + Date.now(), kind: 'crypto', label: 'USDT', network: CRYPTO_NETWORK_LABELS[3], accountName: '', accountNumber: '' }])}>＋ Add crypto wallet</Btn>
            </div>
            <Btn className="w-full py-3.5" onClick={() => { updateSettings({ payMethods: pmList.filter(m => m.label.trim()) }); toast({ kind: 'success', title: 'Payment methods saved', body: 'Add Money now shows the updated accounts.' }) }}>Save payment methods</Btn>
          </div>
        )}

        {tab === 'reports' && (() => {
          const since30 = Date.now() - 30 * 864e5
          const in30 = (iso: string) => new Date(iso).getTime() > since30
          const sum = (rows: any[], f: (r: any) => number) => rows.reduce((s, r) => s + f(r), 0)
          const depA = db.deposits.filter(d => d.status === 'approved')
          const wdA = db.withdrawals.filter(w => w.status === 'completed')
          const feeTotal = db.txs.filter(t => t.status === 'completed').reduce((s, t) => s + (t.fee || 0), 0)
          const fee30 = db.txs.filter(t => t.status === 'completed' && in30(t.createdAt)).reduce((s, t) => s + (t.fee || 0), 0)
          const stats: [string, string, string][] = [
            ['Deposits approved (30d)', usdt(sum(depA.filter(d => in30(d.createdAt)), d => d.amount)), 'All time ' + usdt(sum(depA, d => d.amount))],
            ['Withdrawals paid (30d)', usdt(sum(wdA.filter(w => in30(w.createdAt)), w => w.amount)), 'All time ' + usdt(sum(wdA, w => w.amount))],
            ['Fee revenue (30d)', usdt(fee30), 'All time ' + usdt(feeTotal)],
            ['New users (30d)', String(db.users.filter(u => in30(u.createdAt)).length), 'Total ' + db.users.length + ' users'],
          ]
          return (
            <div className="anim-fade-up space-y-4">
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {stats.map(([label, value, sub]) => (
                  <Card key={label} className="p-4"><p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p><p className="text-xl font-extrabold mt-1">{value}</p><p className="text-xs text-slate-400 mt-0.5">{sub}</p></Card>
                ))}
              </div>
              <Card className="p-5">
                <h3 className="font-extrabold flex items-center gap-2"><Download size={17} className="text-violet-500" /> Export data (CSV)</h3>
                <p className="text-xs text-slate-400 mt-1 mb-4">Downloads open in Excel or Google Sheets — handy for accounting and tax records.</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <Btn variant="outline" onClick={() => downloadCsv('novawallet-transactions.csv', db.txs.map(t => ({ id: t.id, date: t.createdAt, user: db.users.find(u => u.id === t.userId)?.email ?? t.userId, category: t.category, title: t.title, amount_bdt: t.amount, fee_bdt: t.fee || 0, status: t.status })))}>Transactions ({db.txs.length})</Btn>
                  <Btn variant="outline" onClick={() => downloadCsv('novawallet-users.csv', db.users.map(u => ({ id: u.id, name: u.name, username: u.username, email: u.email, role: u.role, level: u.level, kyc: u.kyc, status: u.status, joined: u.createdAt })))}>Users ({db.users.length})</Btn>
                  <Btn variant="outline" onClick={() => downloadCsv('novawallet-deposits.csv', db.deposits.map(d => ({ id: d.id, date: d.createdAt, user: db.users.find(u => u.id === d.userId)?.email ?? d.userId, method: d.method, amount_bdt: d.amount, trx_id: d.trxId, status: d.status })))}>Deposits ({db.deposits.length})</Btn>
                  <Btn variant="outline" onClick={() => downloadCsv('novawallet-withdrawals.csv', db.withdrawals.map(w => ({ id: w.id, date: w.createdAt, user: db.users.find(u => u.id === w.userId)?.email ?? w.userId, method: w.method, amount_bdt: w.amount, fee_bdt: w.fee, destination: w.destination, status: w.status })))}>Withdrawals ({db.withdrawals.length})</Btn>
                </div>
              </Card>
            </div>
          )
        })()}

        {tab === 'health' && (
          <div className="anim-fade-up space-y-4">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <Card className="p-4"><p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">API server</p><p className="text-xl font-extrabold mt-1">{apiHealth === null ? 'Checking…' : apiHealth.ok ? '🟢 Online' : '🔴 Unreachable'}</p><p className="text-xs text-slate-400 mt-0.5">{apiHealth?.ok ? 'novawallet-api · v' + (apiHealth.version ?? '') : 'Live status of the backend'}</p></Card>
              <Card className="p-4"><p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Registered users</p><p className="text-xl font-extrabold mt-1">{db.users.length}</p><p className="text-xs text-slate-400 mt-0.5">Synced from the server</p></Card>
              <Card className="p-4"><p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Open support chats</p><p className="text-xl font-extrabold mt-1">{db.tickets.filter(t => t.status !== 'resolved').length}</p><p className="text-xs text-slate-400 mt-0.5">Waiting in Support Chat</p></Card>
              <Card className="p-4"><p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Crash reports</p><p className="text-xl font-extrabold mt-1">{adminErrors.length}</p><p className="text-xs text-slate-400 mt-0.5">Latest 50 app errors</p></Card>
            </div>
            <Card className="p-5">
              <h3 className="font-extrabold mb-1">App crash reports</h3>
              <p className="text-xs text-slate-400 mb-4">Errors users hit in the app are recorded automatically — newest first.</p>
              {adminErrors.length === 0 ? <Empty title="No crash reports" body="When a user's app hits an error, it will show up here with the page and the message." /> : (
                <div className="space-y-2">{adminErrors.map(e => { const eu = db.users.find(u => u.id === e.userId || (u as any).fbUid === e.userId); return (
                  <div key={e.id} className="rounded-2xl border border-slate-200/70 dark:border-slate-800 p-3.5">
                    <p className="font-bold text-sm text-rose-500">{e.message}</p>
                    <p className="text-xs text-slate-400 mt-1">{eu ? eu.name + ' · ' + eu.email : 'Unknown user'} · {e.url ?? ''} · {fmtDateTime(e.createdAt)}</p>
                  </div>
                ) })}</div>
              )}
            </Card>
            <Card className="p-5">
              <h3 className="font-extrabold flex items-center gap-2"><Download size={17} className="text-violet-500" /> Database backup</h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">Download a full JSON snapshot of the live database — users, wallets, transactions, deposits, withdrawals, loans, KYC, tickets and settings. Keep it somewhere safe.</p>
              <Btn onClick={async () => { try { const r = await apiGet('/v1/admin/backup'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(r.backup, null, 1)], { type: 'application/json' })); a.download = 'novawallet-backup.json'; a.click(); URL.revokeObjectURL(a.href); toast({ kind: 'success', title: 'Backup downloaded' }) } catch (e: any) { toast({ kind: 'error', title: e.message }) } }}>Download backup</Btn>
            </Card>
          </div>
        )}

        {tab === 'settings' && (
          <div className="anim-fade-up">
            <Card className="p-5 space-y-4">
              <h3 className="font-extrabold">Platform settings</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Platform name" value={setForm.platformName} onChange={e => setSetForm(s => ({ ...s, platformName: e.target.value }))} />
                <Input label="BDT per USDT" type="number" value={setForm.bdtPerUsd} onChange={e => setSetForm(s => ({ ...s, bdtPerUsd: Number(e.target.value) }))} />
                <Input label="Send fee %" type="number" step="0.1" value={setForm.sendFeePct} onChange={e => setSetForm(s => ({ ...s, sendFeePct: Number(e.target.value) }))} />
                <Input label="Cash out fee %" type="number" step="0.1" value={setForm.cashoutFeePct} onChange={e => setSetForm(s => ({ ...s, cashoutFeePct: Number(e.target.value) }))} />
                <Input label="Referral commission %" type="number" value={setForm.referralPct} onChange={e => setSetForm(s => ({ ...s, referralPct: Number(e.target.value) }))} />
                <Input label="Loan interest % / year" type="number" value={setForm.loanRatePct} onChange={e => setSetForm(s => ({ ...s, loanRatePct: Number(e.target.value) }))} />
                <Input label="Min loan (USDT)" type="number" value={Math.round(setForm.minLoan / setForm.bdtPerUsd * 100) / 100} onChange={e => setSetForm(s => ({ ...s, minLoan: Math.round(Number(e.target.value) * s.bdtPerUsd) }))} />
                <Input label="Max loan / limit (USDT)" type="number" value={Math.round(setForm.maxLoan / setForm.bdtPerUsd * 100) / 100} onChange={e => setSetForm(s => ({ ...s, maxLoan: Math.round(Number(e.target.value) * s.bdtPerUsd), loanLimit: Math.round(Number(e.target.value) * s.bdtPerUsd) }))} />
              </div>
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm font-semibold">💳 Payment methods (bank accounts & crypto wallets) are managed in their own tab.</p>
                <Btn variant="outline" className="!py-2 !text-xs" onClick={() => setTab('payments')}>Open Payment Methods</Btn>
              </div>
              <label className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 font-semibold text-sm">Maintenance mode
                <input type="checkbox" checked={setForm.maintenance} onChange={e => setSetForm(s => ({ ...s, maintenance: e.target.checked }))} className="w-5 h-5 accent-violet-600" /></label>
              <Btn className="w-full" onClick={() => { updateSettings(setForm); toast({ kind: 'success', title: 'Settings saved' }) }}>Save settings</Btn>
              <p className="text-xs text-slate-400">Payment methods supported: Bank Transfer and Crypto Deposit — the same in every region. Cryptocurrencies: 32 coins with live market data. Admin roles: Full (owner), Finance, Content, Support — enforced by the server on every request.</p>
            </Card>
            <Card className="p-5 mt-4 space-y-3">
              <h3 className="font-extrabold">Feature switches</h3>
              <p className="text-xs text-slate-400">Pause a service for maintenance — the server blocks it for everyone right away and the app shows a maintenance notice instead of the form.</p>
              {feat && ([['deposits', '💰 Deposits — Add Money'], ['withdrawals', '🏧 Withdrawals — Cash Out & Direct Withdraw'], ['trading', '📈 Trading — Buy, Sell & Swap'], ['loans', '🏦 New loan applications'], ['registration', '🆕 New account registrations']] as const).map(([k, label]) => (
                <label key={k} className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 font-semibold text-sm">{label}
                  <input type="checkbox" checked={!!feat[k]} onChange={e => setFeat((f: any) => ({ ...f, [k]: e.target.checked }))} className="w-5 h-5 accent-violet-600" /></label>
              ))}
              <Btn className="w-full" onClick={() => { if (feat) updateSettings({ features: feat }); toast({ kind: 'success', title: 'Feature switches saved' }) }}>Save feature switches</Btn>
            </Card>
            <Card className="p-5 mt-4">
              <h3 className="font-extrabold text-rose-600 mb-2">Danger zone</h3>
              <Btn variant="danger" onClick={() => { resetDemo(); toast({ kind: 'info', title: 'Demo data reset to seed' }) }}>Reset demo data</Btn>
            </Card>
          </div>
        )}
        </main>
      </div>

      <Modal open={!!selTx} onClose={() => setSelTx(null)} title="Transaction details">
        {selTx && (() => { const tu = db.users.find(u => u.id === selTx.userId); const dir = txDirection(selTx.category, selTx.amount); return (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4 items-center"><span className="text-slate-500">Transaction ID</span><span className="flex items-center gap-1.5"><span className="font-bold font-mono text-right">{selTx.id}</span><button onClick={() => copyTxId(selTx.id)} title="Copy Transaction ID" className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-500/15 text-violet-600"><Copy size={13} /></button></span></div>
              {[['Customer', tu ? tu.name + ' · ' + tu.email : selTx.userId], ['Title', selTx.title], ['Category', selTx.category], ['Fee', usdt(selTx.fee)], ['Status', selTx.status], ['Method', selTx.method ?? '—'], ['Counterparty', selTx.counterparty ?? '—'], ['Note', selTx.note ?? '—'], ['Date', fmtDateTime(selTx.createdAt)]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4"><span className="text-slate-500 capitalize">{k}</span><span className="font-bold text-right capitalize">{v}</span></div>
              ))}
              <div className="flex justify-between gap-4 border-t border-slate-200 dark:border-slate-700 pt-2"><span className="text-slate-500">Amount</span><span className={`font-extrabold text-right ${txAmountCls(dir)}`}>{txSign(dir)}{usdt(Math.abs(selTx.amount))}</span></div>
            </div>
            <Btn className="w-full" onClick={() => copyTxId(selTx.id)}><Copy size={15} /> Copy Transaction ID</Btn>
          </div>
        ) })()}
      </Modal>
      <Modal open={!!selUser} onClose={() => setSelUserId(null)} title={selUser ? 'Manage — ' + selUser.name : ''}>
        {selUser && (() => {
          const lvlDef = db.levels.find(l => l.level === selUser.level)
          const pendingReq = db.levelRequests.find(r => r.userId === selUser.id && r.status === 'pending')
          const sw = selWallet
          const holdings = Object.entries(sw?.holdings ?? {}).filter(([, a]) => a > 0)
          const cryptoValueBdt = holdings.reduce((sum, [sym, a]) => sum + a * priceOfA(sym) * db.settings.bdtPerUsd, 0)
          const stakes = db.stakes.filter(st => st.userId === selUser.id && st.status === 'active')
          const pendWd = db.withdrawals.filter(x => x.userId === selUser.id && x.status === 'pending')
          const stmt = byDateDesc(db.txs.filter(t => t.userId === selUser.id)).slice(0, 10)
          const ADJ_TITLES = ['Charge', 'Complaint', 'Hold', 'Refund', 'Bonus', 'Compensation', 'Correction']
          const tradePrice = priceOfA(mSym)
          const sellHolding = sw?.holdings[mSym] ?? 0
          return (
            <div className="space-y-5">
              {/* Summary */}
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 text-sm space-y-1.5">
                <div className="flex justify-between gap-3"><span className="text-slate-500">User ID</span><span className="font-bold">{selUser.id}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Email</span><span className="font-bold">{selUser.email}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Phone</span><span className="font-bold">{selUser.phone}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Joined</span><span className="font-bold">{fmtDateTime(selUser.createdAt)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">KYC / Status</span><span className="font-bold capitalize">{selUser.kyc} · {selUser.status}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Cash balance</span><span className="font-bold">{usdt(sw?.available ?? 0)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Available incl. USDT (customer's Home figure)</span><span className="font-bold">{usdt((sw?.available ?? 0) + (sw?.holdings.USDT ?? 0) * db.settings.bdtPerUsd)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Locked</span><span className="font-bold">{usdt(sw?.locked ?? 0)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Crypto value (live)</span><span className="font-bold">{usdt(cryptoValueBdt)}</span></div>
                {holdings.length > 0 && (
                  <div className="pt-1.5 space-y-1">
                    {holdings.map(([sym, a]) => (
                      <div key={sym} className="flex justify-between gap-3 text-xs"><span className="text-slate-500">{sym} holding</span><span className="font-bold">{a} {sym} · {fmtUSDT(a * priceOfA(sym))}</span></div>
                    ))}
                  </div>
                )}
              </div>
              {(selUser.kycDocType || selUser.kycDocPhoto || kycDocs?.docPhoto) && (
                <div>
                  <p className="font-extrabold text-sm mb-2">KYC documents{selUser.kycDocType ? ' · ' + (selUser.kycDocType === 'passport' ? 'Passport' : selUser.kycDocType === 'driving' ? 'Driving Licence' : 'National ID') : ''}{selUser.kycDocNumber ? ' · ' + selUser.kycDocNumber : ''}{selUser.kycSubmittedAt ? ' · submitted ' + fmtDateTime(selUser.kycSubmittedAt) : ''}</p>
                  <div className="flex gap-2">
                    {(selUser.kycDocPhoto || kycDocs?.docPhoto) && <a href={selUser.kycDocPhoto || kycDocs?.docPhoto} target="_blank" rel="noreferrer"><img src={selUser.kycDocPhoto || kycDocs?.docPhoto} alt="KYC document" className="h-24 w-36 object-cover rounded-xl border border-slate-200 dark:border-slate-700" /></a>}
                    {(selUser.kycFacePhoto || kycDocs?.facePhoto) && <a href={selUser.kycFacePhoto || kycDocs?.facePhoto} target="_blank" rel="noreferrer"><img src={selUser.kycFacePhoto || kycDocs?.facePhoto} alt="KYC face scan" className="h-24 w-24 object-cover rounded-xl border border-slate-200 dark:border-slate-700" /></a>}
                    {!selUser.kycDocPhoto && !kycDocs?.docPhoto && <p className="text-xs text-slate-400">Loading photos…</p>}
                  </div>
                  {selUser.kyc === 'pending' && <div className="flex gap-2 mt-2"><Btn variant="success" className="!py-2 !text-xs" onClick={() => decideKyc(selUser.id, true)}>Verify KYC</Btn><Btn variant="danger" className="!py-2 !text-xs" onClick={() => decideKyc(selUser.id, false)}>Reject KYC</Btn></div>}
                </div>
              )}
              {selUser.role === 'user' && (
                <div className="flex flex-wrap gap-2">
                  {selUser.status !== 'frozen' ? <Btn variant="outline" className="!py-2 !text-xs" onClick={() => setUserStatus(selUser.id, 'frozen')}>Freeze wallet</Btn> : <Btn variant="outline" className="!py-2 !text-xs" onClick={() => setUserStatus(selUser.id, 'active')}>Unfreeze</Btn>}
                  {selUser.status !== 'suspended' ? <Btn variant="danger" className="!py-2 !text-xs" onClick={() => setUserStatus(selUser.id, 'suspended')}>Suspend</Btn> : <Btn variant="success" className="!py-2 !text-xs" onClick={() => setUserStatus(selUser.id, 'active')}>Activate</Btn>}
                </div>
              )}
              {/* Admin access (RBAC) — only the owner (full scope) can grant
                  or change admin roles; the server enforces the scopes. */}
              {myScope === 'full' && selUser.id !== user?.id && (
                <div className="rounded-2xl border border-amber-200/70 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/5 p-4">
                  <p className="font-extrabold text-sm mb-1">🛡️ Admin access</p>
                  <p className="text-xs text-slate-400 mb-3">Scopes decide what a teammate can see and do — Finance approves money, Content manages news & broadcasts, Support handles KYC & chats. Full = owner access.</p>
                  {selUser.role !== 'admin' ? (
                    <Btn variant="outline" className="!py-2 !text-xs" onClick={() => { setAdminRole(selUser.id, 'admin'); toast({ kind: 'success', title: 'Admin access granted', body: selUser.name + ' is now an admin (Support scope to start — widen it here anytime).' }) }}>Make admin</Btn>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {(['full', 'finance', 'content', 'support'] as const).map(sc => (
                          <button key={sc} onClick={() => setAdminScope(selUser.id, sc)} className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition active:scale-95 ${(selUser.adminScope ?? 'full') === sc ? 'bg-violet-600 text-white shadow' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500'}`}>{sc === 'full' ? 'Full (Owner)' : sc}</button>
                        ))}
                      </div>
                      <Btn variant="danger" className="!py-2 !text-xs" onClick={() => { setAdminRole(selUser.id, 'user'); toast({ kind: 'info', title: 'Admin access removed', body: selUser.name + ' is a regular user again.' }) }}>Remove admin access</Btn>
                    </div>
                  )}
                </div>
              )}
              {selUser.role === 'admin' && myScope !== 'full' && (
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 text-sm flex justify-between"><span className="text-slate-500">Admin scope</span><span className="font-bold capitalize">{selUser.adminScope ?? 'full'}</span></div>
              )}
              {/* Level */}
              <div>
                <p className="font-extrabold text-sm mb-2">Account level</p>
                <select value={selUser.level} onChange={e => { setUserLevel(selUser.id, Number(e.target.value)); toast({ kind: 'success', title: selUser.name + ' → Level ' + e.target.value }) }} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm font-bold">
                  {[1, 2, 3, 4].map(n => <option key={n} value={n}>Level {n}</option>)}
                </select>
                {pendingReq && (
                  <div className="flex flex-wrap items-center gap-2 mt-2.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 p-3">
                    <p className="flex-1 min-w-[140px] text-xs font-bold text-amber-700 dark:text-amber-300">Upgrade request pending: Level {pendingReq.fromLevel} → Level {pendingReq.toLevel}</p>
                    <Btn variant="success" className="!py-1.5 !text-xs" onClick={() => { decideUpgrade(pendingReq.id, true); toast({ kind: 'success', title: 'Level upgraded' }) }}>Approve</Btn>
                    <Btn variant="danger" className="!py-1.5 !text-xs" onClick={() => decideUpgrade(pendingReq.id, false)}>Reject</Btn>
                  </div>
                )}
              </div>
              {/* Titled balance adjustment */}
              <div className="rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/60 p-4">
                <p className="font-extrabold text-sm">Adjust balance <span className="text-slate-400 font-semibold">— shows in the statement with your title</span></p>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 mt-3">
                  {([['add', '＋ Add money'], ['deduct', '− Deduct']] as const).map(([d, l]) => (
                    <button key={d} onClick={() => setMAdjDir(d)} className={`py-2 rounded-xl text-sm font-bold transition ${mAdjDir === d ? 'bg-white dark:bg-slate-900 shadow ' + (d === 'add' ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-500'}`}>{l}</button>
                  ))}
                </div>
                <p className="text-xs font-bold text-slate-400 mt-3.5 mb-1.5">TITLE (appears in the customer's statement)</p>
                <div className="flex flex-wrap gap-1.5">
                  {ADJ_TITLES.map(tl => (
                    <button key={tl} onClick={() => setMAdjTitle(tl)} className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition ${mAdjTitle === tl ? 'bg-violet-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{tl}</button>
                  ))}
                </div>
                <div className="space-y-3 mt-3">
                  <Input label="…or a custom title" value={mAdjTitle} onChange={e => setMAdjTitle(e.target.value)} />
                  <Input label={'Amount (USDT) — ' + (mAdjDir === 'add' ? 'added to Available' : 'deducted from Available')} type="number" value={mAdjAmt} onChange={e => setMAdjAmt(e.target.value)} />
                  <Input label="Note (optional)" placeholder="e.g. Support ticket #123 — service charge" value={mAdjNote} onChange={e => setMAdjNote(e.target.value)} />
                  <Btn className="w-full" onClick={() => { const a = Number(mAdjAmt); if (!a || a <= 0) return toast({ kind: 'error', title: 'Enter an amount' }); if (!mAdjTitle.trim()) return toast({ kind: 'error', title: 'A title is required — it appears in the statement' }); if (mAdjDir === 'deduct' && Math.round(a * db.settings.bdtPerUsd) > (sw?.available ?? 0)) return toast({ kind: 'error', title: 'Deduction exceeds the available balance' }); adjustBalance(selUser.id, (mAdjDir === 'add' ? 1 : -1) * Math.round(a * db.settings.bdtPerUsd), mAdjTitle.trim(), mAdjNote.trim() || undefined); setMAdjAmt(''); setMAdjNote(''); toast({ kind: 'success', title: 'Recorded in the statement as “' + mAdjTitle.trim() + '”' }) }}>Apply — statement title: {mAdjTitle.trim() || '…'}</Btn>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">Writes a statement entry with this exact title + an audit log line, and notifies the customer.</p>
              </div>
              {/* Support crypto trade */}
              <div className="rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/60 p-4">
                <p className="font-extrabold text-sm">Crypto buy / sell <span className="text-slate-400 font-semibold">— on the customer's behalf</span></p>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 mt-3">
                  {([['buy', 'Buy'], ['sell', 'Sell']] as const).map(([sd, l]) => (
                    <button key={sd} onClick={() => setMSide(sd)} className={`py-2 rounded-xl text-sm font-bold transition ${mSide === sd ? 'bg-white dark:bg-slate-900 shadow ' + (sd === 'buy' ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-500'}`}>{l}</button>
                  ))}
                </div>
                <div className="space-y-3 mt-3">
                  <Select label="Coin" value={mSym} onChange={(e: any) => setMSym(e.target.value)}>
                    {Object.keys(COIN_META).map(sym => <option key={sym} value={sym}>{sym} — {COIN_META[sym].name}</option>)}
                  </Select>
                  <p className="text-xs text-slate-400 -mt-1">Live price: <b className="text-slate-600 dark:text-slate-200">{mSym === 'USDT' ? '$1.00 (pegged)' : fmtPrice(tradePrice)}</b> · Customer holds <b className="text-slate-600 dark:text-slate-200">{sellHolding} {mSym}</b></p>
                  <div className="relative">
                    <Input label={mSide === 'buy' ? 'Spend (USDT)' : 'Amount (' + mSym + ')'} type="number" value={mTradeAmt} onChange={e => setMTradeAmt(e.target.value)} />
                    {mSide === 'sell' && sellHolding > 0 && <button onClick={() => setMTradeAmt(String(sellHolding))} className="absolute right-3 top-[34px] text-xs font-extrabold text-violet-600">MAX</button>}
                  </div>
                  {mSide === 'buy' && Number(mTradeAmt) > 0 && tradePrice > 0 && <p className="text-xs font-bold text-emerald-600 -mt-1">≈ receives {(Number(mTradeAmt) / tradePrice).toFixed(6)} {mSym}</p>}
                  {mSide === 'sell' && Number(mTradeAmt) > 0 && <p className="text-xs font-bold text-rose-500 -mt-1">≈ receives {fmtUSDT(Number(mTradeAmt) * tradePrice)} {mSym === 'USDT' ? '(to cash balance)' : '(to USDT holding)'}</p>}
                  <Btn className="w-full" onClick={async () => { const a = Number(mTradeAmt); if (!a || a <= 0) return toast({ kind: 'error', title: 'Enter an amount' }); const err = mSide === 'buy' ? await adminBuyCrypto(selUser.id, mSym, a, tradePrice) : await adminSellCrypto(selUser.id, mSym, a, tradePrice); if (err) return toast({ kind: 'error', title: err }); setMTradeAmt(''); toast({ kind: 'success', title: (mSide === 'buy' ? 'Bought ' : 'Sold ') + mSym + ' for ' + selUser.name }) }}>{mSide === 'buy' ? 'Buy' : 'Sell'} {mSym} for customer</Btn>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">Uses the customer's own balances (USDT holding first, cash covers the rest — same as their own trades). Audited + the customer is notified.</p>
              </div>
              {/* Locked manager */}
              <div className="rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/60 p-4">
                <p className="font-extrabold text-sm">Locked holdings <span className="text-slate-400 font-semibold">— total {usdt(sw?.locked ?? 0)}</span></p>
                <div className="space-y-2 mt-3">
                  {stakes.map(st => (
                    <div key={st.id} className="flex items-center gap-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-3.5 py-2.5">
                      <span className="flex-1 min-w-0 text-sm"><b>🌱 Stake</b> <span className="text-slate-400 text-xs block">{st.apy}% APY · {st.termDays === 0 ? 'Flexible' : st.termDays + ' days'} · since {fmtDateTime(st.startAt)}</span></span>
                      <b className="text-sm">{usdt(st.amount)}</b>
                      <Btn variant="outline" className="!py-1.5 !text-xs" onClick={() => { adminReleaseStake(selUser.id, st.id); toast({ kind: 'success', title: 'Stake released to Available' }) }}>Release</Btn>
                    </div>
                  ))}
                  {pendWd.map(x => (
                    <div key={x.id} className="flex items-center gap-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-3.5 py-2.5">
                      <span className="flex-1 min-w-0 text-sm"><b>⏳ Cash Out pending</b> <span className="text-slate-400 text-xs block">{x.method} → {x.destination} · approve/reject it in Finance</span></span>
                      <b className="text-sm">{usdt(x.amount)}</b>
                    </div>
                  ))}
                  {(() => { const rem = (sw?.locked ?? 0) - stakes.reduce((a, st) => a + st.amount, 0) - pendWd.reduce((a, x) => a + x.amount, 0); return rem > 0 ? (
                    <div className="flex items-center gap-2.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 px-3.5 py-2.5">
                      <span className="flex-1 min-w-0 text-sm"><b>🔒 Other holds</b> <span className="text-slate-400 text-xs block">No stake or cash-out record behind this part (platform / legacy hold) — Clear ALL below releases it.</span></span>
                      <b className="text-sm">{usdt(rem)}</b>
                    </div>) : null })()}
                  {stakes.length === 0 && pendWd.length === 0 && (sw?.locked ?? 0) === 0 && <p className="text-sm text-slate-400">Nothing locked for this customer.</p>}
                  {stakes.length === 0 && pendWd.length === 0 && (sw?.locked ?? 0) > 0 && <p className="text-sm text-slate-400">This locked amount has no stake or cash-out record (legacy/other hold) — Clear all releases it.</p>}
                </div>
                {(sw?.locked ?? 0) > 0 && (
                  <Btn variant="danger" className="w-full mt-3" onClick={() => { if (!mClearArm) { setMClearArm(true); setTimeout(() => setMClearArm(false), 4000); return } adminClearLocked(selUser.id); setMClearArm(false); toast({ kind: 'success', title: 'All locked holdings cleared to Available' }) }}>{mClearArm ? '⚠️ Tap again to confirm — release ALL ' + usdt(sw?.locked ?? 0) + '?' : 'Clear ALL locked holdings'}</Btn>
                )}
                <p className="text-[11px] text-slate-400 mt-1.5">Clear-all closes every stake (no interest on a bulk clear — release stakes one by one above to pay interest), cancels pending cash outs, and moves the whole locked amount to Available. Audited + notified.</p>
              </div>
              {/* Loan limit */}
              <div>
                <p className="font-extrabold text-sm mb-2">Loan limit</p>
                <p className="text-xs text-slate-400 mb-2">Level {selUser.level} default: <b>{usdt(lvlDef?.loanLimit ?? 0)}</b> · Current: <b>{selUser.loanLimitOverride ? usdt(selUser.loanLimitOverride) + ' (custom)' : 'level default'}</b></p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1"><Input label="Personal loan limit (USDT)" type="number" value={mLoanLimit} onChange={e => setMLoanLimit(e.target.value)} /></div>
                  <Btn className="!py-3" onClick={() => { const a = Number(mLoanLimit); if (!a || a <= 0) return toast({ kind: 'error', title: 'Enter a loan limit' }); setUserLoanLimit(selUser.id, Math.round(a * db.settings.bdtPerUsd)); toast({ kind: 'success', title: 'Loan limit updated' }) }}>Save</Btn>
                </div>
                {selUser.loanLimitOverride ? <Btn variant="ghost" className="!py-1.5 !text-xs mt-1" onClick={() => { setUserLoanLimit(selUser.id, null); setMLoanLimit(''); toast({ kind: 'success', title: 'Loan limit reset to level default' }) }}>Reset to level default</Btn> : null}
              </div>
              {/* Statement */}
              <div>
                <p className="font-extrabold text-sm mb-2">Statement <span className="text-slate-400 font-semibold">— latest activity (also in Transactions tab)</span></p>
                {stmt.length === 0 ? <p className="text-sm text-slate-400">No transactions yet.</p> : (
                  <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                    {stmt.map(tx => { const dir = txDirection(tx.category, tx.amount); return (
                      <button key={tx.id} onClick={() => copyTxId(tx.id)} title="Copy transaction ID" className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left">
                        <TxDirIcon dir={dir} />
                        <span className="flex-1 min-w-0"><span className="block font-bold text-[13px] truncate">{tx.title}</span><span className="block text-[11px] text-slate-400 truncate">{tx.id} · {fmtDateTime(tx.createdAt)}{tx.note ? ' · ' + tx.note : ''}</span></span>
                        <span className="text-right"><span className={`block font-extrabold text-[13px] ${txAmountCls(dir)}`}>{txSign(dir)}{usdt(Math.abs(tx.amount))}</span><Badge tone={statusTone(tx.status)}>{tx.status}</Badge></span>
                      </button>
                    ) })}
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </Modal>
      <Modal open={!!newsForm} onClose={() => setNewsForm(null)} title={newsForm?.id ? 'Edit news' : 'Publish news'}>
        {newsForm && (
          <div className="space-y-4">
            <Input label="Title" value={newsForm.title} onChange={e => setNewsForm((n: any) => ({ ...n, title: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Category" value={newsForm.category} onChange={(e: any) => setNewsForm((n: any) => ({ ...n, category: e.target.value }))}>{['Bitcoin', 'Ethereum', 'Market Analysis', 'Blockchain', 'Trading'].map(c => <option key={c}>{c}</option>)}</Select>
              <Input label="Source" value={newsForm.source} onChange={e => setNewsForm((n: any) => ({ ...n, source: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Crypto logo shown on the card" value={newsForm.coin ?? 'NOVA'} onChange={(e: any) => setNewsForm((n: any) => ({ ...n, coin: e.target.value }))}>{['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'NOVA'].map(c => <option key={c} value={c}>{c === 'NOVA' ? 'NovaWallet logo' : c + ' logo'}</option>)}</Select>
            </div>
            <Input label="Excerpt" value={newsForm.excerpt} onChange={e => setNewsForm((n: any) => ({ ...n, excerpt: e.target.value }))} />
            <Input label="Body (paragraphs split by blank line)" value={newsForm.body} onChange={e => setNewsForm((n: any) => ({ ...n, body: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={!!newsForm.featured} onChange={e => setNewsForm((n: any) => ({ ...n, featured: e.target.checked }))} className="w-4 h-4 accent-violet-600" /> Featured story</label>
            <Btn className="w-full" onClick={() => { publishNews(newsForm); setNewsForm(null); toast({ kind: 'success', title: 'News saved' }) }}>Save news</Btn>
          </div>
        )}
      </Modal>
    </div>
  )
}


const SUP_TONE = (st: string) => st === 'pending' ? 'amber' : st === 'processing' ? 'violet' : 'green'

function SupportChat() {
  const { db, replyTicket, resolveTicket, toast } = useApp()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [sel, setSel] = useState<string | null>(null)
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const userOf = (id: string) => db.users.find(u => u.id === id)
  const list = db.tickets.filter(tk => {
    const u = userOf(tk.userId)
    const hay = `${u?.name ?? ''} @${u?.username ?? ''} ${u?.email ?? ''} ${tk.subject}`.toLowerCase()
    return (filter === 'all' || tk.status === filter) && hay.includes(q.trim().toLowerCase())
  }).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const tk = sel ? db.tickets.find(x => x.id === sel) : undefined
  useEffect(() => { if (tk && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight })
  const send = () => { if (tk && text.trim()) { replyTicket(tk.id, text, 'admin'); setText('') } }
  const tku = tk ? userOf(tk.userId) : undefined
  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        <Input placeholder="Search by username or email…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {['all', 'pending', 'processing', 'resolved'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-bold capitalize ${filter === f ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500'}`}>{f}{f !== 'all' ? ` (${db.tickets.filter(t => t.status === f).length})` : ''}</button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {list.length === 0 ? <Card><Empty title="No support chats" body="Nothing matches this search or filter." /></Card> : list.map(x => {
          const u = userOf(x.userId); const last = x.messages[x.messages.length - 1]
          return (
            <button key={x.id} onClick={() => setSel(x.id)} className="w-full text-left">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={u?.name ?? '?'} photo={u?.photo} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{x.subject}</p>
                    <p className="text-xs text-slate-400 truncate">{u?.name} · @{u?.username} · {u?.email}</p>
                    {last && <p className="text-xs text-slate-500 truncate mt-0.5">{last.from === 'admin' ? 'Support: ' : ''}{last.text}</p>}
                  </div>
                  <div className="text-right shrink-0"><Badge tone={SUP_TONE(x.status)}>{x.status}</Badge><p className="text-[10px] text-slate-400 mt-1">{fmtDateTime(x.updatedAt)}</p></div>
                </div>
              </Card>
            </button>
          )
        })}
      </div>
      <Modal open={!!tk} onClose={() => { setSel(null); setText('') }} title={tk?.subject ?? 'Support chat'}>
        {tk && (
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-4">
              <Avatar name={tku?.name ?? '?'} photo={tku?.photo} />
              <div className="flex-1 min-w-0"><p className="font-extrabold truncate">{tku?.name}</p><p className="text-xs text-slate-400 truncate">@{tku?.username} · {tku?.email}</p></div>
              <Badge tone={SUP_TONE(tk.status)}>{tk.status}</Badge>
              {tk.status !== 'resolved' && <Btn className="!py-2 !text-xs !bg-emerald-500" onClick={() => { resolveTicket(tk.id); toast({ kind: 'success', title: 'Chat resolved & closed' }) }}>✓ Mark Resolved</Btn>}
            </div>
            <div ref={scrollRef} className="h-[46vh] overflow-y-auto rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3 space-y-2.5 mb-3">
              {tk.messages.map(m => (
                <div key={m.id} className={`flex ${m.from === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm ${m.from === 'admin' ? 'bg-violet-600 text-white rounded-br-md' : 'bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60 rounded-bl-md'}`}>
                    {m.from === 'user' && <p className="text-[10px] font-extrabold text-violet-500 mb-0.5">{tku?.name}</p>}
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p className={`text-[10px] mt-1 ${m.from === 'admin' ? 'text-violet-200' : 'text-slate-400'}`}>{fmtDateTime(m.at)}</p>
                  </div>
                </div>
              ))}
            </div>
            {tk.status === 'resolved' ? (
              <p className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl px-3.5 py-3">This chat is resolved and closed. The customer must open a new chat for further help.</p>
            ) : (
              <div className="flex gap-2">
                <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} placeholder="Type your reply… (first reply: Pending → Processing)" className="flex-1 min-w-0 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium outline-none focus:border-violet-400" />
                <Btn className="!px-5 shrink-0" onClick={send}>Send</Btn>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
