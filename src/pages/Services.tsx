import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Copy, Download, Share2, Upload, XCircle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useApp } from '../lib/store'
import { Avatar, Badge, Btn, Card, CheckLine, CopyBtn, Empty, FeatureOff, Input, Modal, PinField, Select, StepBar, WizardNav, statusTone , MaxBtn } from '../components/ui'
import { fmtDateTime, fmtUSDT } from '../lib/utils'
import type { User } from '../lib/types'

import { depositMethods, withdrawMethods, CRYPTO_NETWORK_LABELS, payMethodShortTitle, payMethodTitle, payMethodValue } from '../lib/localPayments'

function PageHead({ title, sub }: { title: string; sub: string }) {
  return <div className="mb-5 anim-fade-up"><h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{title}</h1><p className="text-sm text-slate-500 mt-0.5">{sub}</p></div>
}
function SuccessModal({ open, onClose, title, rows }: any) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-center py-2"><CheckCircle2 size={56} className="mx-auto text-emerald-500" /></div>
      <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-2">
        {(rows ?? []).map(([k, v]: any) => <div key={k} className="flex justify-between text-sm"><span className="text-slate-500">{k}</span><span className="font-bold text-right">{v}</span></div>)}
      </div>
      <Btn className="w-full mt-4" onClick={onClose}>Done</Btn>
    </Modal>
  )
}

/** Result modal for submit outcomes — success (green check) or failure (red cross,
 * stays until dismissed so the user always knows whether it worked). */
function ResultModal({ open, onClose, kind, title, body, rows }: any) {
  return (
    <Modal open={open} onClose={onClose} title={kind === 'error' ? 'Something went wrong' : title}>
      <div className="text-center py-2">{kind === 'error' ? <XCircle size={56} className="mx-auto text-rose-500" /> : <CheckCircle2 size={56} className="mx-auto text-emerald-500" />}</div>
      {kind === 'error' && <p className="text-center font-extrabold text-lg -mt-1">{title}</p>}
      {body && <p className="text-center text-sm text-slate-500 mt-1.5 leading-relaxed">{body}</p>}
      {(rows ?? []).length > 0 && (
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-2 mt-3">
          {(rows ?? []).map(([k, v]: any) => <div key={k} className="flex justify-between text-sm"><span className="text-slate-500">{k}</span><span className="font-bold text-right">{v}</span></div>)}
        </div>
      )}
      <Btn className="w-full mt-4" variant={kind === 'error' ? 'danger' : 'primary'} onClick={onClose}>{kind === 'error' ? 'Try again' : 'Done'}</Btn>
    </Modal>
  )
}

