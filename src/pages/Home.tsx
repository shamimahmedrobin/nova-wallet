import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, Bitcoin, ChevronRight, Eye, EyeOff, Gift, HandCoins, Lock, QrCode, Send, ShoppingCart, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useApp } from '../lib/store'
import { COIN_META, useMarket } from '../lib/market'
import { fmtBDT, fmtUSD } from '../lib/utils'
import { Badge, Card, SkeletonRows, statusTone } from '../components/ui'

const ACTIONS_RAW = [
  { to: '/app/add', labelKey: 'act_add', icon: ArrowDownToLine, g: 'from-emerald-500 to-teal-600' },
  { to: '/app/cashout', labelKey: 'act_cashout', icon: ArrowUpFromLine, g: 'from-rose-500 to-pink-600' },
  { to: '/app/send', labelKey: 'act_send', icon: Send, g: 'from-violet-500 to-purple-600' },
  { to: '/app/receive', labelKey: 'act_receive', icon: QrCode, g: 'from-cyan-500 to-blue-600' },
  { to: '/app/referral', labelKey: 'act_referral', icon: Gift, g: 'from-amber-500 to-orange-600' },
  { to: '/app/loan', labelKey: 'act_loan', icon: HandCoins, g: 'from-indigo-500 to-blue-700' },
  { to: '/app/market', labelKey: 'act_buy', icon: Bitcoin, g: 'from-orange-500 to-amber-600' },
  { to: '/app/market?mode=sell', labelKey: 'act_sell', icon: ShoppingCart, g: 'from-fuchsia-500 to-purple-700' },
]
export default function Home() {
  const { user, db, walletOf, t, fmtMoney, currency } = useApp()
  const navigate = useNavigate()
  const { coins, loading, isLive } = useMarket()
  const [hide, setHide] = useState(false)
  const [bannerIdx, setBannerIdx] = useState(0)
  const activeBanners = db.banners.filter(b => b.active)
  useEffect(() => {
    if (activeBanners.length < 2) return
    const t = setInterval(() => setBannerIdx(i => (i + 1) % activeBanners.length), 5000)
    return () => clearInterval(t)
  }, [activeBanners.length])
  const w = user ? walletOf(user.id) : null
  const priceOf = (s: string) => coins.find(c => c.symbol === s)?.priceUsd ?? 0
  const cryptoBdt = useMemo(() => w ? Object.entries(w.holdings).reduce((sum, [s, amt]) => sum + amt * priceOf(s) * db.settings.bdtPerUsd, 0) : 0, [w, coins, db.settings.bdtPerUsd])
  if (!user || !w) return null
  const total = w.available + w.locked + cryptoBdt
  const myTxs = db.txs.filter(t => t.userId === user.id).slice(0, 5)
  const myRefs = db.users.filter(u => u.referredBy === user.id)
  const refEarned = db.referralEarnings.filter(r => r.userId === user.id).reduce((s, r) => s + r.amount, 0)
  const money = (n: number) => hide ? '••••••' : fmtMoney(n)
  const ACTIONS = ACTIONS_RAW.map(a => ({ ...a, label: t(a.labelKey) }))

  return (
    <div className="space-y-5 anim-fade-up">
      {/* Balance card */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-violet-700 via-purple-700 to-indigo-800 text-white p-6 shadow-2xl shadow-violet-700/30">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-cyan-400/20 blur-2xl" />
        <div className="absolute -left-8 -bottom-14 w-44 h-44 rounded-full bg-fuchsia-500/20 blur-2xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70 flex items-center gap-1.5"><Wallet size={13} /> {t('total_balance')}</p>
            <button onClick={() => setHide(h => !h)} className="p-2 rounded-full bg-white/15">{hide ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
          <p className="mt-1 text-4xl font-extrabold tracking-tight">{money(total)} <span className="text-xl font-extrabold text-white/85 align-middle">{currency}</span></p>
          {currency === 'USD'
            ? <p className="text-white/70 text-sm">≈ {hide ? '••••' : fmtBDT(total)} BDT</p>
            : <p className="text-white/70 text-sm">≈ {hide ? '••••' : fmtUSD(total / db.settings.bdtPerUsd)} USD</p>}
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[{ l: t('available'), v: w.available, lock: false }, { l: t('locked'), v: w.locked, lock: true }, { l: t('in_crypto'), v: Math.round(cryptoBdt), lock: false }].map(x => (
              <div key={x.l} className="rounded-2xl bg-white/12 backdrop-blur px-3 py-2.5">
                <p className="text-[11px] text-white/70 flex items-center gap-1">{x.lock && <Lock size={10} />}{x.l}</p>
                <p className="font-bold text-[15px]">{money(x.v)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="text-[11px] text-white/70 whitespace-nowrap overflow-hidden text-ellipsis">{user.id} · {user.kyc === 'verified' ? '✅ ' + t('verified') : '⚪ ' + t('non_kyc')}</p>
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap">🏅 {t('level')} {user.level}</span>
              {user.level < 4 && <button onClick={() => navigate('/app/profile')} className="rounded-full bg-white text-violet-700 px-2.5 py-1 text-[11px] font-extrabold shadow whitespace-nowrap">{t('upgrade')} ⬆</button>}
            </span>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-x-3 gap-y-5">
        {ACTIONS.map(a => (
          <button key={a.label} onClick={() => navigate(a.to)} className="flex flex-col items-center gap-2 group">
            <span className={`w-14 h-14 rounded-[20px] bg-gradient-to-br ${a.g} text-white flex items-center justify-center shadow-lg group-active:scale-95 transition`}><a.icon size={23} /></span>
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 text-center leading-tight">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Banners — single full-width rotating banner, aligned with the cards above/below */}
      {activeBanners.length > 0 && (
        <div>
          <div key={activeBanners[bannerIdx % activeBanners.length].id} className={`anim-fade-up w-full rounded-3xl bg-gradient-to-br ${activeBanners[bannerIdx % activeBanners.length].gradient} text-white p-5`}>
            <p className="font-extrabold text-lg leading-snug">{activeBanners[bannerIdx % activeBanners.length].title}</p>
            <p className="text-white/80 text-sm mt-1">{activeBanners[bannerIdx % activeBanners.length].subtitle}</p>
          </div>
          <div className="flex justify-center gap-1.5 mt-2.5">
            {activeBanners.map((b, i) => (
              <button key={b.id} onClick={() => setBannerIdx(i)} aria-label={'Banner ' + (i + 1)} className={`h-1.5 rounded-full transition-all ${i === bannerIdx % activeBanners.length ? 'w-6 bg-violet-600' : 'w-1.5 bg-slate-300 dark:bg-slate-700'}`} />
            ))}
          </div>
        </div>
      )}

      {/* Market overview */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-extrabold text-slate-900 dark:text-white">{t('crypto_market')}</h2>
          <Link to="/app/market" className="text-sm font-bold text-violet-600 flex items-center">{t('view_all')} <ChevronRight size={15} /></Link>
        </div>
        <p className="text-[11px] text-slate-400 mb-3">{isLive ? '🟢 ' + t('live_prices') : '🟡 ' + t('cached_prices')}</p>
        {loading ? <SkeletonRows n={3} /> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {coins.slice(0, 3).map(c => (
              <button key={c.symbol} onClick={() => navigate('/app/market')} className="w-full flex items-center gap-3 py-3 text-left">
                <span className="w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-sm" style={{ background: COIN_META[c.symbol].color }}>{c.symbol[0]}</span>
                <span className="flex-1"><span className="block font-bold text-slate-800 dark:text-slate-100">{c.name}</span><span className="text-xs text-slate-400">{c.symbol} · {fmtBDT(Math.round(c.priceUsd * db.settings.bdtPerUsd))}</span></span>
                <span className="text-right"><span className="block font-bold">{fmtUSD(c.priceUsd, c.priceUsd < 10 ? 2 : 0)}</span>
                  <span className={`text-xs font-bold flex items-center justify-end gap-0.5 ${c.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{c.change24h >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{c.change24h >= 0 ? '+' : ''}{c.change24h.toFixed(2)}%</span></span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex justify-between items-center mb-2"><h3 className="font-extrabold">{t('referral_earnings')}</h3><Link to="/app/referral" className="text-violet-600"><ChevronRight /></Link></div>
          <p className="text-3xl font-extrabold text-violet-600">{fmtMoney(refEarned)}</p>
          <p className="text-sm text-slate-500 mt-1">{myRefs.length} {t('friends_joined')} · {db.settings.referralPct}% {t('commission_rate')}</p>
        </Card>
        <Card className="p-5">
          <div className="flex justify-between items-center mb-2"><h3 className="font-extrabold">{t('latest_news')}</h3><Link to="/app/news" className="text-violet-600"><ChevronRight /></Link></div>
          {db.news.slice(0, 2).map(n => <Link key={n.id} to={'/app/news/' + n.id} className="block py-1.5"><p className="font-semibold text-sm leading-snug hover:text-violet-600">{n.title}</p><p className="text-[11px] text-slate-400">{n.source}</p></Link>)}
        </Card>
      </div>

      {/* Recent transactions */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-extrabold text-slate-900 dark:text-white">{t('recent_transactions')}</h2>
          <Link to="/app/transactions" className="text-sm font-bold text-violet-600 flex items-center">{t('see_all')} <ChevronRight size={15} /></Link>
        </div>
        {myTxs.length === 0 ? <p className="text-sm text-slate-500 py-4 text-center">{t('no_transactions_yet')}</p> : myTxs.map(t => (
          <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{t.title}</p><p className="text-[11px] text-slate-400">{t.id} · {new Date(t.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p></div>
            <div className="text-right"><p className="font-bold text-sm">{fmtMoney(t.amount)}</p><Badge tone={statusTone(t.status)}>{t.status}</Badge></div>
          </div>
        ))}
      </Card>
    </div>
  )
}
