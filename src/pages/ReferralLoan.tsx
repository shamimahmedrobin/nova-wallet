import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Award, CheckCircle2, Coins, Copy, FilePlus2, HandCoins, History as HistoryIcon, Share2, Trophy, Wallet, XCircle } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Badge, Btn, Card, CheckLine, Empty, Input, Modal, ModalDesc, ModalRow, PinField, Select, StepBar, WizardNav } from '../components/ui'
import { emiCalc, fmtDate, fmtDateTime, fmtUSDT, fileToScaledDataUrl } from '../lib/utils'
import { depositMethods, payMethodTitle, payMethodValue } from '../lib/localPayments'
import { PageHead, ResultModal, SuccessModal } from './Services'

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
            <Avatar name={r.u.name} size={36} photo={r.u.photo} />
            <div className="flex-1"><p className="font-bold text-sm">{r.u.name}{r.u.id === user.id && ' (You)'}</p><p className="text-xs text-slate-400">{r.count} referrals</p></div>
            <span className="font-extrabold text-violet-600">{fmtMoney(r.earned)}</span>
          </div>
        ))}
      </Card>

      <h3 className="font-extrabold mt-6 mb-3">My referrals</h3>
      {refs.length === 0 ? <Card><Empty title="No referrals yet" body="Share your link to start earning." /></Card> : (
        <div className="space-y-2">{refs.map(r => (
          <Card key={r.id} className="p-4 flex items-center gap-3"><Avatar name={r.name} photo={r.photo} /><div className="flex-1"><p className="font-bold">{r.name}</p><p className="text-xs text-slate-400">Joined {fmtDateTime(r.createdAt)}</p></div><Badge tone={r.kyc === 'verified' ? 'green' : 'amber'}>{r.kyc === 'verified' ? 'Active' : r.kyc}</Badge></Card>
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
  const { user, db, applyLoan, repayLoan, submitLoanFee, addTicket, verifyTxPin, toast, t, currency, fmtMoney, toBDT, fromBDT } = useApp()
  const [amount, setAmount] = useState(''); const [months, setMonths] = useState('12'); const [repayAmt, setRepayAmt] = useState<Record<string, string>>({})
  const [appName, setAppName] = useState(user?.name ?? ''); const [code, setCode] = useState('+880'); const [phoneNum, setPhoneNum] = useState(user?.phone ?? '')
  const [whatsapp, setWhatsapp] = useState(''); const [nid, setNid] = useState(''); const [photo, setPhoto] = useState('')
  const [idType, setIdType] = useState('National ID'); const [idPhoto, setIdPhoto] = useState('')
  const [gName, setGName] = useState(''); const [gPhone, setGPhone] = useState('')
  const [feePay, setFeePay] = useState<string | null>(null); const [feeMethod, setFeeMethod] = useState(''); const [feeRef, setFeeRef] = useState('')
  const [wstep, setWstep] = useState(0); const [ack, setAck] = useState(false); const [submittedApp, setSubmittedApp] = useState(false)
  const [view, setView] = useState<'hub' | 'apply' | 'active' | 'repay' | 'close' | 'noc' | 'history'>('hub'); const [closeDone, setCloseDone] = useState(false); const [closeArm, setCloseArm] = useState(false); const [txPin, setTxPin] = useState(''); const [okModal, setOkModal] = useState<{ title: string; rows: [string, string][] } | null>(null); const [errMsg, setErrMsg] = useState('')
  if (!user) return null
  const s = db.settings
  const effLoanLimit = user?.loanLimitOverride ?? db.levels.find(l => l.level === user?.level)?.loanLimit ?? s.loanLimit
  const amt = Number(amount) || 0; const mo = Number(months) || 12
  const amtBDT = Math.round(toBDT(amt))
  const calc = emiCalc(amtBDT, s.loanRatePct, mo)
  const myLoans = db.loans.filter(l => l.userId === user.id)
  const active = myLoans.find(l => l.status === 'active')
  const outstanding = active ? active.totalPayable - active.paid : 0
  const repaidLoans = myLoans.filter(l => l.status === 'repaid')
  const pendingApps = myLoans.filter(l => l.status === 'pending').length
  const feeDue = myLoans.filter(l => l.processingFee && l.feeStatus !== 'paid' && l.feeStatus !== 'submitted').length
  const nextRepay = (() => {
    if (!active) return null
    const emisPaid = Math.min(active.months, Math.floor(active.paid / active.emi))
    if (emisPaid >= active.months) return null
    const due = new Date(active.createdAt); due.setMonth(due.getMonth() + emisPaid + 1)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const days = Math.ceil((new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() - today.getTime()) / 86400000)
    return { due, days, emiNo: emisPaid + 1 }
  })()
  const repayTxs = [...db.txs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).filter(x => x.userId === user.id && x.category === 'loan_repayment')
  useEffect(() => {
    if (view === 'hub') return
    window.history.pushState({ loanView: view }, '')
    const onPop = () => setView('hub')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [view])
  const sectionHead = (title: string, sub: string) => (
    <div className="mb-5 anim-fade-up">
      <button onClick={() => setView('hub')} className="inline-flex items-center gap-1.5 text-sm font-bold text-violet-600 dark:text-violet-400 mb-2"><ArrowLeft size={16} /> All loan services</button>
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{title}</h1>
      <p className="text-sm text-slate-500 mt-0.5">{sub}</p>
    </div>
  )
  const validateDocs = (): boolean => {
    if (!appName.trim()) { toast({ kind: 'error', title: 'Enter your full name' }); return false }
    if (phoneNum.replace(/\D/g, '').length < 6) { toast({ kind: 'error', title: 'Enter your phone number' }); return false }
    if (!whatsapp.trim()) { toast({ kind: 'error', title: 'Enter your WhatsApp number' }); return false }
    if (!nid.trim()) { toast({ kind: 'error', title: 'Enter your ' + idType + ' number' }); return false }
    if (!idPhoto) { toast({ kind: 'error', title: 'Upload a photo of your ' + idType }); return false }
    if (!photo) { toast({ kind: 'error', title: 'Upload your photo' }); return false }
    if (!gName.trim() || !gPhone.trim()) { toast({ kind: 'error', title: 'Enter guarantor name and mobile number' }); return false }
    return true
  }
  const submit = () => {
    const pinErr = verifyTxPin(txPin); if (pinErr) return setErrMsg(pinErr)
    if (!validateDocs()) return
    if (amtBDT < s.minLoan || amtBDT > s.maxLoan) return toast({ kind: 'error', title: `Loan amount must be between ${fmtMoney(s.minLoan)} and ${fmtMoney(s.maxLoan)}` })
    if (amtBDT > effLoanLimit) return toast({ kind: 'error', title: user.loanLimitOverride ? `Your personal loan limit is ${fmtMoney(effLoanLimit)}.` : `Your Level ${user.level} loan limit is ${fmtMoney(effLoanLimit)} — upgrade your level for a higher limit.` })
    applyLoan(amtBDT, mo, { applicantName: appName.trim(), phone: code + ' ' + phoneNum.trim(), whatsapp: whatsapp.trim(), nid: nid.trim(), photo, guarantorName: gName.trim(), guarantorPhone: gPhone.trim(), idType, idPhoto })
    setSubmittedApp(true); setTxPin(''); setOkModal({ title: 'Application submitted 🎉', rows: [['Amount', fmtMoney(amtBDT)], ['Duration', mo + ' months'], ['Monthly EMI', fmtMoney(calc.emi)], ['Status', 'Pending approval'], ['Note', 'Loans are never auto-approved — an admin reviews every application.']] })
  }
  // --- wizard derived state ---
  const eligAmountOk = amtBDT >= s.minLoan && amtBDT <= s.maxLoan
  const eligLimitOk = amtBDT > 0 && amtBDT <= effLoanLimit
  const nameMatch = appName.trim().toLowerCase() === user.name.toLowerCase()
  const nidDigits = nid.replace(/\D/g, '')
  const nidFormatOk = idType === 'National ID' ? [10, 13, 17].includes(nidDigits.length) : nid.trim().length >= 6
  const phoneOk = (code + phoneNum).replace(/\D/g, '').length >= 11
  const gPhoneOk = gPhone.replace(/\D/g, '').length >= 10
  return (
    <div>
      {view === 'hub' && <PageHead title={t('loan_title')} sub={t('loan_sub')} />}
      <SuccessModal open={!!okModal} onClose={() => setOkModal(null)} title={okModal?.title ?? ''} rows={okModal?.rows ?? []} />
      <ResultModal open={!!errMsg} onClose={() => setErrMsg('')} kind="error" title="That didn't work" body={errMsg} />
      <Modal open={!!feePay} onClose={() => setFeePay(null)} title="Pay processing fee">
        {(() => {
          const loan = db.loans.find(l => l.id === feePay); if (!loan) return null
          const methods = depositMethods(currency, db.settings.payMethods)
          const sel = methods.find(m => m.id === feeMethod) ?? methods[0]
          return (
            <div>
              <ModalDesc>Pay <b>{fmtMoney(loan.processingFee ?? 0)}</b> for loan {loan.id} using any option below — the same payment options as on the main website.</ModalDesc>
              <div className="space-y-2">
                {methods.map(m => (
                  <button key={m.id} onClick={() => setFeeMethod(m.id)} className="w-full text-left">
                    <ModalRow><span className="flex items-center gap-2.5"><span className={`w-4 h-4 rounded-full border-2 shrink-0 ${sel.id === m.id ? 'bg-violet-600 border-violet-600' : 'border-slate-300 dark:border-slate-600'}`} /><span className="font-bold text-sm">{m.kind === 'crypto' ? '₿ ' : '🏦 '}{payMethodTitle(m)}</span></span></ModalRow>
                  </button>
                ))}
              </div>
              {sel && (
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 mt-3">
                  <p className="text-[11px] text-slate-400 font-bold">SEND PAYMENT TO</p>
                  <p className="font-mono font-bold break-all mt-0.5">{payMethodValue(sel)}</p>
                  {sel.kind === 'bank' && (sel.routing || sel.swift) && <p className="text-xs text-slate-400 mt-1">{sel.routing ? 'Routing: ' + sel.routing : ''}{sel.routing && sel.swift ? ' · ' : ''}{sel.swift ? 'SWIFT: ' + sel.swift : ''}</p>}
                </div>
              )}
              <div className="mt-4"><Input label="Your TrxID / sender number" value={feeRef} onChange={e => setFeeRef(e.target.value)} /></div>
              <Btn className="w-full py-3.5 mt-4" onClick={() => { if (!feeRef.trim()) return toast({ kind: 'error', title: 'Enter the TrxID or sender number' }); submitLoanFee(loan.id, sel ? payMethodTitle(sel) : '', feeRef.trim()); setFeePay(null); setOkModal({ title: 'Processing fee submitted ✓', rows: [['Loan', loan.id], ['Fee', fmtMoney(loan.processingFee ?? 0)], ['Status', 'Pending verification'], ['Note', 'The admin will confirm your payment shortly.']] }) }}>Submit payment</Btn>
            </div>
          )
        })()}
      </Modal>

      {view === 'hub' && (<>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-4 text-center"><p className="text-[11px] text-slate-400 uppercase font-bold">Loan limit</p><p className="font-extrabold mt-1">{fmtMoney(effLoanLimit)}</p>{user?.loanLimitOverride ? <p className="text-[10px] text-violet-500 font-bold mt-0.5">Custom limit by admin</p> : null}</Card>
        <Card className="p-4 text-center"><p className="text-[11px] text-slate-400 uppercase font-bold">Outstanding</p><p className="font-extrabold mt-1 text-rose-500">{fmtMoney(outstanding)}</p></Card>
        <Card className="p-4 text-center"><p className="text-[11px] text-slate-400 uppercase font-bold">Account level</p><p className="font-extrabold mt-1">Level {user.level}</p></Card>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {([
          { id: 'apply' as const, icon: FilePlus2, title: 'Apply Loan', sub: pendingApps > 0 ? pendingApps + ' pending' : 'Up to ' + fmtMoney(effLoanLimit), badge: pendingApps > 0 ? String(pendingApps) : '' },
          { id: 'active' as const, icon: Wallet, title: 'Active Loan', sub: active ? 'EMI ' + fmtMoney(active.emi) : 'None', badge: '' },
          { id: 'repay' as const, icon: Coins, title: 'Repayment', sub: active ? fmtMoney(outstanding) + ' due' : 'Nothing due', badge: '' },
          { id: 'close' as const, icon: XCircle, title: 'Close Loan', sub: active ? 'Pay off in full' : repaidLoans.length > 0 ? 'Closed ✓' : 'No loan', badge: '' },
          { id: 'noc' as const, icon: Award, title: 'Request NOC', sub: repaidLoans.length > 0 ? 'Available' : 'After repayment', badge: '' },
          { id: 'history' as const, icon: HistoryIcon, title: 'Loan History', sub: myLoans.length + ' record' + (myLoans.length === 1 ? '' : 's'), badge: feeDue > 0 ? String(feeDue) : '' },
        ]).map(m => (
          <button key={m.id} onClick={() => setView(m.id)} className="relative flex flex-col items-center text-center gap-1.5 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-4 shadow-sm active:scale-[.96] transition">
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/15 to-cyan-500/15 dark:from-violet-500/25 dark:to-cyan-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center"><m.icon size={22} /></span>
            <span className="font-extrabold text-[13px] leading-tight">{m.title}</span>
            <span className="text-[10px] text-slate-500 leading-snug">{m.sub}</span>
            {m.badge && <span className="absolute top-2 right-2 min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-extrabold inline-flex items-center justify-center">{m.badge}</span>}
          </button>
        ))}
      </div>
      </>)}
      {view === 'history' && myLoans.filter(l => l.processingFee).length > 0 && (
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
                  : <Btn className="!py-2 !text-xs shrink-0" onClick={() => { setFeePay(l.id); setFeeMethod(''); setFeeRef('') }}>Pay</Btn>}
              </div>
            ))}
          </div>
        </Card>
      )}
      {view === 'active' && (<>
        {sectionHead('Active Loan', 'Your running loan at a glance. Repayments live in the Repayment section.')}
        {active ? (
          <Card className="p-5 border-l-4 !border-l-violet-500">
            <div className="flex justify-between items-start"><div><p className="font-extrabold">Loan {active.id}</p><p className="text-sm text-slate-500">Applied {fmtDateTime(active.createdAt)}</p></div><Badge tone="green">Active</Badge></div>
            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 mt-4 overflow-hidden"><div className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full" style={{ width: Math.min(100, active.paid / active.totalPayable * 100) + '%' }} /></div>
            <p className="text-xs text-slate-500 mt-2">{Math.round(active.paid / active.totalPayable * 100)}% repaid</p>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-1.5 text-sm mt-4">
              <div className="flex justify-between"><span className="text-slate-500">Loan amount</span><span className="font-bold">{fmtMoney(active.amount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Duration</span><span className="font-bold">{active.months} months</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Interest rate</span><span className="font-bold">{active.ratePct}% / year</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Monthly EMI</span><span className="font-bold text-violet-600">{fmtMoney(active.emi)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total payable</span><span className="font-bold">{fmtMoney(active.totalPayable)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Paid so far</span><span className="font-bold text-emerald-600">{fmtMoney(active.paid)}</span></div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2"><span className="text-slate-500">Remaining</span><span className="font-extrabold text-rose-500">{fmtMoney(outstanding)}</span></div>
              {nextRepay && <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-700 pt-2"><span className="text-slate-500">Next Repayment</span><span className="text-right"><span className="font-extrabold text-violet-600">{fmtDate(nextRepay.due.toISOString())}</span><span className="block text-[11px] text-slate-400">EMI #{nextRepay.emiNo} · {fmtMoney(active.emi)} · {nextRepay.days < 0 ? 'overdue by ' + Math.abs(nextRepay.days) + ' day' + (Math.abs(nextRepay.days) === 1 ? '' : 's') : nextRepay.days === 0 ? 'due today' : 'in ' + nextRepay.days + ' day' + (nextRepay.days === 1 ? '' : 's')}</span></span></div>}
            </div>
            <Btn className="w-full mt-4" onClick={() => setView('repay')}>Go to Repayment</Btn>
          </Card>
        ) : <Card><Empty title="No active loan" body="When a loan application is approved and disbursed, it will appear here." /></Card>}
      </>)}
      {view === 'repay' && (<>
        {sectionHead('Repayment', 'Pay your monthly EMI or any extra amount toward your loan.')}
        {active ? (<>
          <Card className="p-5 space-y-4">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Loan</span><span className="font-bold">{active.id}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Monthly EMI</span><span className="font-bold">{fmtMoney(active.emi)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Outstanding</span><span className="font-extrabold text-rose-500">{fmtMoney(outstanding)}</span></div>
            </div>
            <PinField pin={txPin} setPin={setTxPin} />
            <div className="flex gap-2">
              <div className="flex-1"><Input label="Repay amount" type="number" placeholder="e.g. 50" value={repayAmt[active.id] ?? ''} onChange={e => setRepayAmt(r => ({ ...r, [active.id]: e.target.value }))} /></div>
              <Btn className="self-end !py-3" onClick={() => { const pinErr = verifyTxPin(txPin); if (pinErr) return setErrMsg(pinErr); const payAmt = Math.round(toBDT(Number(repayAmt[active.id]) || 0)); const err = repayLoan(active, payAmt); if (err) setErrMsg(err); else { setOkModal({ title: 'Repayment successful ✓', rows: [['Loan', active.id], ['You paid', fmtMoney(payAmt)], ['Remaining after this', fmtMoney(Math.max(outstanding - payAmt, 0))], ['Status', outstanding - payAmt <= 0 ? 'Fully repaid 🎉' : 'Active']] }); setRepayAmt(r => ({ ...r, [active.id]: '' })); setTxPin('') } }}>Repay</Btn>
            </div>
            <button onClick={() => setRepayAmt(r => ({ ...r, [active.id]: String(Math.round(fromBDT(active.emi) * 100) / 100) }))} className="text-xs font-bold text-violet-600">Use EMI amount ({fmtMoney(active.emi)})</button>
          </Card>
          <h3 className="font-extrabold mt-6 mb-3">Repayment history</h3>
          {repayTxs.length === 0 ? <Card><Empty title="No repayments yet" /></Card> : (
            <div className="space-y-2">{repayTxs.map(x => (
              <Card key={x.id} className="p-4 flex items-center gap-3"><div className="flex-1"><p className="font-bold">{x.title}</p><p className="text-xs text-slate-400">{x.id} · {fmtDateTime(x.createdAt)}</p></div><span className="font-extrabold text-rose-500">−{fmtMoney(x.amount)}</span></Card>
            ))}</div>
          )}
        </>) : <Card><Empty title="Nothing to repay" body="You have no active loan right now." /></Card>}
      </>)}
      {view === 'close' && (<>
        {sectionHead('Close Loan', 'Settle your full outstanding in one payment and close the loan early.')}
        {closeDone ? (
          <Card className="p-5 text-center">
            <CheckCircle2 size={52} className="mx-auto text-emerald-500" />
            <p className="font-extrabold text-lg mt-3">Loan closed</p>
            <p className="text-sm text-slate-500 mt-1">Your loan is fully repaid and closed. You can now request your No Objection Certificate (NOC).</p>
            <Btn className="w-full mt-4" onClick={() => setView('noc')}>Request NOC</Btn>
          </Card>
        ) : active ? (
          <Card className="p-5 space-y-4">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Loan</span><span className="font-bold">{active.id}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total payable</span><span className="font-bold">{fmtMoney(active.totalPayable)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Paid so far</span><span className="font-bold text-emerald-600">{fmtMoney(active.paid)}</span></div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2"><span className="text-slate-500">Payoff amount today</span><span className="font-extrabold text-rose-500">{fmtMoney(outstanding)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Early-closure fee</span><span className="font-bold">৳0</span></div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">Closing pays the entire remaining balance from your wallet at once. The loan is marked repaid immediately — no more EMIs.</p>
            <PinField pin={txPin} setPin={setTxPin} />
            <Btn variant="danger" className="w-full py-3.5" onClick={() => { if (!closeArm) { setCloseArm(true); setTimeout(() => setCloseArm(false), 4000); return } const pinErr = verifyTxPin(txPin); if (pinErr) { setErrMsg(pinErr); setCloseArm(false); return } const err = repayLoan(active, outstanding); if (err) { toast({ kind: 'error', title: err }); setCloseArm(false) } else { setCloseArm(false); setCloseDone(true); setTxPin(''); setOkModal({ title: 'Loan closed 🎉', rows: [['Loan', active.id], ['Paid off', fmtMoney(outstanding)], ['Status', 'Closed'], ['Next step', 'Request your NOC from the Loan hub']] }); toast({ kind: 'success', title: 'Loan closed', body: 'Your loan has been fully repaid.' }) } }}>{closeArm ? '⚠️ Tap again to confirm — pay ' + fmtMoney(outstanding) + ' and close' : 'Close loan — pay ' + fmtMoney(outstanding)}</Btn>
          </Card>
        ) : repaidLoans.length > 0 ? (
          <Card className="p-5 text-center"><CheckCircle2 size={44} className="mx-auto text-emerald-500" /><p className="font-extrabold mt-3">Already closed</p><p className="text-sm text-slate-500 mt-1">Your loan {repaidLoans[0].id} is fully repaid. Head to Request NOC for your certificate.</p></Card>
        ) : <Card><Empty title="No loan to close" body="You have no active or repaid loan." /></Card>}
      </>)}
      {view === 'noc' && (<>
        {sectionHead('Request NOC', 'A No Objection Certificate confirms you have no dues with NovaWallet.')}
        {repaidLoans.length === 0 ? (
          <Card className="p-5 space-y-3">
            <p className="text-sm text-slate-500 leading-relaxed">An NOC is issued only after a loan is <b>fully repaid</b>.{active ? ' You still have ' + fmtMoney(outstanding) + ' outstanding on loan ' + active.id + '.' : ' You have no repaid loan yet.'}</p>
            {active && <Btn className="w-full" onClick={() => setView('close')}>Close my loan to become eligible</Btn>}
          </Card>
        ) : (
          <div className="space-y-3">{repaidLoans.map(l => { const tk = db.tickets.find(x => x.userId === user.id && x.subject === 'NOC request — ' + l.id); return (
            <Card key={l.id} className="p-5 space-y-3">
              <div className="flex items-center gap-3"><span className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0"><Award size={20} /></span><div><p className="font-extrabold">{l.id}</p><p className="text-xs text-slate-500">{fmtMoney(l.amount)} · fully repaid ({fmtMoney(l.totalPayable)} paid)</p></div></div>
              {tk ? (
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 text-sm">{tk.status === 'resolved' ? <><b className="text-emerald-600">✓ NOC issued</b><p className="text-slate-500 mt-1">Our team sent your certificate in the support chat “{tk.subject}” — open Profile → Help & Support to view it.</p></> : <><b className="text-amber-500">Requested — {tk.status}</b><p className="text-slate-500 mt-1">Our team is preparing your certificate. You will be notified when it is ready.</p></>}</div>
              ) : (
                <>
                <PinField pin={txPin} setPin={setTxPin} />
                <Btn className="w-full" onClick={() => { const pinErr = verifyTxPin(txPin); if (pinErr) return setErrMsg(pinErr); setTxPin(''); setOkModal({ title: 'NOC requested ✓', rows: [['Loan', l.id], ['Status', 'Requested'], ['Delivery', 'Your certificate arrives in the Support chat']] }); addTicket('NOC request — ' + l.id, 'Hello, I have fully repaid my loan ' + l.id + ' (' + fmtMoney(l.amount) + ', total paid ' + fmtMoney(l.totalPayable) + '). Please issue my No Objection Certificate (NOC).'); toast({ kind: 'success', title: 'NOC requested', body: 'Our team will prepare your certificate and reply in Support.' }) }}>Request NOC for {l.id}</Btn>
                </>
              )}
            </Card>)})}
          </div>
        )}
      </>)}
      {view === 'apply' && (<>
      {sectionHead('Apply Loan', 'A step-by-step application — eligibility, documents, verification, approval.')}
      <Card className="p-5">
        <h3 className="font-extrabold mb-4">Loan application</h3>
        {submittedApp ? (
          <div className="text-center py-2 anim-fade-up">
            <CheckCircle2 size={56} className="mx-auto text-emerald-500" />
            <p className="font-extrabold text-lg mt-3">Application submitted for approval</p>
            <p className="text-sm text-slate-500 mt-1">Your application is with our team. Loans are never auto-approved — you will be notified when an admin reviews it.</p>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-1.5 text-sm text-left mt-4">
              <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-bold">{fmtMoney(amtBDT)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Duration</span><span className="font-bold">{mo} months</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Monthly EMI</span><span className="font-bold">{fmtMoney(Math.round(calc.emi))}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="font-bold text-amber-500">Pending review</span></div>
            </div>
            <Btn variant="outline" className="w-full mt-4" onClick={() => { setSubmittedApp(false); setWstep(0); setAck(false) }}>Start a new application</Btn>
          </div>
        ) : (
          <>
            <StepBar steps={['Eligibility', 'Documents', 'Verify', 'Acknowledge']} current={wstep} />
            {wstep === 0 && (
              <div className="space-y-4 anim-fade-up">
                <Input label={`Amount in ${currency} (min ${fmtMoney(s.minLoan)} – max ${fmtMoney(s.maxLoan)})`} type="number" value={amount} onChange={e => setAmount(e.target.value)} />
                {currency !== 'BDT' && amt > 0 && <p className="text-xs text-slate-400 -mt-2">≈ {fmtUSDT(amtBDT / db.settings.bdtPerUsd)} at today's rate.</p>}
                <Select label="Duration" value={months} onChange={(e: any) => setMonths(e.target.value)}>
                  {[3, 6, 12, 18, 24].map(m => <option key={m} value={m}>{m} months</option>)}
                </Select>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-2.5">
                  <p className="font-extrabold text-sm">Eligibility check</p>
                  <CheckLine ok={eligAmountOk}>Amount within the allowed range ({fmtMoney(s.minLoan)} – {fmtMoney(s.maxLoan)}){amtBDT > 0 && !eligAmountOk ? ' — adjust the amount' : ''}</CheckLine>
                  <CheckLine ok={eligLimitOk}>Within your {user.loanLimitOverride ? 'personal' : 'Level ' + user.level} loan limit of {fmtMoney(effLoanLimit)}{amtBDT > effLoanLimit ? ' — lower the amount or upgrade your level' : ''}</CheckLine>
                  <CheckLine ok={user.kyc !== 'unverified'} warn={user.kyc === 'pending'}>KYC: {user.kyc === 'verified' ? 'verified' : user.kyc === 'pending' ? 'submitted — under review' : 'not submitted — submit it from Profile for a faster decision'}</CheckLine>
                  <CheckLine ok={!active} warn={!!active}>{active ? 'You already have an active loan (' + active.id + ') — a new application will still be reviewed by an admin' : 'No active loan right now'}</CheckLine>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Interest rate</span><span className="font-bold">{s.loanRatePct}% / year</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Service charge</span><span className="font-bold">৳0</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Total interest</span><span className="font-bold">{fmtMoney(Math.round(calc.interest))}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Monthly EMI</span><span className="font-bold text-violet-600">{fmtMoney(Math.round(calc.emi))}</span></div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2"><span className="text-slate-500">Total payable</span><span className="font-extrabold">{fmtMoney(Math.round(calc.total))}</span></div>
                </div>
                <WizardNav nextLabel="Continue to documents" nextDisabled={!eligAmountOk || !eligLimitOk} onNext={() => setWstep(1)} />
              </div>
            )}
            {wstep === 1 && (
              <div className="space-y-4 anim-fade-up">
                <div className="rounded-2xl border-2 border-slate-200/70 dark:border-slate-700/60 p-4 space-y-4">
                  <p className="font-extrabold text-sm">Applicant &amp; guarantor information <span className="text-slate-400 font-semibold">(required at any account level)</span></p>
                  <Input label="Full name" value={appName} onChange={e => setAppName(e.target.value)} />
                  <div className="flex gap-2">
                    <div className="w-[118px] shrink-0">
                      <Select label="Code" value={code} onChange={(e: any) => setCode(e.target.value)}>
                        {['+880', '+91', '+92', '+1', '+44', '+971', '+966', '+60'].map(c => <option key={c} value={c}>{c}</option>)}
                      </Select>
                    </div>
                    <div className="flex-1 min-w-0"><Input label="Phone number" value={phoneNum} onChange={e => setPhoneNum(e.target.value)} /></div>
                  </div>
                  <Input label="WhatsApp number" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
                  <Select label="ID type" value={idType} onChange={(e: any) => setIdType(e.target.value)}>
                    {['National ID', 'Passport', 'Driving Licence'].map(x => <option key={x} value={x}>{x}</option>)}
                  </Select>
                  <Input label={`${idType} number`} value={nid} onChange={e => setNid(e.target.value)} />
                  <div>
                    <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">{idType} photo</span>
                    <label className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 px-4 py-3 cursor-pointer">
                      {idPhoto ? <img src={idPhoto} alt="ID document" className="w-12 h-12 rounded-xl object-cover" /> : <span className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl">🪪</span>}
                      <span className="text-sm font-bold text-violet-600">{idPhoto ? 'ID photo added — tap to change' : 'Tap to upload your ' + idType + ' photo'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) setIdPhoto(await fileToScaledDataUrl(f)) }} />
                    </label>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Your photo</span>
                    <label className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 px-4 py-3 cursor-pointer">
                      {photo ? <img src={photo} alt="Applicant" className="w-12 h-12 rounded-xl object-cover" /> : <span className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl">📷</span>}
                      <span className="text-sm font-bold text-violet-600">{photo ? 'Photo added — tap to change' : 'Tap to upload your photo'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) setPhoto(await fileToScaledDataUrl(f)) }} />
                    </label>
                  </div>
                  <Input label="Guarantor — full name" value={gName} onChange={e => setGName(e.target.value)} />
                  <Input label="Guarantor — mobile number" value={gPhone} onChange={e => setGPhone(e.target.value)} />
                </div>
                <WizardNav onBack={() => setWstep(0)} nextLabel="Continue to verification" onNext={() => { if (validateDocs()) setWstep(2) }} />
              </div>
            )}
            {wstep === 2 && (
              <div className="space-y-4 anim-fade-up">
                <div className="rounded-2xl bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 p-4">
                  <p className="font-extrabold text-sm">🤖 AI document check</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">We read the details from your documents and flag anything that looks off. Correct any field right here — the checks update as you type. In this demo the checks run on your device; with the live backend, an AI reads the document photo itself.</p>
                </div>
                {idPhoto && <img src={idPhoto} alt="ID document" className="w-full max-h-44 object-cover rounded-2xl border border-slate-200 dark:border-slate-700" />}
                <div className="space-y-2.5">
                  <CheckLine ok={nameMatch} warn={!nameMatch}>Name on document: <b>{appName || '—'}</b>{nameMatch ? ' — matches your account name' : ' — differs from your account name (' + user.name + '); an admin will double-check it'}</CheckLine>
                  <CheckLine ok={nidFormatOk}>{idType} number format: {nidFormatOk ? 'looks valid (' + nidDigits.length + ' digits)' : idType === 'National ID' ? 'NID numbers are 10, 13 or 17 digits — yours has ' + nidDigits.length : 'looks too short — check the number'}</CheckLine>
                  <CheckLine ok={phoneOk}>Phone number: {phoneOk ? 'valid format' : 'looks incomplete'}</CheckLine>
                  <CheckLine ok={!!whatsapp.trim()}>WhatsApp number provided</CheckLine>
                  <CheckLine ok={gPhoneOk}>Guarantor mobile: {gPhoneOk ? 'valid format' : 'looks incomplete'}</CheckLine>
                  <CheckLine ok={!!idPhoto && !!photo}>Document photo and your photo attached</CheckLine>
                </div>
                <div className="rounded-2xl border-2 border-slate-200/70 dark:border-slate-700/60 p-4 space-y-4">
                  <p className="font-extrabold text-sm">Edit the details the AI read</p>
                  <Input label="Full name" value={appName} onChange={e => setAppName(e.target.value)} />
                  <Input label={`${idType} number`} value={nid} onChange={e => setNid(e.target.value)} />
                  <Input label="WhatsApp number" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
                  <Input label="Guarantor — full name" value={gName} onChange={e => setGName(e.target.value)} />
                  <Input label="Guarantor — mobile number" value={gPhone} onChange={e => setGPhone(e.target.value)} />
                </div>
                <WizardNav onBack={() => setWstep(1)} nextLabel="Continue to acknowledgement" onNext={() => { if (validateDocs()) setWstep(3) }} />
              </div>
            )}
            {wstep === 3 && (
              <div className="space-y-4 anim-fade-up">
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Loan amount</span><span className="font-extrabold">{fmtMoney(amtBDT)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Duration</span><span className="font-bold">{mo} months</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Monthly EMI</span><span className="font-bold text-violet-600">{fmtMoney(Math.round(calc.emi))}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Total payable</span><span className="font-bold">{fmtMoney(Math.round(calc.total))}</span></div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2"><span className="text-slate-500">Applicant</span><span className="font-bold">{appName}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">{idType}</span><span className="font-bold">{nid}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Phone</span><span className="font-bold">{code} {phoneNum}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Guarantor</span><span className="font-bold">{gName} · {gPhone}</span></div>
                </div>
                <label className="flex items-start gap-3 rounded-2xl border-2 border-slate-200/70 dark:border-slate-700/60 p-4 cursor-pointer">
                  <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} className="mt-0.5 w-4.5 h-4.5 accent-violet-600" />
                  <span className="text-sm leading-relaxed">I confirm that all information and documents in this application are correct, and I agree to repay the loan in monthly instalments of <b>{fmtMoney(Math.round(calc.emi))}</b> as shown above.</span>
                </label>
                <PinField pin={txPin} setPin={setTxPin} />
                <WizardNav onBack={() => setWstep(2)} nextLabel="Submit for Approval" nextDisabled={!ack || txPin.length !== 4} onNext={submit} />
              </div>
            )}
          </>
        )}
      </Card>
      </>)}
      {view === 'history' && (<>
      {sectionHead('Loan History', 'Every application and loan in one place — including processing-fee payments.')}
      <h3 className="font-extrabold mt-2 mb-3">All applications & loans</h3>
      {myLoans.length === 0 ? <Card><Empty title="No loans yet" /></Card> : (
        <div className="space-y-2">{myLoans.map(l => (
          <Card key={l.id} className="p-4 flex items-center gap-3">
            <div className="flex-1"><p className="font-bold">{l.id} · {fmtMoney(l.amount)}</p><p className="text-xs text-slate-400">{l.months} mo · EMI {fmtMoney(l.emi)} · Paid {fmtMoney(l.paid)} / {fmtMoney(l.totalPayable)} · {fmtDateTime(l.createdAt)}</p></div>
            <Badge tone={l.status === 'active' || l.status === 'repaid' ? 'green' : l.status === 'pending' ? 'amber' : 'red'}>{l.status}</Badge>
          </Card>
        ))}</div>
      )}
      </>)}
    </div>
  )
}