export function AddMoney() {
  const { addDeposit, db, user, toast, t, currency, fmtMoney, toBDT } = useApp()
  const depMethods = depositMethods(currency, db.settings.payMethods)
  const [method, setMethod] = useState(''); const [amount, setAmount] = useState(''); const [trx, setTrx] = useState(''); const [receipt, setReceipt] = useState('')
  const [done, setDone] = useState(false); const [lastAmt, setLastAmt] = useState(0)
  const [dstep, setDstep] = useState(0); const [dack, setDack] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const mine = db.deposits.filter(d => d.userId === user?.id)
  const activeMethod = depMethods.find(m => m.id === method) ?? depMethods[0]
  const isCrypto = activeMethod.kind === 'crypto'
  const methodLabel = payMethodTitle(activeMethod)
  const amtBDT = Math.round(toBDT(Number(amount) || 0))
  const submit = async () => {
    if (!amtBDT || amtBDT < 10) return toast({ kind: 'error', title: 'Enter an amount of at least ' + fmtMoney(10) })
    if (!isCrypto && trx.trim().length < 6) return toast({ kind: 'error', title: 'Enter the payment Transaction ID' })
    const depErr = await addDeposit({ method: methodLabel, amount: amtBDT, trxId: trx.trim() || 'CRYPTO-' + Date.now(), receipt: receipt || undefined, methodId: activeMethod.id, kind: activeMethod.kind, verification: activeMethod.verification ?? 'manual' })
    if (depErr) return toast({ kind: 'error', title: depErr })
    setLastAmt(amtBDT); setDone(true); setAmount(''); setTrx(''); setReceipt(''); setDstep(0); setDack(false)
  }
  // Stacked rows: short label on top, value on its own full-width line below —
  // long numbers/addresses can never collide with the label or wrap mid-word
  // next to a button. Copyable values get their own value box with the Copy
  // button pinned inside it.
  const infoRow = (label: string, value?: string) => value ? (
    <div key={label} className="py-2">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="font-bold text-[15px] text-slate-800 dark:text-slate-100 mt-0.5 leading-snug">{value}</p>
    </div>
  ) : null
  const copyRow = (label: string, value?: string) => value ? (
    <div key={label} className="py-2">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{label}</p>
      <div className="flex items-start gap-2 rounded-2xl bg-white/80 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 px-3 py-2.5">
        <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100 break-all flex-1 leading-relaxed">{value}</span>
        <CopyBtn value={value} />
      </div>
    </div>
  ) : null
  if (db.settings.features?.deposits === false) return (
    <div>
      <PageHead title={t('add_title')} sub={t('add_sub')} />
      <FeatureOff label="Add Money" />
    </div>
  )
  return (
    <div>
      <PageHead title={t('add_title')} sub={t('add_sub')} />
      <Card className="p-5">
        <StepBar steps={['Method & amount', 'Payment details', 'Review', 'Submit']} current={dstep} />
        {dstep === 0 && (
          <div className="space-y-4 anim-fade-up">
            <Select label={t('payment_method')} value={activeMethod.id} onChange={(e: any) => setMethod(e.target.value)}>{depMethods.map(m => <option key={m.id} value={m.id}>{m.kind === 'crypto' ? '₿ ' : '🏦 '}{payMethodShortTitle(m)}</option>)}</Select>
            <div className="rounded-3xl bg-gradient-to-b from-violet-50 to-white dark:from-violet-500/10 dark:to-slate-900 border border-violet-100 dark:border-violet-500/20 p-4">
              <p className="font-extrabold text-violet-700 dark:text-violet-300 flex items-center gap-2">{isCrypto ? '₿' : '🏦'} {isCrypto ? 'Send crypto to this wallet' : 'Send money to this account'}</p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-1">
                {isCrypto ? (<>
                  {infoRow('Coin', activeMethod.label)}
                  {infoRow('Network', activeMethod.network)}
                  {copyRow('Address', payMethodValue(activeMethod))}
                </>) : (<>
                  {infoRow('Bank', activeMethod.label)}
                  {infoRow('Account Name', activeMethod.accountName)}
                  {copyRow('Account No.', payMethodValue(activeMethod))}
                  {copyRow('Routing', activeMethod.routing)}
                  {copyRow('SWIFT', activeMethod.swift)}
                  {infoRow('Branch', activeMethod.branch)}
                </>)}
                {!activeMethod.accountNumber && activeMethod.detail && copyRow('Details', activeMethod.detail)}
              </div>
              <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">Copy the {isCrypto ? 'address' : 'account number'} exactly and send your payment first — you will enter the amount and Transaction ID in the next steps. Credited after approval.</p>
            </div>
            <Input label={`Amount (${currency})`} type="number" placeholder="e.g. 5000" value={amount} onChange={e => setAmount(e.target.value)} />
            {currency !== 'BDT' && Number(amount) > 0 && <p className="text-xs text-slate-400 -mt-2">≈ {fmtUSDT(amtBDT / db.settings.bdtPerUsd)} will be credited after approval, at today's rate.</p>}
            <WizardNav nextLabel="Continue to payment details" onNext={() => { if (!amtBDT || amtBDT < 10) return toast({ kind: 'error', title: 'Enter an amount of at least ' + fmtMoney(10) }); setDstep(1) }} />
          </div>
        )}
        {dstep === 1 && (
          <div className="space-y-4 anim-fade-up">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">Method</span><span className="font-bold">{methodLabel}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-bold">{fmtMoney(amtBDT)}</span></div>
            </div>
            <Input label={isCrypto ? 'Transaction hash (optional)' : 'Transaction ID'} placeholder={isCrypto ? 'Paste the transaction hash' : 'e.g. FT2601187456'} value={trx} onChange={e => setTrx(e.target.value)} />
            <div>
              <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Payment receipt (optional)</span>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setReceipt(e.target.files?.[0]?.name ?? '')} />
              <Btn variant="outline" onClick={() => fileRef.current?.click()}><Upload size={16} /> {receipt || 'Upload receipt screenshot'}</Btn>
            </div>
            <WizardNav onBack={() => setDstep(0)} nextLabel="Continue to review" onNext={() => { if (!isCrypto && trx.trim().length < 6) return toast({ kind: 'error', title: 'Enter the payment Transaction ID' }); setDstep(2) }} />
          </div>
        )}
        {dstep === 2 && (
          <div className="space-y-4 anim-fade-up">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Method</span><span className="font-bold">{methodLabel}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">You pay to</span><span className="font-bold text-right break-all">{payMethodValue(activeMethod)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Amount to be credited</span><span className="font-extrabold">{fmtMoney(amtBDT)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{isCrypto ? 'Transaction hash' : 'Transaction ID'}</span><span className="font-bold font-mono text-right break-all">{trx.trim() || '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Receipt</span><span className="font-bold">{receipt || 'Not attached'}</span></div>
            </div>
            <div className="space-y-2.5">
              <CheckLine ok={amtBDT >= 10}>Amount is {fmtMoney(amtBDT)} — this is what lands in your wallet after approval</CheckLine>
              <CheckLine ok={isCrypto ? true : trx.trim().length >= 6}>{isCrypto ? 'Crypto deposits are matched by wallet address and amount' : 'Transaction ID format looks right (' + trx.trim().length + ' characters)'}</CheckLine>
              <CheckLine ok warn={false}>Double-check the Transaction ID — a wrong ID is the top reason deposits are rejected</CheckLine>
            </div>
            <WizardNav onBack={() => setDstep(1)} nextLabel="Continue" onNext={() => setDstep(3)} />
          </div>
        )}
        {dstep === 3 && (
          <div className="space-y-4 anim-fade-up">
            <div className="rounded-2xl bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 p-4">
              <p className="font-extrabold text-sm">Acknowledgement</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">Your deposit stays <b>pending</b> until an admin verifies the payment. You will get a notification the moment it is approved or rejected.</p>
            </div>
            <label className="flex items-start gap-3 rounded-2xl border-2 border-slate-200/70 dark:border-slate-700/60 p-4 cursor-pointer">
              <input type="checkbox" checked={dack} onChange={e => setDack(e.target.checked)} className="mt-0.5 accent-violet-600" />
              <span className="text-sm leading-relaxed">I confirm I sent <b>{fmtMoney(amtBDT)}</b> via <b>{methodLabel}</b> from my own account, and the Transaction ID above is correct.</span>
            </label>
            <WizardNav onBack={() => setDstep(2)} nextLabel="Submit for Approval" nextDisabled={!dack} onNext={submit} />
          </div>
        )}
      </Card>
      <h3 className="font-extrabold mt-6 mb-3">My deposit requests</h3>
      {mine.length === 0 ? <Card><Empty title="No deposits yet" /></Card> : (
        <div className="space-y-2">{mine.map(d => (
          <Card key={d.id} className="p-4 flex items-center gap-3">
            <div className="flex-1"><p className="font-bold">{fmtMoney(d.amount)} · {d.method}</p><p className="text-xs text-slate-400">{d.id} · TrxID {d.trxId}{d.verification === 'auto' ? ' · ⚡ Auto-verify' : ''} · {fmtDateTime(d.createdAt)}</p></div>
            <Badge tone={statusTone(d.status)}>{d.status}</Badge>
          </Card>))}
        </div>
      )}
      <SuccessModal open={done} onClose={() => setDone(false)} title="Request submitted"
        rows={[['Status', 'Pending review'], ['Method', methodLabel], ['Amount', fmtMoney(lastAmt)], ['Note', 'You will be notified when an admin approves it.']]} />
    </div>
  )
}

