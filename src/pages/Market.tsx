import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Star, TrendingDown, TrendingUp } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApp } from '../lib/store'
import { COIN_META, useMarket, type Coin } from '../lib/market'
import { Badge, Btn, Card, Input, Modal, SkeletonRows } from '../components/ui'
import { fmtBDT, fmtUSD } from '../lib/utils'
import { PageHead } from './Services'

export default function Market() {
  const { user, db, walletOf, buyCrypto, sellCrypto, toggleWatch, toast } = useApp()
  const { coins, loading, isLive } = useMarket()
  const [params] = useSearchParams()
  const [q, setQ] = useState(''); const [onlyWatch, setOnlyWatch] = useState(false)
  const [selected, setSelected] = useState<Coin | null>(null)
  const [mode, setMode] = useState<'buy' | 'sell'>(params.get('mode') === 'sell' ? 'sell' : 'buy')
  const [amount, setAmount] = useState('')
  const watch = db.watchlist[user?.id ?? ''] ?? []
  const w = user ? walletOf(user.id) : null
  const list = useMemo(() => coins.filter(c => (!onlyWatch || watch.includes(c.symbol)) && (c.name.toLowerCase().includes(q.toLowerCase()) || c.symbol.toLowerCase().includes(q.toLowerCase()))), [coins, q, onlyWatch, watch])
  const open = (c: Coin, m: 'buy' | 'sell') => { setSelected(c); setMode(m); setAmount('') }
  const trade = () => {
    if (!selected) return
    const live = coins.find(c => c.symbol === selected.symbol) ?? selected
    if (mode === 'buy') {
      const err = buyCrypto(selected.symbol, Number(amount), live.priceUsd)
      if (err) return toast({ kind: 'error', title: err })
      toast({ kind: 'success', title: 'Bought ' + selected.symbol, body: 'Executable price confirmed at trade time: ' + fmtUSD(live.priceUsd) })
    } else {
      const err = sellCrypto(selected.symbol, Number(amount), live.priceUsd)
      if (err) return toast({ kind: 'error', title: err })
      toast({ kind: 'success', title: 'Sold ' + selected.symbol })
    }
    setSelected(null)
  }
  const buyPreview = selected && mode === 'buy' && Number(amount) ? (Number(amount) / db.settings.bdtPerUsd / selected.priceUsd) : 0
  const sellPreview = selected && mode === 'sell' && Number(amount) ? Number(amount) * selected.priceUsd * db.settings.bdtPerUsd : 0
  return (
    <div>
      <PageHead title="Crypto Market" sub={isLive ? 'Live prices from CoinGecko · Market price ≠ guaranteed executable price' : 'Cached snapshot — live feed unreachable right now'} />
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search coins…" className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/70 pl-10 pr-4 py-3 text-[15px] outline-none focus:ring-2 focus:ring-violet-500" />
        </div>
        <button onClick={() => setOnlyWatch(v => !v)} className={`px-4 rounded-2xl font-bold text-sm flex items-center gap-1.5 ${onlyWatch ? 'bg-amber-500 text-white' : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700'}`}><Star size={16} /> Watchlist</button>
      </div>
      {loading ? <SkeletonRows n={6} /> : list.length === 0 ? <Card className="p-6 text-center text-slate-500">No coins match.</Card> : (
        <div className="space-y-3">
          {list.map(c => {
            const data = c.spark.filter((_, i) => i % Math.max(1, Math.floor(c.spark.length / 24)) === 0).map((v, i) => ({ i, v }))
            const held = w?.holdings[c.symbol] ?? 0
            const up = c.change24h >= 0
            return (
              <Card key={c.symbol} className="p-4">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-full flex items-center justify-center text-white font-extrabold" style={{ background: COIN_META[c.symbol].color }}>{c.symbol[0]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold flex items-center gap-1.5">{c.name}
                      <button onClick={() => toggleWatch(c.symbol)}><Star size={15} className={watch.includes(c.symbol) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} /></button>
                    </p>
                    <p className="text-xs text-slate-400">{c.symbol} · MCap {fmtUSD(c.marketCap, 0)}{held > 0 ? ` · You hold ${held}` : ''}</p>
                  </div>
                  <div className="w-20 h-10 hidden sm:block">
                    <ResponsiveContainer><AreaChart data={data}><Area type="monotone" dataKey="v" stroke={up ? '#10b981' : '#f43f5e'} fill={up ? '#10b98133' : '#f43f5e33'} strokeWidth={2} /></AreaChart></ResponsiveContainer>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold">{fmtUSD(c.priceUsd, c.priceUsd < 10 ? 3 : 0)}</p>
                    <p className={`text-xs font-bold flex items-center justify-end gap-0.5 ${up ? 'text-emerald-500' : 'text-rose-500'}`}>{up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{up ? '+' : ''}{c.change24h.toFixed(2)}% · 24h</p>
                    <p className="text-[11px] text-slate-400">{fmtBDT(Math.round(c.priceUsd * db.settings.bdtPerUsd))}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Btn className="flex-1 !py-2" onClick={() => open(c, 'buy')}>Buy</Btn>
                  <Btn variant="ghost" className="flex-1 !py-2" onClick={() => open(c, 'sell')}>Sell</Btn>
                  <Btn variant="outline" className="flex-1 !py-2" onClick={() => open(c, 'buy')}>Details</Btn>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${mode === 'buy' ? 'Buy' : 'Sell'} ${selected.name}` : ''}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
              {(['buy', 'sell'] as const).map(m => <button key={m} onClick={() => setMode(m)} className={`py-2 rounded-xl text-sm font-bold capitalize ${mode === m ? (m === 'buy' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white') : 'text-slate-500'}`}>{m}</button>)}
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">Market price</span><span className="font-bold">{fmtUSD(selected.priceUsd)} <Badge tone={selected.live ? 'green' : 'amber'}>{selected.live ? 'Live' : 'Cached'}</Badge></span></div>
              <div className="flex justify-between"><span className="text-slate-500">24h change</span><span className={`font-bold ${selected.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{selected.change24h.toFixed(2)}%</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Your balance</span><span className="font-bold">{mode === 'buy' ? fmtBDT(w?.available ?? 0) : `${w?.holdings[selected.symbol] ?? 0} ${selected.symbol}`}</span></div>
            </div>
            <div className="h-28">
              <ResponsiveContainer>
                <AreaChart data={selected.spark.filter((_, i) => i % Math.max(1, Math.floor(selected.spark.length / 30)) === 0).map((v, i) => ({ i, v }))}>
                  <XAxis dataKey="i" hide /><YAxis hide domain={['dataMin', 'dataMax']} />
                  <Tooltip formatter={(v: any) => fmtUSD(Number(v))} labelFormatter={() => '7d trend'} />
                  <Area type="monotone" dataKey="v" stroke="#8b5cf6" fill="#8b5cf633" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <Input label={mode === 'buy' ? 'Amount in BDT' : `Amount in ${selected.symbol}`} type="number" placeholder={mode === 'buy' ? 'e.g. 5000' : 'e.g. 0.01'} value={amount} onChange={e => setAmount(e.target.value)} />
            {Number(amount) > 0 && <p className="text-sm text-slate-500">You {mode === 'buy' ? `receive ≈ ${buyPreview.toFixed(6)} ${selected.symbol}` : `receive ≈ ${fmtBDT(Math.round(sellPreview))}`}. Final executable price is confirmed at execution.</p>}
            <Btn className="w-full py-3.5" variant={mode === 'buy' ? 'primary' : 'danger'} disabled={!Number(amount)} onClick={trade}>{mode === 'buy' ? 'Buy' : 'Sell'} {selected.symbol}</Btn>
          </div>
        )}
      </Modal>
    </div>
  )
}
