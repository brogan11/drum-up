'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [userType, setUserType] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async () => {
    if (!userType) {
      setError('Please select an account type')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { user_type: userType }
      }
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* Left Side */}
      <div className="hidden md:flex w-1/2 bg-graphite flex-col items-center justify-center p-12">
        <h1 className="text-chestnut text-5xl font-bold mb-4">Drum Up</h1>
        <p className="text-snow text-xl text-center mb-8">
          Connecting restaurants and live music
        </p>
        <div className="border-t border-charcoal w-16 mb-8" />
        <div className="flex flex-col gap-4 text-snow text-sm">
          <div className="flex items-center gap-3">
            <span className="text-teal text-lg">♪</span>
            <span>Musicians find venues looking for live music</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-teal text-lg">🍽</span>
            <span>Restaurants post availability and book talent</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-teal text-lg">★</span>
            <span>Fans discover who is playing where tonight</span>
          </div>
        </div>
      </div>

      {/* Decorative Divider */}
      <div className="hidden md:flex flex-col items-center justify-center relative z-10 -mx-6">
        <div className="w-px bg-charcoal flex-1 opacity-30" />
        <div className="bg-graphite border-2 border-chestnut rounded-full w-12 h-12 flex items-center justify-center shadow-lg my-2 shrink-0">
          <span className="text-chestnut text-lg font-bold">♪</span>
        </div>
        <div className="w-px bg-charcoal flex-1 opacity-30" />
      </div>

      {/* Right Side */}
      <div className="w-full md:w-1/2 bg-[#fcf7f2] flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h2 className="text-graphite text-3xl font-bold mb-2">Join Drum Up</h2>
          <p className="text-charcoal mb-6">Create your free account today</p>

          {error && (
            <p className="bg-red-100 text-red-600 p-3 rounded-xl mb-4">{error}</p>
          )}

          <label className="block text-charcoal font-medium mb-2">I am a...</label>
          <div className="flex gap-3 mb-6">
            {['restaurant', 'musician', 'fan'].map(type => (
              <button
                key={type}
                onClick={() => setUserType(type)}
                className={`flex-1 py-2 rounded-xl capitalize font-medium transition-all shadow-sm ${
                  userType === type
                    ? 'bg-chestnut text-snow shadow-md'
                    : 'bg-white text-charcoal hover:shadow-md'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <label className="block text-charcoal font-medium mb-2">Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-white rounded-xl px-4 py-3 mb-4 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none"
          />

          <label className="block text-charcoal font-medium mb-2">Password</label>
          <input
            type="password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-white rounded-xl px-4 py-3 mb-6 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none"
          />

          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full bg-chestnut text-snow py-3 rounded-xl font-bold shadow-md hover:shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="text-center text-charcoal mt-6">
            Already have an account?{' '}
            <a href="/auth/login" className="text-chestnut font-medium hover:underline">
              Log in
            </a>
          </p>
        </div>
      </div>

    </div>
  )
}