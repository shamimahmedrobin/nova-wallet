import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, Bitcoin, Gift, HandCoins, Moon, Repeat, Send, ShieldCheck, Sun } from 'lucide-react'
import { useApp } from '../lib/store'
import { Btn, Input } from '../components/ui'
import { Logo } from '../components/Layout'

export default function Auth() {
  const { login, register, toast, theme, toggleTheme } = useApp()
  const navigate = useNavigate()
  const refCode = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('ref') ?? ''
  const [mode, setMode] = useState<'landing' | 'login' | 'register'>(refCode ? 'register' : 'landing')
  const [form, setForm] = useState({ name: '', username: '', email: '', phone: '', password: '', pin: '', referralCode: refCode })
  const [loginId, setLoginId] = useState(''); const [loginPw, setLoginPw] = useState('')
  const [err, setErr] = useState('')
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }))

  const doLogin = (id = loginId, pw = loginPw) => {
    const e = login(id.trim().toLowerCase(), pw)
    if (e) { setErr(e); return }
    toast({ kind: 'success', title: 'Welcome back!' })
    navigate(id.includes('admin') ? '/admin' : '/app')
  }
  const doRegister = () => {
    if (form.password.length < 6) return setErr('Password must be at least 6 characters.')
    if (!/^\d{4}$/.test(form.pin)) return setErr('Transaction PIN must be exactly 4 digits.')
    const e = register({ ...form, email: form.email.trim().toLowerCase(), username: form.username.trim().toLowerCase(), referralCode: form.referralCode.trim() || undefined })
    if (e) return setErr(e)
    toast({ kind: 'success', title: 'Account created', body: 'Welcome to NovaWallet.' })
    navigate('/app')
  }
  const features = [
    { icon: ArrowDownToLine, t: 'Add Money', d: 'bKash · Nagad · Rocket · Bank' },
    { icon: ArrowUpFromLine, t: 'Cash Out', d: 'Low 1.5% fee, tracked status' },
    { icon: Send, t: 'Send Money', d: 'Instant user-to-user transfers' },
    { icon: Bitcoin, t: 'Buy Crypto', d: 'BTC, ETH, USDT, BNB, SOL, XRP' },
    { icon: HandCoins, t: 'Loans', d: 'Up to ৳1,00,000, clear EMI' },
    { icon: Gift, t: 'Referrals', d: 'Earn commission on every invite' },
  ]
  if (mode === 'landing') return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Logo />
        <div className="flex gap-2">
          <button onClick={toggleTheme} className="p-2.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
          <Btn variant="ghost" onClick={() => setMode('login')}>Log in</Btn>
          <Btn onClick={() => setMode('register')}>Get started</Btn>
        </div>
      </header>
      <section className="max-w-5xl mx-auto px-4 pt-10 pb-16 text-center">
        <div className="anim-fade-up">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 px-3 py-1 text-xs font-bold"><ShieldCheck size={13} /> Bank-grade double-entry ledger</span>
          <h1 className="mt-5 text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.05]">Your money & crypto,<br /><span className="bg-gradient-to-r from-violet-600 via-purple-500 to-cyan-500 bg-clip-text text-transparent">one beautiful wallet.</span></h1>
          <p className="mt-4 text-slate-500 dark:text-slate-400 max-w-xl mx-auto">The simplicity of bKash with the power of a crypto wallet — add money, send instantly, trade BTC & ETH, earn referrals and apply for loans, all in BDT.</p>
          <div className="mt-7 flex gap-3 justify-center">
            <Btn className="px-6 py-3.5 text-base" onClick={() => setMode('register')}>Create free account</Btn>
            <Btn variant="outline" className="px-6 py-3.5 text-base" onClick={() => setMode('login')}>Log in</Btn>
          </div>
        </div>
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
          {features.map(f => (
            <div key={f.t} className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center mb-3"><f.icon size={19} /></div>
              <p className="font-bold text-slate-900 dark:text-white">{f.t}</p><p className="text-xs text-slate-500 mt-0.5">{f.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-xs text-slate-400 flex items-center justify-center gap-1.5"><Repeat size={12} /> Market prices are indicative (CoinGecko). Trades confirm their executable price before execution.</p>
      </section>
    </div>
  )
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md anim-fade-up">
        <div className="flex justify-center mb-6"><Logo /></div>
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-6 shadow-xl">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-5">
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setErr('') }} className={`py-2 rounded-xl text-sm font-bold capitalize ${mode === m ? 'bg-white dark:bg-slate-900 shadow text-violet-600' : 'text-slate-500'}`}>{m}</button>
            ))}
          </div>
          {err && <div className="mb-4 rounded-2xl bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 px-4 py-3 text-sm font-semibold">{err}</div>}
          {mode === 'login' ? (
            <div className="space-y-4">
              <Input label="Email or username" placeholder="you@email.com" value={loginId} onChange={e => setLoginId(e.target.value)} />
              <Input label="Password" type="password" placeholder="••••••••" value={loginPw} onChange={e => setLoginPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()} />
              <Btn className="w-full py-3.5" onClick={() => doLogin()}>Log in</Btn>
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-3.5 text-xs space-y-2">
                <p className="font-bold text-slate-600 dark:text-slate-300">Demo accounts (tap to fill):</p>
                <button className="block w-full text-left font-mono text-violet-600 dark:text-violet-300" onClick={() => { setLoginId('shamim@novawallet.app'); setLoginPw('123456') }}>👤 shamim@novawallet.app / 123456 · PIN 1234</button>
                <button className="block w-full text-left font-mono text-amber-600 dark:text-amber-300" onClick={() => { setLoginId('admin@novawallet.app'); setLoginPw('admin123') }}>🛡️ admin@novawallet.app / admin123 · PIN 9999</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Input label="Full name" placeholder="Your name" value={form.name} onChange={set('name')} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Username" placeholder="username" value={form.username} onChange={set('username')} />
                <Input label="Phone" placeholder="01XXXXXXXXX" value={form.phone} onChange={set('phone')} />
              </div>
              <Input label="Email" type="email" placeholder="you@email.com" value={form.email} onChange={set('email')} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Password (min 6)" type="password" value={form.password} onChange={set('password')} />
                <Input label="Transaction PIN (4-digit)" type="password" inputMode="numeric" maxLength={4} value={form.pin} onChange={set('pin')} />
              </div>
              <Input label="Referral code (optional)" placeholder="NOVA-XXXXX" value={form.referralCode} onChange={set('referralCode')} />
              <Btn className="w-full py-3.5" onClick={doRegister}>Create account</Btn>
              <p className="text-[11px] text-center text-slate-400">By joining you agree to the Terms & Privacy Policy. Self-referrals are blocked.</p>
            </div>
          )}
        </div>
        <button onClick={() => setMode('landing')} className="mt-4 w-full text-center text-sm text-slate-500">← Back to home</button>
      </div>
    </div>
  )
}
