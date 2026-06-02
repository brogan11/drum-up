'use client'

import { Suspense, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

type Status = 'loading' | 'confirmed' | 'failed'

type Result =
  | { type: 'confirmed' }
  | { type: 'failed' }
  | { type: 'redirect'; to: string }

function CallbackHandler({ onResult }: { onResult: (result: Result) => void }) {
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    const userType = searchParams.get('user_type')

    const handleCallback = async () => {
      try {
        if (code) {
          const { error: codeErr } = await supabase.auth.exchangeCodeForSession(code)
          if (codeErr) throw codeErr
        }

        const { data: { user }, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw userErr
        if (!user) {
          onResult({ type: 'failed' })
          return
        }

        // How did this user authenticate? Email confirmation links use the
        // 'email' provider; Google sign-in/up uses 'google' (an OAuth provider).
        const provider = user.app_metadata?.provider
        const isOAuth = !!provider && provider !== 'email'

        if (isOAuth) {
          // First Google sign-up carries the chosen role in ?user_type=. Persist
          // it to auth metadata if the account doesn't already have one.
          if (userType && !user.user_metadata?.user_type) {
            await supabase.auth.updateUser({ data: { user_type: userType } })
          }

          // OAuth users are already fully signed in — there is no password to
          // create and nothing to "log in" with. Send them straight into the
          // app: onboarding if they're new, dashboard if they already have a
          // profile.
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .maybeSingle()

          onResult({ type: 'redirect', to: profile ? '/dashboard' : '/onboarding' })
          return
        }

        // Email confirmation flow — the user still needs to log in with the
        // password they set at signup.
        onResult({ type: 'confirmed' })
      } catch (e) {
        console.error('Auth callback failed', e)
        onResult({ type: 'failed' })
      }
    }

    handleCallback()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('loading')

  const handleResult = (result: Result) => {
    if (result.type === 'redirect') {
      router.replace(result.to)
      return
    }
    setStatus(result.type)
  }

  if (status === 'confirmed') {
    return (
      <div className="min-h-screen bg-snow flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 bg-teal/10 rounded-2xl flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <p className="text-graphite font-black text-2xl mb-2">Email confirmed!</p>
        <p className="text-charcoal text-sm mb-8">Your account is ready. Log in to complete your profile.</p>
        <button
          onClick={() => router.push('/auth/login')}
          className="bg-chestnut text-snow px-8 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
        >
          Log In →
        </button>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="min-h-screen bg-snow flex flex-col items-center justify-center px-6 text-center">
        <div className="w-14 h-14 bg-chestnut/10 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-chestnut" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </div>
        <p className="text-graphite font-bold text-lg mb-1">Sign-in didn&apos;t complete</p>
        <p className="text-charcoal text-sm mb-6">Something went wrong during authentication. Please try again.</p>
        <button
          onClick={() => router.push('/auth/login')}
          className="bg-chestnut text-snow px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
        >
          Back to Login
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-snow flex flex-col items-center justify-center">
      <div className="bg-white rounded-2xl p-3 mb-6 shadow-xl">
        <img src="/orange-drum-up.png" alt="Drum Up" className="w-16 h-16 object-contain" />
      </div>
      <div className="w-10 h-10 border-4 border-chestnut border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-graphite font-bold text-base">Signing you in…</p>
      <p className="text-charcoal text-sm mt-1">Just a moment.</p>
      <Suspense fallback={null}>
        <CallbackHandler onResult={handleResult} />
      </Suspense>
    </div>
  )
}
