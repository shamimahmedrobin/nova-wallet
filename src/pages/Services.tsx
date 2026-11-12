import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Copy, Download, Share2, Upload } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useApp } from '../lib/store'
import { Badge, Btn, Card, Empty, Input, Modal, PinField, Select, statusTone , MaxBtn } from '../components/ui'
import { fmtDateTime, fmtUSDT } from '../lib/utils'
import type { User } from '../lib/types'

import { depositMethods, withdrawMethods, CRYPTO_NETWORKS, CRYPTO_NETWORK_LABELS } from '../lib/localPayments'

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

export function AddMoney() {
  const { addDeposit, db, user, toast, t, currency, fmtMoney, toBDT } = useApp()
  const depMethods = depositMethods(currency, db.settings.payMethods)
  const [method, setMethod] = useState(''); const [amount, setAmount] = useState(''); const [trx, setTrx] = useState(''); const [receipt, setReceipt] = useState(''); const [network, setNetwork] = useState('')
  const [done, setDone] = useState(false); const [lastAmt, setLastAmt] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const mine = db.deposits.filter(d => d.userId === user?.id)
  const activeMethod = depMethods.find(m => m.label === method) ?? depMethods[0]
  const isCrypto = activeMethod.label === 'Crypto Deposit'
  const activeNetwork = CRYPTO_NETWORKS.find(n => n.label === network) ?? CRYPTO_NETWORKS[0]
  const methodLabel = isCrypto ? 'Crypto Deposit · ' + activeNetwork.label : activeMethod.label
  const shownDetail = isCrypto && activeNetwork.label !== 'Tron (TRC20)' ? activeNetwork.detail : activeMethod.detail
  const amtBDT = Math.round(toBDT(Number(amount) || 0))
  const submit = () => {
    if (!amtBDT || amtBDT < 10) return toast({ kind: 'error', title: 'Enter an amount of at least ' + fmtMoney(10) })
    if (activeMethod.label !== 'Crypto Deposit' && trx.trim().length < 6) return toast({ kind: 'error', title: 'Enter the payment Transaction ID' })
    addDeposit({ method: methodLabel, amount: amtBDT, trxId: trx.trim() || 'CRYPTO-' + Date.now(), receipt: receipt || undefined })
    setLastAmt(amtBDT); setDone(true); setAmount(''); setTrx(''); setReceipt('')
  }
  return (
    <div>
      <PageHead title={t('add_title')} sub={t('add_sub')} />
      <Card className="p-5 space-y-4">
        <Select label={t('payment_method')} value={activeMethod.label} onChange={(e: any) => setMethod(e.target.value)}>{depMethods.map(m => <option key={m.label}>{m.label}</option>)}</Select>
        {isCrypto && <Select label="Crypto network / transfer system" value={activeNetwork.label} onChange={(e: any) => setNetwork(e.target.value)}>{CRYPTO_NETWORKS.map(n => <option key={n.label}>{n.label}</option>)}</Select>}
        <div className="rounded-2xl bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 p-4 text-sm">
          <p className="font-bold text-violet-700 dark:text-violet-300 mb-1">Payment instructions</p>
          <p className="text-slate-600 dark:text-slate-300">Send money to: <span className="font-mono font-bold">{shownDetail}</span></p>
          <p className="text-slate-500 mt-1">Then enter the amount and Transaction ID below. Status flow: Pending → Approved (credited) / Rejected.</p>
        </div>
        <Input label={`Amount (${currency})`} type="number" placeholder="e.g. 5000" value={amount} onChange={e => setAmount(e.target.value)} />
        {currency !== 'BDT' && Number(amount) > 0 && <p className="text-xs text-slate-400 -mt-2">≈ {fmtUSDT(amtBDT / db.settings.bdtPerUsd)} will be credited after approval, at today's rate.</p>}
        <Input label={isCrypto ? 'Transaction hash (optional)' : 'Transaction ID'} placeholder={isCrypto ? 'Paste the transaction hash' : 'e.g. BKX92KD81P'} value={trx} onChange={e => setTrx(e.target.value)} />
        <div>
          <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Payment receipt (optional)</span>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setReceipt(e.target.files?.[0]?.name ?? '')} />
          <Btn variant="outline" onClick={() => fileRef.current?.click()}><Upload size={16} /> {receipt || 'Upload receipt screenshot'}</Btn>
        </div>
        <Btn className="w-full py-3.5" onClick={submit}>{t('submit_deposit')}</Btn>
      </Card>
      <h3 className="font-extrabold mt-6 mb-3">My deposit requests</h3>
      {mine.length === 0 ? <Card><Empty title="No deposits yet" /></Card> : (
        <div className="space-y-2">{mine.map(d => (
          <Card key={d.id} className="p-4 flex items-center gap-3">
            <div className="flex-1"><p className="font-bold">{fmtMoney(d.amount)} · {d.method}</p><p className="text-xs text-slate-400">{d.id} · TrxID {d.trxId} · {fmtDateTime(d.createdAt)}</p></div>
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
  const [done, setDone] = useState(false)
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
  const submit = () => {
    if (!amtBDT || amtBDT < 50) return toast({ kind: 'error', title: 'Minimum cash out is ' + fmtMoney(50) })
    if (!dest.trim()) return toast({ kind: 'error', title: 'Enter the destination account' })
    const err = requestWithdraw({ method: fullMethod, amount: amtBDT, destination: dest.trim(), pin })
    if (err) return toast({ kind: 'error', title: err })
    setDone(true); setAmount(''); setPin('')
    toast({ kind: 'success', title: 'Cash out requested', body: 'Amount locked until processed.' })
  }
  return (
    <div>
      <PageHead title={t('cashout_title')} sub={`${t('available')}: ${fmtMoney(w?.available ?? 0)} · Fee ${Number(effPct.toFixed(2))}%${disc ? ` (Level ${user?.level} −${disc}%)` : ''} · Daily limit ${fmtMoney(db.levels.find(l => l.level === user?.level)?.dailyLimit ?? 0)}`} />
      <Card className="p-5 space-y-4">
        <Select label="Withdrawal method" value={activeOut} onChange={(e: any) => setMethod(e.target.value)}>{outMethods.map(m => <option key={m}>{m}</option>)}</Select>
        {isCrypto && <Select label="Crypto network / transfer system" value={activeNetwork} onChange={(e: any) => setNetwork(e.target.value)}>{CRYPTO_NETWORK_LABELS.map(n => <option key={n}>{n}</option>)}</Select>}
        <div className="relative">
          <Input label={`Amount (${currency})`} type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          <MaxBtn onClick={() => setAmount(String(Math.round(fromBDT(w?.available ?? 0) * 100) / 100))} />
        </div>
        {currency !== 'BDT' && amt > 0 && <p className="text-xs text-slate-400 -mt-2">≈ {fmtUSDT(amtBDT / db.settings.bdtPerUsd)} at today's rate.</p>}
        <Input label={destLabel} value={dest} onChange={e => setDest(e.target.value)} />
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Withdrawal fee</span><span className="font-bold">{fmtMoney(fee)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">You will receive</span><span className="font-bold text-emerald-600">{fmtMoney(Math.max(amtBDT - fee, 0))}</span></div>
        </div>
        <PinField pin={pin} setPin={setPin} />
        <Btn className="w-full py-3.5" onClick={submit}>{t('confirm_cashout')}</Btn>
        <p className="text-center text-xs text-slate-500">{t('pin_forgot_prefix')} <Link to="/withdraw" className="font-bold text-violet-600 underline underline-offset-2">{t('act_withdraw')}</Link></p>
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
    </div>
  )
}

export function SendMoney() {
  const { db, user, sendMoney, walletOf, toast, t, currency, fmtMoney, toBDT } = useApp()
  const navigate = useNavigate()
  const [q, setQ] = useState(''); const [to, setTo] = useState<User | null>(null)
  const [amount, setAmount] = useState(''); const [note, setNote] = useState(''); const [pin, setPin] = useState(''); const [receipt, setReceipt] = useState<any>(null)
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
  const submit = () => {
    if (!to) return toast({ kind: 'error', title: 'Select a recipient first' })
    if (!amtBDT || amtBDT < 10) return toast({ kind: 'error', title: 'Minimum send amount is ' + fmtMoney(10) })
    const r = sendMoney({ toUserId: to.id, amount: amtBDT, note: note || undefined, pin })
    if (typeof r === 'string') return toast({ kind: 'error', title: r })
    setReceipt(r); setPin('')
  }
  return (
    <div>
      <PageHead title={t('send_title')} sub={`Fee ${Number(effPctS.toFixed(2))}%${discS ? ` (Level ${user?.level} −${discS}%)` : ''} · ${t('available')} ${fmtMoney(w?.available ?? 0)}`} />
      <Card className="p-5 space-y-4">
        <Input label={t('search_recipient')} placeholder="e.g. arif, arif@gmail.com, USR-…" value={q} onChange={e => { setQ(e.target.value); setTo(null) }} />
        {results.length > 0 && !to && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {results.map(u => (
              <button key={u.id} onClick={() => setTo(u)} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-left">
                <span className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-white flex items-center justify-center text-xs font-bold">{u.name.split(' ').map(x => x[0]).slice(0, 2).join('')}</span>
                <span><span className="block font-bold text-sm">{u.name}</span><span className="text-xs text-slate-400">@{u.username} · {u.id}</span></span>
              </button>
            ))}
          </div>
        )}
        {to && (
          <div className="rounded-2xl bg-violet-50 dark:bg-violet-500/10 p-4 flex items-center gap-3">
            <span className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-white flex items-center justify-center font-bold">{to.name.split(' ').map(x => x[0]).slice(0, 2).join('')}</span>
            <div><p className="font-bold">{to.name} {to.kyc === 'verified' && '✅'}</p><p className="text-xs text-slate-500">@{to.username} · {to.email} · {to.id}</p></div>
          </div>
        )}
        <Input label={`Amount (${currency})`} type="number" placeholder="e.g. 1000" value={amount} onChange={e => setAmount(e.target.value)} />
        {currency !== 'BDT' && amt > 0 && <p className="text-xs text-slate-400 -mt-2">≈ {fmtUSDT(amtBDT / db.settings.bdtPerUsd)} at today's rate.</p>}
        <Input label="Note (optional)" placeholder="What's it for?" value={note} onChange={e => setNote(e.target.value)} />
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Transfer fee</span><span className="font-bold">{fmtMoney(fee)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Total debit</span><span className="font-bold">{fmtMoney(amtBDT + fee)}</span></div>
        </div>
        <PinField pin={pin} setPin={setPin} />
        <Btn className="w-full py-3.5" disabled={!to} onClick={submit}>Review & send</Btn>
        <p className="text-center text-xs text-slate-500">{t('pin_forgot_prefix')} <Link to="/withdraw" className="font-bold text-violet-600 underline underline-offset-2">{t('act_withdraw')}</Link></p>
        <p className="text-[11px] text-center text-slate-400">Transfers above your available balance are always blocked server-side in production.</p>
      </Card>
      <SuccessModal open={!!receipt} onClose={() => { setReceipt(null); navigate('/transactions') }} title="Transfer successful 🎉"
        rows={receipt ? [['Transaction ID', receipt.id], ['To', receipt.counterparty], ['Amount', fmtMoney(receipt.amount)], ['Fee', fmtMoney(receipt.fee)], ['Status', 'Completed']] : []} />
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
export { PageHead, SuccessModal }
