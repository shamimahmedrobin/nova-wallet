import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Banknote, Bitcoin, ChevronRight, Eye, EyeOff, Gift, HandCoins, Lock, PiggyBank, QrCode, Send, ShoppingCart, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useApp } from '../lib/store'
import { COIN_META, useMarket } from '../lib/market'
import { fmtPrice, fmtUSDT, txAmountCls, txDirection, txSign } from '../lib/utils'
import { Badge, Card, Modal, SkeletonRows, TxDirIcon, statusTone } from '../components/ui'

const ACTIONS_RAW = [
  { to: '/add', labelKey: 'act_add', icon: ArrowDownToLine, g: 'from-emerald-500 to-teal-600' },
  { to: '/cashout', labelKey: 'act_cashout', icon: ArrowUpFromLine, g: 'from-rose-500 to-pink-600' },
  { to: '/send', labelKey: 'act_send', icon: Send, g: 'from-violet-500 to-purple-600' },
  { to: '/withdraw', labelKey: 'act_withdraw', icon: Banknote, g: 'from-blue-500 to-indigo-600' },
  { to: '/receive', labelKey: 'act_receive', icon: QrCode, g: 'from-cyan-500 to-blue-600' },
  { to: '/referral', labelKey: 'act_referral', icon: Gift, g: 'from-amber-500 to-orange-600' },
  { to: '/earn', labelKey: 'act_earn', icon: PiggyBank, g: 'from-lime-500 to-green-600' },
  { to: '/loan', labelKey: 'act_loan', icon: HandCoins, g: 'from-indigo-500 to-blue-700' },
  { to: '/crypto', labelKey: 'act_buy', icon: Bitcoin, g: 'from-orange-500 to-amber-600' },
  { to: '/crypto?mode=sell', labelKey: 'act_sell', icon: ShoppingCart, g: 'from-fuchsia-500 to-purple-700' },
  { to: '/swap', labelKey: 'act_swap', icon: ArrowLeftRight, g: 'from-purple-500 to-violet-700' },
  { to: '/trade', labelKey: 'act_trade', icon: TrendingUp, g: 'from-slate-600 to-slate-800' },
]
export default function Home() {
  const { user, db, walletOf, t, fmtMoney, fmtAmount, currency } = useApp()
  const navigate = useNavigate()
  // Live balance: while the user holds crypto, prices (and therefore the
  // balance card) refresh every 10 seconds; otherwise every 60s is plenty.
  const wEarly = user ? walletOf(user.id) : null
  const holdsCrypto = !!wEarly && Object.entries(wEarly.holdings).some(([s, a]) => s !== 'USDT' && a > 0)
  const { coins, loading, isLive } = useMarket(holdsCrypto ? 10_000 : 60_000)
  const [hide, setHide] = useState(false)
  const [bd, setBd] = useState<null | 'available' | 'locked' | 'crypto'>(null)
  const [bannerIdx, setBannerIdx] = useState(0)
  const activeBanners = db.banners.filter(b => b.active)
  useEffect(() => {
    if (activeBanners.length < 2) return
    const t = setInterval(() => setBannerIdx(i => (i + 1) % activeBanners.length), 5000)
    return () => clearInterval(t)
  }, [activeBanners.length])
  const w = user ? walletOf(user.id) : null
  const priceOf = (s: string) => coins.find(c => c.symbol === s)?.priceUsd ?? 0
  const usdtBdt = w ? (w.holdings.USDT ?? 0) * db.settings.bdtPerUsd : 0
  const cryptoBdt = useMemo(() => w ? Object.entries(w.holdings).filter(([s]) => s !== 'USDT').reduce((sum, [s, amt]) => sum + amt * priceOf(s) * db.settings.bdtPerUsd, 0) : 0, [w, coins, db.settings.bdtPerUsd])
  if (!user || !w) return null
  const total = w.available + w.locked + usdtBdt + cryptoBdt
  const myTxs = db.txs.filter(t => t.userId === user.id).slice(0, 5)
  const myRefs = db.users.filter(u => u.referredBy === user.id)
  const refEarned = db.referralEarnings.filter(r => r.userId === user.id).reduce((s, r) => s + r.amount, 0)
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
          <p className="mt-1 text-4xl font-extrabold tracking-tight">{hide ? '••••••' : fmtAmount(total)} <span className="text-xl font-extrabold text-white/85 align-middle">{currency}</span></p>
          <p className="text-white/70 text-sm">≈ {hide ? '••••' : fmtUSDT(total / db.settings.bdtPerUsd)}</p>
          <div className="grid grid-cols-3 gap-3 mt-5">
            {[{ k: 'available' as const, l: t('available'), v: Math.round(w.available + usdtBdt), lock: false }, { k: 'locked' as const, l: t('locked'), v: w.locked, lock: true }, { k: 'crypto' as const, l: t('in_crypto'), v: Math.round(cryptoBdt), lock: false }].map(x => (
              <button key={x.l} onClick={() => setBd(x.k)} className="rounded-2xl bg-white/12 backdrop-blur px-3 py-2.5 min-w-0 text-left active:scale-[.97] transition hover:bg-white/20">
                <p className="text-[11px] text-white/70 flex items-center gap-1">{x.lock && <Lock size={10} />}{x.l}<ChevronRight size={10} className="ml-auto opacity-70" /></p>
                <p className="font-bold text-[15px] truncate">{hide ? '••••' : fmtUSDT(x.v / db.settings.bdtPerUsd)}</p>
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="text-[11px] text-white/70 whitespace-nowrap overflow-hidden text-ellipsis">{user.id} · {user.kyc === 'verified' ? '✅ ' + t('verified') : '⚪ ' + t('non_kyc')}</p>
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap">🏅 {t('level')} {user.level}</span>
              {user.level < 4 && <button onClick={() => navigate('/profile')} className="rounded-full bg-white text-violet-700 px-2.5 py-1 text-[11px] font-extrabold shadow whitespace-nowrap">{t('upgrade')} ⬆</button>}
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
          <Link to="/crypto" className="text-sm font-bold text-violet-600 flex items-center">{t('view_all')} <ChevronRight size={15} /></Link>
        </div>
        <p className="text-[11px] text-slate-400 mb-3">{isLive ? '🟢 ' + t('live_prices') : '🟡 ' + t('cached_prices')}</p>
        {loading ? <SkeletonRows n={3} /> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {coins.slice(0, 3).map(c => (
              <button key={c.symbol} onClick={() => navigate('/crypto')} className="w-full flex items-center gap-3 py-3 text-left">
                <span className="w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-sm" style={{ background: COIN_META[c.symbol].color }}>{c.symbol[0]}</span>
                <span className="flex-1"><span className="block font-bold text-slate-800 dark:text-slate-100">{c.name}</span><span className="text-xs text-slate-400">{c.symbol} · {fmtPrice(c.priceUsd)}</span></span>
                <span className="text-right"><span className="block font-bold">{fmtPrice(c.priceUsd)}</span>
                  <span className={`text-xs font-bold flex items-center justify-end gap-0.5 ${c.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{c.change24h >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{c.change24h >= 0 ? '+' : ''}{c.change24h.toFixed(2)}%</span></span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex justify-between items-center mb-2"><h3 className="font-extrabold">{t('referral_earnings')}</h3><Link to="/referral" className="text-violet-600"><ChevronRight /></Link></div>
          <p className="text-3xl font-extrabold text-violet-600">{fmtMoney(refEarned)}</p>
          <p className="text-sm text-slate-500 mt-1">{myRefs.length} {t('friends_joined')} · {db.settings.referralPct}% {t('commission_rate')}</p>
        </Card>
        <Card className="p-5">
          <div className="flex justify-between items-center mb-2"><h3 className="font-extrabold">{t('latest_news')}</h3><Link to="/news" className="text-violet-600"><ChevronRight /></Link></div>
          {db.news.slice(0, 2).map(n => <Link key={n.id} to={'/news/' + n.id} className="block py-1.5"><p className="font-semibold text-sm leading-snug hover:text-violet-600">{n.title}</p><p className="text-[11px] text-slate-400">{n.source}</p></Link>)}
        </Card>
      </div>

      {/* Recent transactions */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-extrabold text-slate-900 dark:text-white">{t('recent_transactions')}</h2>
          <Link to="/transactions" className="text-sm font-bold text-violet-600 flex items-center">{t('see_all')} <ChevronRight size={15} /></Link>
        </div>
        {myTxs.length === 0 ? <p className="text-sm text-slate-500 py-4 text-center">{t('no_transactions_yet')}</p> : myTxs.map(t => { const dir = txDirection(t.category, t.amount); return (
          <div key={t.id} className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <TxDirIcon dir={dir} />
            <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{t.title}</p><p className="text-[11px] text-slate-400">{t.id} · {new Date(t.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p></div>
            <div className="text-right"><p className={`font-bold text-sm ${txAmountCls(dir)}`}>{txSign(dir)}{fmtMoney(Math.abs(t.amount))}</p><Badge tone={statusTone(t.status)}>{t.status}</Badge></div>
          </div>
        ) })}
      </Card>

      {/* Balance breakdown — where each part of the balance actually sits */}
      <Modal open={bd !== null} onClose={() => setBd(null)} title={bd === 'available' ? t('available') : bd === 'locked' ? t('locked') : t('in_crypto')}>
        {bd === 'available' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-4 py-3"><span className="font-semibold text-sm">💵 Cash balance</span><span className="font-extrabold">{fmtMoney(w.available)}</span></div>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-4 py-3"><span className="font-semibold text-sm">₮ USDT holding <span className="block text-xs font-semibold text-slate-400">{(w.holdings.USDT ?? 0).toLocaleString()} USDT · pegged $1</span></span><span className="font-extrabold">{fmtMoney(Math.round(usdtBdt))}</span></div>
            <p className="text-xs text-slate-400 leading-relaxed pt-1">USDT counts as available because it's a dollar stablecoin — you can spend, send or trade it right away, just like cash.</p>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-3 mt-1"><span className="font-extrabold text-sm">Total available</span><span className="font-extrabold text-violet-600">{fmtMoney(Math.round(w.available + usdtBdt))}</span></div>
          </div>
        )}
        {bd === 'locked' && (() => {
          const stakes = db.stakes.filter(st => st.userId === user.id && st.status === 'active')
          const pendWd = db.withdrawals.filter(x => x.userId === user.id && x.status === 'pending')
          const explained = stakes.reduce((a, st) => a + st.amount, 0) + pendWd.reduce((a, x) => a + x.amount, 0)
          const other = Math.round(w.locked - explained)
          return (
            <div className="space-y-2">
              {stakes.map(st => (
                <div key={st.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-4 py-3"><span className="font-semibold text-sm">🌱 Staking <span className="block text-xs font-semibold text-slate-400">{st.apy}% APY · {st.termDays === 0 ? 'Flexible' : st.termDays + ' days'} · since {new Date(st.startAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></span><span className="font-extrabold">{fmtMoney(st.amount)}</span></div>
              ))}
              {pendWd.map(x => (
                <div key={x.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-4 py-3"><span className="font-semibold text-sm">⏳ Cash Out pending <span className="block text-xs font-semibold text-slate-400">{x.method} · waiting for admin approval</span></span><span className="font-extrabold">{fmtMoney(x.amount)}</span></div>
              ))}
              {other > 0 && <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-4 py-3"><span className="font-semibold text-sm">🔒 Other holds</span><span className="font-extrabold">{fmtMoney(other)}</span></div>}
              {w.locked === 0 && <p className="text-sm text-slate-500 text-center py-3">Nothing is locked right now. Money you stake or cash out is held here until it's released.</p>}
              {w.locked > 0 && <div className="flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-3 mt-1"><span className="font-extrabold text-sm">Total locked</span><span className="font-extrabold text-violet-600">{fmtMoney(w.locked)}</span></div>}
            </div>
          )
        })()}
        {bd === 'crypto' && (
          <div className="space-y-2">
            {Object.entries(w.holdings).filter(([sym, amt]) => sym !== 'USDT' && amt > 0).map(([sym, amt]) => (
              <div key={sym} className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 px-4 py-3">
                <span className="w-9 h-9 rounded-full flex items-center justify-center text-white font-extrabold text-xs shrink-0" style={{ background: COIN_META[sym]?.color ?? '#64748b' }}>{sym[0]}</span>
                <span className="flex-1 min-w-0"><span className="block font-bold text-sm">{COIN_META[sym]?.name ?? sym}</span><span className="text-xs text-slate-400">{amt} {sym} · {fmtPrice(priceOf(sym))}</span></span>
                <span className="font-extrabold">{fmtUSDT(amt * priceOf(sym))}</span>
              </div>
            ))}
            {cryptoBdt === 0 && <p className="text-sm text-slate-500 text-center py-3">No crypto holdings yet — USDT lives under Available. Buy a coin from the Market and it will show up here.</p>}
            {cryptoBdt > 0 && <div className="flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-3 mt-1"><span className="font-extrabold text-sm">Total in crypto</span><span className="font-extrabold text-violet-600">{fmtMoney(Math.round(cryptoBdt))}</span></div>}
          </div>
        )}
      </Modal>
    </div>
  )
}
