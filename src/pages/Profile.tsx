import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Camera, Car, ChevronRight, Coins, CreditCard, Download, FileText, Fingerprint, Globe, Hash, HelpCircle, KeyRound, Lock, LogOut, Mail, MessageCircle, ScanFace, Send, ShieldCheck, Smartphone, Upload, UserRound } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Badge, Btn, Card, Input, Modal, ModalActions, ModalDesc, ModalRow, PinBoxes, useConfirm } from '../components/ui'
import { depositMethods } from '../lib/localPayments'
import { fileToScaledDataUrl, fmtUSDT, fmtDateTime } from '../lib/utils'
import { LANGUAGES } from '../lib/i18n'
import { CURRENCIES, PINNED, currencyName } from '../lib/currencies'

// Support contact channels (placeholder handles — replace with the real ones any time)
const SUPPORT_CHANNELS = [
  { label: 'WhatsApp', href: 'https://wa.me/8801712345678', icon: MessageCircle, cls: 'bg-emerald-500' },
  { label: 'Telegram', href: 'https://t.me/novawallet', icon: Send, cls: 'bg-sky-500' },
  { label: 'Email', href: 'mailto:support@novawallet.app', icon: Mail, cls: 'bg-violet-600' },
]
export default function Profile() {
  const { user, db, walletOf, lockNow, updateProfile, changePassword, changePin, resetPassword, submitKyc, addTicket, replyTicket, toast, requestUpgrade, devicePinSet, fingerprintSet, setDevicePin, clearDevicePin, setupFingerprint, clearFingerprint, t, lang, setLanguage, currency, currencyIsAuto, detectedCurrency, setCurrency, fmtMoney } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const confirm = useConfirm()
  const [modal, setModal] = useState<string | null>(null)

  useEffect(() => {
    if ((location.state as any)?.openLevels) { setModal('levels'); navigate(location.pathname, { replace: true, state: null }) }
    else if ((location.state as any)?.openSupport) { setModal('support'); navigate(location.pathname, { replace: true, state: null }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [canInstall, setCanInstall] = useState(!!(window as any).__nwInstallPrompt)
  const [appInstalled, setAppInstalled] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true)
  useEffect(() => {
    const ready = () => setCanInstall(true)
    const done = () => { setAppInstalled(true); setCanInstall(false) }
    window.addEventListener('nw-install-ready', ready)
    window.addEventListener('appinstalled', done)
    return () => { window.removeEventListener('nw-install-ready', ready); window.removeEventListener('appinstalled', done) }
  }, [])
  const doInstall = async () => {
    if (appInstalled) return toast({ kind: 'success', title: 'NovaWallet is already installed on this device.' })
    const prompt = (window as any).__nwInstallPrompt
    if (prompt) {
      prompt.prompt()
      const choice = await prompt.userChoice
      if (choice?.outcome === 'accepted') { (window as any).__nwInstallPrompt = null; setCanInstall(false) }
    } else setModal('install')
  }
  const [edit, setEdit] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' })
  const [editPhoto, setEditPhoto] = useState<string | undefined>(user?.photo)
  const [pw, setPw] = useState({ old: '', next: '' })
  const [fp, setFp] = useState({ email: user?.email ?? '', pin: '', next: '', confirm: '' })
  const [pin, setPin] = useState({ old: '', next: '', confirm: '' })
  const [ticket, setTicket] = useState({ subject: '', message: '' })
  const [chatText, setChatText] = useState('')
  const [pinEdit, setPinEdit] = useState(false); const [pinVal, setPinVal] = useState(''); const [pinValConfirm, setPinValConfirm] = useState('')
  const [viewTicket, setViewTicket] = useState<string | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const [notifPrefs, setNotifPrefs] = useState({ tx: true, market: true, promo: false })
  const [curQ, setCurQ] = useState('')
  const [kycStep, setKycStep] = useState(1)
  const [kycDocType, setKycDocType] = useState('nid')
  const [kycDocNumber, setKycDocNumber] = useState('')
  const [kycDocPhoto, setKycDocPhoto] = useState('')
  const [kycFacePhoto, setKycFacePhoto] = useState('')
  const [camOn, setCamOn] = useState(false)
  const [camErr, setCamErr] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const stopCam = () => { streamRef.current?.getTracks().forEach(tr => tr.stop()); streamRef.current = null; setCamOn(false) }
  const startCam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream; setCamOn(true); setCamErr(false)
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream }, 60)
    } catch { setCamErr(true) }
  }
  const captureFace = () => {
    const v = videoRef.current; if (!v) return
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 360 / v.videoWidth)
    canvas.width = Math.round(v.videoWidth * scale); canvas.height = Math.round(v.videoHeight * scale)
    const ctx = canvas.getContext('2d')!; ctx.translate(canvas.width, 0); ctx.scale(-1, 1); ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
    setKycFacePhoto(canvas.toDataURL('image/jpeg', 0.75)); stopCam()
  }
  useEffect(() => {
    if (modal === 'support' && chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
  })
  useEffect(() => {
    if (modal === 'kyc') { setKycStep(1); setKycDocType(user?.kycDocType ?? 'nid'); setKycDocNumber(user?.kycDocNumber ?? ''); setKycDocPhoto(user?.kycDocPhoto ?? ''); setKycFacePhoto(user?.kycFacePhoto ?? ''); setCamErr(false) }
    if (modal !== 'kyc') stopCam()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal])
  if (!user) return null
  const w = walletOf(user.id)
  const rows: [string, string, any][] = [
    ['p_edit', 'edit', <UserRound size={18} />], ['p_password', 'pw', <KeyRound size={18} />], ['forgot_password', 'forgot', <HelpCircle size={18} />], ['p_pin', 'pin', <Hash size={18} />],
    ['p_login_options', 'login', <Fingerprint size={18} />], ['p_kyc', 'kyc', <ShieldCheck size={18} />], ['p_methods', 'methods', <CreditCard size={18} />],
    ['p_notif', 'notif', <Bell size={18} />], ['p_language', 'lang', <Globe size={18} />], ['p_currency', 'currency', <Coins size={18} />], ['p_support', 'support', <HelpCircle size={18} />],
    ['p_sessions', 'sessions', <Smartphone size={18} />], ['p_terms', 'terms', <FileText size={18} />],
  ]
  return (
    <div className="anim-fade-up">
      <Card className="p-6 text-center mb-4">
        <div className="flex justify-center"><Avatar name={user.name} size={84} photo={user.photo} /></div>
        <h1 className="text-xl font-extrabold mt-3">{user.name}</h1>
        <p className="text-sm text-slate-500">@{user.username} · {user.email}</p>
        <p className="text-sm text-slate-500">{user.phone} · ID {user.id}</p>
        <div className="flex gap-2 justify-center mt-3">
          <Badge tone={user.kyc === 'verified' ? 'green' : 'slate'}>{user.kyc === 'verified' ? '✅ ' + t('verified') : t('non_kyc')}</Badge>
          <Badge tone={user.status === 'active' ? 'green' : 'red'}>{user.status}</Badge>
          <Badge tone="violet">{fmtMoney(w.available + w.locked)} {t('wallet')}</Badge>
        </div>
      </Card>

      {/* Account levels */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${db.levels.find(l => l.level === user.level)?.gradient ?? 'from-violet-600 to-indigo-700'} text-white flex flex-col items-center justify-center leading-none`}>
            <span className="text-[9px] font-bold uppercase">{t('level')}</span><span className="text-xl font-extrabold">{user.level}</span>
          </div>
          <div className="flex-1 min-w-[140px]">
            <p className="font-extrabold">{t('level')} {user.level}</p>
            <p className="text-xs text-slate-500">{db.levels.find(l => l.level === user.level)?.tagline} · Daily limit {fmtUSDT((db.levels.find(l => l.level === user.level)?.dailyLimit ?? 0) / db.settings.bdtPerUsd)} · Loan up to {fmtUSDT((db.levels.find(l => l.level === user.level)?.loanLimit ?? 0) / db.settings.bdtPerUsd)}</p>
          </div>
          {user.level < 4
            ? <Btn onClick={() => setModal('levels')}>{t('upgrade')} ⬆</Btn>
            : <Badge tone="violet">{t('max_level')} 👑</Badge>}
        </div>
        {db.levelRequests.filter(r => r.userId === user.id && r.status === 'pending').map(r => (
          <p key={r.id} className="mt-3 text-sm font-semibold text-amber-600">⏳ {t('upgrade')}: {t('level')} {r.toLevel} — pending admin review.</p>
        ))}
      </Card>

      <Card className="p-2">
        {rows.map(([key, id, icon]) => (
          <button key={id} onClick={() => setModal(id)} className="w-full flex items-center gap-3 p-3.5 font-semibold text-[15px] hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-2xl text-left">
            <span className="text-violet-600">{icon}</span> {t(key)}
            {id === 'login' && <Badge tone={(devicePinSet || fingerprintSet) ? 'green' : 'slate'}>{(devicePinSet || fingerprintSet) ? t('on') : t('off')}</Badge>}
            {id === 'kyc' && <Badge tone={user.kyc === 'verified' ? 'green' : 'slate'}>{user.kyc === 'verified' ? t('verified') : t('non_kyc')}</Badge>}
            {id === 'lang' && <span className="ml-auto text-sm text-slate-400">{LANGUAGES.find(l => l.code === lang)?.native ?? 'English'}</span>}
            {id === 'currency' && <span className="ml-auto text-lg font-extrabold text-violet-600">{currency}{currencyIsAuto ? <span className="text-[10px] font-bold text-slate-400 align-middle"> · AUTO</span> : ''}</span>}
            <ChevronRight size={17} className="ml-auto text-slate-300" />
          </button>
        ))}
      </Card>

      <Card className="p-2 mt-4">
        <button onClick={doInstall} className="w-full flex items-center gap-3 p-3.5 font-semibold text-[15px] hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-2xl text-left">
          <span className="text-violet-600"><Download size={18} /></span> Install App
          <span className="ml-auto text-sm font-bold text-violet-600">{appInstalled ? 'Installed ✓' : canInstall ? 'Install' : 'How to install'}</span>
        </button>
      </Card>

      <Card className="p-5 mt-4">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center shrink-0"><HelpCircle size={20} /></span>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold">{t('p_support')}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t('help_card_desc')}</p>
            <p className="text-xs font-bold text-violet-600 mt-1">support@novawallet.app</p>
          </div>
        </div>
        <Btn className="w-full mt-4 py-3.5" onClick={() => setModal('support')}>{t('help_create_ticket')}</Btn>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {SUPPORT_CHANNELS.map(c => (
            <a key={c.label} href={c.href} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 py-3 font-bold text-xs text-slate-600 dark:text-slate-300">
              <span className={`w-9 h-9 rounded-full ${c.cls} text-white flex items-center justify-center`}><c.icon size={17} /></span>{c.label}
            </a>
          ))}
        </div>
        {db.tickets.filter(x => x.userId === user.id && x.status !== 'resolved').length > 0 && <p className="text-center text-xs font-semibold text-amber-600 mt-2.5">⏳ {db.tickets.filter(x => x.userId === user.id && x.status !== 'resolved').length} open ticket(s)</p>}
      </Card>

      {user.role === 'admin' && <Btn className="w-full mt-4" onClick={() => navigate('/admin')}>{t('open_admin')}</Btn>}
      <button onClick={() => confirm.confirm({ title: 'Log out?', body: 'Your login stays saved on this device — unlock again any time with your PIN, fingerprint or password. Use Sign out on the lock screen to remove the saved login completely.', confirmLabel: 'Log out', onConfirm: () => { lockNow() } })}
        className="w-full mt-4 rounded-3xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 font-bold py-4 flex items-center justify-center gap-2"><LogOut size={18} /> {t('logout')}</button>
      {confirm.el}

      <Modal open={modal === 'levels'} onClose={() => setModal(null)} title={t('account_levels')}>
        <ModalDesc>Higher levels unlock bigger daily and loan limits with lower fees. Upgrades are reviewed by an admin — never automatic.</ModalDesc>
        <div className="space-y-2.5">
          {db.levels.map(l => {
            const isCurrent = l.level === user.level
            const isNext = l.level === user.level + 1
            const pending = db.levelRequests.some(r => r.userId === user.id && r.status === 'pending')
            const myDep = db.deposits.filter(d => d.userId === user.id && d.status === 'approved').reduce((s2, d) => s2 + d.amount, 0)
            const depShort = isNext && (l.depositRequired ?? 0) > myDep
            return (
              <div key={l.level} className={`rounded-2xl border-2 px-4 py-3.5 ${isCurrent ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-slate-200/80 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-800/50'}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${l.gradient} text-white flex items-center justify-center font-extrabold`}>{l.level}</span>
                  <div className="flex-1"><p className="font-extrabold">{t('level')} {l.level} {isCurrent && <Badge tone="violet">{t('current')}</Badge>}</p><p className="text-xs text-slate-500">{l.tagline}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs mt-3 text-slate-600 dark:text-slate-300">
                  <span>Daily limit: <b>{fmtUSDT(l.dailyLimit / db.settings.bdtPerUsd)}</b></span><span>Monthly: <b>{fmtUSDT(l.monthlyLimit / db.settings.bdtPerUsd)}</b></span>
                  <span>Loan limit: <b>{fmtUSDT(l.loanLimit / db.settings.bdtPerUsd)}</b></span><span>Fee discount: <b>{l.feeDiscountPct}%</b></span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Requirement: {l.requirement}</p>
                {isNext && (l.depositRequired ?? 0) > 0 && (
                  <div className="mt-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 p-3.5">
                    <div className="flex justify-between gap-2 text-xs font-bold"><span>💰 Deposit requirement</span><span>{fmtUSDT(myDep / db.settings.bdtPerUsd)} / {fmtUSDT(l.depositRequired / db.settings.bdtPerUsd)}</span></div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 mt-2 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 transition-all" style={{ width: Math.min(100, Math.round(myDep / l.depositRequired * 100)) + '%' }} /></div>
                    <p className="text-[11px] text-slate-500 mt-1.5">{depShort ? `Deposit ${fmtUSDT((l.depositRequired - myDep) / db.settings.bdtPerUsd)} more via Add Money to unlock this upgrade.` : '✅ Requirement met — you can request this upgrade.'}</p>
                  </div>
                )}
                {isNext && l.level === 2 && user.kyc === 'unverified' && (
                  <div className="mt-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 p-3.5">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{t('kyc_need_level2')}</p>
                    <Btn variant="outline" className="w-full mt-2.5" onClick={() => setModal('kyc')}>{t('kyc_do_now')}</Btn>
                  </div>
                )}
                {isNext && !(l.level === 2 && user.kyc === 'unverified') && <Btn className="w-full mt-3" disabled={pending || depShort} onClick={() => { const e = requestUpgrade(l.level); if (e) toast({ kind: 'error', title: e }); else { setModal(null); toast({ kind: 'success', title: 'Upgrade requested', body: 'An admin will review your request.' }) } }}>{pending ? 'Request pending…' : depShort ? 'Deposit required first' : 'Request upgrade to Level ' + l.level}</Btn>}
              </div>
            )
          })}
        </div>
      </Modal>
      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title={t('p_edit')}>
        <ModalDesc>Update your photo, name and phone number. Your email and User ID can't be changed.</ModalDesc>
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2.5">
            <Avatar name={edit.name || user.name} size={84} photo={editPhoto} />
            <div className="flex gap-2">
              <label className="px-3.5 py-2 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"><Upload size={13} /> {editPhoto ? 'Change photo' : 'Add photo'}<input type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) setEditPhoto(await fileToScaledDataUrl(f, 256)); e.target.value = '' }} /></label>
              {editPhoto && <button onClick={() => setEditPhoto(undefined)} className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-500">Remove</button>}
            </div>
            <p className="text-[11px] text-slate-400 text-center">Your photo shows next to your name everywhere — when people send you money, on the leaderboard, and across the app.</p>
          </div>
          <Input label={t('full_name')} value={edit.name} onChange={e => setEdit(s => ({ ...s, name: e.target.value }))} />
          <Input label={t('phone')} value={edit.phone} onChange={e => setEdit(s => ({ ...s, phone: e.target.value }))} />
          <Input label="Email" value={user.email} disabled />
        </div>
        <ModalActions><Btn className="w-full py-3.5" onClick={() => { updateProfile({ ...edit, photo: editPhoto }); setModal(null); toast({ kind: 'success', title: 'Profile updated' }) }}>{t('save_changes')}</Btn></ModalActions>
      </Modal>
      <Modal open={modal === 'pw'} onClose={() => setModal(null)} title={t('p_password')}>
        <div className="flex flex-col items-center text-center mb-5">
          <span className="w-14 h-14 rounded-3xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-violet-600/25 mb-3"><KeyRound size={24} /></span>
          <ModalDesc>Choose a strong new password. You'll use it with your email to log in — and it always works as your unlock fallback.</ModalDesc>
        </div>
        <div className="space-y-4">
          <Input label="Current password" type="password" value={pw.old} onChange={e => setPw(s => ({ ...s, old: e.target.value }))} />
          <div>
            <Input label="New password (min 6)" type="password" value={pw.next} onChange={e => setPw(s => ({ ...s, next: e.target.value }))} />
            {pw.next && <div className="mt-2.5"><div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"><div className={`h-full rounded-full transition-all ${pw.next.length >= 10 ? 'bg-emerald-500 w-full' : pw.next.length >= 6 ? 'bg-amber-500 w-2/3' : 'bg-rose-500 w-1/3'}`} /></div><p className="text-[11px] font-semibold text-slate-400 mt-1.5">{pw.next.length >= 10 ? '💪 Strong password' : pw.next.length >= 6 ? '👍 Okay — longer is safer (10+ characters)' : 'Too short — use at least 6 characters'}</p></div>}
          </div>
          <Btn className="w-full py-3.5" onClick={() => { if (pw.next.length < 6) return toast({ kind: 'error', title: 'New password too short' }); const e = changePassword(pw.old, pw.next); if (e) toast({ kind: 'error', title: e }); else { setModal(null); setPw({ old: '', next: '' }); toast({ kind: 'success', title: 'Password changed' }) } }}>{t('p_password')}</Btn>
          <button onClick={() => setModal('forgot')} className="w-full text-center text-sm font-bold text-violet-600 py-1">Forgot your current password? Reset it instead →</button>
        </div>
      </Modal>
      <Modal open={modal === 'forgot'} onClose={() => setModal(null)} title={t('forgot_password')}>
        <div className="flex flex-col items-center text-center mb-5">
          <span className="w-14 h-14 rounded-3xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-violet-600/25 mb-3"><HelpCircle size={24} /></span>
          <ModalDesc>Forgot your password? Verify it's you with your account email and 4-digit transaction PIN, then choose a new password. It works right away — for login and for unlocking.</ModalDesc>
        </div>
        <div className="space-y-5">
          <Input label="Account email" type="email" placeholder="you@email.com" value={fp.email} onChange={e => setFp(s => ({ ...s, email: e.target.value }))} />
          <PinBoxes label="Transaction PIN — verify it's you" value={fp.pin} onChange={v => setFp(s => ({ ...s, pin: v }))} />
          <div>
            <Input label="New password (min 6)" type="password" placeholder="••••••••" value={fp.next} onChange={e => setFp(s => ({ ...s, next: e.target.value }))} />
            {fp.next && <div className="mt-2.5"><div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"><div className={`h-full rounded-full transition-all ${fp.next.length >= 10 ? 'bg-emerald-500 w-full' : fp.next.length >= 6 ? 'bg-amber-500 w-2/3' : 'bg-rose-500 w-1/3'}`} /></div><p className="text-[11px] font-semibold text-slate-400 mt-1.5">{fp.next.length >= 10 ? '💪 Strong password' : fp.next.length >= 6 ? '👍 Okay — longer is safer (10+ characters)' : 'Too short — use at least 6 characters'}</p></div>}
          </div>
          <Input label="Confirm new password" type="password" placeholder="••••••••" value={fp.confirm} onChange={e => setFp(s => ({ ...s, confirm: e.target.value }))} />
          {fp.confirm && fp.next && fp.confirm !== fp.next && <p className="text-center text-sm font-bold text-rose-500">The passwords don't match yet.</p>}
          {fp.confirm && fp.confirm === fp.next && fp.next.length >= 6 && <p className="text-center text-sm font-bold text-emerald-600">✓ Passwords match — you're ready to reset.</p>}
          <div className="rounded-2xl bg-violet-50 dark:bg-violet-500/10 px-4 py-3 flex gap-2.5">
            <ShieldCheck size={17} className="text-violet-600 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">For your safety, 5 wrong PIN attempts lock password reset for 5 minutes, and you'll get a security notification as soon as the password changes.</p>
          </div>
          <Btn className="w-full py-3.5" disabled={!fp.email.trim() || fp.pin.length !== 4 || fp.next.length < 6 || fp.confirm !== fp.next} onClick={() => { const e = resetPassword(fp.email, fp.pin, fp.next); if (e) return toast({ kind: 'error', title: e }); setModal(null); setFp({ email: user.email, pin: '', next: '', confirm: '' }); toast({ kind: 'success', title: 'Password reset complete', body: 'Use your new password the next time you log in or unlock.' }) }}>Reset password</Btn>
        </div>
      </Modal>
      <Modal open={modal === 'pin'} onClose={() => setModal(null)} title={t('p_pin')}>
        <div className="flex flex-col items-center text-center mb-2">
          <span className="w-14 h-14 rounded-3xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-violet-600/25 mb-3"><Hash size={24} /></span>
          <ModalDesc>Your 4-digit transaction PIN confirms sends and cash outs. Follow the three steps — it takes ten seconds.</ModalDesc>
        </div>
        <div className="flex items-center justify-center gap-2 mb-5 text-[11px] font-extrabold">
          {[{ n: '1', l: 'Current PIN', done: pin.old.length === 4 }, { n: '2', l: 'New PIN', done: pin.next.length === 4 }, { n: '3', l: 'Confirm', done: pin.confirm.length === 4 && pin.confirm === pin.next }].map((st, i) => (
            <span key={st.l} className="flex items-center gap-2">
              {i > 0 && <span className="w-5 h-px bg-slate-300 dark:bg-slate-600" />}
              <span className={`inline-flex items-center gap-1.5 ${st.done ? 'text-emerald-600' : 'text-slate-400'}`}><span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white ${st.done ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>{st.done ? '✓' : st.n}</span>{st.l}</span>
            </span>
          ))}
        </div>
        <div className="space-y-6">
          <PinBoxes label="Step 1 · Current PIN" value={pin.old} onChange={v => setPin(s => ({ ...s, old: v }))} />
          <PinBoxes label="Step 2 · New PIN" value={pin.next} onChange={v => setPin(s => ({ ...s, next: v }))} />
          <PinBoxes label="Step 3 · Confirm new PIN" value={pin.confirm} onChange={v => setPin(s => ({ ...s, confirm: v }))} />
          {pin.confirm.length === 4 && pin.next.length === 4 && pin.confirm !== pin.next && <p className="text-center text-sm font-bold text-rose-500">The new PIN and confirmation don't match yet.</p>}
          {pin.confirm.length === 4 && pin.confirm === pin.next && pin.next.length === 4 && <p className="text-center text-sm font-bold text-emerald-600">✓ New PIN confirmed — you're ready to save.</p>}
          <div className="rounded-2xl bg-violet-50 dark:bg-violet-500/10 px-4 py-3 flex gap-2.5">
            <ShieldCheck size={17} className="text-violet-600 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed"><b>Keep it private.</b> Never share your PIN with anyone — NovaWallet staff will never ask for it. Avoid birth years and easy sequences like 1234. PINs are stored hashed, never in plain text.</p>
          </div>
          <Btn className="w-full py-3.5" disabled={pin.old.length !== 4 || pin.next.length !== 4 || pin.confirm !== pin.next} onClick={() => { const e = changePin(pin.old, pin.next); if (e) toast({ kind: 'error', title: e }); else { setModal(null); setPin({ old: '', next: '', confirm: '' }); toast({ kind: 'success', title: 'PIN changed', body: 'Use your new PIN for your next send or cash out.' }) } }}>{t('p_pin')}</Btn>
        </div>
      </Modal>
      <Modal open={modal === 'kyc'} onClose={() => setModal(null)} title={t('p_kyc')}>
        {user.kyc === 'verified' ? (
          <>
            <ModalDesc>{t('kyc_pending_note')}</ModalDesc>
            <ModalRow><span className="text-sm font-semibold">{t('status')}</span><span className="float-right"><Badge tone="green">{t('verified')}</Badge></span>
              {user.kycDocNumber && <p className="text-xs text-slate-500 mt-1.5">{user.kycDocType === 'passport' ? t('kyc_passport') : user.kycDocType === 'driving' ? t('kyc_driving') : t('kyc_nid')} · {user.kycDocNumber}</p>}</ModalRow>
            <ModalActions><Btn variant="ghost" className="w-full py-3.5" onClick={() => setModal(null)}>{t('done')}</Btn></ModalActions>
          </>
        ) : user.kyc === 'pending' ? (
          <>
            <ModalDesc>{t('kyc_pending_note')}</ModalDesc>
            <ModalRow><span className="text-sm font-semibold">{t('status')}</span><span className="float-right"><Badge tone="amber">Pending</Badge></span>
              {user.kycDocNumber && <p className="text-xs text-slate-500 mt-1.5">{user.kycDocType === 'passport' ? t('kyc_passport') : user.kycDocType === 'driving' ? t('kyc_driving') : t('kyc_nid')} · {user.kycDocNumber}{user.kycSubmittedAt ? ' · ' + fmtDateTime(user.kycSubmittedAt) : ''}</p>}
              {(user.kycDocPhoto || user.kycFacePhoto) && <span className="flex gap-2 mt-2">{user.kycDocPhoto && <img src={user.kycDocPhoto} alt="document" className="h-16 w-24 object-cover rounded-xl" />}{user.kycFacePhoto && <img src={user.kycFacePhoto} alt="face" className="h-16 w-16 object-cover rounded-xl" />}</span>}</ModalRow>
            <ModalActions><Btn variant="ghost" className="w-full py-3.5" onClick={() => setModal(null)}>{t('done')}</Btn></ModalActions>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              {[1, 2, 3].map(n => <span key={n} className={`flex-1 h-1.5 rounded-full ${kycStep >= n ? 'bg-violet-600' : 'bg-slate-200 dark:bg-slate-700'}`} />)}
            </div>
            <p className="text-xs font-bold text-slate-400 mb-3">{t('kyc_step')} {kycStep} / 3 · {kycStep === 1 ? t('kyc_doc_type') : kycStep === 2 ? t('kyc_face_scan') : t('kyc_submit_approval')}</p>
            {kycStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {([['nid', t('kyc_nid'), CreditCard], ['passport', t('kyc_passport'), Globe], ['driving', t('kyc_driving'), Car]] as const).map(([code, label, Icon]) => (
                    <button key={code} onClick={() => setKycDocType(code)} className={`rounded-2xl border-2 px-2 py-3.5 flex flex-col items-center gap-1.5 text-center ${kycDocType === code ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-slate-200/80 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-800/50'}`}>
                      <Icon size={20} className="text-violet-600" /><span className="text-[11px] font-bold leading-tight">{label}</span>
                    </button>
                  ))}
                </div>
                <Input label={t('kyc_doc_number')} placeholder="e.g. 1234567890" value={kycDocNumber} onChange={e => setKycDocNumber(e.target.value)} />
                <div>
                  <p className="text-sm font-semibold mb-1.5">{t('kyc_doc_photo')}</p>
                  {kycDocPhoto ? (
                    <div className="relative"><img src={kycDocPhoto} alt="document" className="w-full h-40 object-cover rounded-2xl" />
                      <button onClick={() => setKycDocPhoto('')} className="absolute bottom-2 right-2 px-3 py-1.5 rounded-full bg-slate-900/80 text-white text-xs font-bold">{t('kyc_retake')}</button></div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 py-6 cursor-pointer font-bold text-sm text-violet-600">
                      <Upload size={18} /> {t('kyc_upload_photo')}
                      <input type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) setKycDocPhoto(await fileToScaledDataUrl(f)) }} />
                    </label>
                  )}
                </div>
                <Btn className="w-full py-3.5" disabled={kycDocNumber.trim().length < 5 || !kycDocPhoto} onClick={() => setKycStep(2)}>{t('kyc_next')}</Btn>
              </div>
            )}
            {kycStep === 2 && (
              <div className="space-y-4">
                <ModalDesc>{t('kyc_face_desc')}</ModalDesc>
                {kycFacePhoto ? (
                  <div className="relative"><img src={kycFacePhoto} alt="face" className="w-full h-56 object-cover rounded-2xl" />
                    <button onClick={() => setKycFacePhoto('')} className="absolute bottom-2 right-2 px-3 py-1.5 rounded-full bg-slate-900/80 text-white text-xs font-bold">{t('kyc_retake')}</button></div>
                ) : camOn ? (
                  <div className="space-y-3">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-56 object-cover rounded-2xl bg-slate-900 -scale-x-100" />
                    <Btn className="w-full py-3.5" onClick={captureFace}><Camera size={17} /> {t('kyc_capture')}</Btn>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button onClick={startCam} className="w-full rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white py-6 font-extrabold flex items-center justify-center gap-2"><ScanFace size={22} /> {t('kyc_open_camera')}</button>
                    {camErr && <p className="text-xs font-semibold text-amber-600">{t('camera_fallback')}</p>}
                    <label className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 py-4 cursor-pointer font-bold text-sm text-violet-600">
                      <Upload size={17} /> {t('kyc_upload_photo')}
                      <input type="file" accept="image/*" capture="user" className="hidden" onChange={async e => { const f = e.target.files?.[0]; if (f) setKycFacePhoto(await fileToScaledDataUrl(f, 480)) }} />
                    </label>
                  </div>
                )}
                <div className="flex gap-2">
                  <Btn variant="ghost" className="flex-1 py-3.5" onClick={() => { stopCam(); setKycStep(1) }}>{t('kyc_back')}</Btn>
                  <Btn className="flex-1 py-3.5" disabled={!kycFacePhoto} onClick={() => setKycStep(3)}>{t('kyc_next')}</Btn>
                </div>
              </div>
            )}
            {kycStep === 3 && (
              <div className="space-y-4">
                <ModalRow>
                  <span className="flex justify-between text-sm"><span className="text-slate-500">{t('kyc_doc_type')}</span><b>{kycDocType === 'passport' ? t('kyc_passport') : kycDocType === 'driving' ? t('kyc_driving') : t('kyc_nid')}</b></span>
                  <span className="flex justify-between text-sm mt-1.5"><span className="text-slate-500">{t('kyc_doc_number')}</span><b className="font-mono">{kycDocNumber}</b></span>
                  <span className="flex gap-2 mt-3"><img src={kycDocPhoto} alt="document" className="h-16 w-24 object-cover rounded-xl" /><img src={kycFacePhoto} alt="face" className="h-16 w-16 object-cover rounded-xl" /></span>
                </ModalRow>
                <div className="flex gap-2">
                  <Btn variant="ghost" className="flex-1 py-3.5" onClick={() => setKycStep(2)}>{t('kyc_back')}</Btn>
                  <Btn className="flex-1 py-3.5" onClick={() => { submitKyc({ docType: kycDocType, docNumber: kycDocNumber.trim(), docPhoto: kycDocPhoto, facePhoto: kycFacePhoto }); setModal(null); toast({ kind: 'success', title: 'KYC submitted', body: 'Your documents are now pending admin approval.' }) }}>{t('kyc_submit_approval')}</Btn>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>
      <Modal open={modal === 'methods'} onClose={() => setModal(null)} title={t('p_methods')}>
        <ModalDesc>Your local payment methods for {currency} — shown automatically for your country, and used as defaults for Add Money and Cash Out.</ModalDesc>
        <div className="space-y-2.5">
          {depositMethods(currency, db.settings.payMethods).map(m => (
            <ModalRow key={m.label}><span className="flex justify-between items-center gap-3"><span className="font-bold text-sm shrink-0">{m.label}</span><span className="font-mono text-xs text-right break-all">{m.detail}</span></span></ModalRow>
          ))}
          <ModalRow><span className="flex justify-between items-center gap-3"><span className="font-bold text-sm shrink-0">Your phone</span><span className="font-mono text-xs">{user.phone}</span></span></ModalRow>
        </div>
        <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">Switch your currency in Profile → Currency and this list updates to that country's local methods.</p>
        <ModalActions><Btn variant="ghost" className="w-full py-3.5" onClick={() => setModal(null)}>{t('done')}</Btn></ModalActions>
      </Modal>
      <Modal open={modal === 'notif'} onClose={() => setModal(null)} title={t('p_notif')}>
        <ModalDesc>Choose which alerts you want to receive.</ModalDesc>
        <div className="space-y-2.5">
          {([['tx', 'Transaction alerts'], ['market', 'Crypto market alerts'], ['promo', 'Promotions & offers']] as const).map(([k, l]) => (
            <ModalRow key={k}><label className="flex items-center justify-between font-semibold text-sm">{l}
              <input type="checkbox" checked={notifPrefs[k]} onChange={e => setNotifPrefs(p => ({ ...p, [k]: e.target.checked }))} className="w-5 h-5 accent-violet-600" /></label></ModalRow>
          ))}
        </div>
        <ModalActions><Btn className="w-full py-3.5" onClick={() => { setModal(null); toast({ kind: 'success', title: 'Preferences saved' }) }}>{t('save')}</Btn></ModalActions>
      </Modal>
      <Modal open={modal === 'sessions'} onClose={() => setModal(null)} title={t('p_sessions')}>
        <ModalDesc>Devices currently signed in to your account.</ModalDesc>
        <div className="space-y-2.5">
          {user.sessions.map(s => <ModalRow key={s.id}><span className="flex justify-between items-center gap-3"><span><span className="block font-bold text-sm">{s.device}</span><span className="text-xs text-slate-400">Last login {new Date(user.lastLogin).toLocaleString('en-GB')}</span></span>{s.current && <Badge tone="green">This device</Badge>}</span></ModalRow>)}
        </div>
        <ModalActions><Btn variant="ghost" className="w-full py-3.5" onClick={() => setModal(null)}>{t('done')}</Btn></ModalActions>
      </Modal>
      <Modal open={modal === 'support'} onClose={() => { setModal(null); setViewTicket(null) }} title={t('p_support')}>
        <ModalDesc>Chat with our support team — we usually reply within 24 hours.</ModalDesc>
        {(() => {
          const mine = db.tickets.filter(x => x.userId === user.id)
          const active = mine.find(x => x.status !== 'resolved')
          const viewing = viewTicket ? mine.find(x => x.id === viewTicket) : undefined
          const tk = viewing ?? active
          const statusBadge = (st: string) => st === 'pending' ? <Badge tone="amber">Pending</Badge> : st === 'processing' ? <Badge tone="violet">Processing</Badge> : <Badge tone="green">Resolved</Badge>
          if (tk) return (
            <div>
              <div className="flex items-center gap-2 mb-3">
                {viewing && <button onClick={() => setViewTicket(null)} className="text-xs font-bold text-violet-600 shrink-0">← Back</button>}
                <p className="font-extrabold text-sm flex-1 truncate">{tk.subject}</p>
                {statusBadge(tk.status)}
              </div>
              <div ref={chatScrollRef} className="h-64 overflow-y-auto rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3 space-y-2.5 mb-3">
                {tk.messages.map(m => (
                  <div key={m.id} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm ${m.from === 'user' ? 'bg-violet-600 text-white rounded-br-md' : 'bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60 rounded-bl-md'}`}>
                      {m.from === 'admin' && <p className="text-[10px] font-extrabold text-violet-500 mb-0.5">{t('chat_team')}</p>}
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p className={`text-[10px] mt-1 ${m.from === 'user' ? 'text-violet-200' : 'text-slate-400'}`}>{fmtDateTime(m.at)}</p>
                    </div>
                  </div>
                ))}
              </div>
              {tk.status === 'resolved' ? (
                <p className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl px-3.5 py-3">{t('chat_closed_note')}</p>
              ) : (
                <div className="flex gap-2">
                  <input value={chatText} onChange={e => setChatText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && chatText.trim()) { replyTicket(tk.id, chatText, 'user'); setChatText('') } }} placeholder={t('chat_placeholder')} className="flex-1 min-w-0 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium outline-none focus:border-violet-400" />
                  <Btn className="!px-4 shrink-0" onClick={() => { if (chatText.trim()) { replyTicket(tk.id, chatText, 'user'); setChatText('') } }}><Send size={16} /></Btn>
                </div>
              )}
            </div>
          )
          return (
            <div>
              <p className="font-extrabold text-sm mb-3">{t('chat_new')}</p>
              <div className="space-y-4">
                <Input label="Subject" value={ticket.subject} onChange={e => setTicket(x => ({ ...x, subject: e.target.value }))} />
                <Input label="Message" value={ticket.message} onChange={e => setTicket(x => ({ ...x, message: e.target.value }))} />
                <Btn className="w-full py-3.5" onClick={() => { if (!ticket.subject.trim() || !ticket.message.trim()) return toast({ kind: 'error', title: 'Write a subject and your message' }); addTicket(ticket.subject.trim(), ticket.message.trim()); setTicket({ subject: '', message: '' }); toast({ kind: 'success', title: 'Support chat started', body: 'Status: Pending — we usually reply within 24 hours.' }) }}>{t('chat_start')}</Btn>
              </div>
              {mine.length > 0 && <>
                <p className="font-extrabold text-sm mt-6 mb-2.5">{t('chat_history')}</p>
                <div className="space-y-2">
                  {mine.map(x => (
                    <button key={x.id} onClick={() => setViewTicket(x.id)} className="w-full text-left">
                      <ModalRow><span className="flex items-center gap-2"><span className="flex-1 min-w-0"><span className="block font-bold text-sm truncate">{x.subject}</span><span className="text-xs text-slate-400">{fmtDateTime(x.updatedAt)}</span></span>{statusBadge(x.status)}</span></ModalRow>
                    </button>
                  ))}
                </div>
              </>}
            </div>
          )
        })()}
      </Modal>
      <Modal open={modal === 'login'} onClose={() => { setModal(null); setPinEdit(false); setPinVal(''); setPinValConfirm('') }} title={t('p_login_options')}>
        {(() => {
          const methodsOn = 1 + (devicePinSet ? 1 : 0) + (fingerprintSet ? 1 : 0)
          return (
            <>
              <div className="rounded-3xl bg-gradient-to-br from-violet-700 via-purple-700 to-indigo-800 text-white p-5 mb-4">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0"><ShieldCheck size={21} /></span>
                  <div className="flex-1">
                    <p className="font-extrabold text-sm">Your unlock security</p>
                    <p className="text-xs text-white/75 mt-0.5">{methodsOn} of 3 ways to unlock are on for this device</p>
                  </div>
                  <span className="text-2xl font-extrabold">{methodsOn}/3</span>
                </div>
                <div className="h-2 rounded-full bg-white/20 mt-3.5 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all" style={{ width: (methodsOn / 3 * 100) + '%' }} /></div>
                <p className="text-[11px] text-white/70 mt-2.5 leading-relaxed">Your login stays saved on this device. Unlock fast with PIN or fingerprint — your password always works as a fallback.</p>
              </div>
              <div className="space-y-3">
                <div className="rounded-3xl border-2 border-emerald-500/50 bg-emerald-50/60 dark:bg-emerald-500/5 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shrink-0"><KeyRound size={19} /></span>
                    <div className="flex-1 min-w-0"><p className="font-extrabold text-sm">Password</p><p className="text-xs text-slate-500 mt-0.5">Full sign-in with email + password. Works on any device, any time.</p></div>
                    <Badge tone="green">Always on</Badge>
                  </div>
                </div>
                <div className={`rounded-3xl border-2 px-4 py-4 ${devicePinSet ? 'border-violet-500 bg-violet-50/70 dark:bg-violet-500/10' : 'border-slate-200/80 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-800/50'}`}>
                  <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shrink-0"><Hash size={19} /></span>
                    <div className="flex-1 min-w-0"><p className="font-extrabold text-sm">Login PIN</p><p className="text-xs text-slate-500 mt-0.5">A 4-digit PIN saved only on this device — separate from your transaction PIN. Clearing app data or uninstalling means you set a new one here.</p></div>
                    {devicePinSet ? <Badge tone="green">On</Badge> : <Badge tone="slate">Off</Badge>}
                  </div>
                  {pinEdit ? (
                    <div className="mt-4 space-y-5">
                      <PinBoxes label={devicePinSet ? 'New login PIN' : 'Choose a 4-digit login PIN'} value={pinVal} onChange={setPinVal} />
                      <PinBoxes label="Confirm PIN" value={pinValConfirm} onChange={setPinValConfirm} />
                      {pinValConfirm.length === 4 && pinVal.length === 4 && pinValConfirm !== pinVal && <p className="text-center text-sm font-bold text-rose-500">PINs don't match yet.</p>}
                      <div className="flex gap-2">
                        <Btn variant="ghost" className="flex-1 py-3" onClick={() => { setPinEdit(false); setPinVal(''); setPinValConfirm('') }}>Cancel</Btn>
                        <Btn className="flex-1 py-3" disabled={pinVal.length !== 4 || pinValConfirm !== pinVal} onClick={() => { const e = setDevicePin(pinVal); if (e) return toast({ kind: 'error', title: e }); setPinEdit(false); setPinVal(''); setPinValConfirm(''); toast({ kind: 'success', title: 'Login PIN saved on this device', body: 'Next time you can unlock in seconds.' }) }}>Save PIN</Btn>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-3.5">
                      <Btn className="!py-2.5 flex-1" onClick={() => { setPinEdit(true); setPinVal(''); setPinValConfirm('') }}>{devicePinSet ? 'Change PIN' : 'Set up PIN — 10 seconds'}</Btn>
                      {devicePinSet && <Btn variant="ghost" className="!py-2.5" onClick={() => { clearDevicePin(); toast({ kind: 'success', title: 'Login PIN removed from this device' }) }}>Remove</Btn>}
                    </div>
                  )}
                </div>
                <div className={`rounded-3xl border-2 px-4 py-4 ${fingerprintSet ? 'border-violet-500 bg-violet-50/70 dark:bg-violet-500/10' : 'border-slate-200/80 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-800/50'}`}>
                  <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center shrink-0"><Fingerprint size={20} /></span>
                    <div className="flex-1 min-w-0"><p className="font-extrabold text-sm">Fingerprint / Face unlock</p><p className="text-xs text-slate-500 mt-0.5">{appInstalled ? 'The fastest way in — one touch, no typing. Your fingerprint never leaves this device.' : 'Available inside the installed app only. Install NovaWallet, open the installed app, then set it up here.'}</p></div>
                    {fingerprintSet ? <Badge tone="green">On</Badge> : <Badge tone="slate">Off</Badge>}
                  </div>
                  <div className="flex gap-2 mt-3.5">
                    {!fingerprintSet && appInstalled && <Btn className="!py-2.5 flex-1" onClick={async () => { const e = await setupFingerprint(); if (e) return toast({ kind: 'error', title: e }); toast({ kind: 'success', title: 'Fingerprint login is on', body: 'Unlock with one touch from now on.' }) }}><Fingerprint size={16} /> Set up fingerprint</Btn>}
                    {!fingerprintSet && !appInstalled && <Btn className="!py-2.5 flex-1" onClick={() => setModal('install')}><Smartphone size={16} /> Install the app first</Btn>}
                    {fingerprintSet && <Btn variant="ghost" className="!py-2.5 flex-1" onClick={() => { clearFingerprint(); toast({ kind: 'success', title: 'Fingerprint removed from this device' }) }}>Remove fingerprint</Btn>}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 px-4 py-3 mt-4 flex gap-2.5">
                <Lock size={16} className="text-slate-500 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">PIN and fingerprint live <b>only on this device</b> — they are never uploaded. Log out any time from Profile; the lock screen will ask for one of these methods.</p>
              </div>
              <ModalActions><Btn variant="ghost" className="w-full py-3.5" onClick={() => setModal(null)}>{t('done')}</Btn></ModalActions>
            </>
          )
        })()}
      </Modal>
      <Modal open={modal === 'lang'} onClose={() => setModal(null)} title={t('p_language')}>
        <ModalDesc>{t('language_choose')}</ModalDesc>
        <div className="space-y-2.5">
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => { setLanguage(l.code); toast({ kind: 'success', title: t('language_set') + ': ' + l.native }) }}
              className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left ${lang === l.code ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-slate-200/80 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-800/50'}`}>
              <span className="flex-1"><span className="block font-bold">{l.native}</span><span className="text-xs text-slate-500">{l.label}</span></span>
              {lang === l.code && <Badge tone="violet">{t('current')}</Badge>}
            </button>
          ))}
        </div>
        <ModalActions><Btn variant="ghost" className="w-full py-3.5" onClick={() => setModal(null)}>{t('done')}</Btn></ModalActions>
      </Modal>
      <Modal open={modal === 'currency'} onClose={() => setModal(null)} title={t('p_currency')}>
        <div className="rounded-3xl bg-gradient-to-br from-violet-700 via-purple-700 to-indigo-800 text-white p-5 mb-4 text-center">
          <p className="text-4xl font-extrabold tracking-wide">{currency}</p>
          <p className="text-white/75 text-sm font-semibold mt-1">{currencyName(currency)}{currencyIsAuto ? ' · ' + t('currency_auto') : ''}</p>
        </div>
        <ModalDesc>{t('currency_choose')}</ModalDesc>
        <div className="space-y-2.5 max-h-[52vh] overflow-y-auto pr-0.5">
          <button onClick={() => { setCurrency(null); toast({ kind: 'success', title: t('currency_auto') + ': ' + detectedCurrency }) }}
            className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left ${currencyIsAuto ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-slate-200/80 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-800/50'}`}>
            <span className="flex-1"><span className="block font-bold">{t('currency_auto')}</span><span className="text-xs text-slate-500">{t('currency_detected')}: {detectedCurrency} · {currencyName(detectedCurrency)}</span></span>
            {currencyIsAuto && <Badge tone="violet">{t('current')}</Badge>}
          </button>
          <Input placeholder={t('search_currency')} value={curQ} onChange={e => setCurQ(e.target.value)} />
          {[...CURRENCIES.filter(c => PINNED.includes(c.code)), ...CURRENCIES.filter(c => !PINNED.includes(c.code))]
            .filter(c => (c.code + ' ' + c.name).toLowerCase().includes(curQ.trim().toLowerCase()))
            .map(c => (
              <button key={c.code} onClick={() => { setCurrency(c.code); toast({ kind: 'success', title: t('p_currency') + ': ' + c.code }) }}
                className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left ${!currencyIsAuto && currency === c.code ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-slate-200/80 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-800/50'}`}>
                <span className="font-extrabold w-12 shrink-0">{c.code}</span>
                <span className="flex-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{c.name}</span>
                {PINNED.includes(c.code) && <span className="text-amber-500 text-xs">★</span>}
                {!currencyIsAuto && currency === c.code && <Badge tone="violet">{t('current')}</Badge>}
              </button>
            ))}
        </div>
        <ModalActions><Btn variant="ghost" className="w-full py-3.5" onClick={() => setModal(null)}>{t('done')}</Btn></ModalActions>
      </Modal>
      <Modal open={modal === 'install'} onClose={() => setModal(null)} title="Install NovaWallet">
        <ModalDesc>NovaWallet works as a real app — no app store needed. It installs from this website and opens full-screen from your home screen or desktop.</ModalDesc>
        <div className="space-y-2.5 text-sm">
          <ModalRow><span>📱 <b>Android (Chrome):</b> tap <b>Install App</b> here, or Chrome menu ⋮ → <b>Install app / Add to Home screen</b>.</span></ModalRow>
          <ModalRow><span>🍎 <b>iPhone (Safari):</b> tap the <b>Share</b> button → <b>Add to Home Screen</b> → <b>Add</b>.</span></ModalRow>
          <ModalRow><span>💻 <b>Desktop (Chrome / Edge):</b> click the <b>install icon</b> at the right end of the address bar, or menu ⋮ → <b>Install NovaWallet</b>.</span></ModalRow>
        </div>
        <Btn className="w-full mt-4" onClick={() => { setModal(null); doInstall() }}>{canInstall ? 'Install now' : 'Got it'}</Btn>
      </Modal>
      <Modal open={modal === 'terms'} onClose={() => setModal(null)} title={t('p_terms')}>
        <div className="space-y-2.5">
          <ModalRow><p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed"><b>Terms:</b> NovaWallet is a demo digital finance platform. Deposits and withdrawals are processed only after admin verification. Loans are subject to admin approval and KYC. Crypto prices are indicative market data, not a guarantee of executable price.</p></ModalRow>
          <ModalRow><p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed"><b>Privacy:</b> We store only the data needed to operate your wallet. Passwords and PINs are hashed. Financial movements are recorded in an immutable double-entry ledger for audit. We never sell personal data.</p></ModalRow>
        </div>
        <ModalActions><Btn variant="ghost" className="w-full py-3.5" onClick={() => setModal(null)}>{t('done')}</Btn></ModalActions>
      </Modal>
    </div>
  )
}
