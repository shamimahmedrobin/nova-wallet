import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, Bitcoin, CheckCircle2, Gift, Globe, HandCoins, Landmark, Repeat, Send, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import { useApp } from '../lib/store'
import { Btn, Input, PinBoxes } from '../components/ui'
import { Logo } from '../components/Layout'

export default function Auth({ initialMode = 'landing' }: { initialMode?: 'landing' | 'login' | 'register' }) {
  const { login, register, resetPassword, requestPasswordOtp, verifyPasswordOtp, resetPasswordWithOtp, toast, t } = useApp()
  const navigate = useNavigate()
  const refCode = new URLSearchParams(window.location.search).get('ref') ?? ''
  const [mode] = useState<'landing' | 'login' | 'register'>(refCode ? 'register' : initialMode)
  const [form, setForm] = useState({ name: '', username: '', email: '', phone: '', password: '', pin: '', referralCode: refCode })
  const [loginId, setLoginId] = useState(''); const [loginPw, setLoginPw] = useState('')
  const [step, setStep] = useState<'auth' | 'forgot'>('auth')
  const [fp, setFp] = useState({ email: '', pin: '', password: '' })
  const [fpMethod, setFpMethod] = useState<'email' | 'pin'>('email')
  const [fpOtp, setFpOtp] = useState('')
  const [fpOtpDemo, setFpOtpDemo] = useState<string | null>(null)
  const [fpOtpVerified, setFpOtpVerified] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }))

  const afterLogin = (id: string) => {
    toast({ kind: 'success', title: 'Welcome back!' })
    // Always land on Home after a fresh login — never restore the page that was
    // open before the previous session ended.
    navigate(id.includes('admin') ? '/admin' : '/home')
  }
  const doLogin = (id = loginId, pw = loginPw) => {
    const e = login(id.trim().toLowerCase(), pw)
    if (e) { setErr(e); return }
    afterLogin(id)
  }
  const doReset = () => {
    const e = resetPassword(fp.email, fp.pin, fp.password)
    if (e) { setErr(e); return }
    toast({ kind: 'success', title: 'Password reset', body: 'Log in with your new password.' })
    setLoginId(fp.email); setLoginPw(''); setErr(''); setStep('auth')
  }
  const doResetOtp = () => {
    const e = resetPasswordWithOtp(fp.email, fpOtp, fp.password)
    if (e) { setErr(e); return }
    toast({ kind: 'success', title: 'Password reset', body: 'Log in with your new password.' })
    setLoginId(fp.email); setLoginPw(''); setErr(''); setStep('auth'); setFpOtp(''); setFpOtpDemo(null); setFpOtpVerified(false)
  }
  const doRegister = () => {
    if (form.password.length < 6) return setErr('Password must be at least 6 characters.')
    if (!/^\d{4}$/.test(form.pin)) return setErr('Transaction PIN must be exactly 4 digits.')
    const e = register({ ...form, email: form.email.trim().toLowerCase(), username: form.username.trim().toLowerCase(), referralCode: form.referralCode.trim() || undefined })
    if (e) return setErr(e)
    toast({ kind: 'success', title: 'Account created', body: 'Welcome to NovaWallet.' })
    navigate('/home')
  }
  const features = [
    { icon: ArrowDownToLine, t: t('act_add'), d: t('feat_add_d') },
    { icon: ArrowUpFromLine, t: t('act_cashout'), d: t('feat_cashout_d') },
    { icon: Send, t: t('act_send'), d: t('feat_send_d') },
    { icon: Bitcoin, t: t('act_buy'), d: t('feat_buy_d') },
    { icon: HandCoins, t: t('act_loan'), d: t('feat_loan_d') },
    { icon: Gift, t: t('act_referral'), d: t('feat_ref_d') },
  ]
  const payWays = [
    { icon: Landmark, label: 'Bank transfer' }, { icon: Bitcoin, label: 'Crypto deposit' },
    { icon: Repeat, label: '16 crypto networks' }, { icon: Globe, label: 'Same in every country' },
  ]
  const stats: [string, string][] = [[t('stat_users_v'), t('stat_users')], [t('stat_fees_v'), t('stat_fees')], [t('stat_apy_v'), t('stat_apy')], [t('stat_speed_v'), t('stat_speed')]]
  const pillars = [
    { icon: ShieldCheck, t: t('why_sec_t'), d: t('why_sec_d') },
    { icon: TrendingUp, t: t('why_earn_t'), d: t('why_earn_d') },
    { icon: Globe, t: t('why_global_t'), d: t('why_global_d') },
  ]
  const steps: [string, string][] = [[t('how_1_t'), t('how_1_d')], [t('how_2_t'), t('how_2_d')], [t('how_3_t'), t('how_3_d')]]
  if (mode === 'landing') return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-gradient-to-b from-violet-600/12 via-purple-500/6 to-transparent dark:from-violet-600/20" />
      <header className="relative max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Logo />
        <div className="flex items-center gap-2 shrink-0">
          <Btn variant="ghost" className="px-4 whitespace-nowrap hidden sm:inline-flex" onClick={() => navigate('/login')}>{t('login')}</Btn>
          <Btn className="px-5 whitespace-nowrap" onClick={() => navigate('/register')}>{t('get_started')}</Btn>
        </div>
      </header>
      <section className="relative max-w-6xl mx-auto px-4 pt-10 sm:pt-14 pb-14 text-center">
        <div className="anim-fade-up">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 px-3.5 py-1.5 text-xs font-bold"><Globe size={13} /> {t('landing_badge')}</span>
          <h1 className="mt-5 text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.05]">{t('landing_title_a')}<br /><span className="bg-gradient-to-r from-violet-600 via-purple-500 to-cyan-500 bg-clip-text text-transparent">{t('landing_title_b')}</span></h1>
          <p className="mt-5 text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">{t('landing_sub')}</p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center px-1">
            <Btn className="px-7 py-4 text-base" onClick={() => navigate('/register')}><Sparkles size={18} /> {t('create_free_account')}</Btn>
            <Btn variant="outline" className="px-7 py-4 text-base bg-white/70 dark:bg-slate-900/70" onClick={() => navigate('/login')}>{t('login')}</Btn>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            {[t('chip_currencies'), t('chip_coins'), t('chip_langs'), t('chip_support')].map(c => (
              <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-3 py-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> {c}</span>
            ))}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(([v, l]) => (
            <div key={l} className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 py-5 px-3">
              <p className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-violet-600 to-cyan-500 bg-clip-text text-transparent">{v}</p>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-1">{l}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
          {features.map(f => (
            <div key={f.t} className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 hover:shadow-xl hover:-translate-y-0.5 transition-all">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center mb-3 shadow-lg shadow-violet-600/20"><f.icon size={20} /></div>
              <p className="font-bold text-slate-900 dark:text-white">{f.t}</p><p className="text-xs text-slate-500 mt-1 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 text-left sm:text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">{t('pay_title')}</h2>
          <p className="mt-2 text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">{t('pay_sub')}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            {payWays.map(pw => (
              <span key={pw.label} className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-4 py-3 font-bold text-sm text-slate-700 dark:text-slate-200"><pw.icon size={17} className="text-violet-600" /> {pw.label}</span>
            ))}
          </div>
        </div>

        <div className="mt-14 text-left">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white text-center">{t('why_title')}</h2>
          <div className="mt-6 grid sm:grid-cols-3 gap-3">
            {pillars.map(p => (
              <div key={p.t} className="rounded-3xl bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-900/60 border border-slate-200/70 dark:border-slate-800 p-6">
                <div className="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-300 flex items-center justify-center mb-4"><p.icon size={22} /></div>
                <p className="font-extrabold text-slate-900 dark:text-white">{p.t}</p>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{p.d}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">{t('how_title')}</h2>
          <div className="mt-6 grid sm:grid-cols-3 gap-3 text-left">
            {steps.map(([st, sd], i) => (
              <div key={st} className="relative rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-6">
                <span className="absolute -top-3 left-5 w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 text-white text-sm font-extrabold flex items-center justify-center shadow-lg shadow-violet-600/25">{i + 1}</span>
                <p className="font-extrabold text-slate-900 dark:text-white mt-1">{st}</p>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{sd}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 rounded-[2rem] bg-gradient-to-br from-violet-700 via-purple-700 to-indigo-800 text-white p-8 sm:p-10 shadow-2xl shadow-violet-700/25">
          <h2 className="text-2xl sm:text-3xl font-extrabold">{t('cta_title')}</h2>
          <p className="mt-2 text-white/80 max-w-md mx-auto leading-relaxed">{t('cta_sub')}</p>
          <Btn className="mt-6 px-8 py-4 text-base !bg-white !text-violet-700 shadow-xl" onClick={() => navigate('/register')}>{t('create_free_account')}</Btn>
        </div>

        <p className="mt-10 text-xs text-slate-400 flex items-center justify-center gap-1.5"><Repeat size={12} /> {t('market_note')}</p>
        <p className="mt-3 text-xs text-slate-400">{t('footer_note')} · support@novawallet.app</p>
        <p className="mt-2 text-xs font-semibold"><Link to="/terms" className="text-violet-600 dark:text-violet-400 hover:underline">{t('join_terms_word')}</Link><span className="text-slate-300 dark:text-slate-600 mx-2">·</span><Link to="/privacy" className="text-violet-600 dark:text-violet-400 hover:underline">{t('join_privacy_word')}</Link></p>
      </section>
    </div>
  )
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-violet-50 via-slate-50 to-slate-100 dark:from-slate-950 dark:via-[#0b0722] dark:to-slate-950 flex items-center justify-center p-4">
      {/* Ambient glow — same drifting blobs as the lock screen */}
      <div className="pointer-events-none absolute -top-28 -left-24 w-80 h-80 rounded-full bg-violet-500/25 blur-3xl animate-[nw-drift_8s_ease-in-out_infinite_alternate]" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-cyan-400/20 blur-3xl animate-[nw-drift_10s_ease-in-out_infinite_alternate-reverse]" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="relative w-full max-w-md anim-fade-up">
        <div className="flex flex-col items-center mb-6">
          <div className="rounded-[26px] p-[2px] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 shadow-[0_0_36px_rgba(139,92,246,.45)] mb-3.5">
            <div className="rounded-[24px] bg-white dark:bg-slate-950 px-5 py-3.5"><Logo size={40} /></div>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white text-center">{step === 'forgot' ? 'Reset your password' : mode === 'login' ? <>Welcome back to <span className="bg-gradient-to-r from-violet-600 via-purple-500 to-cyan-500 bg-clip-text text-transparent">NovaWallet</span></> : <>Join <span className="bg-gradient-to-r from-violet-600 via-purple-500 to-cyan-500 bg-clip-text text-transparent">NovaWallet</span></>}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center">{step === 'forgot' ? 'Verify it\'s you and pick a new password.' : mode === 'login' ? 'Your money & crypto, one global wallet.' : 'Create your free account in under a minute.'}</p>
        </div>
        <div className="rounded-[26px] p-[1.5px] bg-gradient-to-br from-violet-500/50 via-slate-200/60 to-cyan-400/50 dark:from-violet-500/60 dark:via-slate-700/50 dark:to-cyan-400/50 shadow-2xl shadow-violet-600/15">
        <div className="rounded-[25px] bg-white/95 dark:bg-slate-900/95 backdrop-blur p-6">
          {step === 'auth' && <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-5">
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => { navigate(m === 'login' ? '/login' : '/register'); setErr('') }} className={`py-2 rounded-xl text-sm font-bold ${mode === m ? 'bg-white dark:bg-slate-900 shadow text-violet-600' : 'text-slate-500'}`}>{m === 'login' ? t('login') : t('register')}</button>
            ))}
          </div>}
          {err && <div className="mb-4 rounded-2xl bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 px-4 py-3 text-sm font-semibold">{err}</div>}
          {step === 'forgot' ? (
            <div className="space-y-4">
              <div>
                <p className="font-extrabold text-lg">Reset your password</p>
                <p className="text-sm text-slate-500 mt-1">Choose how to verify it's you, then pick a new password.</p>
              </div>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
                {([['email', '✉️ With Email'], ['pin', '🔢 With PIN']] as const).map(([m, l]) => (
                  <button key={m} onClick={() => { setFpMethod(m); setErr('') }} className={`py-2.5 rounded-xl text-sm font-bold transition ${fpMethod === m ? 'bg-white dark:bg-slate-900 shadow text-violet-600' : 'text-slate-500'}`}>{l}</button>
                ))}
              </div>
              {fpMethod === 'pin' ? (
                <>
                  <Input label="Email" type="email" placeholder="you@email.com" value={fp.email} onChange={e => setFp(f => ({ ...f, email: e.target.value }))} />
                  <Input label={t('pin_4digit')} type="password" inputMode="numeric" maxLength={4} placeholder="••••" value={fp.pin} onChange={e => setFp(f => ({ ...f, pin: e.target.value }))} />
                  <Input label="New password (min 6 characters)" type="password" placeholder="••••••••" value={fp.password} onChange={e => setFp(f => ({ ...f, password: e.target.value }))} onKeyDown={e => e.key === 'Enter' && doReset()} />
                  <Btn className="w-full py-3.5" onClick={doReset}>Reset password</Btn>
                </>
              ) : !fpOtpDemo ? (
                <>
                  <Input label="Email" type="email" placeholder="you@email.com" value={fp.email} onChange={e => setFp(f => ({ ...f, email: e.target.value }))} />
                  <p className="text-sm text-slate-500 leading-relaxed">We'll send a <b>6-digit verification code</b> to this email address. Enter the code to prove it's you.</p>
                  <Btn className="w-full py-3.5" disabled={!fp.email.trim()} onClick={() => { const r = requestPasswordOtp(fp.email); if (r.error) { setErr(r.error); return } setErr(''); setFpOtpDemo(r.otp); setFpOtp(''); setFpOtpVerified(false) }}>Send 6-digit code</Btn>
                </>
              ) : !fpOtpVerified ? (
                <>
                  <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/70 dark:border-emerald-500/20 px-4 py-3.5 text-center">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">📩 We've sent a 6-digit code to <b>{fp.email}</b>. It expires in 10 minutes.</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">Don't see it in your inbox? Please check your <b>spam or junk folder</b> — sometimes it lands there.</p>
                    <p className="text-xs font-bold text-violet-600 dark:text-violet-300 mt-2.5">Demo mode — your code is shown here: <span className="font-mono text-base tracking-[.3em]">{fpOtpDemo}</span></p>
                  </div>
                  <PinBoxes label="Enter the 6-digit code" length={6} showDigits value={fpOtp} onChange={setFpOtp} />
                  <Btn className="w-full py-3.5" disabled={fpOtp.length !== 6} onClick={() => { const e = verifyPasswordOtp(fp.email, fpOtp); if (e) { setErr(e); return } setErr(''); setFpOtpVerified(true) }}>Verify code</Btn>
                  <button onClick={() => { const r = requestPasswordOtp(fp.email); if (r.error) { setErr(r.error); return } setFpOtpDemo(r.otp); setFpOtp('') }} className="w-full text-center text-sm font-bold text-violet-600">Didn't get it? Resend code</button>
                </>
              ) : (
                <>
                  <p className="text-center text-sm font-bold text-emerald-600">✓ Email verified — choose your new password.</p>
                  <Input label="New password (min 6 characters)" type="password" placeholder="••••••••" value={fp.password} onChange={e => setFp(f => ({ ...f, password: e.target.value }))} onKeyDown={e => e.key === 'Enter' && doResetOtp()} />
                  <Btn className="w-full py-3.5" onClick={doResetOtp}>Reset password</Btn>
                </>
              )}
              <button onClick={() => { setErr(''); setStep('auth') }} className="w-full text-center text-sm font-bold text-slate-500">← Back to login</button>
            </div>
          ) : mode === 'login' ? (
            <div className="space-y-4">
              <Input label={t('email_or_username')} placeholder="you@email.com" value={loginId} onChange={e => setLoginId(e.target.value)} />
              <Input label={t('password')} type="password" placeholder="••••••••" value={loginPw} onChange={e => setLoginPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()} />
              <Btn className="w-full py-3.5" onClick={() => doLogin()}>{t('login')}</Btn>
              <button onClick={() => { setErr(''); setStep('forgot') }} className="w-full text-center text-sm font-bold text-violet-600">Forgot password?</button>
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-3.5 text-xs space-y-2">
                <p className="font-bold text-slate-600 dark:text-slate-300">{t('demo_accounts')}</p>
                <button className="block w-full text-left font-mono text-violet-600 dark:text-violet-300" onClick={() => { setLoginId('shamim@novawallet.app'); setLoginPw('123456') }}>👤 shamim@novawallet.app / 123456 · PIN 1234</button>
                <button className="block w-full text-left font-mono text-amber-600 dark:text-amber-300" onClick={() => { setLoginId('admin@novawallet.app'); setLoginPw('admin123') }}>🛡️ admin@novawallet.app / admin123 · PIN 9999</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Input label={t('full_name')} placeholder="Your name" value={form.name} onChange={set('name')} />
              <Input label={t('username')} placeholder="username" value={form.username} onChange={set('username')} />
              <Input label={t('phone')} placeholder="+880 1XXX-XXXXXX · +91 · +1 · …" value={form.phone} onChange={set('phone')} />
              <Input label="Email" type="email" placeholder="you@email.com" value={form.email} onChange={set('email')} />
              <Input label={t('password_min')} type="password" placeholder="••••••••" value={form.password} onChange={set('password')} />
              <Input label={t('pin_4digit')} type="password" inputMode="numeric" maxLength={4} placeholder="••••" value={form.pin} onChange={set('pin')} />
              <Input label={t('referral_code_opt')} placeholder="NOVA-XXXXX" value={form.referralCode} onChange={set('referralCode')} />
              <Btn className="w-full py-3.5" onClick={doRegister}>{t('create_account')}</Btn>
              <p className="text-[11px] text-center text-slate-400 leading-relaxed">{t('join_pre')} <Link to="/terms" className="font-bold text-violet-600 dark:text-violet-400 underline underline-offset-2">{t('join_terms_word')}</Link> {t('join_and')} <Link to="/privacy" className="font-bold text-violet-600 dark:text-violet-400 underline underline-offset-2">{t('join_privacy_word')}</Link>{t('join_post')}</p>
            </div>
          )}
        </div>
        </div>
        <button onClick={() => navigate('/')} className="mt-4 w-full text-center text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-violet-600 transition">← {t('back_to_home')}</button>
        <p className="mt-3 text-center text-[11px] text-slate-400 dark:text-slate-500">🔒 Secured sign-in · Your data stays protected</p>
      </div>
    </div>
  )
}
