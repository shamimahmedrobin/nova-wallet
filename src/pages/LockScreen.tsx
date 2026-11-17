import { useState } from 'react'
import { Fingerprint, KeyRound, Lock, LogOut, ShieldCheck } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Btn, Input } from '../components/ui'
import { Logo } from '../components/Layout'

// Full-screen lock: shown after tapping Log out, or after 5 idle minutes.
// The session stays saved on this device — unlock with the device PIN,
// fingerprint, or the account password and you land right where you left off.
// Sign out (bottom) removes the saved login and opens the full login form.
export default function LockScreen() {
  const { user, devicePinSet, fingerprintSet, unlockWithPin, unlockWithFingerprint, unlockWithPassword, signOut } = useApp()
  const [pin, setPin] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [confirmOut, setConfirmOut] = useState(false)
  if (!user) return null
  const first = user.name.split(' ')[0]
  const hasQuick = devicePinSet || fingerprintSet
  const tryPin = () => { const e = unlockWithPin(pin); if (e) { setErr(e); setPin('') } }
  const tryFp = async () => { const e = await unlockWithFingerprint(); if (e) setErr(e) }
  const tryPw = () => { const e = unlockWithPassword(pw); if (e) { setErr(e); setPw('') } }
  const methodChip = (ready: boolean, label: string) => (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${ready ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ready ? 'bg-emerald-500' : 'bg-slate-400'}`} />{label}
    </span>
  )
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-sm py-8">
          <div className="flex justify-center mb-5"><Logo size={46} /></div>
          <div className="relative w-fit mx-auto mb-3">
            <Avatar name={user.name} size={72} />
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center border-2 border-slate-50 dark:border-slate-950"><Lock size={12} /></span>
          </div>
          <p className="text-center font-extrabold text-2xl">Welcome back, {first} 👋</p>
          <p className="text-center text-sm text-slate-500 mt-1.5 leading-relaxed">Your account is locked to keep your money safe.<br />Unlock to pick up right where you left off.</p>

          <div className="flex justify-center gap-1.5 mt-4 flex-wrap">
            {methodChip(devicePinSet, 'PIN' + (devicePinSet ? ' ready' : ' not set'))}
            {methodChip(fingerprintSet, 'Fingerprint' + (fingerprintSet ? ' ready' : ' not set'))}
            {methodChip(true, 'Password always')}
          </div>

          {err && <div className="mt-4 rounded-2xl bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 px-4 py-3 text-sm font-semibold text-center">{err}</div>}

          {devicePinSet && (
            <div className="mt-6 space-y-3">
              <Input label="Login PIN" type="password" inputMode="numeric" maxLength={4} placeholder="••••" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && tryPin()} />
              <Btn className="w-full py-3.5" onClick={tryPin}>Unlock</Btn>
            </div>
          )}
          {fingerprintSet && (
            <Btn variant="outline" className="w-full py-3.5 mt-3" onClick={tryFp}><Fingerprint size={18} /> Unlock with fingerprint</Btn>
          )}

          {hasQuick && !showPw ? (
            <button onClick={() => setShowPw(true)} className="w-full mt-4 text-sm font-bold text-violet-600 inline-flex items-center justify-center gap-1.5"><KeyRound size={15} /> Unlock with password instead</button>
          ) : (
            <div className="mt-6 space-y-3">
              <Input label="Account password" type="password" placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && tryPw()} />
              <Btn className={`w-full py-3.5 ${hasQuick ? '' : ''}`} variant={hasQuick ? 'outline' : 'primary'} onClick={tryPw}><KeyRound size={17} /> Unlock with password</Btn>
            </div>
          )}

          <div className="flex items-center gap-3 mt-8 mb-4">
            <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Not you?</span>
            <span className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          </div>
          {confirmOut ? (
            <div className="space-y-2">
              <Btn className="w-full py-3.5 !bg-rose-600" onClick={signOut}><LogOut size={17} /> Yes, sign me out</Btn>
              <Btn variant="ghost" className="w-full py-3" onClick={() => setConfirmOut(false)}>Cancel</Btn>
            </div>
          ) : (
            <Btn variant="ghost" className="w-full py-3.5 !text-rose-600" onClick={() => setConfirmOut(true)}><LogOut size={17} /> Sign out</Btn>
          )}
          <p className="text-center text-[11px] text-slate-400 mt-2 leading-relaxed">Sign out removes the saved login from this device —<br />next time you'll get the full login form.</p>

          <p className="text-center text-[11px] text-slate-400 mt-6 inline-flex items-center gap-1 w-full justify-center"><ShieldCheck size={12} /> NovaWallet locks when the tab closes, or after 5 minutes away.</p>
        </div>
      </div>
    </div>
  )
}
