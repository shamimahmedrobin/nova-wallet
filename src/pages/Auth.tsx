import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, Bitcoin, Gift, HandCoins, Moon, Repeat, Send, ShieldCheck, Sun } from 'lucide-react'
import { useApp } from '../lib/store'
import { Btn, Input } from '../components/ui'
import { LANGUAGES } from '../lib/i18n'
import { Logo } from '../components/Layout'

export default function Auth() {
  const { login, register, toast, theme, toggleTheme, t, lang, setLanguage } = useApp()
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
    { icon: ArrowDownToLine, t: t('act_add'), d: t('feat_add_d') },
    { icon: ArrowUpFromLine, t: t('act_cashout'), d: t('feat_cashout_d') },
    { icon: Send, t: t('act_send'), d: t('feat_send_d') },
    { icon: Bitcoin, t: t('act_buy'), d: t('feat_buy_d') },
    { icon: HandCoins, t: t('act_loan'), d: t('feat_loan_d') },
    { icon: Gift, t: t('act_referral'), d: t('feat_ref_d') },
  ]
  const langPicker = (
    <select value={lang} onChange={e => setLanguage(e.target.value)} aria-label="Language" className="rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-semibold outline-none cursor-pointer">
      {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.native}</option>)}
    </select>
  )
  if (mode === 'landing') return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Logo />
        <div className="flex gap-2">
          {langPicker}
          <button onClick={toggleTheme} className="p-2.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
          <Btn variant="ghost" onClick={() => setMode('login')}>{t('login')}</Btn>
          <Btn onClick={() => setMode('register')}>{t('get_started')}</Btn>
        </div>
      </header>
      <section className="max-w-5xl mx-auto px-4 pt-10 pb-16 text-center">
        <div className="anim-fade-up">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 px-3 py-1 text-xs font-bold"><ShieldCheck size={13} /> {t('landing_badge')}</span>
          <h1 className="mt-5 text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.05]">{t('landing_title_a')}<br /><span className="bg-gradient-to-r from-violet-600 via-purple-500 to-cyan-500 bg-clip-text text-transparent">{t('landing_title_b')}</span></h1>
          <p className="mt-4 text-slate-500 dark:text-slate-400 max-w-xl mx-auto">{t('landing_sub')}</p>
          <div className="mt-7 flex gap-3 justify-center">
            <Btn className="px-6 py-3.5 text-base" onClick={() => setMode('register')}>{t('create_free_account')}</Btn>
            <Btn variant="outline" className="px-6 py-3.5 text-base" onClick={() => setMode('login')}>{t('login')}</Btn>
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
        <p className="mt-10 text-xs text-slate-400 flex items-center justify-center gap-1.5"><Repeat size={12} /> {t('market_note')}</p>
      </section>
    </div>
  )
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md anim-fade-up">
        <div className="flex items-center justify-between mb-6"><Logo /><span>{langPicker}</span></div>
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-6 shadow-xl">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-5">
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setErr('') }} className={`py-2 rounded-xl text-sm font-bold ${mode === m ? 'bg-white dark:bg-slate-900 shadow text-violet-600' : 'text-slate-500'}`}>{m === 'login' ? t('login') : t('register')}</button>
            ))}
          </div>
          {err && <div className="mb-4 rounded-2xl bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 px-4 py-3 text-sm font-semibold">{err}</div>}
          {mode === 'login' ? (
            <div className="space-y-4">
              <Input label={t('email_or_username')} placeholder="you@email.com" value={loginId} onChange={e => setLoginId(e.target.value)} />
              <Input label={t('password')} type="password" placeholder="••••••••" value={loginPw} onChange={e => setLoginPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()} />
              <Btn className="w-full py-3.5" onClick={() => doLogin()}>{t('login')}</Btn>
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-3.5 text-xs space-y-2">
                <p className="font-bold text-slate-600 dark:text-slate-300">{t('demo_accounts')}</p>
                <button className="block w-full text-left font-mono text-violet-600 dark:text-violet-300" onClick={() => { setLoginId('shamim@novawallet.app'); setLoginPw('123456') }}>👤 shamim@novawallet.app / 123456 · PIN 1234</button>
                <button className="block w-full text-left font-mono text-amber-600 dark:text-amber-300" onClick={() => { setLoginId('admin@novawallet.app'); setLoginPw('admin123') }}>🛡️ admin@novawallet.app / admin123 · PIN 9999</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Input label={t('full_name')} placeholder="Your name" value={form.name} onChange={set('name')} />
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('username')} placeholder="username" value={form.username} onChange={set('username')} />
                <Input label={t('phone')} placeholder="01XXXXXXXXX" value={form.phone} onChange={set('phone')} />
              </div>
              <Input label="Email" type="email" placeholder="you@email.com" value={form.email} onChange={set('email')} />
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('password_min')} type="password" value={form.password} onChange={set('password')} />
                <Input label={t('pin_4digit')} type="password" inputMode="numeric" maxLength={4} value={form.pin} onChange={set('pin')} />
              </div>
              <Input label={t('referral_code_opt')} placeholder="NOVA-XXXXX" value={form.referralCode} onChange={set('referralCode')} />
              <Btn className="w-full py-3.5" onClick={doRegister}>{t('create_account')}</Btn>
              <p className="text-[11px] text-center text-slate-400">{t('join_terms')}</p>
            </div>
          )}
        </div>
        <button onClick={() => setMode('landing')} className="mt-4 w-full text-center text-sm text-slate-500">← {t('back_to_home')}</button>
      </div>
    </div>
  )
}
