import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Share2, Trophy } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Badge, Btn, Card, Empty, Input, Select } from '../components/ui'
import { emiCalc, fmtBDT, fmtDateTime } from '../lib/utils'
import { PageHead } from './Services'
import { Level2GateModal } from './Extras'

export function Referral() {
  const { user, db, toast, t } = useApp()
  if (!user) return null
  const link = `${location.origin}${import.meta.env.BASE_URL}register?ref=${user.referralCode}`
  const refs = db.users.filter(u => u.referredBy === user.id)
  const earnings = db.referralEarnings.filter(r => r.userId === user.id)
  const totalEarned = earnings.reduce((s, r) => s + r.amount, 0)
  const leaderboard = useMemo(() => {
    return db.users.filter(u => u.role === 'user').map(u => ({
      u, count: db.users.filter(x => x.referredBy === u.id).length,
      earned: db.referralEarnings.filter(r => r.userId === u.id).reduce((s, r) => s + r.amount, 0),
    })).sort((a, b) => b.earned - a.earned).slice(0, 5)
  }, [db])
  const copy = (t: string, l: string) => { navigator.clipboard?.writeText(t); toast({ kind: 'success', title: l + ' copied' }) }
  return (
    <div>
      <PageHead title={t('ref_title')} sub={`${db.settings.referralPct}% ${t('commission_rate')}`} />
      <div className="rounded-[28px] bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white p-6 shadow-xl shadow-orange-500/25">
        <p className="text-xs uppercase tracking-widest font-bold text-white/75">Total referral earnings</p>
        <p className="text-4xl font-extrabold mt-1">{fmtBDT(totalEarned)}</p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-2xl bg-white/15 p-3"><p className="text-[11px] text-white/75">Total referred</p><p className="font-extrabold text-lg">{refs.length}</p></div>
          <div className="rounded-2xl bg-white/15 p-3"><p className="text-[11px] text-white/75">Active referrals</p><p className="font-extrabold text-lg">{refs.filter(r => r.kyc === 'verified').length}</p></div>
        </div>
      </div>
      <Card className="p-5 mt-4 space-y-3">
        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-4 py-3">
          <div className="flex-1 min-w-0"><p className="text-[11px] text-slate-400 uppercase font-bold">Your referral code</p><p className="font-mono font-extrabold text-lg">{user.referralCode}</p></div>
          <button onClick={() => copy(user.referralCode, 'Code')} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 shadow"><Copy size={16} /></button>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-4 py-3">
          <div className="flex-1 min-w-0"><p className="text-[11px] text-slate-400 uppercase font-bold">Referral link</p><p className="font-mono text-xs truncate">{link}</p></div>
          <button onClick={() => copy(link, 'Link')} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 shadow"><Copy size={16} /></button>
        </div>
        <Btn className="w-full" onClick={() => { if (navigator.share) navigator.share({ title: 'Join NovaWallet', text: 'Join NovaWallet with my code ' + user.referralCode, url: link }); else copy(link, 'Link') }}><Share2 size={16} /> Share invite</Btn>
        <p className="text-[11px] text-slate-400 text-center">Anti-fraud: self-referrals and duplicate accounts are automatically blocked.</p>
      </Card>

      <h3 className="font-extrabold mt-6 mb-3 flex items-center gap-2"><Trophy size={18} className="text-amber-500" /> Leaderboard</h3>
      <Card className="p-2">
        {leaderboard.map((r, i) => (
          <div key={r.u.id} className="flex items-center gap-3 p-3">
            <span className={`w-7 text-center font-extrabold ${i === 0 ? 'text-amber-500' : 'text-slate-400'}`}>{i + 1}</span>
            <Avatar name={r.u.name} size={36} />
            <div className="flex-1"><p className="font-bold text-sm">{r.u.name}{r.u.id === user.id && ' (You)'}</p><p className="text-xs text-slate-400">{r.count} referrals</p></div>
            <span className="font-extrabold text-violet-600">{fmtBDT(r.earned)}</span>
          </div>
        ))}
      </Card>

      <h3 className="font-extrabold mt-6 mb-3">My referrals</h3>
      {refs.length === 0 ? <Card><Empty title="No referrals yet" body="Share your link to start earning." /></Card> : (
        <div className="space-y-2">{refs.map(r => (
          <Card key={r.id} className="p-4 flex items-center gap-3"><Avatar name={r.name} /><div className="flex-1"><p className="font-bold">{r.name}</p><p className="text-xs text-slate-400">Joined {fmtDateTime(r.createdAt)}</p></div><Badge tone={r.kyc === 'verified' ? 'green' : 'amber'}>{r.kyc === 'verified' ? 'Active' : r.kyc}</Badge></Card>
        ))}</div>
      )}
      <h3 className="font-extrabold mt-6 mb-3">Earnings history</h3>
      {earnings.length === 0 ? <Card><Empty title="No earnings yet" /></Card> : (
        <div className="space-y-2">{earnings.map(e => (
          <Card key={e.id} className="p-4 flex items-center gap-3"><div className="flex-1"><p className="font-bold">Commission from {e.fromUser}</p><p className="text-xs text-slate-400">{fmtDateTime(e.createdAt)}</p></div><span className="font-extrabold text-emerald-600">+{fmtBDT(e.amount)}</span></Card>
        ))}</div>
      )}
    </div>
  )
}

