'use client'

import { Suspense, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function CallbackHandler({ onError }: { onError: () => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    const userType = searchParams.get('user_type')

    const handleCallback = async () => {
      try {
        if (code) {
          const { data, error: codeErr } = await supabase.auth.exchangeCodeForSession(code)
          if (codeErr) throw codeErr
          if (data.session && userType) {
            await supabase.auth.updateUser({ data: { user_type: userType } })
          }
        }

        const { data: { user }, error: userErr } = await supabase.auth.getUser()
        if (userErr) throw userErr
        if (!user) {
          router.push('/auth/login')
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle()

        router.replace(profile?.full_name ? '/dashboard' : '/onboarding')
      } catch (e) {
        console.error('Auth callback failed', e)
        onError()
      }
    }

    handleCallback()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default function AuthCallback() {
  const router = useRouter()
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="min-h-screen bg-snow flex flex-col items-center justify-center px-6 text-center">
        <div className="w-14 h-14 bg-chestnut/10 rounded-2xl flex items-center justify-center text-2xl mb-4">🎵</div>
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
      <p className="text-graphite font-bold text-base">Confirming your account…</p>
      <p className="text-charcoal text-sm mt-1">You&apos;ll be redirected automatically.</p>
      <Suspense fallback={null}>
        <CallbackHandler onError={() => setFailed(true)} />
      </Suspense>
    </div>
  )
}
