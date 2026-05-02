import { useState } from 'react'
import { authAPI } from '../api'
import { Zap, TrendingUp, Shield, Cpu } from 'lucide-react'

export default function Login({ onLogin }) {
  const [mode, setMode]     = useState('login')
  const [form, setForm]     = useState({ email: '', password: '', fullName: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const fn = mode === 'login' ? authAPI.login : authAPI.register
      const { data } = await fn(form)
      onLogin(data.token, data.user)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 p-12 flex-col justify-between border-r border-slate-800">
        <div className="flex items-center gap-2">
          <Zap className="text-blue-400" size={28} />
          <span className="text-2xl font-bold text-white">TradeX</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Trade smarter,<br />grow faster.
          </h1>
          <p className="text-slate-400 text-lg mb-8">
            Real-time market data, instant trade execution, and advanced portfolio analytics.
          </p>
          <div className="space-y-4">
            {[
              [TrendingUp, 'Real-time price feeds for 10+ stocks across markets'],
              [Shield,     'Bank-grade security with JWT authentication'],
              [Cpu,        'Production-grade microservices on Kubernetes'],
            ].map(([Icon, text]) => (
              <div key={text} className="flex items-start gap-3">
                <div className="mt-0.5 p-1.5 bg-blue-900/40 rounded-lg">
                  <Icon size={16} className="text-blue-400" />
                </div>
                <p className="text-slate-300 text-sm">{text}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-slate-600 text-sm">© 2024 TradeX. Demo application.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <Zap className="text-blue-400" size={24} />
            <span className="text-xl font-bold text-white">TradeX</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            {mode === 'login' ? 'Sign in to your account' : 'Start trading in seconds'}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm text-slate-400 mb-1">Full Name</label>
                <input className="input" type="text" placeholder="Rahul Sharma"
                  value={form.fullName} onChange={e => set('fullName', e.target.value)} />
              </div>
            )}
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <input className="input" type="email" placeholder="you@example.com" required
                value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Password</label>
              <input className="input" type="password" placeholder="Min 8 characters" required
                value={form.password} onChange={e => set('password', e.target.value)} />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-400 text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="btn-primary w-full py-2.5 disabled:opacity-50">
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError('') }}
              className="text-blue-400 hover:text-blue-300 font-medium">
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          <div className="mt-6 p-3 bg-slate-900 rounded-lg border border-slate-800">
            <p className="text-xs text-slate-500 text-center">Demo credentials</p>
            <p className="text-xs text-slate-400 text-center mt-1">Register any email to get ₹1,00,000 virtual balance</p>
          </div>
        </div>
      </div>
    </div>
  )
}
