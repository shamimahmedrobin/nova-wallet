import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ChevronRight, FileText, Globe, HelpCircle, KeyRound, LogOut, Moon, ShieldCheck, Smartphone, Sun, UserRound } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Badge, Btn, Card, Input, Modal, ModalActions, ModalDesc, ModalRow, useConfirm } from '../components/ui'
import { fmtBDT } from '../lib/utils'

export default function Profile() {
  const { user, db, walletOf, logout, updateProfile, changePassword, changePin, submitKyc, addTicket, toast, theme, toggleTheme, requestUpgrade } = useApp()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [modal, setModal] = useState<string | null>(null)
  const [edit, setEdit] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' })
  const [pw, setPw] = useState({ old: '', next: '' })
  const [pin, setPin] = useState({ old: '', next: '' })
  const [ticket, setTicket] = useState({ subject: '', message: '' })
  const [notifPrefs, setNotifPrefs] = useState({ tx: true, market: true, promo: false })
  if (!user) return null
  const w = walletOf(user.id)
  const rows: [string, any][] = [
    ['Edit profile', <UserRound size={18} />], ['Change password', <KeyRound size={18} />], ['Change transaction PIN', <KeyRound size={18} />],
    ['Two-factor authentication', <Smartphone size={18} />], ['KYC verification', <ShieldCheck size={18} />], ['Linked payment methods', <FileText size={18} />],
    ['Notification preferences', <Bell size={18} />], ['Language', <Globe size={18} />], ['Help & support', <HelpCircle size={18} />],
    ['Login activity & sessions', <Smartphone size={18} />], ['Terms & Privacy', <FileText size={18} />],
  ]
  const act = (label: string) => {
    if (label === 'Edit profile') setModal('edit')
    else if (label === 'Change password') setModal('pw')
    else if (label === 'Change transaction PIN') setModal('pin')
    else if (label === 'KYC verification') setModal('kyc')
    else if (label === 'Two-factor authentication') setModal('2fa')
    else if (label === 'Notification preferences') setModal('notif')
    else if (label === 'Language') setModal('lang')
    else if (label === 'Help & support') setModal('support')
    else if (label === 'Login activity & sessions') setModal('sessions')
    else if (label === 'Linked payment methods') setModal('methods')
    else if (label === 'Terms & Privacy') setModal('terms')
  }
  return (
    <div className="anim-fade-up">
      <Card className="p-6 text-center mb-4">
        <div className="flex justify-center"><Avatar name={user.name} size={84} /></div>
        <h1 className="text-xl font-extrabold mt-3">{user.name}</h1>
        <p className="text-sm text-slate-500">@{user.username} · {user.email}</p>
        <p className="text-sm text-slate-500">{user.phone} · ID {user.id}</p>
        <div className="flex gap-2 justify-center mt-3">
          <Badge tone={user.kyc === 'verified' ? 'green' : 'slate'}>{user.kyc === 'verified' ? '✅ Verified' : 'Non KYC'}</Badge>
          <Badge tone={user.status === 'active' ? 'green' : 'red'}>{user.status}</Badge>
          <Badge tone="violet">{fmtBDT(w.available + w.locked)} wallet</Badge>
        </div>
      </Card>

      {/* Account levels */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${db.levels.find(l => l.level === user.level)?.gradient ?? 'from-violet-600 to-indigo-700'} text-white flex flex-col items-center justify-center leading-none`}>
            <span className="text-[9px] font-bold uppercase">Level</span><span className="text-xl font-extrabold">{user.level}</span>
          </div>
          <div className="flex-1 min-w-[140px]">
            <p className="font-extrabold">Level {user.level}</p>
            <p className="text-xs text-slate-500">{db.levels.find(l => l.level === user.level)?.tagline} · Daily limit {fmtBDT(db.levels.find(l => l.level === user.level)?.dailyLimit ?? 0)} · Loan up to {fmtBDT(db.levels.find(l => l.level === user.level)?.loanLimit ?? 0)}</p>
          </div>
          {user.level < 4
            ? <Btn onClick={() => setModal('levels')}>Upgrade ⬆</Btn>
            : <Badge tone="violet">Max level 👑</Badge>}
        </div>
        {db.levelRequests.filter(r => r.userId === user.id && r.status === 'pending').map(r => (
          <p key={r.id} className="mt-3 text-sm font-semibold text-amber-600">⏳ Upgrade to Level {r.toLevel} requested — pending admin review.</p>
        ))}
      </Card>

      <Card className="p-2 mb-4">
        <button onClick={toggleTheme} className="w-full flex items-center gap-3 p-3.5 font-semibold text-[15px]">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} Theme — {theme === 'dark' ? 'Dark' : 'Light'}
          <span className="ml-auto text-violet-600 text-sm font-bold">Toggle</span>
        </button>
      </Card>

      <Card className="p-2">
        {rows.map(([label, icon]) => (
          <button key={label} onClick={() => act(label)} className="w-full flex items-center gap-3 p-3.5 font-semibold text-[15px] hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-2xl text-left">
            <span className="text-violet-600">{icon}</span> {label}
            {label === 'Two-factor authentication' && <Badge tone={user.twoFA ? 'green' : 'slate'}>{user.twoFA ? 'On' : 'Off'}</Badge>}
            {label === 'KYC verification' && <Badge tone={user.kyc === 'verified' ? 'green' : 'slate'}>{user.kyc === 'verified' ? 'Verified' : 'Non KYC'}</Badge>}
            {label === 'Language' && <span className="ml-auto text-sm text-slate-400">{user.language === 'bn' ? 'বাংলা' : 'English'}</span>}
            <ChevronRight size={17} className="ml-auto text-slate-300" />
          </button>
        ))}
      </Card>

      {user.role === 'admin' && <Btn className="w-full mt-4" onClick={() => navigate('/admin')}>Open Admin Panel</Btn>}
      <button onClick={() => confirm.confirm({ title: 'Log out?', body: 'You will be signed out of NovaWallet on this device.', confirmLabel: 'Log out', onConfirm: () => { logout(); navigate('/') } })}
        className="w-full mt-4 rounded-3xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 font-bold py-4 flex items-center justify-center gap-2"><LogOut size={18} /> Logout</button>
      {confirm.el}

      <Modal open={modal === 'levels'} onClose={() => setModal(null)} title="Account levels">
        <ModalDesc>Higher levels unlock bigger daily and loan limits with lower fees. Upgrades are reviewed by an admin — never automatic.</ModalDesc>
        <div className="space-y-2.5">
          {db.levels.map(l => {
            const isCurrent = l.level === user.level
            const isNext = l.level === user.level + 1
            const pending = db.levelRequests.some(r => r.userId === user.id && r.status === 'pending')
            return (
              <div key={l.level} className={`rounded-2xl border-2 px-4 py-3.5 ${isCurrent ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-slate-200/80 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-800/50'}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${l.gradient} text-white flex items-center justify-center font-extrabold`}>{l.level}</span>
                  <div className="flex-1"><p className="font-extrabold">Level {l.level} {isCurrent && <Badge tone="violet">Current</Badge>}</p><p className="text-xs text-slate-500">{l.tagline}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs mt-3 text-slate-600 dark:text-slate-300">
                  <span>Daily limit: <b>{fmtBDT(l.dailyLimit)}</b></span><span>Monthly: <b>{fmtBDT(l.monthlyLimit)}</b></span>
                  <span>Loan limit: <b>{fmtBDT(l.loanLimit)}</b></span><span>Fee discount: <b>{l.feeDiscountPct}%</b></span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Requirement: {l.requirement}</p>
                {isNext && <Btn className="w-full mt-3" disabled={pending} onClick={() => { const e = requestUpgrade(l.level); if (e) toast({ kind: 'error', title: e }); else { setModal(null); toast({ kind: 'success', title: 'Upgrade requested', body: 'An admin will review your request.' }) } }}>{pending ? 'Request pending…' : 'Request upgrade to Level ' + l.level}</Btn>}
              </div>
            )
          })}
        </div>
      </Modal>
      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title="Edit profile">
        <ModalDesc>Update your name and phone number. Your email and User ID can't be changed.</ModalDesc>
        <div className="space-y-4">
          <Input label="Full name" value={edit.name} onChange={e => setEdit(s => ({ ...s, name: e.target.value }))} />
          <Input label="Phone" value={edit.phone} onChange={e => setEdit(s => ({ ...s, phone: e.target.value }))} />
          <Input label="Email" value={user.email} disabled />
        </div>
        <ModalActions><Btn className="w-full py-3.5" onClick={() => { updateProfile(edit); setModal(null); toast({ kind: 'success', title: 'Profile updated' }) }}>Save changes</Btn></ModalActions>
      </Modal>
      <Modal open={modal === 'pw'} onClose={() => setModal(null)} title="Change password">
        <ModalDesc>Choose a strong new password. You'll use it with your email to log in.</ModalDesc>
        <div className="space-y-4">
          <Input label="Current password" type="password" value={pw.old} onChange={e => setPw(s => ({ ...s, old: e.target.value }))} />
          <Input label="New password (min 6)" type="password" value={pw.next} onChange={e => setPw(s => ({ ...s, next: e.target.value }))} />
          <Btn className="w-full py-3.5" onClick={() => { if (pw.next.length < 6) return toast({ kind: 'error', title: 'New password too short' }); const e = changePassword(pw.old, pw.next); if (e) toast({ kind: 'error', title: e }); else { setModal(null); toast({ kind: 'success', title: 'Password changed' }) } }}>Change password</Btn>
        </div>
      </Modal>
      <Modal open={modal === 'pin'} onClose={() => setModal(null)} title="Change transaction PIN">
        <ModalDesc>Your 4-digit PIN confirms sends and cash outs. PINs are stored hashed, never in plain text.</ModalDesc>
        <div className="space-y-4">
          <Input label="Current PIN" type="password" inputMode="numeric" maxLength={4} value={pin.old} onChange={e => setPin(s => ({ ...s, old: e.target.value }))} />
          <Input label="New PIN (4 digits)" type="password" inputMode="numeric" maxLength={4} value={pin.next} onChange={e => setPin(s => ({ ...s, next: e.target.value }))} />
          <Btn className="w-full py-3.5" onClick={() => { const e = changePin(pin.old, pin.next); if (e) toast({ kind: 'error', title: e }); else { setModal(null); toast({ kind: 'success', title: 'PIN changed' }) } }}>Change PIN</Btn>
        </div>
      </Modal>
      <Modal open={modal === 'kyc'} onClose={() => setModal(null)} title="KYC verification">
        <ModalDesc>Submit your NID / passport for admin review. Verified KYC unlocks loans and higher limits.</ModalDesc>
        <div className="space-y-4">
          <ModalRow><span className="text-sm font-semibold">Status</span><span className="float-right"><Badge tone={user.kyc === 'verified' ? 'green' : 'slate'}>{user.kyc === 'verified' ? 'Verified' : 'Non KYC'}</Badge></span>{user.kyc === 'pending' && <p className="text-xs text-amber-600 font-semibold mt-1.5">Your documents are under admin review.</p>}</ModalRow>
          <Input label="NID / Passport number" placeholder="e.g. 1234567890" />
        </div>
        <ModalActions><Btn className="w-full py-3.5" disabled={user.kyc !== 'unverified'} onClick={() => { submitKyc(); setModal(null); toast({ kind: 'success', title: 'KYC submitted', body: 'An admin will review your documents.' }) }}>{user.kyc === 'verified' ? 'Already verified' : user.kyc === 'pending' ? 'Under review…' : 'Submit for verification'}</Btn></ModalActions>
      </Modal>
      <Modal open={modal === 'methods'} onClose={() => setModal(null)} title="Linked payment methods">
        <ModalDesc>These are used as defaults for Add Money and Cash Out.</ModalDesc>
        <div className="space-y-2.5">
          {[['bKash', user.phone], ['Nagad', user.phone], ['Bank', 'BRAC Bank ····0001']].map(([k, v]) => (
            <ModalRow key={k}><span className="flex justify-between items-center"><span className="font-bold text-sm">{k}</span><span className="font-mono text-sm">{v}</span></span></ModalRow>
          ))}
        </div>
        <ModalActions><Btn variant="ghost" className="w-full py-3.5" onClick={() => setModal(null)}>Done</Btn></ModalActions>
      </Modal>
      <Modal open={modal === 'notif'} onClose={() => setModal(null)} title="Notification preferences">
        <ModalDesc>Choose which alerts you want to receive.</ModalDesc>
        <div className="space-y-2.5">
          {([['tx', 'Transaction alerts'], ['market', 'Crypto market alerts'], ['promo', 'Promotions & offers']] as const).map(([k, l]) => (
            <ModalRow key={k}><label className="flex items-center justify-between font-semibold text-sm">{l}
              <input type="checkbox" checked={notifPrefs[k]} onChange={e => setNotifPrefs(p => ({ ...p, [k]: e.target.checked }))} className="w-5 h-5 accent-violet-600" /></label></ModalRow>
          ))}
        </div>
        <ModalActions><Btn className="w-full py-3.5" onClick={() => { setModal(null); toast({ kind: 'success', title: 'Preferences saved' }) }}>Save preferences</Btn></ModalActions>
      </Modal>
      <Modal open={modal === 'sessions'} onClose={() => setModal(null)} title="Login activity & sessions">
        <ModalDesc>Devices currently signed in to your account.</ModalDesc>
        <div className="space-y-2.5">
          {user.sessions.map(s => <ModalRow key={s.id}><span className="flex justify-between items-center gap-3"><span><span className="block font-bold text-sm">{s.device}</span><span className="text-xs text-slate-400">Last login {new Date(user.lastLogin).toLocaleString('en-GB')}</span></span>{s.current && <Badge tone="green">This device</Badge>}</span></ModalRow>)}
        </div>
        <ModalActions><Btn variant="ghost" className="w-full py-3.5" onClick={() => setModal(null)}>Done</Btn></ModalActions>
      </Modal>
      <Modal open={modal === 'support'} onClose={() => setModal(null)} title="Help & support">
        <ModalDesc>Send a message to our support team. Open tickets: {db.tickets.filter(t => t.userId === user.id && t.status === 'open').length} · support@novawallet.app</ModalDesc>
        <div className="space-y-4">
          <Input label="Subject" value={ticket.subject} onChange={e => setTicket(t => ({ ...t, subject: e.target.value }))} />
          <Input label="Message" value={ticket.message} onChange={e => setTicket(t => ({ ...t, message: e.target.value }))} />
          <Btn className="w-full py-3.5" onClick={() => { addTicket(ticket.subject, ticket.message); setModal(null); toast({ kind: 'success', title: 'Support ticket created' }) }}>Send ticket</Btn>
        </div>
      </Modal>
      <Modal open={modal === '2fa'} onClose={() => setModal(null)} title="Two-factor authentication">
        <ModalDesc>When 2FA is on, sensitive actions (login on a new device, cash out, PIN change) need a second verification step in addition to your password.</ModalDesc>
        <ModalRow><label className="flex items-center justify-between font-semibold text-sm">Two-factor authentication
          <input type="checkbox" checked={user.twoFA} onChange={e => { updateProfile({ twoFA: e.target.checked }); toast({ kind: 'success', title: 'Two-factor ' + (e.target.checked ? 'enabled' : 'disabled') }) }} className="w-5 h-5 accent-violet-600" /></label></ModalRow>
        <ModalActions><Btn variant="ghost" className="w-full py-3.5" onClick={() => setModal(null)}>Done</Btn></ModalActions>
      </Modal>
      <Modal open={modal === 'lang'} onClose={() => setModal(null)} title="Language">
        <ModalDesc>Choose the interface language.</ModalDesc>
        <div className="space-y-2.5">
          {([['en', 'English', 'Interface in English'], ['bn', 'বাংলা', 'বাংলায় ইন্টারফেস']] as const).map(([code, label, sub]) => (
            <button key={code} onClick={() => { updateProfile({ language: code }); setModal(null); toast({ kind: 'success', title: 'Language: ' + label }) }}
              className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left ${user.language === code ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-slate-200/80 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-800/50'}`}>
              <span className="flex-1"><span className="block font-bold">{label}</span><span className="text-xs text-slate-500">{sub}</span></span>
              {user.language === code && <Badge tone="violet">Current</Badge>}
            </button>
          ))}
        </div>
      </Modal>
      <Modal open={modal === 'terms'} onClose={() => setModal(null)} title="Terms & Privacy">
        <div className="space-y-2.5">
          <ModalRow><p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed"><b>Terms:</b> NovaWallet is a demo digital finance platform. Deposits and withdrawals are processed only after admin verification. Loans are subject to admin approval and KYC. Crypto prices are indicative market data, not a guarantee of executable price.</p></ModalRow>
          <ModalRow><p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed"><b>Privacy:</b> We store only the data needed to operate your wallet. Passwords and PINs are hashed. Financial movements are recorded in an immutable double-entry ledger for audit. We never sell personal data.</p></ModalRow>
        </div>
        <ModalActions><Btn variant="ghost" className="w-full py-3.5" onClick={() => setModal(null)}>Done</Btn></ModalActions>
      </Modal>
    </div>
  )
}
