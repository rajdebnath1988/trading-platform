import { useEffect, useState } from 'react'
import { orderAPI } from '../api'
import { RefreshCw } from 'lucide-react'

const fmt = n => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n)

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { orderAPI.list({ limit: 100 }).then(r => setOrders(r.data.orders)).finally(() => setLoading(false)) }, [])

  if (loading) return <div className="flex justify-center items-center h-64"><RefreshCw className="animate-spin text-blue-400" size={28} /></div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Order History</h1>
      <div className="card">
        {orders.length === 0 ? <p className="text-slate-500 text-sm">No orders yet. Place your first trade in Markets!</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-slate-500 border-b border-slate-800">
                <th className="pb-3 text-left">Symbol</th>
                <th className="pb-3 text-left">Type</th>
                <th className="pb-3 text-right">Qty</th>
                <th className="pb-3 text-right">Price</th>
                <th className="pb-3 text-right">Total</th>
                <th className="pb-3 text-right hidden md:table-cell">Date</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-800/50">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 font-medium text-white">{o.symbol}</td>
                    <td className="py-2.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${o.type === 'BUY' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>{o.type}</span>
                    </td>
                    <td className="py-2.5 text-right text-slate-300">{parseFloat(o.quantity)}</td>
                    <td className="py-2.5 text-right text-slate-300">₹{fmt(o.price)}</td>
                    <td className="py-2.5 text-right text-white font-medium">₹{fmt(o.total || (o.quantity * o.price))}</td>
                    <td className="py-2.5 text-right text-slate-500 text-xs hidden md:table-cell">{new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
