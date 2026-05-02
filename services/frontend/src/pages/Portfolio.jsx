import { useEffect, useState } from 'react'
import { portfolioAPI } from '../api'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { RefreshCw } from 'lucide-react'

const fmt = (n) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n)
const COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#a855f7','#06b6d4','#f97316','#ec4899']

export default function Portfolio() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    portfolioAPI.get()
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center h-64 items-center"><RefreshCw className="animate-spin text-blue-400" size={28} /></div>
  if (!data)   return <div className="text-red-400 p-4">Failed to load portfolio</div>

  const pieData = data.holdings.map(h => ({ name: h.symbol, value: h.value }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Portfolio</h1>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Value',     value: `₹${fmt(data.totalValue)}`,     color: 'text-white' },
          { label: 'Portfolio Value', value: `₹${fmt(data.portfolioValue)}`,  color: 'text-blue-400' },
          { label: 'Cash Balance',    value: `₹${fmt(data.cashBalance)}`,     color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="card">
            <p className="text-slate-400 text-xs mb-1">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart */}
        {pieData.length > 0 && (
          <div className="card">
            <h2 className="text-sm font-medium text-slate-400 mb-4">Allocation</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  formatter={(v) => [`₹${fmt(v)}`, 'Value']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Holdings table */}
        <div className="card">
          <h2 className="text-sm font-medium text-slate-400 mb-4">Holdings ({data.holdings.length})</h2>
          {data.holdings.length === 0 ? (
            <p className="text-slate-500 text-sm">No holdings yet. Start trading in Markets!</p>
          ) : (
            <div className="space-y-2">
              {data.holdings.map((h, i) => (
                <div key={h.symbol} className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: COLORS[i % COLORS.length] }}>
                      {h.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium text-white text-sm">{h.symbol}</p>
                      <p className="text-xs text-slate-500">{h.quantity} shares @ ₹{fmt(h.avg_price)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white font-medium">₹{fmt(h.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
