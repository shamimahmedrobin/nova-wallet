import { useMemo, useState } from 'react'
import { Copy, HandCoins, Share2, Trophy } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Badge, Btn, Card, Empty, Input, Modal, ModalDesc, ModalRow, Select } from '../components/ui'
import { emiCalc, fmtBDT, fmtDateTime , fileToScaledDataUrl } from '../lib/utils'
import { PageHead } from './Services'

export function Referral() {
  const { user, db, toast, t, fmtMoney } = useApp()
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
        <p className="text-4xl font-extrabold mt-1">{fmtMoney(totalEarned)}</p>
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
            <span className="font-extrabold text-violet-600">{fmtMoney(r.earned)}</span>
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
          <Card key={e.id} className="p-4 flex items-center gap-3"><div className="flex-1"><p className="font-bold">Commission from {e.fromUser}</p><p className="text-xs text-slate-400">{fmtDateTime(e.createdAt)}</p></div><span className="font-extrabold text-emerald-600">+{fmtMoney(e.amount)}</span></Card>
        ))}</div>
      )}
    </div>
  )
}

export function LoanPage() {
  const { user, db, applyLoan, repayLoan, submitLoanFee, toast, t, currency, fmtMoney, toBDT } = useApp()
  const [amount, setAmount] = useState('30000'); const [months, setMonths] = useState('12'); const [repayAmt, setRepayAmt] = useState<Record<string, string>>({})
  const [appName, setAppName] = useState(user?.name ?? ''); const [code, setCode] = useState('+880'); const [phoneNum, setPhoneNum] = useState(user?.phone ?? '')
  const [whatsapp, setWhatsapp] = useState(''); const [nid, setNid] = useState(''); const [photo, setPhoto] = useState('')
  const [gName, setGName] = useState(''); const [gPhone, setGPhone] = useState('')
  const [feePay, setFeePay] = useState<string | null>(null); const [feeMethod, setFeeMethod] = useState(''); const [feeRef, setFeeRef] = useState('')
  if (!user) return null
  const s = db.settings
  const amt = Number(amount) || 0; const mo = Number(months) || 12
  const amtBDT = Math.round(toBDT(amt))
  const calc = emiCalc(amtBDT, s.loanRatePct, mo)
  const myLoans = db.loans.filter(l => l.userId === user.id)
  const active = myLoans.find(l => l.status === 'active')
  const outstanding = active ? active.totalPayable - active.paid : 0
  const submit = () => {
    if (!appName.trim()) return toast({ kind: 'error', title: 'Enter your full name' })
    if (phoneNum.replace(/\D/g, '').length < 6) return toast({ kind: 'error', title: 'Enter your phone number' })
    if (!whatsapp.trim()) return toast({ kind: 'error', title: 'Enter your WhatsApp number' })
    if (!nid.trim()) return toast({ kind: 'error', title: 'Enter your National ID number' })
    if (!photo) return toast({ kind: 'error', title: 'Upload your photo' })
    if (!gName.trim() || !gPhone.trim()) return toast({ kind: 'error', title: 'Enter guarantor name and mobile number' })
    if (amtBDT < s.minLoan || amtBDT > s.maxLoan) return toast({ kind: 'error', title: `Loan amount must be between ${fmtMoney(s.minLoan)} and ${fmtMoney(s.maxLoan)}` })
    const lvlDef = db.levels.find(l => l.level === user.level)
    if (lvlDef && amtBDT > lvlDef.loanLimit) return toast({ kind: 'error', title: `Your Level ${user.level} loan limit is ${fmtMoney(lvlDef.loanLimit)} — upgrade your level for a higher limit.` })
    applyLoan(amtBDT, mo, { applicantName: appName.trim(), phone: code + ' ' + phoneNum.trim(), whatsapp: whatsapp.trim(), nid: nid.trim(), photo, guarantorName: gName.trim(), guarantorPhone: gPhone.trim() }); toast({ kind: 'success', title: 'Application submitted', body: 'An admin will review your information. Loans are never auto-approved.' })
  }
  return (
    <div>
      <PageHead title={t('loan_title')} sub={t('loan_sub')} />
      <Modal open={!!feePay} onClose={() => setFeePay(null)} title="Pay processing fee">
        {(() => {
          const loan = db.loans.find(l => l.id === feePay); if (!loan) return null
          const methods = db.settings.payMethods ?? []
          const sel = methods.find(m => m.id === feeMethod) ?? methods[0]
          return (
            <div>
              <ModalDesc>Pay <b>{fmtMoney(loan.processingFee ?? 0)}</b> for loan {loan.id} using any option below — the same payment options as on the main website.</ModalDesc>
              <div className="space-y-2">
                {methods.map(m => (
                  <button key={m.id} onClick={() => setFeeMethod(m.id)} className="w-full text-left">
                    <ModalRow><span className="flex items-center gap-2.5"><span className={`w-4 h-4 rounded-full border-2 shrink-0 ${sel?.id === m.id ? 'bg-violet-600 border-violet-600' : 'border-slate-300 dark:border-slate-600'}`} /><span className="font-bold text-sm">{m.label}</span></span></ModalRow>
                  </button>
                ))}
              </div>
              {sel && (
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 mt-3">
                  <p className="text-[11px] text-slate-400 font-bold">SEND PAYMENT TO</p>
                  <p className="font-mono font-bold break-all mt-0.5">{sel.detail}</p>
                </div>
              )}
              <div className="mt-4"><Input label="Your TrxID / sender number" placeholder="e.g. 9HX7K2LMN or 01XXXXXXXXX" value={feeRef} onChange={e => setFeeRef(e.target.value)} /></div>
              <Btn className="w-full py-3.5 mt-4" onClick={() => { if (!feeRef.trim()) return toast({ kind: 'error', title: 'Enter the TrxID or sender number' }); submitLoanFee(loan.id, sel?.label ?? '', feeRef.trim()); setFeePay(null); toast({ kind: 'success', title: 'Payment submitted', body: 'The admin will confirm your payment shortly.' }) }}>Submit payment</Btn>
            </div>
          )
        })()}
      </Modal>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-4 text-center"><p className="text-[11px] text-slate-400 uppercase font-bold">Loan limit</p><p className="font-extrabold mt-1">{fmtMoney(s.loanLimit)}</p></Card>
        <Card className="p-4 text-center"><p className="text-[11px] text-slate-400 uppercase font-bold">Outstanding</p><p className="font-extrabold mt-1 text-rose-500">{fmtMoney(outstanding)}</p></Card>
        <Card className="p-4 text-center"><p className="text-[11px] text-slate-400 uppercase font-bold">Account level</p><p className="font-extrabold mt-1">Level {user.level}</p></Card>
      </div>
      {myLoans.filter(l => l.processingFee).length > 0 && (
        <Card className="p-5 mb-4 border-l-4 !border-l-amber-500">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0"><HandCoins size={20} /></span>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold">Loan processing fee</p>
              <p className="text-xs text-slate-500 mt-0.5">An admin set a processing fee for your application. Pay it here to continue.</p>
            </div>
          </div>
          <div className="space-y-2 mt-4">
            {myLoans.filter(l => l.processingFee).map(l => (
              <div key={l.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{l.id} · Loan {fmtMoney(l.amount)}</p>
                  <p className="text-xs text-slate-500">Processing fee: <b className="text-slate-700 dark:text-slate-200">{fmtMoney(l.processingFee ?? 0)}</b></p>
                </div>
                {l.feeStatus === 'paid' ? <Badge tone="green">✓ Paid</Badge>
                  : l.feeStatus === 'submitted' ? <Badge tone="violet">Confirming…</Badge>
                  : <Btn className="!py-2 !text-xs shrink-0" onClick={() => { setFeePay(l.id); setFeeMethod(db.settings.payMethods?.[0]?.id ?? ''); setFeeRef('') }}>Pay</Btn>}
              </div>
            ))}
          </div>
        </Card>
      )}
      {active && (
        <Card className="p-5 mb-4 border-l-4 !border-l-violet-500">
          <div className="flex justify-between items-start"><div><p className="font-extrabold">Active loan {active.id}</p><p className="text-sm text-slate-500">{fmtMoney(active.amount)} · {active.months} months · EMI {fmtMoney(active.emi)}</p></div><Badge tone="green">Active</Badge></div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-3 overflow-hidden"><div className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full" style={{ width: Math.min(100, active.paid / active.totalPayable * 100) + '%' }} /></div>
          <p className="text-xs text-slate-500 mt-2">Paid {fmtMoney(active.paid)} of {fmtMoney(active.totalPayable)} · Remaining {fmtMoney(outstanding)}</p>
          <div className="flex gap-2 mt-3">
            <Input type="number" placeholder={`Repayment (${currency})`} value={repayAmt[active.id] ?? ''} onChange={e => setRepayAmt(r => ({ ...r, [active.id]: e.target.value }))} />
            <Btn onClick={() => { const err = repayLoan(active, Math.round(toBDT(Number(repayAmt[active.id]) || 0))); if (err) toast({ kind: 'error', title: err }); else toast({ kind: 'success', title: 'Repayment recorded' }) }}>Repay</Btn>
          </div>
        </Card>
      )}
      <Card className="p-5 space-y-4">
        <h3 className="font-extrabold">Apply for a loan</h3>
        <Input label={`Amount in ${currency} (min ${fmtMoney(s.minLoan)} – max ${fmtMoney(s.maxLoan)})`} type="number" value={amount} onChange={e => setAmount(e.target.value)} />
        {currency !== 'BDT' && amt > 0 && <p className="text-xs text-slate-400 -mt-2">≈ {fmtBDT(amtBDT)} — loans are processed in BDT at today's rate.</p>}
        <Select label="Duration" value={months} onChange={(e: any) => setMonths(e.target.value)}>
          {[3, 6, 12, 18, 24].map(m => <option key={m} value={m}>{m} months</option>)}
        </Select>
        <div className="rounded-2xl border-2 border-slate-200/70 dark:border-slate-700/60 p-4 space-y-4">
          <p className="font-extrabold text-sm">Applicant &amp; guarantor information <span className="text-slate-400 font-semibold">(required at any account level)</span></p>
          <Input label="Full name" value={appName} onChange={e => setAppName(e.target.value)} />
          <div className="flex gap-2">
            <div className="w-[118px] shrink-0">
              <Select label="Code" value={code} onChange={(e: any) => setCode(e.target.value)}>
                {['+880', '+91', '+92', '+1', '+44', '+971', '+966', '+60'].map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="flex-1 min-w-0"><Input label="Phone number" placeholder="1XXXXXXXXX" value={phoneNum} onChange={e => setPhoneNum(e.target.value)} /></div>
          </div>
          <Input label="WhatsApp number" placeholder="01XXXXXXXXX" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
          <Input label="National ID (NID) number" placeholder="e.g. 1234567890" value={nid} onChange={e => setNid(e.target.value)} />
          <div>
            <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Your photo</span>
            <label className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 px-4 py-3 cursor-pointer">
              {photo ? <img src={photo} alt="Applicant" className="w-12 h-12 rounded-xl object-cover" /> : <span className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl">📷</span>}
              <span className="text-sm font-bold text-violet-600">{photo ? 'Photo added — tap to change' : 'Tap to upload your photo'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) setPhoto(await fileToScaledDataUrl(f)) }} />
            </label>
          </div>
          <Input label="Guarantor — full name" placeholder="Name of your guarantor" value={gName} onChange={e => setGName(e.target.value)} />
          <Input label="Guarantor — mobile number" placeholder="01XXXXXXXXX" value={gPhone} onChange={e => setGPhone(e.target.value)} />
        </div>
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Interest rate</span><span className="font-bold">{s.loanRatePct}% / year</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Service charge</span><span className="font-bold">৳0</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Total interest</span><span className="font-bold">{fmtMoney(Math.round(calc.interest))}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Monthly EMI</span><span className="font-bold text-violet-600">{fmtMoney(Math.round(calc.emi))}</span></div>
          <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2"><span className="text-slate-500">Total payable</span><span className="font-extrabold">{fmtMoney(Math.round(calc.total))}</span></div>
        </div>
        <Btn className="w-full py-3.5" onClick={submit}>Submit application for admin review</Btn>
      </Card>
      <h3 className="font-extrabold mt-6 mb-3">My applications & repayment history</h3>
      {myLoans.length === 0 ? <Card><Empty title="No loans yet" /></Card> : (
        <div className="space-y-2">{myLoans.map(l => (
          <Card key={l.id} className="p-4 flex items-center gap-3">
            <div className="flex-1"><p className="font-bold">{l.id} · {fmtMoney(l.amount)}</p><p className="text-xs text-slate-400">{l.months} mo · EMI {fmtMoney(l.emi)} · Paid {fmtMoney(l.paid)} / {fmtMoney(l.totalPayable)} · {fmtDateTime(l.createdAt)}</p></div>
            <Badge tone={l.status === 'active' || l.status === 'repaid' ? 'green' : l.status === 'pending' ? 'amber' : 'red'}>{l.status}</Badge>
          </Card>
        ))}</div>
      )}
    </div>
  )
}
