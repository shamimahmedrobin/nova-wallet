import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../lib/store'
import { Btn, Card } from '../components/ui'
import { PageHead } from './Services'
import { fmtUSDT, fmtDateTime } from '../lib/utils'
import { ADS_PER_DAY, CHECKIN_REWARDS, EARN_TASKS, QUIZ, SCRATCH_PER_DAY, SPINS_PER_DAY, WHEEL_PRIZES } from '../lib/earn'

const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
const yesterdayStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }

const REWARD_TITLES = ['Daily check-in reward', 'Watched ad reward', 'Spin Wheel reward', 'Scratch card reward', 'Task reward:', 'Daily quiz reward']
const isRewardTx = (x: { category: string; title: string }) => x.category === 'earn' && REWARD_TITLES.some(t => x.title.startsWith(t))
const isToday = (iso: string) => { const d = new Date(iso); const n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate() }

export function EarnSummary() {
  const { db, user } = useApp()
  if (!user) return null
  const rate = db.settings.bdtPerUsd
  const earned = db.txs.filter(x => x.userId === user.id && isRewardTx(x) && isToday(x.createdAt)).reduce((a, x) => a + x.amount, 0)
  return (
    <Card className="p-4 mb-4 flex items-center gap-3 !bg-gradient-to-r from-violet-600/10 to-cyan-500/10 !border-violet-200/60 dark:!border-violet-500/20">
      <span className="text-2xl">💰</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Earned today from rewards</p>
        <p className="font-extrabold text-lg leading-tight">{fmtUSDT(earned / rate)}</p>
      </div>
      <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-600 shrink-0">PAID IN USDT</span>
    </Card>
  )
}

export function EarnHistory() {
  const { db, user } = useApp()
  if (!user) return null
  const rate = db.settings.bdtPerUsd
  const rows = db.txs.filter(x => x.userId === user.id && isRewardTx(x)).slice(0, 5)
  if (!rows.length) return null
  return (
    <>
      <h3 className="font-extrabold mt-6 mb-3">Recent rewards</h3>
      <div className="space-y-2">{rows.map(x => (
        <Card key={x.id} className="p-3.5 flex items-center gap-3">
          <div className="flex-1 min-w-0"><p className="font-bold text-sm truncate">{x.title}</p><p className="text-xs text-slate-400">{fmtDateTime(x.createdAt)}</p></div>
          <span className="font-extrabold text-emerald-600 shrink-0">+{fmtUSDT(x.amount / rate)}</span>
        </Card>
      ))}</div>
    </>
  )
}

function Pips({ total, used, color = 'bg-violet-500' }: { total: number; used: number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i < used ? color : 'bg-slate-200 dark:bg-slate-700'}`} />)}
    </div>
  )
}

function BackLink() {
  return <Link to="/earn" className="inline-flex items-center gap-1 text-sm font-bold text-violet-600 mb-3">← Back to Earn</Link>
}

/* ---------------- Daily Check-in ---------------- */
export function CheckinPage() {
  const { earnInfo, claimCheckin, toast, db } = useApp()
  const usd = (bdt: number) => fmtUSDT(bdt / db.settings.bdtPerUsd)
  const info = earnInfo()
  const claimed = info.lastCheckin === todayStr()
  const continuing = info.lastCheckin === yesterdayStr()
  const filled = claimed ? ((info.streak - 1) % 7) + 1 : continuing ? info.streak % 7 : 0
  const nextReward = CHECKIN_REWARDS[filled % 7]
  const claim = () => {
    const r = claimCheckin()
    if (r.err) return toast({ kind: 'error', title: r.err })
    toast({ kind: 'success', title: '+' + usd(r.amount ?? 0) + ' added to your balance', body: 'Day ' + r.streak + ' check-in streak. Come back tomorrow for the next reward.' })
  }
  return (
    <div>
      <BackLink />
      <PageHead title="Daily Check-in" sub="Check in every day to build your streak — longer streaks pay more." />
      <EarnSummary />
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div><p className="text-xs text-slate-400 font-bold uppercase">Current streak</p><p className="text-2xl font-extrabold">🔥 {info.streak} day{info.streak === 1 ? '' : 's'}</p></div>
          <div className="text-right"><p className="text-xs text-slate-400 font-bold uppercase">{claimed ? "Tomorrow's reward" : "Today's reward"}</p><p className="text-2xl font-extrabold text-emerald-500">{usd(nextReward)}</p></div>
        </div>
        <div className="grid grid-cols-7 gap-1.5 mb-5">
          {CHECKIN_REWARDS.map((r, i) => (
            <div key={i} className={`rounded-xl py-2.5 text-center border-2 ${i < filled ? 'bg-emerald-500 border-emerald-500 text-white' : i === filled && !claimed ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
              <p className="text-sm">{i < filled ? '✓' : '🎁'}</p>
              <p className="text-[10px] font-extrabold mt-0.5">{usd(r)}</p>
              <p className="text-[9px] opacity-70 font-bold">Day {i + 1}</p>
            </div>
          ))}
        </div>
        <Btn className="w-full py-3.5" disabled={claimed} onClick={claim}>{claimed ? '✓ Claimed today — see you tomorrow' : 'Claim ' + usd(nextReward)}</Btn>
        <p className="text-xs text-slate-400 text-center mt-3">Rewards go straight to your available balance. Missing a day restarts the streak.</p>
      </Card>
      <EarnHistory />
    </div>
  )
}

