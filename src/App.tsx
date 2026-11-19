import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { lazy, Suspense } from 'react'
const Market = lazy(() => import('./pages/Market'))
const Admin = lazy(() => import('./pages/Admin'))
import { AppProvider, useApp } from './lib/store'
import Layout from './components/Layout'
import { Toasts } from './components/ui'
import Auth from './pages/Auth'
import LockScreen from './pages/LockScreen'
// Page-level code splitting: each page module loads on first visit, so the
// first paint only carries the landing/auth shell (Admin and Market were
// already split). Named exports are adapted to lazy() default components.
const lazyNamed = <T extends Record<string, any>>(load: () => Promise<T>, name: keyof T) =>
  lazy(() => load().then(m => ({ default: m[name] })))
const Home = lazyNamed(() => import('./pages/Home'), 'default')
const AddMoney = lazyNamed(() => import('./pages/Services'), 'AddMoney')
const CashOut = lazyNamed(() => import('./pages/Services'), 'CashOut')
const ReceiveMoney = lazyNamed(() => import('./pages/Services'), 'ReceiveMoney')
const SendMoney = lazyNamed(() => import('./pages/Services'), 'SendMoney')
const LoanPage = lazyNamed(() => import('./pages/ReferralLoan'), 'LoanPage')
const Referral = lazyNamed(() => import('./pages/ReferralLoan'), 'Referral')
const DirectWithdraw = lazyNamed(() => import('./pages/Extras'), 'DirectWithdraw')
const EarnPage = lazyNamed(() => import('./pages/Extras'), 'EarnPage')
const SwapPage = lazyNamed(() => import('./pages/Extras'), 'SwapPage')
const TradePage = lazyNamed(() => import('./pages/Extras'), 'TradePage')
const AdsPage = lazyNamed(() => import('./pages/EarnPages'), 'AdsPage')
const CheckinPage = lazyNamed(() => import('./pages/EarnPages'), 'CheckinPage')
const QuizPage = lazyNamed(() => import('./pages/EarnPages'), 'QuizPage')
const ScratchPage = lazyNamed(() => import('./pages/EarnPages'), 'ScratchPage')
const SpinPage = lazyNamed(() => import('./pages/EarnPages'), 'SpinPage')
const TasksPage = lazyNamed(() => import('./pages/EarnPages'), 'TasksPage')
const NewsDetail = lazyNamed(() => import('./pages/TransactionsNews'), 'NewsDetail')
const NewsList = lazyNamed(() => import('./pages/TransactionsNews'), 'NewsList')
const Notifications = lazyNamed(() => import('./pages/TransactionsNews'), 'Notifications')
const Transactions = lazyNamed(() => import('./pages/TransactionsNews'), 'Transactions')
const Profile = lazyNamed(() => import('./pages/Profile'), 'default')
import { PrivacyPage, TermsPage } from './pages/Legal'

/** When the device is locked, cover the whole app with the unlock screen. After a
    successful UNLOCK the app always opens on Home — never back on the page that
    happened to be open when it locked (e.g. Profile after tapping Log out). */
function LockGate() {
  const { locked, user } = useApp()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const wasLocked = useRef(false)
  useEffect(() => {
    if (locked) { wasLocked.current = true; return }
    if (wasLocked.current && user) {
      wasLocked.current = false
      // Public pages (Terms / Privacy) stay where they are after an unlock —
      // only app pages reset to Home.
      if (pathname !== '/terms' && pathname !== '/privacy') {
        navigate(user.role === 'admin' ? '/admin' : '/home', { replace: true })
      }
    }
  }, [locked, user, navigate, pathname])
  return locked && user ? <LockScreen /> : null
}

/** OS-level notifications: ask permission once the user is signed in, and mirror
    NEW in-app notifications to the system tray while the app sits in the
    background. Clicking one focuses the app and opens the exact section. */
