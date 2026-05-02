import { useEffect, useState, useCallback } from 'react'
import { marketAPI, portfolioAPI } from '../api'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'

const fmt = n => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n)

export default function Markets() {
  const [stocks, setStocks]   = useState([])
  const [sel, setSel]         = useState(null)
  const [chart, setChart]     = useState([])
  const [period, setPeriod]   = useState('1M')
  const [trade, setTrade]     = useState({ type: 'BUY', quantity: '', price: '' })
  const [msg, setMsg]         = useState(null)
  const [loading, setLoading] = useState(true)

  const pick = useCallback(async stock => {
    setSel(stock); setTrade(f => ({ ...f, price: stock.price.toFixed(2) }))
    try { const { data } = await marketAPI.chart(stock.symbol, period); setChart(data) } catch {}
  }, [period])

  useEffect(() => {
    marketAPI.stocks().then(r => { setStocks(r.data); if (!sel) pick(r.data[0]) }).finally(() => setLoading(false))
    const t = setInterval(() => marketAPI.stocks().then(r => setStocks(r.data)).catch(() => {}), 4000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { if (sel) marketAPI.chart(sel.symbol, period).then(r => setChart(r.data)).catch(() => {}) }, [period, sel?.symbol])

  const submitTrade = async e => {
    e.preventDefault(); setMsg(null)
    try {
      await portfolioAPI.trade({ symbol: sel.symbol, type: trade.type, quantity: parseFloat(trade.quantity), price: parseFloat(trade.price) })
      setMsg({ ok: true, text: `${trade.type} order placed for ${trade.quantity} ${sel.symbol}!` })
      setTrade(f => ({ ...f, quantity: '' }))
    } catch (err) { setMsg({ ok: false, text: err.response?.data?.error || 'Trade failed' }) }
  }

  if (loading) return <div className="flex justify-center items-center h-64"><RefreshCw className="animate-spin text-blue-400" size={28} /></div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Markets</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card overflow-auto max-h-[640px]">
          <h2 className="text-sm font-medium text-slate-400 mb-3">All Stocks</h2>
          <div className="space-y-1">
            {stocks.map(s => (
              <button key={s.symbol} onClick={() => pick(s)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${sel?.symbol === s.symbol ? 'bg-blue-900/30 border border-blue-800' : 'hover:bg-slate-800'}`}>
                <div className="flex items-center justify-between">
                  <div><span className="font-medium text-white text-sm">{s.symbol}</span><p className="text-xs text-slate-500 truncate">{s.name}</p></div>
                  <div className="text-right">
                    <p className="text-sm text-white">{s.currency === 'INR' ? '₹' : '$'}{fmt(s.price)}</p>
                    <span className={s.change >= 0 ? 'badge-gain' : 'badge-loss'}>{s.change >= 0 ? '+' : ''}{s.change}%</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2 space-y-4">
          {sel && <>
            <div className="card">
              <div className="flex items-start justify-between mb-4">
                <div><h2 className="text-xl font-bold text-white">{sel.symbol}</h2><p className="text-slate-400 text-sm">{sel.name}</p></div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">{sel.currency === 'INR' ? '₹' : '$'}{fmt(sel.price)}</p>
                  <span className={`flex items-center gap-1 justify-end text-sm ${sel.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {sel.change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {sel.change >= 0 ? '+' : ''}{sel.change}%
                  </span>
                </div>
              </div>
              <div className="flex gap-2 mb-4">
                {['1W','1M','3M','6M','1Y'].map(p => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={`px-3 py-1 rounded text-xs transition-colors ${period === p ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>{p}</button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chart}>
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.floor(chart.length / 5)} />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#94a3b8', fontSize: 12 }}
                    formatter={v => [`${sel?.currency === 'INR' ? '₹' : '$'}${fmt(v)}`, 'Close']} />
                  <Line type="monotone" dataKey="close" stroke="#3b82f6" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h2 className="text-sm font-medium text-slate-400 mb-4">Place Order</h2>
              <form onSubmit={submitTrade} className="space-y-4">
                <div className="flex gap-2">
                  {['BUY','SELL'].map(t => (
                    <button key={t} type="button" onClick={() => setTrade(f => ({ ...f, type: t }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${trade.type === t ? (t === 'BUY' ? 'bg-green-600 text-white' : 'bg-red-600 text-white') : 'bg-slate-800 text-slate-400'}`}>{t}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs text-slate-400 mb-1">Quantity</label>
                    <input className="input" type="number" min="0.01" step="0.01" placeholder="e.g. 10" value={trade.quantity} onChange={e => setTrade(f => ({ ...f, quantity: e.target.value }))} required /></div>
                  <div><label className="block text-xs text-slate-400 mb-1">Price</label>
                    <input className="input" type="number" min="0.01" step="0.01" value={trade.price} onChange={e => setTrade(f => ({ ...f, price: e.target.value }))} required /></div>
                </div>
                {trade.quantity && trade.price && (
                  <div className="bg-slate-800/50 rounded-lg p-3 text-sm">
                    <span className="text-slate-400">Total: </span>
                    <span className="text-white font-medium">{sel?.currency === 'INR' ? '₹' : '$'}{fmt(parseFloat(trade.quantity || 0) * parseFloat(trade.price || 0))}</span>
                  </div>
                )}
                {msg && <div className={`text-sm p-3 rounded-lg ${msg.ok ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-red-900/30 text-red-400 border border-red-800'}`}>{msg.text}</div>}
                <button type="submit" className={`w-full py-2.5 rounded-lg font-medium text-white transition-colors ${trade.type === 'BUY' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                  {trade.type} {sel.symbol}
                </button>
              </form>
            </div>
          </>}
        </div>
      </div>
    </div>
  )
}
