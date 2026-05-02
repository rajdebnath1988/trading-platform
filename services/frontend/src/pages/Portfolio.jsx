import { useEffect, useState } from 'react'
import { portfolioAPI } from '../api'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { RefreshCw } from 'lucide-react'

const fmt = n => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n)
const COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#a855f7','#06b6d4','#f97316']

export default function Portfolio() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { portfolioAPI.get().then(r => setData(r.data)).finally(() => setLoading(false)) }, [])

  if (loading) return <div className="flex justify-center items-center h-64"><RefreshCw className="animate-spin text-blue-400" size={28} /></div>

  const pie = data?.holdings.map(h => ({ name: h.symbol, value: h.value })) || []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Portfolio</h1>
      <div className="grid grid-cols-3 gap-4">
        {[['Total Value', `₹${fmt(data.totalValue)}`, 'text-white'], ['Portfolio', `₹${fmt(data.portfolioValue)}`, 'text-blue-400'], ['Cash', `₹${fmt(data.cashBalance)}`, 'text-green-400']].map(([l, v, c]) => (
          <div key={l} className="card"><p className="text-slate-400 text-xs mb-1">{l}</p><p className={`text-lg font-bold ${c}`}>{v}</p></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {pie.length > 0 && (
          <div className="card">
            <h2 className="text-sm font-medium text-slate-400 mb-4">Allocation</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart><Pie data={pie} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
                {pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} formatter={v => [`₹${fmt(v)}`, 'Value']} /></PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="card">
          <h2 className="text-sm font-medium text-slate-400 mb-4">Holdings ({data.holdings.length})</h2>
          {data.holdings.length === 0 ? <p className="text-slate-500 text-sm">No holdings yet. Start trading in Markets!</p> : (
            <div className="space-y-2">
              {data.holdings.map((h, i) => (
                <div key={h.symbol} className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: COLORS[i % COLORS.length] }}>{h.symbol.slice(0, 2)}</div>
                    <div><p className="font-medium text-white text-sm">{h.symbol}</p><p className="text-xs text-slate-500">{h.quantity} @ ₹{fmt(h.avg_price)}</p></div>
                  </div>
                  <p className="text-sm text-white font-medium">₹{fmt(h.value)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
