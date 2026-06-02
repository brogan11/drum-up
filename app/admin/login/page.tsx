'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [needsCode, setNeedsCode] = useState(false)
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
        body: JSON.stringify({ password, code: code || undefined }),
      })
      if (res.ok) {
        router.push('/admin/dashboard')
      } else {
        const data = await res.json() as { error?: string; needsCode?: boolean }
        if (data.needsCode) setNeedsCode(true)
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

            {needsCode && (
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-1.5">
                  Authenticator code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-snow text-graphite placeholder-charcoal/40 shadow-sm focus:shadow-md focus:outline-none transition-shadow font-medium tracking-[0.3em] text-center"
                />
                <p className="text-xs text-charcoal/60 mt-1.5">Enter the 6-digit code from your authenticator app.</p>
              </div>
            )}

            {error && (
              <p className="text-sm font-medium text-red-500 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password || (needsCode && code.length !== 6)}
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