export function LoanPage() {
  const { user, db, applyLoan, repayLoan, toast, t } = useApp()
  const navigate = useNavigate()
  const [amount, setAmount] = useState('30000'); const [months, setMonths] = useState('12'); const [repayAmt, setRepayAmt] = useState<Record<string, string>>({})
  const [gate, setGate] = useState(false)
  if (!user) return null
  const s = db.settings
  const amt = Number(amount) || 0; const mo = Number(months) || 12
  const calc = emiCalc(amt, s.loanRatePct, mo)
  const myLoans = db.loans.filter(l => l.userId === user.id)
  const active = myLoans.find(l => l.status === 'active')
  const outstanding = active ? active.totalPayable - active.paid : 0
  const eligible = user.kyc !== 'unverified' && user.status === 'active'
  const submit = () => {
    if (user.level < 2) return setGate(true)
    if (!eligible) return toast({ kind: 'error', title: t('kyc_need_loan') })
    if (amt < s.minLoan || amt > s.maxLoan) return toast({ kind: 'error', title: `Loan amount must be between ${fmtBDT(s.minLoan)} and ${fmtBDT(s.maxLoan)}` })
    applyLoan(amt, mo); toast({ kind: 'success', title: 'Application submitted', body: 'An admin will review it. Loans are never auto-approved.' })
  }
  return (
    <div>
      <PageHead title={t('loan_title')} sub={t('loan_sub')} />
      <Level2GateModal open={gate} onClose={() => setGate(false)} feature="Loans" />
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-4 text-center"><p className="text-[11px] text-slate-400 uppercase font-bold">Loan limit</p><p className="font-extrabold mt-1">{fmtBDT(s.loanLimit)}</p></Card>
        <Card className="p-4 text-center"><p className="text-[11px] text-slate-400 uppercase font-bold">Outstanding</p><p className="font-extrabold mt-1 text-rose-500">{fmtBDT(outstanding)}</p></Card>
        <Card className="p-4 text-center"><p className="text-[11px] text-slate-400 uppercase font-bold">Eligibility</p><p className="font-extrabold mt-1">{eligible ? '✅ Eligible' : '⚠️ ' + t('p_kyc')}</p></Card>
      </div>
      {active && (
        <Card className="p-5 mb-4 border-l-4 !border-l-violet-500">
          <div className="flex justify-between items-start"><div><p className="font-extrabold">Active loan {active.id}</p><p className="text-sm text-slate-500">{fmtBDT(active.amount)} · {active.months} months · EMI {fmtBDT(active.emi)}</p></div><Badge tone="green">Active</Badge></div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden"><div className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full" style={{ width: Math.min(100, active.paid / active.totalPayable * 100) + '%' }} /></div>
          <p className="text-xs text-slate-500 mt-2">Paid {fmtBDT(active.paid)} of {fmtBDT(active.totalPayable)} · Remaining {fmtBDT(outstanding)}</p>
          <div className="flex gap-2 mt-3">
            <Input type="number" placeholder="Repayment amount" value={repayAmt[active.id] ?? ''} onChange={e => setRepayAmt(r => ({ ...r, [active.id]: e.target.value }))} />
            <Btn onClick={() => { const err = repayLoan(active, Number(repayAmt[active.id])); if (err) toast({ kind: 'error', title: err }); else toast({ kind: 'success', title: 'Repayment recorded' }) }}>Repay</Btn>
          </div>
        </Card>
      )}
      {user.kyc === 'unverified' && (
        <Card className="p-4 mb-4 border-l-4 !border-l-amber-500">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{t('kyc_need_loan')}</p>
          <Btn variant="outline" className="w-full mt-3" onClick={() => navigate('/profile')}>{t('kyc_do_now')}</Btn>
        </Card>
      )}
      <Card className="p-5 space-y-4">
        <h3 className="font-extrabold">Apply for a loan</h3>
        <Input label={`Amount (min ${fmtBDT(s.minLoan)} – max ${fmtBDT(s.maxLoan)})`} type="number" value={amount} onChange={e => setAmount(e.target.value)} />
        <Select label="Duration" value={months} onChange={(e: any) => setMonths(e.target.value)}>
          {[3, 6, 12, 18, 24].map(m => <option key={m} value={m}>{m} months</option>)}
        </Select>
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Interest rate</span><span className="font-bold">{s.loanRatePct}% / year</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Service charge</span><span className="font-bold">৳0</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Total interest</span><span className="font-bold">{fmtBDT(Math.round(calc.interest))}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Monthly EMI</span><span className="font-bold text-violet-600">{fmtBDT(Math.round(calc.emi))}</span></div>
          <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2"><span className="text-slate-500">Total payable</span><span className="font-extrabold">{fmtBDT(Math.round(calc.total))}</span></div>
        </div>
        <Btn className="w-full py-3.5" onClick={submit}>Submit application for admin review</Btn>
      </Card>
      <h3 className="font-extrabold mt-6 mb-3">My applications & repayment history</h3>
      {myLoans.length === 0 ? <Card><Empty title="No loans yet" /></Card> : (
        <div className="space-y-2">{myLoans.map(l => (
          <Card key={l.id} className="p-4 flex items-center gap-3">
            <div className="flex-1"><p className="font-bold">{l.id} · {fmtBDT(l.amount)}</p><p className="text-xs text-slate-400">{l.months} mo · EMI {fmtBDT(l.emi)} · Paid {fmtBDT(l.paid)} / {fmtBDT(l.totalPayable)} · {fmtDateTime(l.createdAt)}</p></div>
            <Badge tone={l.status === 'active' || l.status === 'repaid' ? 'green' : l.status === 'pending' ? 'amber' : 'red'}>{l.status}</Badge>
          </Card>
        ))}</div>
      )}
    </div>
  )
}