/* ---------------- View Ads ---------------- */
const DEMO_ADS = [
  { brand: 'Nova Store', text: 'Mega Sale — up to 50% off electronics this week only!', emoji: '🛍️', grad: 'from-rose-500 to-orange-500' },
  { brand: 'FlyTravel', text: 'Dhaka → Cox\'s Bazar return tickets from $41.31. Book now!', emoji: '✈️', grad: 'from-sky-500 to-cyan-400' },
  { brand: 'Crypto Academy', text: 'Learn trading in 7 days — free beginner course inside.', emoji: '🎓', grad: 'from-violet-600 to-indigo-500' },
]
export function AdsPage() {
  const { earnInfo, watchAdReward, toast, db } = useApp()
  const usd = (bdt: number) => fmtUSDT(bdt / db.settings.bdtPerUsd)
  const info = earnInfo()
  const left = ADS_PER_DAY - info.ads
  const [phase, setPhase] = useState<'idle' | 'watching' | 'done'>('idle')
  const [progress, setProgress] = useState(0)
  const [adIdx, setAdIdx] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])
  const ad = DEMO_ADS[adIdx % DEMO_ADS.length]
  const watch = () => {
    setPhase('watching'); setProgress(0)
    timer.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { if (timer.current) clearInterval(timer.current); setPhase('done'); return 100 }
        return p + 1
      })
    }, 100)
  }
  const claim = () => {
    const r = watchAdReward()
    if (r.err) return toast({ kind: 'error', title: r.err })
    toast({ kind: 'success', title: '+' + usd(r.amount ?? 0) + ' ad reward added', body: r.left + ' ads left today.' })
    setPhase('idle'); setProgress(0); setAdIdx(i => i + 1)
  }
  return (
    <div>
      <BackLink />
      <PageHead title="View Ads" sub={`Watch a short ad and earn ${usd(2)}–${usd(8)} each time. ${left} of ${ADS_PER_DAY} left today.`} />
      <EarnSummary />
      <Card className="p-5">
        <div className={`rounded-3xl bg-gradient-to-br ${ad.grad} text-white p-6 min-h-[180px] flex flex-col justify-between overflow-hidden relative`}>
          <div><p className="text-[11px] font-bold uppercase tracking-widest opacity-80">Ad · {ad.brand}</p><p className="text-4xl mt-3">{ad.emoji}</p></div>
          <p className="font-extrabold text-lg leading-snug">{ad.text}</p>
          {phase === 'watching' && <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/25"><div className="h-full bg-white transition-all" style={{ width: progress + '%' }} /></div>}
        </div>
        <div className="mt-4"><Pips total={ADS_PER_DAY} used={info.ads} /><p className="text-[11px] font-bold text-slate-400 mt-1.5">{info.ads} of {ADS_PER_DAY} ads watched today</p></div>
        {phase === 'watching' && <p className="text-center text-sm font-bold text-slate-500 mt-4">Watching ad… {Math.ceil((100 - progress) / 10)}s</p>}
        {phase === 'idle' && <Btn className="w-full py-3.5 mt-4" disabled={left <= 0} onClick={watch}>{left <= 0 ? 'No ads left today' : '▶ Watch ad (10s)'}</Btn>}
        {phase === 'done' && <Btn className="w-full py-3.5 mt-4" onClick={claim}>Claim reward</Btn>}
        <p className="text-xs text-slate-400 text-center mt-3">The reward is credited to your available balance as soon as you claim it.</p>
      </Card>
      <EarnHistory />
    </div>
  )
}

