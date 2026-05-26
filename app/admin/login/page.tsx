'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        router.push('/admin/dashboard')
      } else {
        const data = await res.json()
        setError(data.error ?? 'Incorrect password.')
      }
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#FCFAF9' }}>
      <div className="w-full max-w-sm">
        {/* Logo + brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <img src="/orange-drum-up.png" alt="Drum Up" className="w-10 h-10 object-contain" />
            <span className="text-2xl font-black text-graphite tracking-tight">Drum Up</span>
          </div>
          <p className="text-sm font-semibold text-charcoal uppercase tracking-widest">Admin</p>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-8">
          <h1 className="text-xl font-bold text-graphite mb-6">Sign in to dashboard</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-charcoal mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter admin password"
                required
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-snow text-graphite placeholder-charcoal/40 shadow-sm focus:shadow-md focus:outline-none transition-shadow font-medium"
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-red-500 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 rounded-xl bg-chestnut text-white font-bold text-sm tracking-wide hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
