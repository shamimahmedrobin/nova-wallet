import React, { useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
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
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="anim-pop relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
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
export const Avatar = ({ name, size = 40 }: { name: string; size?: number }) => (
  <div className={`shrink-0 rounded-full bg-gradient-to-br ${gradientFor(name)} text-white flex items-center justify-center font-bold`} style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials(name)}</div>
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
        <div key={t.id} className="anim-fade-up flex gap-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-3.5 shadow-2xl">
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