/* ---------------- Spin Wheel ---------------- */
const SEG_COLORS = ['#7c3aed', '#06b6d4', '#f59e0b', '#ec4899', '#10b981', '#64748b', '#8b5cf6', '#f43f5e']
export function SpinPage() {
  const { earnInfo, spinReward, toast, db } = useApp()
  const usd = (bdt: number) => fmtUSDT(bdt / db.settings.bdtPerUsd)
  const info = earnInfo()
  const left = SPINS_PER_DAY - info.spins
  const [rot, setRot] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [lastPrize, setLastPrize] = useState<number | null>(null)
  const gradient = 'conic-gradient(from 0deg, ' + WHEEL_PRIZES.map((_, i) => `${SEG_COLORS[i]} ${i * 45}deg ${(i + 1) * 45}deg`).join(', ') + ')'
  const spin = () => {
    const r = spinReward()
    if (r.err) return toast({ kind: 'error', title: r.err })
    const seg = 45
    const targetMod = (360 - ((r.index ?? 0) * seg + seg / 2) + 360) % 360
    const delta = (targetMod - (rot % 360) + 360) % 360
    setRot(rot + 360 * 5 + delta)
    setSpinning(true); setLastPrize(null)
    setTimeout(() => {
      setSpinning(false); setLastPrize(r.prize ?? 0)
      if ((r.prize ?? 0) > 0) toast({ kind: 'success', title: '🎉 You won ' + usd(r.prize ?? 0), body: 'Added to your balance. ' + (r.left ?? 0) + ' spins left today.' })
      else toast({ kind: 'info', title: 'No prize this time', body: (r.left ?? 0) + ' spins left today — try again!' })
    }, 4300)
  }
  return (
    <div>
      <BackLink />
      <PageHead title="Spin Wheel" sub={`Spin the wheel and win up to ${usd(50)}. ${left} of ${SPINS_PER_DAY} free spins left today.`} />
      <EarnSummary />
      <Card className="p-5 flex flex-col items-center">
        <div className="relative w-64 h-64 sm:w-72 sm:h-72">
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10 text-2xl">▼</div>
          <div className="w-full h-full rounded-full border-8 border-white dark:border-slate-700 shadow-xl relative overflow-hidden" style={{ background: gradient, transform: `rotate(${rot}deg)`, transition: spinning ? 'transform 4.2s cubic-bezier(0.12, 0.8, 0.08, 1)' : 'none' }}>
            {WHEEL_PRIZES.map((p, i) => (
              <div key={i} className="absolute inset-0 flex justify-center" style={{ transform: `rotate(${i * 45 + 22.5}deg)` }}>
                <span className="mt-4 text-white font-extrabold text-sm drop-shadow">{p === 0 ? '✕' : (p / db.settings.bdtPerUsd).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white dark:bg-slate-800 shadow flex items-center justify-center text-xl">🎡</div>
        </div>
        {lastPrize !== null && <p className="font-extrabold mt-4">{lastPrize > 0 ? '🎉 You won ' + usd(lastPrize) : 'No prize — better luck next spin!'}</p>}
        <div className="w-full mt-4"><Pips total={SPINS_PER_DAY} used={info.spins} /><p className="text-[11px] font-bold text-slate-400 mt-1.5 text-center">Wheel prizes: {[...new Set(WHEEL_PRIZES)].sort((a, b) => a - b).map(x => (x / db.settings.bdtPerUsd).toFixed(2)).join(' · ')} USDT</p></div>
        <Btn className="w-full py-3.5 mt-4" disabled={spinning || left <= 0} onClick={spin}>{spinning ? 'Spinning…' : left <= 0 ? 'No spins left today' : 'Spin now (free)'}</Btn>
      </Card>
      <EarnHistory />
    </div>
  )
}

/* ---------------- Scratch Card ---------------- */
export function ScratchPage() {
  const { earnInfo, scratchDraw, toast, db } = useApp()
  const usd = (bdt: number) => fmtUSDT(bdt / db.settings.bdtPerUsd)
  const info = earnInfo()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [prize, setPrize] = useState<number | null>(null)
  const [left, setLeft] = useState(SCRATCH_PER_DAY - info.scratches)
  const [revealed, setRevealed] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  const drawing = useRef(false)
  const drawnOnce = useRef(false)

  const paintCover = () => {
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    const g = ctx.createLinearGradient(0, 0, c.width, c.height)
    g.addColorStop(0, '#8b5cf6'); g.addColorStop(1, '#06b6d4')
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = 'bold 34px system-ui'; ctx.textAlign = 'center'
    ctx.fillText('SCRATCH HERE', c.width / 2, c.height / 2 - 6)
    ctx.font = 'bold 20px system-ui'; ctx.fillText('🎫 Good luck!', c.width / 2, c.height / 2 + 30)
  }
  const draw = () => {
    const r = scratchDraw()
    if (r.err) { setExhausted(true); return }
    setPrize(r.prize ?? 0); setLeft(r.left ?? 0); setRevealed(false)
    requestAnimationFrame(paintCover)
  }
  useEffect(() => { if (!drawnOnce.current) { drawnOnce.current = true; draw() } }, [])
  const scratchAt = (e: React.PointerEvent) => {
    if (revealed || prize === null) return
    const c = canvasRef.current; if (!c) return
    const rect = c.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (c.width / rect.width)
    const y = (e.clientY - rect.top) * (c.height / rect.height)
    const ctx = c.getContext('2d'); if (!ctx) return
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill()
    drawing.current = true
  }
  const checkReveal = () => {
    if (!drawing.current || revealed) return
    drawing.current = false
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    const data = ctx.getImageData(0, 0, c.width, c.height).data
    let clear = 0, total = 0
    for (let i = 3; i < data.length; i += 64) { total++; if (data[i] === 0) clear++ }
    if (total && clear / total > 0.35) {
      setRevealed(true)
      ctx.clearRect(0, 0, c.width, c.height)
      if (prize !== null && prize > 0) toast({ kind: 'success', title: '🎉 You won ' + usd(prize), body: 'The reward was added to your balance when the card was drawn.' })
    }
  }
  return (
    <div>
      <BackLink />
      <PageHead title="Scratch Card" sub={`Scratch to reveal a prize up to ${usd(50)}. ${left} card${left === 1 ? '' : 's'} left today.`} />
      <EarnSummary />
      <Card className="p-5">
        <div className="mb-4"><Pips total={SCRATCH_PER_DAY} used={info.scratches} color="bg-amber-500" /><p className="text-[11px] font-bold text-slate-400 mt-1.5">{info.scratches} of {SCRATCH_PER_DAY} cards used today</p></div>
        {exhausted || (prize === null && left <= 0) ? (
          <p className="text-center font-bold text-slate-500 py-10">No scratch cards left today — come back tomorrow. 🎫</p>
        ) : (
          <>
            <div className="relative rounded-3xl overflow-hidden select-none touch-none" style={{ height: 200 }}>
              <div className="absolute inset-0 bg-gradient-to-br from-amber-100 to-rose-100 dark:from-slate-800 dark:to-slate-700 flex flex-col items-center justify-center">
                {prize !== null && prize > 0 ? (<><p className="text-5xl">🎉</p><p className="text-4xl font-extrabold text-emerald-600 mt-1">{usd(prize)}</p><p className="text-xs font-bold text-slate-500">added to your balance</p></>) : (<><p className="text-5xl">🍀</p><p className="text-xl font-extrabold text-slate-500 mt-1">No luck this time</p></>)}
              </div>
              <canvas ref={canvasRef} width={680} height={400} className="absolute inset-0 w-full h-full cursor-pointer" style={{ opacity: revealed ? 0 : 1, transition: 'opacity .4s' }} onPointerDown={scratchAt} onPointerMove={e => { if (e.buttons & 1) scratchAt(e) }} onPointerUp={checkReveal} onPointerLeave={checkReveal} />
            </div>
            <p className="text-xs text-slate-400 text-center mt-3">Scratch the cover with your finger or mouse to reveal the prize. The prize is credited to your balance as soon as the card is drawn.</p>
            {revealed && left > 0 && <Btn className="w-full py-3.5 mt-3" onClick={draw}>Next card ({left} left)</Btn>}
            {revealed && left <= 0 && <p className="text-center font-bold text-slate-500 mt-3">That was today's last card.</p>}
          </>
        )}
      </Card>
      <EarnHistory />
    </div>
  )
}

/* ---------------- Complete Tasks ---------------- */
export function TasksPage() {
  const { earnInfo, completeEarnTask, toast, db } = useApp()
  const usd = (bdt: number) => fmtUSDT(bdt / db.settings.bdtPerUsd)
  const info = earnInfo()
  const [phase, setPhase] = useState<Record<string, number>>({})
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({})
  useEffect(() => () => { Object.values(timers.current).forEach(clearInterval) }, [])
  const start = (id: string) => {
    setPhase(p => ({ ...p, [id]: 5 }))
    timers.current[id] = setInterval(() => {
      setPhase(p => {
        const v = (p[id] ?? 0) - 1
        if (v <= 0) { clearInterval(timers.current[id]); return { ...p, [id]: 0 } }
        return { ...p, [id]: v }
      })
    }, 1000)
  }
  const claim = (id: string) => {
    const r = completeEarnTask(id)
    if (r.err) return toast({ kind: 'error', title: r.err })
    toast({ kind: 'success', title: '+' + usd(r.amount ?? 0) + ' task reward added' })
  }
  return (
    <div>
      <BackLink />
      <PageHead title="Complete Tasks" sub="Finish simple tasks and earn USDT for each one. Tasks can be completed once." />
      <EarnSummary />
      <Card className="p-4 mb-4">
        <div className="flex justify-between text-xs font-bold text-slate-400 mb-2"><span>{info.tasksDone.length} of {EARN_TASKS.length} tasks completed</span><span>Total value {usd(EARN_TASKS.reduce((a, x) => a + x.reward, 0))}</span></div>
        <Pips total={EARN_TASKS.length} used={info.tasksDone.length} color="bg-emerald-500" />
      </Card>
      <div className="space-y-2.5">
        {EARN_TASKS.map(task => {
          const done = info.tasksDone.includes(task.id)
          const counting = phase[task.id] !== undefined && phase[task.id] > 0
          const ready = phase[task.id] === 0
          return (
            <Card key={task.id} className="p-4 flex items-center gap-3">
              <span className="text-2xl w-11 h-11 rounded-2xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0">{task.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{task.title}</p>
                <p className="text-xs text-slate-400">{task.desc}</p>
                <p className="text-xs font-extrabold text-emerald-600 mt-0.5">Reward {usd(task.reward)}</p>
              </div>
              {done ? <span className="font-extrabold text-emerald-600 text-sm shrink-0">✓ Done</span>
                : counting ? <Btn className="!py-2 !text-xs shrink-0" disabled>Verifying… {phase[task.id]}s</Btn>
                : ready ? <Btn className="!py-2 !text-xs shrink-0" onClick={() => claim(task.id)}>Claim {usd(task.reward)}</Btn>
                : <Btn className="!py-2 !text-xs shrink-0" onClick={() => start(task.id)}>Start</Btn>}
            </Card>
          )
        })}
      </div>
      <EarnHistory />
    </div>
  )
}

/* ---------------- Daily Quiz ---------------- */
export function QuizPage() {
  const { earnInfo, submitQuiz, toast, db } = useApp()
  const usd = (bdt: number) => fmtUSDT(bdt / db.settings.bdtPerUsd)
  const info = earnInfo()
  const playedToday = info.quizDay === todayStr()
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [finished, setFinished] = useState(false)
  const [earned, setEarned] = useState(0)
  const scoreRef = useRef(0)
  const submitted = useRef(false)
  const pick = (opt: number) => {
    if (picked !== null) return
    setPicked(opt)
    if (opt === QUIZ[i].answer) scoreRef.current += 1
    setTimeout(() => {
      setPicked(null)
      if (i + 1 < QUIZ.length) setI(i + 1)
      else {
        setFinished(true)
        if (!submitted.current) {
          submitted.current = true
          const r = submitQuiz(scoreRef.current)
          if (r.err) toast({ kind: 'error', title: r.err })
          else { setEarned(r.amount ?? 0); if ((r.amount ?? 0) > 0) toast({ kind: 'success', title: '+' + usd(r.amount ?? 0) + ' quiz reward added' }) }
        }
      }
    }, 950)
  }
  if (playedToday && !finished) return (
    <div>
      <BackLink />
      <PageHead title="Daily Quiz" sub={`Answer 5 questions — earn ${usd(4)} for every correct answer.`} />
      <EarnSummary />
      <Card className="p-8 text-center"><p className="text-4xl">🧠</p><p className="font-extrabold mt-2">You've played today's quiz</p><p className="text-sm text-slate-400 mt-1">A new quiz arrives tomorrow. Check the other Earn options meanwhile!</p></Card>
      <EarnHistory />
    </div>
  )
  if (finished) return (
    <div>
      <BackLink />
      <PageHead title="Daily Quiz" sub={`Answer 5 questions — earn ${usd(4)} for every correct answer.`} />
      <EarnSummary />
      <Card className="p-8 text-center">
        <p className="text-5xl">{scoreRef.current >= 4 ? '🏆' : scoreRef.current >= 2 ? '🎉' : '💪'}</p>
        <p className="font-extrabold text-xl mt-2">You scored {scoreRef.current} / {QUIZ.length}</p>
        <p className="text-sm text-slate-400 mt-1">{earned > 0 ? usd(earned) + ' was added to your balance.' : 'No reward this time — try again tomorrow.'}</p>
      </Card>
      <EarnHistory />
    </div>
  )
  const q = QUIZ[i]
  return (
    <div>
      <BackLink />
      <PageHead title="Daily Quiz" sub={`Answer 5 questions — earn ${usd(4)} for every correct answer.`} />
      <EarnSummary />
      <Card className="p-5">
        <div className="flex justify-between text-xs font-bold text-slate-400 mb-2"><span>Question {i + 1} of {QUIZ.length}</span><span>Score: {scoreRef.current}</span></div>
        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-4"><div className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all" style={{ width: ((i) / QUIZ.length) * 100 + '%' }} /></div>
        <p className="font-extrabold text-lg mb-4">{q.q}</p>
        <div className="space-y-2">
          {q.options.map((opt, oi) => {
            const isAnswer = oi === q.answer
            const isPicked = picked === oi
            const cls = picked === null ? 'border-slate-200 dark:border-slate-700 hover:border-violet-400' : isAnswer ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : isPicked ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/10' : 'border-slate-200 dark:border-slate-700 opacity-60'
            return <button key={oi} onClick={() => pick(oi)} className={`w-full text-left rounded-2xl border-2 px-4 py-3 font-bold text-sm transition ${cls}`}>{opt}{picked !== null && isAnswer ? ' ✓' : ''}{picked !== null && isPicked && !isAnswer ? ' ✕' : ''}</button>
          })}
        </div>
      </Card>
      <EarnHistory />
    </div>
  )
}
