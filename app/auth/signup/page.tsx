'use client'

import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { eqBarStyle } from '@/lib/eq'
import { WaveDivider } from '@/components/WaveDivider'
import { useRouter } from 'next/navigation'

const EQ_BARS = 28

const USER_TYPE_ICONS: Record<string, React.ReactNode> = {
  restaurant: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
  ),
  musician: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
  ),
  fan: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
  ),
}

const USER_TYPES = [
  { key: 'restaurant', label: 'Restaurant' },
  { key: 'musician',   label: 'Musician'   },
  { key: 'fan',        label: 'Fan'        },
]

const DARK_PANEL_BG = `
  radial-gradient(ellipse 60% 50% at 12% 10%, rgba(108, 154, 139, 0.14), transparent 70%),
  radial-gradient(ellipse 60% 50% at 12% 90%, rgba(220, 127, 65, 0.18), transparent 70%),
  #333333
`

const LIGHT_PANEL_BG = `
  radial-gradient(ellipse 60% 50% at 88% 10%, rgba(108, 154, 139, 0.11), transparent 70%),
  radial-gradient(ellipse 60% 50% at 88% 90%, rgba(220, 127, 65, 0.14), transparent 70%),
  #E8E4E0
`

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [userType, setUserType] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleSignup = async () => {
    if (!userType) {
      setError('Please select an account type')
      return
    }
    setLoading(true)
    setError('')
    try {
      console.log('[Signup] Creating account with user_type:', userType)
      const { data, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { user_type: userType },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (authErr) throw authErr
      if (data.session) {
        // Email confirmation is disabled — session returned immediately
        router.replace('/onboarding')
      } else {
        // Email confirmation required — store user ID so confirm page can poll
        if (data.user?.id) {
          sessionStorage.setItem('drumup_pending_uid', data.user.id)
        }
        router.replace(`/auth/confirm?email=${encodeURIComponent(email)}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign up failed. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    if (!userType) {
      setError('Please select an account type first')
      return
    }
    setGoogleLoading(true)
    setError('')
    try {
      const { error: authErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?user_type=${userType}`,
        },
      })
      if (authErr) throw authErr
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Google sign-up failed. Please try again.'
      setError(msg)
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex relative overflow-hidden">

      {/* LEFT — dark stage panel */}
      <div
        className="hidden md:flex w-1/2 flex-col items-center justify-center p-12 relative z-10 overflow-hidden"
        style={{ background: DARK_PANEL_BG }}
      >

        {/* Equalizer bars */}
        <div className="absolute inset-x-0 bottom-0 top-1/2 flex items-end justify-around opacity-[0.12] pointer-events-none">
          {Array.from({ length: EQ_BARS }).map((_, i) => (
            <div
              key={i}
              className="eq-bar w-2 bg-chestnut rounded-t"
              style={eqBarStyle(i, 19)}
            />
          ))}
        </div>

        {/* Live indicator top-left */}
        <div className="absolute top-8 left-8 flex items-center gap-2.5 z-10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chestnut opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-chestnut" />
          </span>
          <p className="text-teal text-[10px] font-bold uppercase tracking-[0.3em]">Now Booking</p>
        </div>

        <div className="relative z-10 flex flex-col items-center max-w-md">
          <div className="bg-white rounded-2xl p-3 mb-5 shadow-2xl">
            <img src="/orange-drum-up.png" alt="Drum Up" className="w-20 h-20 object-contain" />
          </div>
          <h1 className="text-snow text-5xl font-black tracking-tight mb-4">Drum Up</h1>
          <p className="text-snow/80 text-xl text-center mb-8 max-w-sm">
            Connecting restaurants and live music
          </p>
          <div className="h-[3px] w-16 bg-chestnut mb-8 rounded-full" />

          <div className="flex flex-col gap-3 w-full">
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-chestnut/20 shrink-0">
                <svg className="w-5 h-5 text-chestnut" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </span>
              <span className="text-snow/90 text-sm">Musicians find venues looking for live music</span>
            </div>
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-teal/25 shrink-0">
                <svg className="w-5 h-5 text-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
              </span>
              <span className="text-snow/90 text-sm">Restaurants post availability and book talent</span>
            </div>
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-chestnut/20 shrink-0">
                <svg className="w-5 h-5 text-chestnut" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </span>
              <span className="text-snow/90 text-sm">Fans discover who is playing where tonight</span>
            </div>
          </div>
        </div>
      </div>

      <WaveDivider />

      {/* RIGHT — form panel */}
      <div
        className="w-full md:w-1/2 flex items-center justify-center p-8 py-12 relative z-10 overflow-hidden"
        style={{ background: LIGHT_PANEL_BG }}
      >
        <div className="w-full max-w-md relative z-10">

          <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.35em] mb-3">— Get on the Bill</p>

          <h2 className="text-graphite text-5xl md:text-6xl font-black leading-[0.9] tracking-tight mb-3">
            Join <span className="text-chestnut italic">Drum Up.</span>
          </h2>
          <p className="text-charcoal mb-8 text-lg">Create your free account today</p>

          {error && (
            <p className="bg-red-100 text-red-600 p-3 rounded-xl mb-4 text-sm">{error}</p>
          )}

          <label className="block text-charcoal font-semibold text-sm mb-2">I am a...</label>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {USER_TYPES.map(({ key, label }) => {
              const active = userType === key
              return (
                <button
                  key={key}
                  onClick={() => setUserType(key)}
                  className={`relative py-4 rounded-xl font-bold transition-all shadow-sm flex flex-col items-center gap-1.5 ${
                    active
                      ? 'bg-chestnut text-snow shadow-md scale-[1.02]'
                      : 'bg-white text-charcoal hover:shadow-md'
                  }`}
                >
                  <span className={active ? 'text-snow' : 'text-chestnut'}>{USER_TYPE_ICONS[key]}</span>
                  <span className="text-sm">{label}</span>
                </button>
              )
            })}
          </div>

          <button
            onClick={handleGoogleSignup}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-white py-3.5 rounded-xl font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-50 text-graphite mb-4"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {googleLoading ? 'Redirecting...' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-charcoal/20" />
            <span className="text-charcoal/60 text-xs uppercase tracking-widest font-bold">or</span>
            <div className="flex-1 h-px bg-charcoal/20" />
          </div>

          <label className="block text-charcoal font-semibold text-sm mb-2">Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-white rounded-xl px-4 py-3.5 mb-4 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none"
          />

          <label className="block text-charcoal font-semibold text-sm mb-2">Password</label>
          <input
            type="password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-white rounded-xl px-4 py-3.5 mb-6 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none"
          />

          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full bg-chestnut text-snow py-3.5 rounded-xl font-bold shadow-md hover:shadow-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
          >
            {loading
              ? <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Creating account…</>
              : <>Create Account <span className="group-hover:translate-x-1 transition-transform">→</span></>}
          </button>

          <p className="text-center text-charcoal mt-6 text-sm">
            Already have an account?{' '}
            <a href="/auth/login" className="text-chestnut font-bold hover:underline">
              Log in
            </a>
          </p>
        </div>
      </div>

    </div>
  )
}