export function CashOut() {
  const { requestWithdraw, db, user, walletOf, toast, t, currency, fmtMoney, toBDT, fromBDT } = useApp()
  const [method, setMethod] = useState(''); const [amount, setAmount] = useState(''); const [dest, setDest] = useState(''); const [pin, setPin] = useState(''); const [network, setNetwork] = useState('')
  const [done, setDone] = useState(false); const [cstep, setCstep] = useState(0); const [errMsg, setErrMsg] = useState('')
  const outMethods = withdrawMethods(currency)
  const activeOut = outMethods.includes(method) ? method : outMethods[0]
  const isCrypto = activeOut === 'Crypto Wallet'
  const activeNetwork = CRYPTO_NETWORK_LABELS.includes(network) ? network : CRYPTO_NETWORK_LABELS[0]
  const fullMethod = isCrypto ? 'Crypto Wallet · ' + activeNetwork : activeOut
  const destLabel = !isCrypto ? 'Destination account / number / address' : activeNetwork === 'Binance Pay' ? 'Binance Pay ID / email' : 'Wallet address'
  const amt = Number(amount) || 0
  const amtBDT = Math.round(toBDT(amt))
  const disc = db.levels.find(l => l.level === user?.level)?.feeDiscountPct ?? 0
  const effPct = db.settings.cashoutFeePct * (1 - disc / 100)
  const fee = Math.round(amtBDT * effPct / 100)
  const mine = db.withdrawals.filter(d => d.userId === user?.id)
  const w = user ? walletOf(user.id) : null
  const submit = async () => {
    if (!amtBDT || amtBDT < 50) return toast({ kind: 'error', title: 'Minimum cash out is ' + fmtMoney(50) })
    if (!dest.trim()) return toast({ kind: 'error', title: 'Enter the destination account' })
    const err = await requestWithdraw({ method: fullMethod, amount: amtBDT, destination: dest.trim(), pin })
    if (err) return setErrMsg(err)
    setDone(true); setAmount(''); setPin(''); setCstep(0)
    toast({ kind: 'success', title: 'Cash out requested', body: 'Amount locked until processed.' })
  }
  if (db.settings.features?.withdrawals === false) return (
    <div>
      <PageHead title={t('cashout_title')} sub="Withdraw to your bank account or crypto wallet" />
      <FeatureOff label="Cash Out" />
    </div>
  )
  return (
    <div>
      <PageHead title={t('cashout_title')} sub={`${t('available')} (cash): ${fmtMoney(w?.available ?? 0)}${(w?.holdings.USDT ?? 0) > 0 ? ` · Incl. USDT: ${fmtMoney((w?.available ?? 0) + (w?.holdings.USDT ?? 0) * db.settings.bdtPerUsd)}` : ''} · Fee ${Number(effPct.toFixed(2))}%${disc ? ` (Level ${user?.level} −${disc}%)` : ''} · Daily limit ${fmtMoney(db.levels.find(l => l.level === user?.level)?.dailyLimit ?? 0)}`} />
      <Card className="p-5">
        <StepBar steps={['Details', 'Review', 'Confirm']} current={cstep} />
        {cstep === 0 && (
          <div className="space-y-4 anim-fade-up">
            <Select label="Withdrawal method" value={activeOut} onChange={(e: any) => setMethod(e.target.value)}>{outMethods.map(m => <option key={m}>{m}</option>)}</Select>
            {isCrypto && <Select label="Crypto network / transfer system" value={activeNetwork} onChange={(e: any) => setNetwork(e.target.value)}>{CRYPTO_NETWORK_LABELS.map(n => <option key={n}>{n}</option>)}</Select>}
            <div className="relative">
              <Input label={`Amount (${currency})`} type="number" value={amount} onChange={e => setAmount(e.target.value)} />
              <MaxBtn onClick={() => setAmount(String(Math.round(fromBDT(w?.available ?? 0) * 100) / 100))} />
            </div>
            {currency !== 'BDT' && amt > 0 && <p className="text-xs text-slate-400 -mt-2">≈ {fmtUSDT(amtBDT / db.settings.bdtPerUsd)} at today's rate.</p>}
            <Input label={destLabel} value={dest} onChange={e => setDest(e.target.value)} />
            <WizardNav nextLabel="Review cash out" onNext={() => {
              if (!amtBDT || amtBDT < 50) return toast({ kind: 'error', title: 'Minimum cash out is ' + fmtMoney(50) })
              if (!dest.trim()) return toast({ kind: 'error', title: 'Enter the destination account' })
              setCstep(1)
            }} />
          </div>
        )}
        {cstep === 1 && (
          <div className="space-y-4 anim-fade-up">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Method</span><span className="font-bold">{fullMethod}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Destination</span><span className="font-bold text-right break-all">{dest}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-extrabold">{fmtMoney(amtBDT)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Withdrawal fee ({Number(effPct.toFixed(2))}%)</span><span className="font-bold">{fmtMoney(fee)}</span></div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2"><span className="text-slate-500">You will receive</span><span className="font-extrabold text-emerald-600">{fmtMoney(Math.max(amtBDT - fee, 0))}</span></div>
            </div>
            <div className="space-y-2.5">
              <CheckLine ok={dest.trim().length >= 6}>Destination looks complete ({dest.trim().length} characters) — a wrong destination is the top reason cash outs fail</CheckLine>
              <CheckLine ok={amtBDT <= (w?.available ?? 0)}>Amount within your cash balance of {fmtMoney(w?.available ?? 0)}</CheckLine>
              <CheckLine ok warn={false}>The amount is locked while your request is processed, and returned in full if it is rejected</CheckLine>
            </div>
            <WizardNav onBack={() => setCstep(0)} nextLabel="Continue to confirm" onNext={() => setCstep(2)} />
          </div>
        )}
        {cstep === 2 && (
          <div className="space-y-4 anim-fade-up">
            <div className="rounded-2xl bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 p-4">
              <p className="font-extrabold text-sm">Acknowledgement</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">Cash outs are reviewed before payout. Submitting locks <b>{fmtMoney(amtBDT)}</b> until an admin completes or rejects the request — you will be notified either way.</p>
            </div>
            <PinField pin={pin} setPin={setPin} />
            <Btn className="w-full py-3.5" onClick={submit}>Submit for Approval</Btn>
            <button onClick={() => setCstep(1)} className="w-full text-center text-sm font-bold text-slate-500">Back to review</button>
            <p className="text-center text-xs text-slate-500">{t('pin_forgot_prefix')} <Link to="/withdraw" className="font-bold text-violet-600 underline underline-offset-2">{t('act_withdraw')}</Link></p>
          </div>
        )}
      </Card>
      <h3 className="font-extrabold mt-6 mb-3">Withdrawal history</h3>
      {mine.length === 0 ? <Card><Empty title="No withdrawals yet" /></Card> : (
        <div className="space-y-2">{mine.map(d => (
          <Card key={d.id} className="p-4 flex items-center gap-3">
            <div className="flex-1"><p className="font-bold">{fmtMoney(d.amount)} · {d.method}</p><p className="text-xs text-slate-400">{d.id} → {d.destination} · fee {fmtMoney(d.fee)} · {fmtDateTime(d.createdAt)}</p></div>
            <Badge tone={statusTone(d.status)}>{d.status}</Badge>
          </Card>))}
        </div>
      )}
      <SuccessModal open={done} onClose={() => setDone(false)} title="Cash out pending"
        rows={[['Status', 'Pending → Processing → Completed'], ['Track it', 'Withdrawal history above & Transactions']]} />
      <ResultModal open={!!errMsg} onClose={() => setErrMsg('')} kind="error" title="Cash out failed" body={errMsg} />
    </div>
  )
}

export function SendMoney() {
  const { db, user, sendMoney, walletOf, toast, t, currency, fmtMoney, toBDT } = useApp()
  const navigate = useNavigate()
  const [q, setQ] = useState(''); const [to, setTo] = useState<User | null>(null)
  const [sstep, setSstep] = useState(0)
  const [amount, setAmount] = useState(''); const [note, setNote] = useState(''); const [pin, setPin] = useState(''); const [receipt, setReceipt] = useState<any>(null); const [errMsg, setErrMsg] = useState('')
  const results = useMemo(() => {
    if (!q.trim()) return []
    const s = q.trim().toLowerCase()
    return db.users.filter(u => u.id !== user?.id && u.role === 'user' && (u.username.includes(s) || u.email.includes(s) || u.id.toLowerCase().includes(s) || u.name.toLowerCase().includes(s))).slice(0, 5)
  }, [q, db.users, user])
  const amt = Number(amount) || 0
  const amtBDT = Math.round(toBDT(amt))
  const discS = db.levels.find(l => l.level === user?.level)?.feeDiscountPct ?? 0
  const effPctS = db.settings.sendFeePct * (1 - discS / 100)
  const fee = Math.round(amtBDT * effPctS / 100 * 100) / 100
  const w = user ? walletOf(user.id) : null
  const submit = async () => {
    if (!to) return toast({ kind: 'error', title: 'Select a recipient first' })
    if (!amtBDT || amtBDT < 10) return toast({ kind: 'error', title: 'Minimum send amount is ' + fmtMoney(10) })
    const r = await sendMoney({ toUserId: to.id, amount: amtBDT, note: note || undefined, pin })
    if (typeof r === 'string') return setErrMsg(r)
    setReceipt(r); setPin('')
  }
  return (
    <div>
      <PageHead title={t('send_title')} sub={`Fee ${Number(effPctS.toFixed(2))}%${discS ? ` (Level ${user?.level} −${discS}%)` : ''} · ${t('available')} ${fmtMoney(w?.available ?? 0)}`} />
      <Card className="p-5">
        <StepBar steps={['Recipient & amount', 'Review', 'Confirm']} current={sstep} />
        {sstep === 0 && (
          <div className="space-y-4 anim-fade-up">
            <Input label={t('search_recipient')} placeholder="e.g. arif, arif@gmail.com, USR-…" value={q} onChange={e => { setQ(e.target.value); setTo(null) }} />
            {results.length > 0 && !to && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {results.map(u => (
                  <button key={u.id} onClick={() => setTo(u)} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-left">
                    <Avatar name={u.name} size={36} photo={u.photo} />
                    <span><span className="block font-bold text-sm">{u.name}</span><span className="text-xs text-slate-400">@{u.username} · {u.id}</span></span>
                  </button>
                ))}
              </div>
            )}
            {to && (
              <div className="rounded-2xl bg-violet-50 dark:bg-violet-500/10 p-4 flex items-center gap-3">
                <Avatar name={to.name} size={44} photo={to.photo} />
                <div className="flex-1"><p className="font-bold">{to.name} {to.kyc === 'verified' && '✅'}</p><p className="text-xs text-slate-500">@{to.username} · {to.email} · {to.id}</p></div>
                <button onClick={() => setTo(null)} className="text-xs font-bold text-violet-600">Change</button>
              </div>
            )}
            <Input label={`Amount (${currency})`} type="number" placeholder="e.g. 1000" value={amount} onChange={e => setAmount(e.target.value)} />
            {currency !== 'BDT' && amt > 0 && <p className="text-xs text-slate-400 -mt-2">≈ {fmtUSDT(amtBDT / db.settings.bdtPerUsd)} at today's rate.</p>}
            <Input label="Note (optional)" placeholder="What's it for?" value={note} onChange={e => setNote(e.target.value)} />
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Transfer fee</span><span className="font-bold">{fmtMoney(fee)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total debit</span><span className="font-bold">{fmtMoney(amtBDT + fee)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Your available balance</span><span className="font-bold">{fmtMoney(w?.available ?? 0)}</span></div>
            </div>
            <WizardNav nextLabel="Review transfer" nextDisabled={!to} onNext={() => {
              if (!to) return toast({ kind: 'error', title: 'Select a recipient first' })
              if (!amtBDT || amtBDT < 10) return toast({ kind: 'error', title: 'Minimum send amount is ' + fmtMoney(10) })
              if (amtBDT + fee > (w?.available ?? 0)) return toast({ kind: 'error', title: 'Insufficient balance (amount + fee exceeds available balance)' })
              setSstep(1)
            }} />
          </div>
        )}
        {sstep === 1 && to && (
          <div className="space-y-4 anim-fade-up">
            <div className="rounded-3xl bg-gradient-to-b from-violet-50 to-white dark:from-violet-500/10 dark:to-slate-900 border border-violet-100 dark:border-violet-500/20 p-4 flex items-center gap-3">
              <Avatar name={to.name} size={52} photo={to.photo} />
              <div><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">You are sending to</p><p className="font-extrabold text-lg leading-tight">{to.name} {to.kyc === 'verified' && '✅'}</p><p className="text-xs text-slate-500">@{to.username} · {to.id}</p></div>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-extrabold">{fmtMoney(amtBDT)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Transfer fee</span><span className="font-bold">{fmtMoney(fee)}</span></div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2"><span className="text-slate-500">Total debit from your wallet</span><span className="font-extrabold">{fmtMoney(amtBDT + fee)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{to.name.split(' ')[0]} receives</span><span className="font-bold text-emerald-600">{fmtMoney(amtBDT)}</span></div>
              {note && <div className="flex justify-between"><span className="text-slate-500">Note</span><span className="font-bold">{note}</span></div>}
            </div>
            {amtBDT >= 50000 && <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/25 p-4 text-sm"><b>⚠ Large transfer.</b> Please double-check the recipient — NovaWallet transfers are instant and cannot be reversed.</div>}
            <div className="space-y-2.5">
              <CheckLine ok>Recipient account is active{to.kyc === 'verified' ? ' and KYC-verified' : ''}</CheckLine>
              <CheckLine ok={amtBDT + fee <= (w?.available ?? 0)}>Amount + fee within your available balance</CheckLine>
            </div>
            <WizardNav onBack={() => setSstep(0)} nextLabel="Continue to confirm" onNext={() => setSstep(2)} />
          </div>
        )}
        {sstep === 2 && (
          <div className="space-y-4 anim-fade-up">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">To</span><span className="font-bold">{to?.name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total debit</span><span className="font-extrabold">{fmtMoney(amtBDT + fee)}</span></div>
            </div>
            <PinField pin={pin} setPin={setPin} />
            <Btn className="w-full py-3.5" onClick={submit}>Confirm &amp; Send {fmtMoney(amtBDT)}</Btn>
            <button onClick={() => setSstep(1)} className="w-full text-center text-sm font-bold text-slate-500">Back to review</button>
            <p className="text-center text-xs text-slate-500">{t('pin_forgot_prefix')} <Link to="/withdraw" className="font-bold text-violet-600 underline underline-offset-2">{t('act_withdraw')}</Link></p>
            <p className="text-[11px] text-center text-slate-400">Transfers above your available balance are always blocked server-side in production.</p>
          </div>
        )}
      </Card>
      <SuccessModal open={!!receipt} onClose={() => { setReceipt(null); navigate('/transactions') }} title="Transfer successful 🎉"
        rows={receipt ? [['Transaction ID', receipt.id], ['To', receipt.counterparty], ['Amount', fmtMoney(receipt.amount)], ['Fee', fmtMoney(receipt.fee)], ['Status', 'Completed']] : []} />
      <ResultModal open={!!errMsg} onClose={() => setErrMsg('')} kind="error" title="Transfer failed" body={errMsg} />
    </div>
  )
}

export function ReceiveMoney() {
  const { user, db, toast, t } = useApp()
  if (!user) return null
  const payload = `novawallet://pay/${user.id}`
  const incoming = db.txs.filter(t => t.userId === user.id && t.category === 'receive')
  const copy = (text: string, label: string) => { navigator.clipboard?.writeText(text); toast({ kind: 'success', title: label + ' copied' }) }
  return (
    <div>
      <PageHead title={t('receive_title')} sub={t('receive_sub')} />
      <Card className="p-6 text-center">
        <div className="inline-block rounded-3xl bg-white p-4 shadow-lg border border-slate-100">
          <QRCodeSVG value={payload} size={190} />
        </div>
        <p className="mt-4 font-extrabold text-lg">{user.name}</p>
        <p className="text-sm text-slate-500">@{user.username}</p>
        <div className="mt-4 space-y-2 text-left">
          {[['Payment ID (User ID)', user.id], ['Wallet address', payload], ['Phone', user.phone]].map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-4 py-3">
              <div className="flex-1 min-w-0"><p className="text-[11px] text-slate-400 uppercase font-bold">{k}</p><p className="font-mono text-sm truncate">{v}</p></div>
              <button onClick={() => copy(v, k)} className="p-2 rounded-xl bg-white dark:bg-slate-900 shadow"><Copy size={15} /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-4">
          <Btn variant="ghost" className="flex-1" onClick={() => { if (navigator.share) navigator.share({ title: 'Pay me on NovaWallet', text: payload }); else copy(payload, 'Payment link') }}><Share2 size={16} /> Share</Btn>
          <Btn variant="ghost" className="flex-1" onClick={() => toast({ kind: 'info', title: 'Tip', body: 'Screenshot the QR code to save it.' })}><Download size={16} /> Save QR</Btn>
        </div>
      </Card>
      <h3 className="font-extrabold mt-6 mb-3">Incoming payments</h3>
      {incoming.length === 0 ? <Card><Empty title="No incoming payments yet" /></Card> : (
        <div className="space-y-2">{incoming.map(t => (
          <Card key={t.id} className="p-4 flex items-center gap-3">
            <div className="flex-1"><p className="font-bold">{t.title}</p><p className="text-xs text-slate-400">{t.id} · {fmtDateTime(t.createdAt)}</p></div>
            <p className="font-extrabold text-emerald-600">+{fmtUSDT(t.amount / db.settings.bdtPerUsd)}</p><Badge tone={statusTone(t.status)}>{t.status}</Badge>
          </Card>))}
        </div>
      )}
    </div>
  )
}
export { PageHead, SuccessModal, ResultModal }
