import { useEffect, useState } from 'react'
import { marketAPI, portfolioAPI } from '../api'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { DollarSign, Activity, TrendingUp, RefreshCw } from 'lucide-react'

const fmt = n => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n)

export default function Dashboard({ user }) {
  const [stocks, setStocks]   = useState([])
  const [portfolio, setP]     = useState(null)
  const [chart, setChart]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [s, p] = await Promise.all([marketAPI.stocks(), portfolioAPI.get()])
        setStocks(s.data.slice(0, 6)); setP(p.data)
        const c = await marketAPI.chart('AAPL', '1M')
        setChart(c.data.map(d => ({ date: d.date.slice(5), value: parseFloat((p.data.totalValue * (d.close / 178)).toFixed(2)) })))
      } finally { setLoading(false) }
    }
    load()
    const t = setInterval(() => marketAPI.stocks().then(r => setStocks(r.data.slice(0, 6))).catch(() => {}), 5000)
    return () => clearInterval(t)
  }, [])

  if (loading) return <div className="flex justify-center items-center h-64"><RefreshCw className="animate-spin text-blue-400" size={28} /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.full_name?.split(' ')[0] || 'Trader'} 👋</h1>
        <p className="text-slate-400 text-sm mt-1">Here's your portfolio overview</p>
      </div>
      {portfolio && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Value',    value: `₹${fmt(portfolio.totalValue)}`,    icon: DollarSign, color: 'text-blue-400'   },
            { label: 'Cash Balance',   value: `₹${fmt(portfolio.cashBalance)}`,   icon: Activity,   color: 'text-green-400'  },
            { label: 'Portfolio',      value: `₹${fmt(portfolio.portfolioValue)}`,icon: TrendingUp, color: 'text-purple-400' },
            { label: 'Holdings',       value: portfolio.holdings?.length || 0,    icon: TrendingUp, color: 'text-amber-400'  },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400 text-xs">{label}</span>
                <Icon size={16} className={color} />
              </div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}
      <div className="card">
        <h2 className="text-sm font-medium text-slate-400 mb-4">Portfolio value — 30 days</h2>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chart}>
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#94a3b8' }} formatter={v => [`₹${fmt(v)}`, 'Value']} />
            <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#g)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="card">
        <h2 className="text-sm font-medium text-slate-400 mb-4">Top movers</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-slate-500 border-b border-slate-800">
            <th className="pb-3 text-left">Symbol</th>
            <th className="pb-3 text-right">Price</th>
            <th className="pb-3 text-right">Change</th>
            <th className="pb-3 text-right hidden md:table-cell">Volume</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-800/50">
            {stocks.map(s => (
              <tr key={s.symbol} className="hover:bg-slate-800/30">
                <td className="py-3"><div className="font-medium text-white">{s.symbol}</div><div className="text-xs text-slate-500">{s.name}</div></td>
                <td className="py-3 text-right text-white">{s.currency === 'INR' ? '₹' : '$'}{fmt(s.price)}</td>
                <td className="py-3 text-right"><span className={s.change >= 0 ? 'badge-gain' : 'badge-loss'}>{s.change >= 0 ? '+' : ''}{s.change}%</span></td>
                <td className="py-3 text-right text-slate-400 hidden md:table-cell">{(s.volume / 1e6).toFixed(1)}M</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
