'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex relative overflow-hidden">

      {/* Left Side */}
      <div className="hidden md:flex w-1/2 bg-graphite flex-col items-center justify-center p-12 relative z-10">
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

      {/* Animated Wave Divider */}
      <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-0 h-full z-20" style={{ width: '80px' }}>
        <svg
          width="80"
          height="100%"
          viewBox="0 0 80 900"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ height: '100%', width: '100%' }}
        >
          <path
            d="M40 0 C 65 15, 15 35, 40 50 C 65 65, 15 85, 40 100 C 65 115, 15 135, 40 150 C 65 165, 15 185, 40 200 C 65 215, 15 235, 40 250 C 65 265, 15 285, 40 300 C 65 315, 15 335, 40 350 C 65 365, 15 385, 40 400 C 65 415, 15 435, 40 450 C 65 465, 15 485, 40 500 C 65 515, 15 535, 40 550 C 65 565, 15 585, 40 600 C 65 615, 15 635, 40 650 C 65 665, 15 685, 40 700 C 65 715, 15 735, 40 750 C 65 765, 15 785, 40 800 C 65 815, 15 835, 40 850 C 65 865, 15 885, 40 900 C 65 915, 15 935, 40 950 C 65 965, 15 985, 40 1000 C 65 1015, 15 1035, 40 1050 L 80 1050 L 80 0 Z"
            fill="#E8E4E0"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 -150; 0 0"
              dur="2s"
              repeatCount="indefinite"
            />
          </path>
          <path
            d="M40 0 C 65 15, 15 35, 40 50 C 65 65, 15 85, 40 100 C 65 115, 15 135, 40 150 C 65 165, 15 185, 40 200 C 65 215, 15 235, 40 250 C 65 265, 15 285, 40 300 C 65 315, 15 335, 40 350 C 65 365, 15 385, 40 400 C 65 415, 15 435, 40 450 C 65 465, 15 485, 40 500 C 65 515, 15 535, 40 550 C 65 565, 15 585, 40 600 C 65 615, 15 635, 40 650 C 65 665, 15 685, 40 700 C 65 715, 15 735, 40 750 C 65 765, 15 785, 40 800 C 65 815, 15 835, 40 850 C 65 865, 15 885, 40 900 C 65 915, 15 935, 40 950 C 65 965, 15 985, 40 1000 C 65 1015, 15 1035, 40 1050 L 0 1050 L 0 0 Z"
            fill="#333333"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 -150; 0 0"
              dur="2s"
              repeatCount="indefinite"
            />
          </path>
          <path
            d="M40 0 C 65 15, 15 35, 40 50 C 65 65, 15 85, 40 100 C 65 115, 15 135, 40 150 C 65 165, 15 185, 40 200 C 65 215, 15 235, 40 250 C 65 265, 15 285, 40 300 C 65 315, 15 335, 40 350 C 65 365, 15 385, 40 400 C 65 415, 15 435, 40 450 C 65 465, 15 485, 40 500 C 65 515, 15 535, 40 550 C 65 565, 15 585, 40 600 C 65 615, 15 635, 40 650 C 65 665, 15 685, 40 700 C 65 715, 15 735, 40 750 C 65 765, 15 785, 40 800 C 65 815, 15 835, 40 850 C 65 865, 15 885, 40 900 C 65 915, 15 935, 40 950 C 65 965, 15 985, 40 1000 C 65 1015, 15 1035, 40 1050"
            fill="none"
            stroke="#DC7F41"
            strokeWidth="2.5"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values="0 -150; 0 0"
              dur="2s"
              repeatCount="indefinite"
            />
          </path>
        </svg>
      </div>

      {/* Right Side */}
      <div className="w-full md:w-1/2 bg-[#E8E4E0] flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-md">
          <h2 className="text-graphite text-3xl font-bold mb-2">Welcome Back</h2>
          <p className="text-charcoal mb-6">Log in to your Drum Up account</p>

          {error && (
            <p className="bg-red-100 text-red-600 p-3 rounded-xl mb-4">{error}</p>
          )}

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
            placeholder="Your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-white rounded-xl px-4 py-3 mb-6 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none"
          />

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-chestnut text-snow py-3 rounded-xl font-bold shadow-md hover:shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>

          <p className="text-center text-charcoal mt-6">
            Don't have an account?{' '}
            <a href="/auth/signup" className="text-chestnut font-medium hover:underline">
              Sign up
            </a>
          </p>
        </div>
      </div>

    </div>
  )
}