import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Check, CheckCircle2, Copy, Info, X, XCircle } from 'lucide-react'
import { useApp } from '../lib/store'
import { gradientFor, initials } from '../lib/utils'

export const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-[0_2px_16px_rgba(15,23,42,0.05)] ${className}`}>{children}</div>
)
export const Btn = ({ children, onClick, variant = 'primary', className = '', disabled, type }: any) => {
  const styles: Record<string, string> = {
    primary: 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/25 hover:opacity-95 active:scale-[.98]',
    ghost: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700',
    danger: 'bg-rose-600 text-white hover:bg-rose-500',
    success: 'bg-emerald-600 text-white hover:bg-emerald-500',
    outline: 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800',
  }
  return <button type={type ?? 'button'} disabled={disabled} onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:pointer-events-none ${styles[variant]} ${className}`}>{children}</button>
}
export const Input = (props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) => (
  <label className="block">
    {props.label && <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">{props.label}</span>}
    <input {...props} className={`w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/70 px-4 py-3 text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition ${props.className ?? ''}`} />
  </label>
)
/** Small copy-to-clipboard button with a brief "Copied" state (clipboard API + fallback). */
export const CopyBtn = ({ value, label = 'Copy' }: { value: string; label?: string }) => {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(value) } catch {
      const ta = document.createElement('textarea'); ta.value = value; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy') } catch { /* ignore */ } ta.remove()
    }
    setDone(true); setTimeout(() => setDone(false), 1600)
  }
  return (
    <button type="button" onClick={copy} aria-label={label + ': ' + value} className={`shrink-0 inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold transition active:scale-95 ${done ? 'bg-emerald-600 text-white' : 'bg-violet-600/10 text-violet-600 dark:text-violet-300 hover:bg-violet-600/20'}`}>
      {done ? <Check size={13} /> : <Copy size={13} />} {done ? 'Copied' : label}
    </button>
  )
}
export const MaxBtn = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick} aria-label="Use maximum amount"
    className="absolute right-2.5 bottom-[9px] z-10 px-2.5 py-1 rounded-lg bg-transparent text-violet-600 dark:text-violet-400 text-xs font-extrabold tracking-widest hover:bg-violet-600/10 active:scale-95 transition">MAX</button>
)
export const Select = ({ label, children, ...props }: any) => (
  <label className="block">
    {label && <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">{label}</span>}
    <select {...props} className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/70 px-4 py-3 text-[15px] text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500">{children}</select>
  </label>
)
export const Badge = ({ children, tone = 'slate' }: { children: React.ReactNode; tone?: string }) => {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    red: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  }
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${tones[tone]}`}>{children}</span>
}
export const statusTone = (s: string) =>
  ['completed', 'approved', 'active', 'verified'].includes(s) ? 'green'
  : ['pending', 'processing', 'unverified'].includes(s) ? 'amber'
  : ['rejected', 'suspended'].includes(s) ? 'red' : 'slate'

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  // Lock background page scroll while any modal is open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev; document.documentElement.style.overflow = '' }
  }, [open ])
  if (!open) return null
  // Portal to <body>: the modal is always positioned against the viewport,
  // never against a (possibly transformed/animated) page container.
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="anim-pop relative w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>, document.body)
}
/** Uniform modal interior pieces — every modal in the app uses these so they all look the same. */
export const ModalDesc = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-4">{children}</p>
)
/** Round direction icon for transaction rows: green down-left = money in, red up-right = money out, violet = swap. */
export const TxDirIcon = ({ dir }: { dir: 'in' | 'out' | 'neutral' }) => (
  dir === 'in'
    ? <span className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0"><ArrowDownLeft size={17} /></span>
    : dir === 'out'
      ? <span className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0"><ArrowUpRight size={17} /></span>
      : <span className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0"><ArrowLeftRight size={17} /></span>
)
export const ModalRow = ({ children, active = false }: { children: React.ReactNode; active?: boolean }) => (
  <div className={`rounded-2xl border-2 px-4 py-3.5 ${active ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-slate-200/80 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-800/50'}`}>{children}</div>
)
export const ModalActions = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-2 mt-5">{children}</div>
)
export function Confirm({ open, onClose, onConfirm, title, body, confirmLabel = 'Confirm' }: any) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex gap-3 items-start">
        <div className="p-2.5 rounded-2xl bg-amber-100 dark:bg-amber-500/15 text-amber-600"><AlertTriangle size={20} /></div>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{body}</p>
      </div>
      <div className="flex gap-3 mt-5">
        <Btn variant="ghost" className="flex-1" onClick={onClose}>Cancel</Btn>
        <Btn className="flex-1" onClick={() => { onConfirm(); onClose() }}>{confirmLabel}</Btn>
      </div>
    </Modal>
  )
}
/** Attractive box PIN/OTP entry: tap the boxes and type — filled boxes light up one by one. `length` 4 = PIN, 6 = email OTP (digits shown). */
export const PinBoxes = ({ value, onChange, label, onEnter, shake = false, length = 4, showDigits = false }: { value: string; onChange: (v: string) => void; label?: string; onEnter?: () => void; shake?: boolean; length?: number; showDigits?: boolean }) => (
  <div>
    {label && <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide text-center">{label}</span>}
    <label className={`relative block cursor-text ${shake ? 'animate-[nw-shake_.35s_ease]' : ''}`}>
      <span className="flex justify-center gap-2.5">
        {Array.from({ length }).map((_, i) => (
          <span key={i} className={`${length > 4 ? 'w-11 h-12 text-lg' : 'w-14 h-14'} rounded-2xl border-2 flex items-center justify-center transition-all font-extrabold text-slate-800 dark:text-slate-100 ${value.length === i ? 'border-violet-500 ring-4 ring-violet-500/15 scale-[1.03]' : value.length > i ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/70'}`}>
            {value.length > i && (showDigits ? value[i] : <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-violet-600 to-cyan-500" />)}
          </span>
        ))}
      </span>
      <input type={showDigits ? 'text' : 'password'} inputMode="numeric" autoComplete="one-time-code" maxLength={length} value={value} aria-label={label ?? 'PIN'}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
        onKeyDown={e => e.key === 'Enter' && onEnter?.()}
        className="absolute inset-0 w-full h-full opacity-0 cursor-text" />
    </label>
    <span className="flex justify-center gap-1.5 mt-3">
      {Array.from({ length }).map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${value.length > i ? 'w-6 bg-gradient-to-r from-violet-600 to-cyan-500' : 'w-3 bg-slate-200 dark:bg-slate-700'}`} />)}
    </span>
  </div>
)
/** On-screen numeric keypad for the lock screen — big, thumb-friendly keys. */
export const PinPad = ({ onDigit, onBackspace, leftCell }: { onDigit: (d: string) => void; onBackspace: () => void; leftCell?: React.ReactNode }) => {
  const letters: Record<string, string> = { '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL', '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ' }
  const keyCls = "h-12 rounded-2xl bg-gradient-to-b from-white to-slate-100 dark:from-slate-800 dark:to-slate-900 border border-slate-200/90 dark:border-slate-700/70 shadow-[0_2px_10px_rgba(15,23,42,0.08)] active:scale-95 active:border-violet-400 active:shadow-[0_0_0_4px_rgba(139,92,246,0.15)] transition flex flex-col items-center justify-center leading-none"
  return (
    <div className="grid grid-cols-3 gap-1.5 max-w-[264px] mx-auto">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
        <button key={d} type="button" onClick={() => onDigit(d)} className={keyCls}>
          <span className="text-lg font-extrabold text-slate-800 dark:text-slate-100">{d}</span>
          {letters[d] && <span className="text-[7.5px] font-bold tracking-[.18em] text-slate-400 mt-0.5">{letters[d]}</span>}
        </button>
      ))}
      <span className="h-12 flex items-center justify-center">{leftCell}</span>
      <button type="button" onClick={() => onDigit('0')} className={keyCls}><span className="text-lg font-extrabold text-slate-800 dark:text-slate-100">0</span></button>
      <button type="button" aria-label="Delete last digit" onClick={onBackspace} className="h-12 rounded-2xl text-slate-500 dark:text-slate-400 text-lg font-bold active:scale-95 transition flex items-center justify-center">⌫</button>
    </div>
  )
}
export const PinField = ({ pin, setPin }: { pin: string; setPin: (v: string) => void }) => (
  <Input label="Transaction PIN" type="password" inputMode="numeric" maxLength={4} placeholder="••••" value={pin}
    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
)
export const COIN_LOGOS: Record<string, { glyph: string; bg: string }> = {
  BTC: { glyph: '₿', bg: '#f7931a' }, ETH: { glyph: 'Ξ', bg: '#627eea' },
  USDT: { glyph: '₮', bg: '#26a17b' }, BNB: { glyph: '◆', bg: '#f0b90b' },
  SOL: { glyph: '◎', bg: '#9945ff' }, XRP: { glyph: '✕', bg: '#25a4e9' },
  NOVA: { glyph: 'N', bg: '#7c3aed' },
}
export function NewsLogo({ coin, category, size = 64 }: { coin?: string; category?: string; size?: number }) {
  const key = coin ?? ({ Bitcoin: 'BTC', Ethereum: 'ETH' } as any)[category ?? ''] ?? 'NOVA'
  const logo = COIN_LOGOS[key] ?? COIN_LOGOS.NOVA
  return (
    <div className="shrink-0 rounded-full flex items-center justify-center text-white font-extrabold shadow-lg ring-4 ring-white/40 dark:ring-white/10"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${logo.bg}, ${logo.bg}bb)`, fontSize: size * 0.44 }}>{logo.glyph}</div>
  )
}
export const Avatar = ({ name, size = 40, photo }: { name: string; size?: number; photo?: string }) => (
  photo
    ? <img src={photo} alt={name} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
    : <div className={`shrink-0 rounded-full bg-gradient-to-br ${gradientFor(name)} text-white flex items-center justify-center font-bold`} style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials(name)}</div>
)
export const Empty = ({ title, body }: { title: string; body?: string }) => (
  <div className="py-10 text-center">
    <div className="text-4xl mb-2">🗂️</div>
    <p className="font-semibold text-slate-700 dark:text-slate-200">{title}</p>
    {body && <p className="text-sm text-slate-500 mt-1">{body}</p>}
  </div>
)
export const SkeletonRows = ({ n = 4 }: { n?: number }) => (
  <div className="space-y-3">{Array.from({ length: n }).map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}</div>
)
export function Toasts() {
  const { toasts, dismissToast } = useApp()
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-4 z-[100] w-[calc(100%-2rem)] sm:w-96 space-y-2">
      {toasts.map(t => (
        <div key={t.id} className="anim-fade-up flex gap-3 rounded-2xl bg-slate-900/75 dark:bg-white/80 text-white dark:text-slate-900 p-3.5 shadow-2xl backdrop-blur-md border border-white/15 dark:border-slate-900/10">
          {t.kind === 'success' ? <CheckCircle2 className="text-emerald-400 shrink-0" size={20} /> : t.kind === 'error' ? <XCircle className="text-rose-400 shrink-0" size={20} /> : <Info className="text-cyan-400 shrink-0" size={20} />}
          <div className="flex-1 min-w-0"><p className="text-sm font-bold">{t.title}</p>{t.body && <p className="text-xs opacity-80 mt-0.5">{t.body}</p>}</div>
          <button onClick={() => dismissToast(t.id)} className="opacity-60 hover:opacity-100"><X size={16} /></button>
        </div>
      ))}
    </div>
  )
}
export function useConfirm() {
  const [state, setState] = useState<any>(null)
  return {
    confirm: (cfg: any) => setState(cfg),
    el: state ? <Confirm open {...state} onClose={() => setState(null)} onConfirm={() => state.onConfirm()} /> : null,
  }
}
