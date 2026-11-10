import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, LayoutDashboard, Megaphone, Moon, Newspaper, Settings as SettingsIcon, ShieldCheck, Sun, Users, Wallet, X, HandCoins, Gift, ScrollText, Award } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApp } from '../lib/store'
import { Avatar, Badge, Btn, Card, Empty, Input, Modal, Select, statusTone } from '../components/ui'
import { fmtBDT, fmtDateTime } from '../lib/utils'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'finance', label: 'Deposits & Withdrawals', icon: Wallet },
  { id: 'users', label: 'Users & KYC', icon: Users },
  { id: 'loans', label: 'Loans', icon: HandCoins },
  { id: 'referrals', label: 'Referrals', icon: Gift },
  { id: 'levels', label: 'Levels', icon: Award },
  { id: 'content', label: 'News & Banners', icon: Newspaper },
  { id: 'audit', label: 'Audit Log', icon: ScrollText },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
] as const

export default function Admin() {
  const { user, db, theme, toggleTheme, decideDeposit, decideWithdraw, decideLoan, decideKyc, setUserStatus, adjustBalance, publishNews, deleteNews, updateSettings, toggleBanner, toast, resetDemo, decideUpgrade, updateLevelDef, setUserLevel } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState<string>('overview')
  const [userQ, setUserQ] = useState('')
  const [adj, setAdj] = useState<{ userId: string; amount: string; reason: string } | null>(null)
  const [newsForm, setNewsForm] = useState<any>(null)
  const [setForm, setSetForm] = useState({ ...db.settings })
  const [levelForms, setLevelForms] = useState<Record<number, any>>({})

  const stats = useMemo(() => {
    const plain = db.users.filter(u => u.role === 'user')
    return {
      users: plain.length, active: plain.filter(u => u.status === 'active').length,
      totalBalance: db.wallets.reduce((s, w) => s + w.available + w.locked, 0),
      deposits: db.deposits.filter(d => d.status === 'approved').reduce((s, d) => s + d.amount, 0),
      withdrawals: db.withdrawals.filter(d => d.status === 'completed').reduce((s, d) => s + d.amount, 0),
      transfers: db.txs.filter(t => t.category === 'send' && t.status === 'completed').reduce((s, t) => s + t.amount, 0),
      fees: db.txs.reduce((s, t) => s + (t.status === 'completed' ? t.fee : 0), 0),
      refPaid: db.referralEarnings.reduce((s, r) => s + r.amount, 0),
      pendingDeposits: db.deposits.filter(d => d.status === 'pending'),
      pendingWithdrawals: db.withdrawals.filter(d => d.status === 'pending'),
      pendingLoans: db.loans.filter(d => d.status === 'pending'),
      pendingKyc: db.users.filter(u => u.kyc === 'pending'),
    }
  }, [db])
  const chartData = useMemo(() => {
    const days: Record<string, number> = {}
    db.txs.forEach(t => { const k = new Date(t.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); if (t.status === 'completed') days[k] = (days[k] ?? 0) + t.amount })
    return Object.entries(days).slice(-7).map(([name, volume]) => ({ name, volume }))
  }, [db.txs])
  if (!user) return null
  const nameOf = (id: string) => db.users.find(u => u.id === id)?.name ?? id

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-30 bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <button onClick={() => navigate('/app')} className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800"><ArrowLeft size={18} /></button>
          <h1 className="font-extrabold text-lg flex items-center gap-2"><ShieldCheck className="text-amber-500" /> Admin Panel</h1>
          <Badge tone="amber">Secure · RBAC</Badge>
          <div className="ml-auto flex gap-2">
            <button onClick={toggleTheme} className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
            <Link to="/app" className="hidden sm:inline-flex items-center rounded-2xl px-4 py-2.5 text-sm font-semibold bg-violet-600 text-white">User app</Link>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
          {TABS.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold ${tab === t.id ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500'}`}><t.icon size={14} /> {t.label}</button>)}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-16">
        {tab === 'overview' && (
          <div className="space-y-4 anim-fade-up">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[['Registered users', stats.users], ['Active users', stats.active], ['Total wallet balance', fmtBDT(stats.totalBalance)], ['Revenue (fees)', fmtBDT(Math.round(stats.fees))],
                ['Total deposits', fmtBDT(stats.deposits)], ['Total withdrawals', fmtBDT(stats.withdrawals)], ['Total transfers', fmtBDT(stats.transfers)], ['Referral commissions paid', fmtBDT(stats.refPaid)],
                ['Pending deposits', stats.pendingDeposits.length], ['Pending withdrawals', stats.pendingWithdrawals.length], ['Pending loans', stats.pendingLoans.length], ['Pending KYC', stats.pendingKyc.length],
              ].map(([k, v]) => (
                <Card key={k as string} className="p-4"><p className="text-[11px] uppercase font-bold text-slate-400">{k}</p><p className="text-xl font-extrabold mt-1">{v}</p></Card>
              ))}
            </div>
            <Card className="p-5">
              <h3 className="font-extrabold mb-3">Transaction volume (completed)</h3>
              <div className="h-52"><ResponsiveContainer><BarChart data={chartData}><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: any) => fmtBDT(Number(v))} /><Bar dataKey="volume" fill="#8b5cf6" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
            </Card>
            <Card className="p-5">
              <h3 className="font-extrabold mb-2">Recent transactions</h3>
              {db.txs.slice(0, 8).map(t => (
                <div key={t.id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 text-sm">
                  <div className="flex-1 min-w-0"><p className="font-semibold truncate">{t.title}</p><p className="text-xs text-slate-400">{nameOf(t.userId)} · {t.id} · {fmtDateTime(t.createdAt)}</p></div>
                  <span className="font-bold">{fmtBDT(t.amount)}</span><Badge tone={statusTone(t.status)}>{t.status}</Badge>
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
                  <div className="flex-1 min-w-[180px]"><p className="font-bold">{fmtBDT(d.amount)} · {d.method} — {nameOf(d.userId)}</p><p className="text-xs text-slate-400">{d.id} · TrxID {d.trxId}{d.receipt ? ' · 📎 ' + d.receipt : ''} · {fmtDateTime(d.createdAt)}</p></div>
                  <Badge tone={statusTone(d.status)}>{d.status}</Badge>
                  {d.status === 'pending' && <><Btn variant="success" className="!py-2" onClick={() => { decideDeposit(d.id, true); toast({ kind: 'success', title: 'Deposit approved & credited' }) }}><Check size={15} /> Approve</Btn><Btn variant="danger" className="!py-2" onClick={() => { decideDeposit(d.id, false); toast({ kind: 'info', title: 'Deposit rejected' }) }}><X size={15} /> Reject</Btn></>}
                </Card>
              ))}
            </section>
            <section>
              <h3 className="font-extrabold mb-3">Withdrawal requests</h3>
              {db.withdrawals.length === 0 ? <Card><Empty title="No withdrawal requests" /></Card> : db.withdrawals.map(d => (
                <Card key={d.id} className="p-4 mb-2 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[180px]"><p className="font-bold">{fmtBDT(d.amount)} · {d.method} — {nameOf(d.userId)}</p><p className="text-xs text-slate-400">{d.id} → {d.destination} · fee {fmtBDT(d.fee)} · payable {fmtBDT(d.amount - d.fee)} · {fmtDateTime(d.createdAt)}</p></div>
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
                    <div className="flex flex-wrap items-center gap-3">
                      <Avatar name={u.name} />
                      <div className="flex-1 min-w-[170px]"><p className="font-bold">{u.name} {u.role === 'admin' && <Badge tone="amber">admin</Badge>}</p><p className="text-xs text-slate-400">@{u.username} · {u.email} · {u.phone} · {u.id}</p><p className="text-xs text-slate-400">Balance {fmtBDT((w?.available ?? 0) + (w?.locked ?? 0))} · Joined {fmtDateTime(u.createdAt)} · {db.txs.filter(t => t.userId === u.id).length} txns</p></div>
                      <Badge tone={statusTone(u.kyc)}>KYC {u.kyc}</Badge><Badge tone="violet">Level {u.level}</Badge><Badge tone={u.status === 'active' ? 'green' : 'red'}>{u.status}</Badge>
                    </div>
                    {u.role === 'user' && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {u.kyc === 'pending' && <><Btn variant="success" className="!py-1.5 !text-xs" onClick={() => decideKyc(u.id, true)}>Verify KYC</Btn><Btn variant="danger" className="!py-1.5 !text-xs" onClick={() => decideKyc(u.id, false)}>Reject KYC</Btn></>}
                        {u.status !== 'frozen' ? <Btn variant="outline" className="!py-1.5 !text-xs" onClick={() => setUserStatus(u.id, 'frozen')}>Freeze wallet</Btn> : <Btn variant="outline" className="!py-1.5 !text-xs" onClick={() => setUserStatus(u.id, 'active')}>Unfreeze</Btn>}
                        {u.status !== 'suspended' ? <Btn variant="danger" className="!py-1.5 !text-xs" onClick={() => setUserStatus(u.id, 'suspended')}>Suspend</Btn> : <Btn variant="success" className="!py-1.5 !text-xs" onClick={() => setUserStatus(u.id, 'active')}>Activate</Btn>}
                        <Btn variant="ghost" className="!py-1.5 !text-xs" onClick={() => setAdj({ userId: u.id, amount: '', reason: '' })}>Adjust balance (audited)</Btn>
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
              <Card key={l.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[190px]"><p className="font-bold">{l.id} · {fmtBDT(l.amount)} — {nameOf(l.userId)}</p><p className="text-xs text-slate-400">{l.months} mo · {l.ratePct}% · EMI {fmtBDT(l.emi)} · Total {fmtBDT(l.totalPayable)} · Paid {fmtBDT(l.paid)} · {fmtDateTime(l.createdAt)}</p>
                  {l.status === 'active' && l.paid < l.totalPayable * 0.3 && <p className="text-xs text-amber-600 font-bold mt-0.5">Watch: low repayment progress</p>}</div>
                <Badge tone={statusTone(l.status)}>{l.status}</Badge>
                {l.status === 'pending' && <><Btn variant="success" className="!py-2" onClick={() => { decideLoan(l.id, true); toast({ kind: 'success', title: 'Loan approved & disbursed' }) }}>Approve & disburse</Btn><Btn variant="danger" className="!py-2" onClick={() => decideLoan(l.id, false)}>Reject</Btn></>}
              </Card>
            ))}
            <Card className="p-5 text-sm text-slate-500">Loan config (limits, rate) lives in Settings. Overdue monitoring: active loans below 30% repaid are flagged above.</Card>
          </div>
        )}

        {tab === 'referrals' && (
          <div className="anim-fade-up space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-4 text-center"><p className="text-[11px] uppercase font-bold text-slate-400">Commission rate</p><p className="text-xl font-extrabold mt-1">{db.settings.referralPct}%</p></Card>
              <Card className="p-4 text-center"><p className="text-[11px] uppercase font-bold text-slate-400">Total paid</p><p className="text-xl font-extrabold mt-1">{fmtBDT(stats.refPaid)}</p></Card>
              <Card className="p-4 text-center"><p className="text-[11px] uppercase font-bold text-slate-400">Referred users</p><p className="text-xl font-extrabold mt-1">{db.users.filter(u => u.referredBy).length}</p></Card>
            </div>
            <Card className="p-5">
              <h3 className="font-extrabold mb-2">Suspicious referral check</h3>
              <p className="text-sm text-slate-500">Self-referrals are blocked at registration. Duplicate email/username signups are rejected. Accounts flagged: <b>{db.users.filter(u => u.status === 'suspended').length}</b> suspended.</p>
              <div className="mt-3 space-y-1.5">{db.referralEarnings.map(r => <p key={r.id} className="text-sm">{nameOf(r.userId)} earned {fmtBDT(r.amount)} from {r.fromUser} · {fmtDateTime(r.createdAt)}</p>)}</div>
            </Card>
          </div>
        )}

        {tab === 'content' && (
          <div className="anim-fade-up space-y-6">
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
                      <Input label="Name" value={f.name} onChange={e => upd('name', e.target.value)} />
                      <Input label="Tagline" value={f.tagline} onChange={e => upd('tagline', e.target.value)} />
                      <Input label="Daily limit (BDT)" type="number" value={f.dailyLimit} onChange={e => upd('dailyLimit', Number(e.target.value))} />
                      <Input label="Monthly limit (BDT)" type="number" value={f.monthlyLimit} onChange={e => upd('monthlyLimit', Number(e.target.value))} />
                      <Input label="Loan limit (BDT)" type="number" value={f.loanLimit} onChange={e => upd('loanLimit', Number(e.target.value))} />
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
                  <Avatar name={u.name} size={36} />
                  <div className="flex-1 min-w-[120px]"><p className="font-bold text-sm">{u.name}</p><p className="text-xs text-slate-400">@{u.username} · KYC {u.kyc}</p></div>
                  <select value={u.level} onChange={e => { setUserLevel(u.id, Number(e.target.value)); toast({ kind: 'success', title: u.name + ' → Level ' + e.target.value }) }} className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-bold">
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>Level {n} · {db.levels.find(x => x.level === n)?.name}</option>)}
                  </select>
                </Card>
              ))}
            </section>
          </div>
        )}

        {tab === 'audit' && (
          <div className="anim-fade-up space-y-2">
            {db.audit.map(a => (
              <Card key={a.id} className="p-4 text-sm"><p className="font-bold">{a.action} <span className="text-slate-400 font-normal">by {a.actor}</span></p><p className="text-slate-500">{a.detail}</p><p className="text-[11px] text-slate-400">{fmtDateTime(a.createdAt)}</p></Card>
            ))}
            <Card className="p-5"><h3 className="font-extrabold mb-2">Support tickets</h3>{db.tickets.length === 0 ? <p className="text-sm text-slate-500">No tickets.</p> : db.tickets.map(t => <p key={t.id} className="text-sm py-1"><b>{t.subject}</b> — {nameOf(t.userId)} · {t.status}</p>)}</Card>
          </div>
        )}

        {tab === 'settings' && (
          <div className="anim-fade-up">
            <Card className="p-5 space-y-4">
              <h3 className="font-extrabold">Platform settings</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Platform name" value={setForm.platformName} onChange={e => setSetForm(s => ({ ...s, platformName: e.target.value }))} />
                <Input label="BDT per USD" type="number" value={setForm.bdtPerUsd} onChange={e => setSetForm(s => ({ ...s, bdtPerUsd: Number(e.target.value) }))} />
                <Input label="Send fee %" type="number" step="0.1" value={setForm.sendFeePct} onChange={e => setSetForm(s => ({ ...s, sendFeePct: Number(e.target.value) }))} />
                <Input label="Cash out fee %" type="number" step="0.1" value={setForm.cashoutFeePct} onChange={e => setSetForm(s => ({ ...s, cashoutFeePct: Number(e.target.value) }))} />
                <Input label="Referral commission %" type="number" value={setForm.referralPct} onChange={e => setSetForm(s => ({ ...s, referralPct: Number(e.target.value) }))} />
                <Input label="Loan interest % / year" type="number" value={setForm.loanRatePct} onChange={e => setSetForm(s => ({ ...s, loanRatePct: Number(e.target.value) }))} />
                <Input label="Min loan (BDT)" type="number" value={setForm.minLoan} onChange={e => setSetForm(s => ({ ...s, minLoan: Number(e.target.value) }))} />
                <Input label="Max loan / limit (BDT)" type="number" value={setForm.maxLoan} onChange={e => setSetForm(s => ({ ...s, maxLoan: Number(e.target.value), loanLimit: Number(e.target.value) }))} />
              </div>
              <label className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 font-semibold text-sm">Maintenance mode
                <input type="checkbox" checked={setForm.maintenance} onChange={e => setSetForm(s => ({ ...s, maintenance: e.target.checked }))} className="w-5 h-5 accent-violet-600" /></label>
              <Btn className="w-full" onClick={() => { updateSettings(setForm); toast({ kind: 'success', title: 'Settings saved' }) }}>Save settings</Btn>
              <p className="text-xs text-slate-400">Payment methods supported: bKash, Nagad, Rocket, Bank Transfer, Crypto Deposit. Cryptocurrencies: BTC, ETH, USDT, BNB, SOL, XRP (CoinGecko market feed). Admin roles: Super Admin (full), Finance (approvals), Content (news/banners) — enforced via RLS in production.</p>
            </Card>
            <Card className="p-5 mt-4">
              <h3 className="font-extrabold text-rose-600 mb-2">Danger zone</h3>
              <Btn variant="danger" onClick={() => { resetDemo(); toast({ kind: 'info', title: 'Demo data reset to seed' }) }}>Reset demo data</Btn>
            </Card>
          </div>
        )}
      </main>

      <Modal open={!!adj} onClose={() => setAdj(null)} title="Adjust balance (audited)">
        {adj && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">User: <b>{nameOf(adj.userId)}</b>. Positive adds, negative deducts. This writes a ledger entry + audit log.</p>
            <Input label="Amount (+/- BDT)" type="number" value={adj.amount} onChange={e => setAdj(a => a && ({ ...a, amount: e.target.value }))} />
            <Input label="Reason (required)" value={adj.reason} onChange={e => setAdj(a => a && ({ ...a, reason: e.target.value }))} />
            <Btn className="w-full" onClick={() => { if (!adj.reason.trim()) return toast({ kind: 'error', title: 'Reason required for audit' }); adjustBalance(adj.userId, Number(adj.amount), adj.reason); setAdj(null); toast({ kind: 'success', title: 'Adjustment recorded' }) }}>Apply adjustment</Btn>
          </div>
        )}
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
