import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Camera, Car, ChevronRight, Coins, CreditCard, FileText, Globe, HelpCircle, KeyRound, LogOut, Mail, MessageCircle, Moon, ScanFace, Send, ShieldCheck, Smartphone, Sun, Upload, UserRound } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Badge, Btn, Card, Input, Modal, ModalActions, ModalDesc, ModalRow, useConfirm } from '../components/ui'
import { fileToScaledDataUrl, fmtBDT, fmtDateTime } from '../lib/utils'
import { LANGUAGES } from '../lib/i18n'
import { CURRENCIES, PINNED, currencyName } from '../lib/currencies'

// Support contact channels (placeholder handles — replace with the real ones any time)
const SUPPORT_CHANNELS = [
  { label: 'WhatsApp', href: 'https://wa.me/8801712345678', icon: MessageCircle, cls: 'bg-emerald-500' },
  { label: 'Telegram', href: 'https://t.me/novawallet', icon: Send, cls: 'bg-sky-500' },
  { label: 'Email', href: 'mailto:support@novawallet.app', icon: Mail, cls: 'bg-violet-600' },
]
export default function Profile() {
  const { user, db, walletOf, logout, updateProfile, changePassword, changePin, submitKyc, addTicket, replyTicket, toast, theme, toggleTheme, requestUpgrade, t, lang, setLanguage, currency, currencyIsAuto, detectedCurrency, setCurrency, fmtMoney } = useApp()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [modal, setModal] = useState<string | null>(null)
  const [edit, setEdit] = useState({ name: user?.name ?? '', phone: user?.phone ?? '' })
  const [pw, setPw] = useState({ old: '', next: '' })
  const [pin, setPin] = useState({ old: '', next: '' })
  const [ticket, setTicket] = useState({ subject: '', message: '' })
  const [chatText, setChatText] = useState('')
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
    ['p_edit', 'edit', <UserRound size={18} />], ['p_password', 'pw', <KeyRound size={18} />], ['p_pin', 'pin', <KeyRound size={18} />],
    ['p_2fa', '2fa', <Smartphone size={18} />], ['p_kyc', 'kyc', <ShieldCheck size={18} />], ['p_methods', 'methods', <FileText size={18} />],
    ['p_notif', 'notif', <Bell size={18} />], ['p_language', 'lang', <Globe size={18} />], ['p_currency', 'currency', <Coins size={18} />], ['p_support', 'support', <HelpCircle size={18} />],
    ['p_sessions', 'sessions', <Smartphone size={18} />], ['p_terms', 'terms', <FileText size={18} />],
  ]
  return (
    <div className="anim-fade-up">
      <Card className="p-6 text-center mb-4">
        <div className="flex justify-center"><Avatar name={user.name} size={84} /></div>
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
            <p className="text-xs text-slate-500">{db.levels.find(l => l.level === user.level)?.tagline} · Daily limit {fmtBDT(db.levels.find(l => l.level === user.level)?.dailyLimit ?? 0)} · Loan up to {fmtBDT(db.levels.find(l => l.level === user.level)?.loanLimit ?? 0)}</p>
          </div>
          {user.level < 4
            ? <Btn onClick={() => setModal('levels')}>{t('upgrade')} ⬆</Btn>
            : <Badge tone="violet">{t('max_level')} 👑</Badge>}
        </div>
        {db.levelRequests.filter(r => r.userId === user.id && r.status === 'pending').map(r => (
          <p key={r.id} className="mt-3 text-sm font-semibold text-amber-600">⏳ {t('upgrade')}: {t('level')} {r.toLevel} — pending admin review.</p>
        ))}
      </Card>

      <Card className="p-2 mb-4">
        <button onClick={toggleTheme} className="w-full flex items-center gap-3 p-3.5 font-semibold text-[15px]">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} {t('theme')} — {theme === 'dark' ? t('dark') : t('light')}
          <span className="ml-auto text-violet-600 text-sm font-bold">{t('toggle')}</span>
        </button>
      </Card>

      <Card className="p-2">
        {rows.map(([key, id, icon]) => (
          <button key={id} onClick={() => setModal(id)} className="w-full flex items-center gap-3 p-3.5 font-semibold text-[15px] hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-2xl text-left">
            <span className="text-violet-600">{icon}</span> {t(key)}
            {id === '2fa' && <Badge tone={user.twoFA ? 'green' : 'slate'}>{user.twoFA ? t('on') : t('off')}</Badge>}
            {id === 'kyc' && <Badge tone={user.kyc === 'verified' ? 'green' : 'slate'}>{user.kyc === 'verified' ? t('verified') : t('non_kyc')}</Badge>}
            {id === 'lang' && <span className="ml-auto text-sm text-slate-400">{LANGUAGES.find(l => l.code === lang)?.native ?? 'English'}</span>}
            {id === 'currency' && <span className="ml-auto text-lg font-extrabold text-violet-600">{currency}{currencyIsAuto ? <span className="text-[10px] font-bold text-slate-400 align-middle"> · AUTO</span> : ''}</span>}
            <ChevronRight size={17} className="ml-auto text-slate-300" />
          </button>
        ))}
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
      <button onClick={() => confirm.confirm({ title: 'Log out?', body: 'You will be signed out of NovaWallet on this device.', confirmLabel: 'Log out', onConfirm: () => { logout(); navigate('/') } })}
        className="w-full mt-4 rounded-3xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 font-bold py-4 flex items-center justify-center gap-2"><LogOut size={18} /> {t('logout')}</button>
      {confirm.el}

      <Modal open={modal === 'levels'} onClose={() => setModal(null)} title={t('account_levels')}>
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
                  <div className="flex-1"><p className="font-extrabold">{t('level')} {l.level} {isCurrent && <Badge tone="violet">{t('current')}</Badge>}</p><p className="text-xs text-slate-500">{l.tagline}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs mt-3 text-slate-600 dark:text-slate-300">
                  <span>Daily limit: <b>{fmtBDT(l.dailyLimit)}</b></span><span>Monthly: <b>{fmtBDT(l.monthlyLimit)}</b></span>
                  <span>Loan limit: <b>{fmtBDT(l.loanLimit)}</b></span><span>Fee discount: <b>{l.feeDiscountPct}%</b></span>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Requirement: {l.requirement}</p>
                {isNext && l.level === 2 && user.kyc === 'unverified' && (
                  <div className="mt-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 p-3.5">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{t('kyc_need_level2')}</p>
                    <Btn variant="outline" className="w-full mt-2.5" onClick={() => setModal('kyc')}>{t('kyc_do_now')}</Btn>
                  </div>
                )}
                {isNext && !(l.level === 2 && user.kyc === 'unverified') && <Btn className="w-full mt-3" disabled={pending} onClick={() => { const e = requestUpgrade(l.level); if (e) toast({ kind: 'error', title: e }); else { setModal(null); toast({ kind: 'success', title: 'Upgrade requested', body: 'An admin will review your request.' }) } }}>{pending ? 'Request pending…' : 'Request upgrade to Level ' + l.level}</Btn>}
              </div>
            )
          })}
        </div>
      </Modal>
      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title={t('p_edit')}>
        <ModalDesc>Update your name and phone number. Your email and User ID can't be changed.</ModalDesc>
        <div className="space-y-4">
          <Input label={t('full_name')} value={edit.name} onChange={e => setEdit(s => ({ ...s, name: e.target.value }))} />
          <Input label={t('phone')} value={edit.phone} onChange={e => setEdit(s => ({ ...s, phone: e.target.value }))} />
          <Input label="Email" value={user.email} disabled />
        </div>
        <ModalActions><Btn className="w-full py-3.5" onClick={() => { updateProfile(edit); setModal(null); toast({ kind: 'success', title: 'Profile updated' }) }}>{t('save_changes')}</Btn></ModalActions>
      </Modal>
      <Modal open={modal === 'pw'} onClose={() => setModal(null)} title={t('p_password')}>
        <ModalDesc>Choose a strong new password. You'll use it with your email to log in.</ModalDesc>
        <div className="space-y-4">
          <Input label="Current password" type="password" value={pw.old} onChange={e => setPw(s => ({ ...s, old: e.target.value }))} />
          <Input label="New password (min 6)" type="password" value={pw.next} onChange={e => setPw(s => ({ ...s, next: e.target.value }))} />
          <Btn className="w-full py-3.5" onClick={() => { if (pw.next.length < 6) return toast({ kind: 'error', title: 'New password too short' }); const e = changePassword(pw.old, pw.next); if (e) toast({ kind: 'error', title: e }); else { setModal(null); toast({ kind: 'success', title: 'Password changed' }) } }}>{t('p_password')}</Btn>
        </div>
      </Modal>
      <Modal open={modal === 'pin'} onClose={() => setModal(null)} title={t('p_pin')}>
        <ModalDesc>Your 4-digit PIN confirms sends and cash outs. PINs are stored hashed, never in plain text.</ModalDesc>
        <div className="space-y-4">
          <Input label="Current PIN" type="password" inputMode="numeric" maxLength={4} value={pin.old} onChange={e => setPin(s => ({ ...s, old: e.target.value }))} />
          <Input label="New PIN (4 digits)" type="password" inputMode="numeric" maxLength={4} value={pin.next} onChange={e => setPin(s => ({ ...s, next: e.target.value }))} />
          <Btn className="w-full py-3.5" onClick={() => { const e = changePin(pin.old, pin.next); if (e) toast({ kind: 'error', title: e }); else { setModal(null); toast({ kind: 'success', title: 'PIN changed' }) } }}>{t('p_pin')}</Btn>
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
        <ModalDesc>These are used as defaults for Add Money and Cash Out.</ModalDesc>
        <div className="space-y-2.5">
          {[['bKash', user.phone], ['Nagad', user.phone], ['Bank', 'BRAC Bank ····0001']].map(([k, v]) => (
            <ModalRow key={k}><span className="flex justify-between items-center"><span className="font-bold text-sm">{k}</span><span className="font-mono text-sm">{v}</span></span></ModalRow>
          ))}
        </div>
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
      <Modal open={modal === '2fa'} onClose={() => setModal(null)} title={t('p_2fa')}>
        <ModalDesc>When 2FA is on, sensitive actions (login on a new device, cash out, PIN change) need a second verification step in addition to your password.</ModalDesc>
        <ModalRow><label className="flex items-center justify-between font-semibold text-sm">{t('p_2fa')}
          <input type="checkbox" checked={user.twoFA} onChange={e => { updateProfile({ twoFA: e.target.checked }); toast({ kind: 'success', title: 'Two-factor ' + (e.target.checked ? 'enabled' : 'disabled') }) }} className="w-5 h-5 accent-violet-600" /></label></ModalRow>
        <ModalActions><Btn variant="ghost" className="w-full py-3.5" onClick={() => setModal(null)}>{t('done')}</Btn></ModalActions>
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
