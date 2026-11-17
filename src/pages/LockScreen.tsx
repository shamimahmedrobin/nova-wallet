import { useState } from 'react'
import { Fingerprint } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Btn, Input } from '../components/ui'
import { Logo } from '../components/Layout'

// Full-screen lock shown when a saved session exists on this device and a
// device quick-login method (PIN / fingerprint) is set. The session itself is
// untouched — unlocking returns to exactly where the user left off.
export default function LockScreen() {
  const { user, devicePinSet, fingerprintSet, unlockWithPin, unlockWithFingerprint, usePasswordInstead } = useApp()
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  if (!user) return null
  const tryPin = () => { const e = unlockWithPin(pin); if (e) { setErr(e); setPin('') } }
  const tryFp = async () => { const e = await unlockWithFingerprint(); if (e) setErr(e) }
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center py-8">
          <div className="flex justify-center mb-4"><Logo size={52} /></div>
          <div className="flex justify-center mb-3"><Avatar name={user.name} size={64} /></div>
          <p className="font-extrabold text-xl">{user.name}</p>
          <p className="text-sm text-slate-500 mt-1">NovaWallet is locked. Your login stays saved on this device — unlock to continue.</p>
          {err && <div className="mt-4 rounded-2xl bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 px-4 py-3 text-sm font-semibold">{err}</div>}
          {devicePinSet && (
            <div className="mt-6 space-y-3 text-left">
              <Input label="Login PIN" type="password" inputMode="numeric" maxLength={4} placeholder="••••" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && tryPin()} />
              <Btn className="w-full py-3.5" onClick={tryPin}>Unlock</Btn>
            </div>
          )}
          {fingerprintSet && (
            <Btn variant="outline" className="w-full py-3.5 mt-3" onClick={tryFp}><Fingerprint size={18} /> Unlock with fingerprint</Btn>
          )}
          <button onClick={usePasswordInstead} className="mt-6 text-sm font-bold text-violet-600">Log in with password instead</button>
          <p className="text-[11px] text-slate-400 mt-3">Password login always works — use it if you forgot your device PIN.</p>
        </div>
      </div>
    </div>
  )
}