const SYS_ROUTES: Record<string, string> = {
  loan: '/loan', support: '/profile', transaction: '/transactions', deposit: '/transactions',
  withdraw: '/transactions', receive: '/transactions', referral: '/referral', security: '/profile',
  kyc: '/profile', upgrade: '/profile', earn: '/earn', trade: '/transactions', info: '/home',
}
function SystemNotifier() {
  const { user, db } = useApp()
  const navigate = useNavigate()
  const known = useRef<Set<string> | null>(null)
  const lastUser = useRef<string | null>(null)
  // 1) Permission — requested when the app is opened with a signed-in account.
  useEffect(() => {
    if (!user) return
    try {
      if (!('Notification' in window) || Notification.permission !== 'default') return
      if (sessionStorage.getItem('nova.notifAsked')) return
      sessionStorage.setItem('nova.notifAsked', '1')
      Notification.requestPermission().catch(() => {})
    } catch { /* unsupported — in-app notifications still work */ }
  }, [user])
  // 2) Mirror new notifications to the OS while the tab is in the background.
  useEffect(() => {
    if (!user) { known.current = null; lastUser.current = null; return }
    if (lastUser.current !== user.id) { lastUser.current = user.id; known.current = null }
    const mine = db.notifications.filter(n => n.userId === user.id)
    if (known.current === null) { known.current = new Set(mine.map(n => n.id)); return }
    const fresh = mine.filter(n => !known.current!.has(n.id) && !n.read)
    fresh.forEach(n => known.current!.add(n.id))
    if (!fresh.length) return
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return
    } catch { return }
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    fresh.slice(0, 3).forEach(n => {
      const rel = n.link ?? SYS_ROUTES[n.kind] ?? '/home'
      const url = window.location.origin + base + rel
      const opts: NotificationOptions = { body: n.body, tag: n.id, icon: base + '/icons/icon-192.png', data: { url } }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => reg.showNotification(n.title, opts)).catch(() => { try { new Notification(n.title, opts) } catch { /* ignore */ } })
      } else {
        try { const sn = new Notification(n.title, opts); sn.onclick = () => { window.focus(); navigate(rel) } } catch { /* ignore */ }
      }
    })
  }, [user, db.notifications, navigate])
  return null
}

/** New navigation (PUSH) opens at the top; browser Back/Forward (POP) restores the previous scroll spot. */
function ScrollManager() {
  const { key } = useLocation()
  const navType = useNavigationType()
  const positions = useRef<Record<string, number>>({})
  useEffect(() => { if ('scrollRestoration' in history) history.scrollRestoration = 'manual' }, [])
  useEffect(() => {
    const save = () => { positions.current[key] = window.scrollY }
    window.addEventListener('scroll', save, { passive: true })
    return () => window.removeEventListener('scroll', save)
  }, [key])
  useEffect(() => {
    if (navType === 'POP') {
      const y = positions.current[key] ?? 0
      requestAnimationFrame(() => setTimeout(() => window.scrollTo(0, y), 30))
    } else {
      window.scrollTo(0, 0)
    }
  }, [key, navType])
  return null
}
function Guard({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { user } = useApp(); const loc = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (admin && user.role !== 'admin') return <Navigate to="/home" replace />
  return <>{children}</>
}
function Root() {
  const { user } = useApp()
  if (user) return <Navigate to="/home" replace />
  return <Auth initialMode="landing" />
}
function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user } = useApp()
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/home'} replace />
  return <Auth key={mode} initialMode={mode} />
}
export default function App() {
  return (
    <AppProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <ScrollManager />
        <Toasts />
        <LockGate />
        <SystemNotifier />
        <Suspense fallback={<div className="p-10 text-center text-sm font-semibold text-slate-400">Loading…</div>}>
        <Routes>
          <Route path="/" element={<Root />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route element={<Guard><Layout /></Guard>}>
            <Route path="/home" element={<Home />} />
            <Route path="/add" element={<AddMoney />} />
            <Route path="/cashout" element={<CashOut />} />
            <Route path="/send" element={<SendMoney />} />
            <Route path="/receive" element={<ReceiveMoney />} />
            <Route path="/withdraw" element={<DirectWithdraw />} />
            <Route path="/earn" element={<EarnPage />} />
            <Route path="/earn/checkin" element={<CheckinPage />} />
            <Route path="/earn/ads" element={<AdsPage />} />
            <Route path="/earn/spin" element={<SpinPage />} />
            <Route path="/earn/scratch" element={<ScratchPage />} />
            <Route path="/earn/tasks" element={<TasksPage />} />
            <Route path="/earn/quiz" element={<QuizPage />} />
            <Route path="/swap" element={<SwapPage />} />
            <Route path="/trade" element={<TradePage />} />
            <Route path="/referral" element={<Referral />} />
            <Route path="/loan" element={<LoanPage />} />
            <Route path="/crypto" element={<Suspense fallback={<div className="p-8 text-center">Loading market…</div>}><Market /></Suspense>} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/news" element={<NewsList />} />
            <Route path="/news/:id" element={<NewsDetail />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="/admin" element={<Guard admin><Suspense fallback={<div className="p-8 text-center">Loading admin…</div>}><Admin /></Suspense></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AppProvider>
  )
}
