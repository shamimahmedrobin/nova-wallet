import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftRight, Award, TrendingDown, TrendingUp } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { useApp } from '../lib/store'
import { COIN_META, useMarket } from '../lib/market'
import { Badge, Btn, Card, Empty, Input, MaxBtn, Modal, Select } from '../components/ui'
import { fmtBDT, fmtDateTime, fmtUSD } from '../lib/utils'
import { PageHead, SuccessModal } from './Services'

export function Level2GateModal({ open, onClose, feature }: { open: boolean; onClose: () => void; feature: string }) {
  const navigate = useNavigate()
  return (
    <Modal open={open} onClose={onClose} title="Level 2 required">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-violet-600/30 mb-3"><Award size={30} /></div>
        <p className="font-extrabold text-lg">Upgrade to Level 2</p>
        <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{feature} is available on <b className="text-slate-700 dark:text-slate-200">Level 2</b> accounts and above. Your account is currently <b className="text-slate-700 dark:text-slate-200">Level 1</b>. Submit your KYC and request an upgrade — it only takes a minute.</p>
      </div>
      <div className="flex gap-2.5 mt-5">
        <Btn variant="outline" className="flex-1 py-3.5" onClick={onClose}>Cancel</Btn>
        <Btn className="flex-1 py-3.5" onClick={() => { onClose(); navigate('/profile', { state: { openLevels: true } }) }}>Upgrade ⬆</Btn>
      </div>
    </Modal>
  )
}

const OUT_METHODS = ['bKash', 'Nagad', 'Rocket', 'Bank Account', 'Crypto Wallet']

