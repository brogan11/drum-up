'use client'

import { Suspense, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { eqBarStyle } from '@/lib/eq'
import { WaveDivider } from '@/components/WaveDivider'
import { useSearchParams } from 'next/navigation'

const EQ_BARS = 28

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

const COOLDOWN_SECONDS = 60

function ConfirmContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  const [cooldown, setCooldown] = useState(0)
  const [sent, setSent] = useState(false)
  const [resendError, setResendError] = useState('')

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const handleResend = async () => {
    if (cooldown > 0 || !email) return
    setResendError('')
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email })
      if (error) throw error
      setSent(true)
      setCooldown(COOLDOWN_SECONDS)
      setTimeout(() => setSent(false), 3000)
    } catch (e) {
      setResendError(e instanceof Error ? e.message : 'Failed to resend. Try again.')
    }
  }

  return (
    <div className="w-full md:w-1/2 flex items-center justify-center p-8 py-12 relative z-10 overflow-hidden"
      style={{ background: LIGHT_PANEL_BG }}
    >
      <div className="w-full max-w-md relative z-10">

        {/* Envelope icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-chestnut/10 rounded-3xl flex items-center justify-center">
            <svg className="w-10 h-10 text-chestnut" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
        </div>

        <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.35em] mb-3">— Almost There</p>

        <h2 className="text-graphite text-5xl md:text-6xl font-black leading-[0.9] tracking-tight mb-3">
          Check your <span className="text-chestnut italic">inbox.</span>
        </h2>
        <p className="text-charcoal mb-6 text-lg">One more step before you join Drum Up.</p>

        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <p className="text-charcoal text-sm mb-1">We sent a confirmation email to:</p>
          {email && (
            <p className="text-chestnut font-bold text-base break-all">{email}</p>
          )}
          <p className="text-charcoal text-sm mt-3">
            Click the link in that email to activate your account and complete your profile setup.
          </p>
        </div>

        {/* Info checklist */}
        <div className="bg-white/60 rounded-xl shadow-sm px-4 py-3 mb-6 flex flex-col gap-2">
          <div className="flex items-start gap-3 text-sm text-charcoal">
            <span className="shrink-0 mt-0.5">📧</span>
            <span>Check your spam folder if you don&apos;t see it</span>
          </div>
          <div className="flex items-start gap-3 text-sm text-charcoal">
            <span className="shrink-0 mt-0.5">⏱</span>
            <span>The link expires in 1 hour</span>
          </div>
          <div className="flex items-start gap-3 text-sm text-charcoal">
            <span className="shrink-0 mt-0.5">🔒</span>
            <span>For your security, we verify all accounts</span>
          </div>
        </div>

        {/* Resend button */}
        {resendError && (
          <p className="bg-red-100 text-red-600 p-3 rounded-xl mb-3 text-sm">{resendError}</p>
        )}

        <button
          onClick={handleResend}
          disabled={cooldown > 0 || !email}
          className={`w-full py-3.5 rounded-xl font-bold transition-all mb-2 flex items-center justify-center gap-2 ${
            sent
              ? 'bg-teal text-snow shadow-md'
              : cooldown > 0
              ? 'border-2 border-charcoal/20 text-charcoal/40 cursor-not-allowed'
              : 'border-2 border-chestnut text-chestnut hover:bg-chestnut hover:text-snow'
          }`}
        >
          {sent ? (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Sent!
            </>
          ) : cooldown > 0 ? (
            <span className="font-mono">Resend in {cooldown}s…</span>
          ) : (
            'Resend confirmation email'
          )}
        </button>

        <p className="text-center text-charcoal/60 text-sm mt-4">
          Wrong email?{' '}
          <a href="/auth/signup" className="text-chestnut font-bold hover:underline">
            Sign up again
          </a>
        </p>
      </div>
    </div>
  )
}

export default function ConfirmPage() {
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
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-chestnut/20 text-chestnut text-lg shrink-0">♪</span>
              <span className="text-snow/90 text-sm">Musicians find venues looking for live music</span>
            </div>
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-teal/25 text-base shrink-0">🍽</span>
              <span className="text-snow/90 text-sm">Restaurants post availability and book talent</span>
            </div>
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-chestnut/20 text-chestnut text-lg shrink-0">★</span>
              <span className="text-snow/90 text-sm">Fans discover who is playing where tonight</span>
            </div>
          </div>
        </div>
      </div>

      <WaveDivider />

      <Suspense fallback={
        <div className="w-full md:w-1/2 flex items-center justify-center" style={{ background: LIGHT_PANEL_BG }}>
          <div className="w-8 h-8 border-4 border-chestnut border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <ConfirmContent />
      </Suspense>
    </div>
  )
}
