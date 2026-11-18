import { useState } from 'react'
import { Fingerprint, KeyRound, Lock, LogOut, ShieldCheck } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Btn, Input, PinPad } from '../components/ui'
import { Logo } from '../components/Layout'

// Full-screen lock: shown after tapping Log out, after 5 idle minutes, after
// 5 minutes away, or in a fresh tab. The session stays saved on this device —
// unlock with the on-screen PIN pad, fingerprint, or the account password.
// Sign out (bottom) removes the saved login and opens the full login form.
export default function LockScreen() {
  const { user, devicePinSet, fingerprintSet, unlockWithPin, unlockWithFingerprint, unlockWithPassword, signOut } = useApp()
  const [pin, setPin] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [shake, setShake] = useState(0)
  const [showPw, setShowPw] = useState(false)
  const [confirmOut, setConfirmOut] = useState(false)
  if (!user) return null
  const first = user.name.split(' ')[0]
  const hasQuick = devicePinSet || fingerprintSet
  const fail = (e: string) => { setErr(e); setShake(x => x + 1) }
  const addDigit = (d: string) => {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next); setErr('')
    if (next.length === 4) {
      const e = unlockWithPin(next)
      if (e) { fail(e); setPin('') }
    }
  }
  const tryFp = async () => { const e = await unlockWithFingerprint(); if (e) fail(e) }
  const tryPw = () => { const e = unlockWithPassword(pw); if (e) { fail(e); setPw('') } }
  const methodChip = (ready: boolean, label: string) => (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${ready ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ready ? 'bg-emerald-500' : 'bg-slate-400'}`} />{label}
    </span>
  )
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-violet-600/15 via-purple-500/8 to-transparent" />
      <div className="relative min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-sm py-6">
          <div className="flex justify-center mb-5"><Logo size={46} /></div>

          <div className="rounded-[2rem] bg-white/85 dark:bg-slate-900/85 backdrop-blur border border-slate-200/80 dark:border-slate-800 shadow-2xl shadow-violet-600/10 p-6">
            <div className="relative w-fit mx-auto mb-3">
              <Avatar name={user.name} size={76} photo={user.photo} />
              <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 shadow"><Lock size={13} /></span>
            </div>
            <p className="text-center font-extrabold text-2xl">Welcome back, {first} 👋</p>
            <p className="text-center text-sm text-slate-500 mt-1">{user.email}</p>
            <p className="text-center text-[13px] text-slate-500 mt-2 leading-relaxed">Your account is locked to keep your money safe.<br />Unlock to pick up right where you left off.</p>

            <div className="flex justify-center gap-1.5 mt-4 flex-wrap">
              {methodChip(devicePinSet, 'PIN' + (devicePinSet ? ' ready' : ' not set'))}
              {methodChip(fingerprintSet, 'Fingerprint' + (fingerprintSet ? ' ready' : ' not set'))}
              {methodChip(true, 'Password always')}
            </div>

            {err && <div className="mt-4 rounded-2xl bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 px-4 py-3 text-sm font-semibold text-center">{err}</div>}

            {devicePinSet && (
              <div className="mt-6">
                <p className="text-center text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Enter your login PIN</p>
                <div key={shake} className={`flex justify-center gap-3.5 mb-5 ${shake ? 'animate-[nw-shake_.35s_ease]' : ''}`}>
                  {[0, 1, 2, 3].map(i => (
                    <span key={i} className={`w-4 h-4 rounded-full transition-all ${pin.length > i ? 'bg-gradient-to-br from-violet-600 to-cyan-500 scale-110' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  ))}
                </div>
                <PinPad onDigit={addDigit} onBackspace={() => setPin(p => p.slice(0, -1))}
                  leftCell={fingerprintSet ? (
                    <button type="button" aria-label="Unlock with fingerprint" onClick={tryFp} className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-violet-600/30 active:scale-95 transition"><Fingerprint size={26} /></button>
                  ) : undefined} />
                {fingerprintSet && <p className="text-center text-[11px] font-semibold text-slate-400 mt-2">Tap the fingerprint button for instant unlock</p>}
              </div>
            )}

            {!devicePinSet && fingerprintSet && (
              <button type="button" onClick={tryFp} className="mt-6 w-full rounded-3xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white py-5 flex flex-col items-center gap-2 shadow-xl shadow-violet-600/25 active:scale-[.98] transition">
                <Fingerprint size={38} />
                <span className="font-extrabold text-sm">Tap to unlock with fingerprint</span>
              </button>
            )}

            {hasQuick && (
              <div className="flex items-center gap-3 mt-6 mb-1">
                <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">or</span>
                <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              </div>
            )}

            {hasQuick && !showPw ? (
              <button onClick={() => setShowPw(true)} className="w-full mt-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 py-3.5 text-sm font-bold text-violet-600 dark:text-violet-300 inline-flex items-center justify-center gap-2 active:scale-[.98] transition"><KeyRound size={16} /> Unlock with password instead</button>
            ) : (
              <div className="mt-4 space-y-3">
                <Input label="Account password" type="password" placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && tryPw()} />
                <Btn className="w-full py-3.5" variant={hasQuick ? 'outline' : 'primary'} onClick={tryPw}><KeyRound size={17} /> Unlock with password</Btn>
              </div>
            )}
          </div>

          <div className="mt-5">
            {confirmOut ? (
              <div className="space-y-2">
                <Btn className="w-full py-3.5 !bg-rose-600" onClick={signOut}><LogOut size={17} /> Yes, sign me out</Btn>
                <Btn variant="ghost" className="w-full py-3" onClick={() => setConfirmOut(false)}>Cancel</Btn>
              </div>
            ) : (
              <Btn variant="ghost" className="w-full py-3.5 !text-rose-600" onClick={() => setConfirmOut(true)}><LogOut size={17} /> Sign out — this isn't my account</Btn>
            )}
            <p className="text-center text-[11px] text-slate-400 mt-2 leading-relaxed">Sign out removes the saved login from this device —<br />next time you'll get the full login form.</p>
            <p className="text-center text-[11px] text-slate-400 mt-5 flex items-center gap-1 w-full justify-center"><ShieldCheck size={12} /> NovaWallet locks when the tab closes, or after 5 minutes away.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