export function DirectWithdraw() {
  const { directWithdraw, db, user, walletOf, toast, t } = useApp()
  const [method, setMethod] = useState('bKash'); const [amount, setAmount] = useState(''); const [dest, setDest] = useState(user?.phone ?? '')
  const [gate, setGate] = useState(false)
  const [done, setDone] = useState(false)
  const [lastTx, setLastTx] = useState<{ amount: number; method: string } | null>(null)
  const amt = Number(amount) || 0
  const fee = Math.round(amt * db.settings.cashoutFeePct / 100)
  const w = user ? walletOf(user.id) : null
  const mine = db.txs.filter(x => x.userId === user?.id && x.category === 'direct_withdraw')
  const submit = () => {
    if (!amt || amt < 50) return toast({ kind: 'error', title: 'Minimum direct withdraw is ৳50' })
    if (!dest.trim()) return toast({ kind: 'error', title: 'Enter the destination account' })
    if (user && user.level < 2) return setGate(true)
    const err = directWithdraw({ method, amount: amt, destination: dest.trim() })
    if (err) return toast({ kind: 'error', title: err })
    setLastTx({ amount: amt, method }); setDone(true); setAmount('')
    toast({ kind: 'success', title: 'Withdrawal completed', body: 'Money sent instantly — no admin review needed.' })
  }
  if (!user) return null
  return (
    <div>
      <PageHead title="Direct Withdraw" sub={`Instant · No PIN needed · Level 2 · ${t('available')}: ${fmtBDT(w?.available ?? 0)}`} />
      <Card className="p-5 space-y-4">
        <Select label="Withdrawal method" value={method} onChange={(e: any) => setMethod(e.target.value)}>{OUT_METHODS.map(m => <option key={m}>{m}</option>)}</Select>
        <div className="relative">
          <Input label={t('amount_bdt')} type="number" placeholder="e.g. 10000" value={amount} onChange={e => setAmount(e.target.value)} />
          <MaxBtn onClick={() => setAmount(String(w?.available ?? 0))} />
        </div>
        <Input label="Destination account / number / address" placeholder="01XXXXXXXXX" value={dest} onChange={e => setDest(e.target.value)} />
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Withdrawal fee</span><span className="font-bold">{fmtBDT(fee)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">You will receive</span><span className="font-bold text-emerald-600">{fmtBDT(Math.max(amt - fee, 0))}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Speed</span><span className="font-bold text-emerald-600">⚡ Instant</span></div>
          <div className="flex justify-between"><span className="text-slate-500">PIN / password</span><span className="font-bold text-emerald-600">Not required</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Account level</span><span className="font-bold">Level 2+</span></div>
        </div>
        <Btn className="w-full py-3.5" onClick={submit}>Withdraw now</Btn>
      </Card>
      <h3 className="font-extrabold mt-6 mb-3">Direct withdrawal history</h3>
      {mine.length === 0 ? <Card><Empty title="No direct withdrawals yet" /></Card> : (
        <div className="space-y-2">{mine.map(x => (
          <Card key={x.id} className="p-4 flex items-center gap-3"><div className="flex-1"><p className="font-bold">{x.title}</p><p className="text-xs text-slate-400">{x.id} · {fmtDateTime(x.createdAt)}</p></div><div className="text-right"><p className="font-bold">{fmtBDT(x.amount)}</p><Badge tone="green">completed</Badge></div></Card>
        ))}</div>
      )}
      <Level2GateModal open={gate} onClose={() => setGate(false)} feature="Direct Withdraw" />
      <SuccessModal open={done} onClose={() => setDone(false)} title="Withdrawal completed ⚡"
        rows={lastTx ? [['Amount', fmtBDT(lastTx.amount)], ['Method', lastTx.method], ['Speed', 'Instant'], ['Status', 'Completed']] : []} />
    </div>
  )
}

const PLANS = [
  { days: 0, apy: 5, label: 'Flexible', note: 'Withdraw anytime' },
  { days: 30, apy: 8, label: '30 days', note: 'Short term' },
  { days: 90, apy: 12, label: '90 days', note: 'Best value' },
  { days: 180, apy: 16, label: '180 days', note: 'Max return' },
]
export function EarnPage() {
  const { user, db, walletOf, stake, unstake, toast, t } = useApp()
  const [amount, setAmount] = useState(''); const [plan, setPlan] = useState(1)
  if (!user) return null
  const w = walletOf(user.id)
  const amt = Number(amount) || 0
  const myStakes = db.stakes.filter(s => s.userId === user.id)
  const accrued = (s: typeof myStakes[number]) => Math.round(s.amount * s.apy / 100 * Math.max(0, (Date.now() - new Date(s.startAt).getTime()) / 86_400_000) / 365)
  const totalStaked = myStakes.filter(s => s.status === 'active').reduce((a, s) => a + s.amount, 0)
  const totalEarned = myStakes.filter(s => s.status === 'active').reduce((a, s) => a + accrued(s), 0)
  const submit = () => {
    if (!amt || amt < 100) return toast({ kind: 'error', title: 'Minimum stake is ৳100' })
    const err = stake(amt, PLANS[plan].apy, PLANS[plan].days)
    if (err) return toast({ kind: 'error', title: err })
    setAmount(''); toast({ kind: 'success', title: 'Staked successfully', body: 'Your money is now earning ' + PLANS[plan].apy + '% APY.' })
  }
  return (
    <div>
      <PageHead title="Earn" sub="Stake BDT and earn daily interest. Unstake anytime (flexible) or at term." />
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-4 text-center"><p className="text-[11px] text-slate-400 uppercase font-bold">Available</p><p className="font-extrabold mt-1">{fmtBDT(w.available)}</p></Card>
        <Card className="p-4 text-center"><p className="text-[11px] text-slate-400 uppercase font-bold">Staked</p><p className="font-extrabold mt-1 text-violet-600">{fmtBDT(totalStaked)}</p></Card>
        <Card className="p-4 text-center"><p className="text-[11px] text-slate-400 uppercase font-bold">Earned</p><p className="font-extrabold mt-1 text-emerald-500">{fmtBDT(totalEarned)}</p></Card>
      </div>
      <Card className="p-5 space-y-4">
        <h3 className="font-extrabold">Choose a plan</h3>
        <div className="grid grid-cols-2 gap-2">
          {PLANS.map((p, i) => (
            <button key={p.label} onClick={() => setPlan(i)} className={`rounded-2xl border-2 p-3.5 text-left ${plan === i ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-slate-200/80 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-800/50'}`}>
              <p className="font-extrabold text-lg text-violet-600">{p.apy}% <span className="text-xs">APY</span></p>
              <p className="font-bold text-sm">{p.label}</p><p className="text-[11px] text-slate-400">{p.note}</p>
            </button>
          ))}
        </div>
        <Input label={t('amount_bdt')} type="number" placeholder="e.g. 5000" value={amount} onChange={e => setAmount(e.target.value)} />
        {amt > 0 && <p className="text-xs text-slate-500">Projected yearly earning: <b className="text-emerald-600">{fmtBDT(Math.round(amt * PLANS[plan].apy / 100))}</b></p>}
        <Btn className="w-full py-3.5" onClick={submit}>Stake now</Btn>
      </Card>
      <h3 className="font-extrabold mt-6 mb-3">My stakes</h3>
      {myStakes.length === 0 ? <Card><Empty title="No stakes yet" body="Pick a plan above to start earning." /></Card> : (
        <div className="space-y-2">{myStakes.map(s => (
          <Card key={s.id} className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1"><p className="font-bold">{fmtBDT(s.amount)} · {s.apy}% APY</p>
                <p className="text-xs text-slate-400">{s.termDays === 0 ? 'Flexible' : s.termDays + ' days'} · started {fmtDateTime(s.startAt)} · earned so far <b className="text-emerald-500">{fmtBDT(accrued(s))}</b></p></div>
              {s.status === 'active'
                ? <Btn variant="outline" className="!py-2 !text-xs" onClick={() => { const e = unstake(s.id); if (e) toast({ kind: 'error', title: e }); else toast({ kind: 'success', title: 'Unstaked', body: 'Principal + interest returned to your available balance.' }) }}>Unstake</Btn>
                : <Badge tone="slate">closed</Badge>}
            </div>
          </Card>
        ))}</div>
      )}
    </div>
  )
}

export function SwapPage() {
  const { user, db, walletOf, swap, toast } = useApp()
  const { coins } = useMarket()
  const [from, setFrom] = useState('BDT'); const [to, setTo] = useState('BTC'); const [amount, setAmount] = useState('')
  if (!user) return null
  const w = walletOf(user.id)
  const prices = useMemo(() => Object.fromEntries(coins.map(c => [c.symbol, c.priceUsd])), [coins])
  const rate = db.settings.bdtPerUsd
  const priceOf = (sym: string) => sym === 'BDT' ? 1 / rate : (prices[sym] ?? 0)
  const amt = Number(amount) || 0
  const usdGross = amt * priceOf(from)
  const receive = priceOf(to) ? (usdGross * 0.995) / priceOf(to) : 0
  const balanceOf = (sym: string) => sym === 'BDT' ? w.available : (w.holdings[sym] ?? 0)
  const assets = ['BDT', ...Object.keys(COIN_META)]
  const fmtAmt = (sym: string, v: number) => sym === 'BDT' ? fmtBDT(Math.round(v)) : v.toFixed(6) + ' ' + sym
  const submit = () => {
    if (!amt) return toast({ kind: 'error', title: 'Enter an amount' })
    const err = swap(from, to, amt, prices)
    if (err) return toast({ kind: 'error', title: err })
    setAmount(''); toast({ kind: 'success', title: 'Swap completed', body: 'Your balance has been updated.' })
  }
  return (
    <div>
      <PageHead title="Swap" sub="Instantly exchange BDT and crypto at live prices · 0.5% swap fee." />
      <Card className="p-5 space-y-4">
        <div>
          <Select label="From" value={from} onChange={(e: any) => { setFrom(e.target.value); if (e.target.value === to) setTo(from) }}>{assets.map(a => <option key={a} value={a}>{a} — balance {fmtAmt(a, balanceOf(a))}</option>)}</Select>
          <Input className="mt-3" type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div className="flex justify-center">
          <button onClick={() => { setFrom(to); setTo(from) }} className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition" aria-label="Flip pair"><ArrowLeftRight size={19} /></button>
        </div>
        <div>
          <Select label="To" value={to} onChange={(e: any) => { setTo(e.target.value); if (e.target.value === from) setFrom(to) }}>{assets.map(a => <option key={a} value={a}>{a} — balance {fmtAmt(a, balanceOf(a))}</option>)}</Select>
          <div className="mt-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4">
            <p className="text-xs text-slate-400 font-bold">YOU RECEIVE (EST.)</p>
            <p className="text-2xl font-extrabold mt-0.5">{fmtAmt(to, receive)}</p>
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Rate</span><span className="font-bold">1 {from} ≈ {priceOf(to) ? (priceOf(from) / priceOf(to)).toPrecision(4) : '—'} {to}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Swap fee (0.5%)</span><span className="font-bold">{fmtBDT(Math.round(usdGross * 0.005 * rate))}</span></div>
        </div>
        <Btn className="w-full py-3.5" onClick={submit}>Swap now</Btn>
      </Card>
    </div>
  )
}

export function TradePage() {
  const { user, db, walletOf, buyCrypto, sellCrypto, toast, t } = useApp()
  const { coins, loading, isLive } = useMarket()
  const [sel, setSel] = useState('BTC')
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('')
  if (!user) return null
  const w = walletOf(user.id)
  const coin = coins.find(c => c.symbol === sel) ?? coins[0]
  const amt = Number(amount) || 0
  const data = coin ? coin.spark.filter((_, i) => i % Math.max(1, Math.floor(coin.spark.length / 40)) === 0).map((v, i) => ({ i, v })) : []
  const up = (coin?.change24h ?? 0) >= 0
  const submit = () => {
    if (!coin || !amt) return toast({ kind: 'error', title: 'Enter an amount' })
    const err = side === 'buy' ? buyCrypto(coin.symbol, amt, coin.priceUsd) : sellCrypto(coin.symbol, amt, coin.priceUsd)
    if (err) return toast({ kind: 'error', title: err })
    setAmount(''); toast({ kind: 'success', title: (side === 'buy' ? 'Bought ' : 'Sold ') + coin.symbol, body: 'Executed at the confirmed market price.' })
  }
  return (
    <div>
      <PageHead title="Trade" sub={isLive ? 'Live spot trading · CoinGecko prices' : 'Cached prices — live feed unreachable'} />
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 -mx-4 px-4">
        {coins.map(c => (
          <button key={c.symbol} onClick={() => setSel(c.symbol)} className={`shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border-2 font-bold text-sm ${sel === c.symbol ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-slate-900'}`}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-extrabold" style={{ background: COIN_META[c.symbol].color }}>{c.symbol[0]}</span>{c.symbol}
            <span className={c.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}>{c.change24h >= 0 ? '+' : ''}{c.change24h.toFixed(1)}%</span>
          </button>
        ))}
      </div>
      {loading || !coin ? <Card className="p-8 text-center text-slate-400">Loading market…</Card> : (
        <>
          <Card className="p-5 mb-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div><p className="font-extrabold text-lg">{coin.name} <span className="text-slate-400 text-sm">{coin.symbol}/USD</span></p>
                <p className="text-3xl font-extrabold mt-1">{fmtUSD(coin.priceUsd, coin.priceUsd < 10 ? 2 : 0)}</p>
                <p className="text-sm text-slate-400">{fmtBDT(Math.round(coin.priceUsd * db.settings.bdtPerUsd))} · You hold <b className="text-slate-600 dark:text-slate-200">{(w.holdings[coin.symbol] ?? 0).toFixed(6)} {coin.symbol}</b></p></div>
              <span className={`flex items-center gap-1 font-extrabold ${up ? 'text-emerald-500' : 'text-rose-500'}`}>{up ? <TrendingUp size={17} /> : <TrendingDown size={17} />}{up ? '+' : ''}{coin.change24h.toFixed(2)}%</span>
            </div>
            <div className="h-36 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <YAxis hide domain={['dataMin', 'dataMax']} />
                  <Tooltip formatter={(v: any) => [fmtUSD(Number(v)), 'Price']} labelFormatter={() => ''} />
                  <Area type="monotone" dataKey="v" stroke={up ? '#10b981' : '#f43f5e'} fill={up ? '#10b98133' : '#f43f5e33'} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
              {(['buy', 'sell'] as const).map(x => (
                <button key={x} onClick={() => { setSide(x); setAmount('') }} className={`py-2.5 rounded-xl text-sm font-extrabold capitalize ${side === x ? (x === 'buy' ? 'bg-emerald-500 text-white shadow' : 'bg-rose-500 text-white shadow') : 'text-slate-500'}`}>{x === 'buy' ? t('buy') : t('sell')} {coin.symbol}</button>
              ))}
            </div>
            <div className="relative">
              <Input label={side === 'buy' ? t('amount_bdt') : `Amount (${coin.symbol})`} type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
              <MaxBtn onClick={() => setAmount(String(side === 'buy' ? w.available : (w.holdings[coin.symbol] ?? 0)))} />
            </div>
            {amt > 0 && <p className="text-xs text-slate-500">{side === 'buy'
              ? <>You receive ≈ <b>{(amt / db.settings.bdtPerUsd / coin.priceUsd).toFixed(6)} {coin.symbol}</b></>
              : <>You receive ≈ <b>{fmtBDT(Math.round(amt * coin.priceUsd * db.settings.bdtPerUsd))}</b></>}</p>}
            <Btn className={`w-full py-3.5 ${side === 'sell' ? '!bg-rose-500' : '!bg-emerald-500'}`} onClick={submit}>{side === 'buy' ? t('buy') : t('sell')} {coin.symbol}</Btn>
          </Card>
        </>
      )}
    </div>
  )
}
