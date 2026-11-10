import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Bell, Home, Moon, Newspaper, ShieldCheck, Sun, User as UserIcon, Wallet, ArrowLeftRight } from 'lucide-react'
import { useApp } from '../lib/store'

const NAV = [
  { to: '/home', key: 'nav_home', icon: Home, end: true },
  { to: '/transactions', key: 'nav_transactions', icon: ArrowLeftRight },
  { to: '/news', key: 'nav_news', icon: Newspaper },
  { to: '/profile', key: 'nav_profile', icon: UserIcon },
]
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-violet-600/30" style={{ width: size, height: size }}>
        <Wallet size={size * 0.55} />
      </div>
      <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">Nova<span className="text-violet-500">Wallet</span></span>
    </div>
  )
}
export default function Layout() {
  const { user, db, theme, toggleTheme, t } = useApp()
  const navigate = useNavigate()
  const unread = db.notifications.filter(n => n.userId === user?.id && !n.read).length
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-white dark:bg-slate-900 border-r border-slate-200/70 dark:border-slate-800 p-5 z-40">
        <Logo />
        <nav className="mt-8 space-y-1.5 flex-1">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${isActive ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <n.icon size={19} /> {t(n.key)}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink to="/admin" className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10">
              <ShieldCheck size={19} /> {t('admin_panel')}
            </NavLink>
          )}
        </nav>
        <button onClick={toggleTheme} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold bg-slate-100 dark:bg-slate-800">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} {theme === 'dark' ? t('light_mode') : t('dark_mode')}
        </button>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="lg:hidden"><Logo size={30} /></div>
            <div className="hidden lg:block text-sm text-slate-500">{t('welcome_back')}, <span className="font-bold text-slate-800 dark:text-slate-100">{user?.name.split(' ')[0]}</span></div>
            <div className="flex items-center gap-2">
              <button onClick={toggleTheme} className="lg:hidden p-2.5 rounded-full bg-slate-100 dark:bg-slate-800">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
              <button onClick={() => navigate('/notifications')} className="relative p-2.5 rounded-full bg-slate-100 dark:bg-slate-800">
                <Bell size={18} />
                {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">{unread}</span>}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 pt-5 pb-28 lg:pb-10">
          {db.settings.maintenance && user?.role !== 'admin' && (
            <div className="mb-4 rounded-2xl bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 px-4 py-3 text-sm font-semibold">⚠️ {t('maintenance_on')}</div>
          )}
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/92 dark:bg-slate-900/92 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${isActive ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400'}`}>
              <n.icon size={22} /> {t(n.key)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
