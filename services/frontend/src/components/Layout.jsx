import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { BarChart2, TrendingUp, Briefcase, ClipboardList, LogOut, Zap } from 'lucide-react'

export default function Layout({ user, onLogout }) {
  const navigate = useNavigate()
  const nav = [
    { to: '/',          icon: BarChart2,     label: 'Dashboard'  },
    { to: '/markets',   icon: TrendingUp,    label: 'Markets'    },
    { to: '/portfolio', icon: Briefcase,     label: 'Portfolio'  },
    { to: '/orders',    icon: ClipboardList, label: 'Orders'     },
  ]
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Zap className="text-blue-400" size={22} />
          <span className="text-lg font-bold text-white">TradeX</span>
          <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded-full ml-1">BETA</span>
        </div>
        <nav className="flex items-center gap-1">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <Icon size={15} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {user && <span className="text-sm text-slate-400">{user.full_name || user.email}</span>}
          <button onClick={() => { onLogout(); navigate('/login') }}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors">
            <LogOut size={15} /> Logout
          </button>
        </div>
      </header>
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full"><Outlet /></main>
    </div>
  )
}
