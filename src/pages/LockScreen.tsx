import { useState } from 'react'
import { Fingerprint, KeyRound, LogOut } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Btn, Input, PinPad } from '../components/ui'
import { Logo } from '../components/Layout'

// Full-screen lock — everything fits on ONE screen, no scrolling.
// Unlock with the on-screen PIN pad (auto-unlocks at 4 digits), fingerprint,
// or switch to the password view. Sign out removes the saved login.
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
  const pwView = showPw || !hasQuick
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
  return (
    <div className="fixed inset-0 z-[100] h-dvh overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-violet-600/15 to-transparent" />
      <div className="relative h-full flex flex-col items-center justify-center px-4 py-3">
        <div className="mb-3"><Logo size={36} /></div>
        <div className="w-full max-w-sm rounded-[1.75rem] bg-white/85 dark:bg-slate-900/85 backdrop-blur border border-slate-200/80 dark:border-slate-800 shadow-2xl shadow-violet-600/10 px-5 py-5">
          <div className="relative w-fit mx-auto">
            <Avatar name={user.name} size={56} photo={user.photo} />
            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 text-[9px]">🔒</span>
          </div>
          <p className="text-center font-extrabold text-xl mt-2.5">Welcome back, {first} 👋</p>

          {err && <div className="mt-3 rounded-2xl bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 px-3 py-2.5 text-[13px] font-semibold text-center">{err}</div>}

          {!pwView && devicePinSet && (
            <div className="mt-4">
              <div key={shake} className={`flex justify-center gap-3 mb-4 ${shake ? 'animate-[nw-shake_.35s_ease]' : ''}`}>
                {[0, 1, 2, 3].map(i => (
                  <span key={i} className={`w-3.5 h-3.5 rounded-full transition-all ${pin.length > i ? 'bg-gradient-to-br from-violet-600 to-cyan-500 scale-110' : 'bg-slate-200 dark:bg-slate-700'}`} />
                ))}
              </div>
              <PinPad onDigit={addDigit} onBackspace={() => setPin(p => p.slice(0, -1))}
                leftCell={fingerprintSet ? (
                  <button type="button" aria-label="Unlock with fingerprint" onClick={tryFp} className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-violet-600/30 active:scale-95 transition"><Fingerprint size={23} /></button>
                ) : undefined} />
              <button onClick={() => { setShowPw(true); setErr('') }} className="w-full mt-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 py-3 text-sm font-bold text-violet-600 dark:text-violet-300 inline-flex items-center justify-center gap-2 active:scale-[.98] transition"><KeyRound size={15} /> Unlock with password</button>
            </div>
          )}

          {!pwView && !devicePinSet && fingerprintSet && (
            <div className="mt-4">
              <button type="button" onClick={tryFp} className="w-full rounded-3xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white py-4 flex flex-col items-center gap-1.5 shadow-xl shadow-violet-600/25 active:scale-[.98] transition">
                <Fingerprint size={34} />
                <span className="font-extrabold text-sm">Unlock with fingerprint</span>
              </button>
              <button onClick={() => { setShowPw(true); setErr('') }} className="w-full mt-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 py-3 text-sm font-bold text-violet-600 dark:text-violet-300 inline-flex items-center justify-center gap-2 active:scale-[.98] transition"><KeyRound size={15} /> Unlock with password</button>
            </div>
          )}

          {pwView && (
            <div className="mt-4 space-y-3">
              <Input label="Account password" type="password" placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && tryPw()} />
              <Btn className="w-full py-3.5" onClick={tryPw}><KeyRound size={16} /> Unlock with password</Btn>
              {fingerprintSet && <Btn variant="outline" className="w-full py-3" onClick={tryFp}><Fingerprint size={17} /> Unlock with fingerprint</Btn>}
              {hasQuick && <button onClick={() => { setShowPw(false); setErr('') }} className="w-full text-center text-sm font-bold text-violet-600 py-1">← Back to PIN</button>}
            </div>
          )}
        </div>

        <div className="w-full max-w-sm mt-3">
          {confirmOut ? (
            <div className="flex gap-2">
              <Btn variant="ghost" className="flex-1 py-3" onClick={() => setConfirmOut(false)}>Cancel</Btn>
              <Btn className="flex-1 py-3 !bg-rose-600" onClick={signOut}><LogOut size={16} /> Sign out</Btn>
            </div>
          ) : (
            <button onClick={() => setConfirmOut(true)} className="w-full py-2 text-sm font-bold text-rose-500 inline-flex items-center justify-center gap-1.5"><LogOut size={15} /> Sign out</button>
          )}
        </div>
      </div>
    </div>
  )
}
