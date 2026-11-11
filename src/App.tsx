import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { lazy, Suspense } from 'react'
const Market = lazy(() => import('./pages/Market'))
const Admin = lazy(() => import('./pages/Admin'))
import { AppProvider, useApp } from './lib/store'
import Layout from './components/Layout'
import { Toasts } from './components/ui'
import Auth from './pages/Auth'
import Home from './pages/Home'
import { AddMoney, CashOut, ReceiveMoney, SendMoney } from './pages/Services'
import { LoanPage, Referral } from './pages/ReferralLoan'
import { DirectWithdraw, EarnPage, SwapPage, TradePage } from './pages/Extras'
import { NewsDetail, NewsList, Notifications, Transactions } from './pages/TransactionsNews'
import Profile from './pages/Profile'

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
        <Routes>
          <Route path="/" element={<Root />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route element={<Guard><Layout /></Guard>}>
            <Route path="/home" element={<Home />} />
            <Route path="/add" element={<AddMoney />} />
            <Route path="/cashout" element={<CashOut />} />
            <Route path="/send" element={<SendMoney />} />
            <Route path="/receive" element={<ReceiveMoney />} />
            <Route path="/withdraw" element={<DirectWithdraw />} />
            <Route path="/earn" element={<EarnPage />} />
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
      </BrowserRouter>
    </AppProvider>
  )
}
