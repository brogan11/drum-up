'use client'

import { Suspense, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    const userType = searchParams.get('user_type')

    const handleCallback = async () => {
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error && data.session && userType) {
          await supabase.auth.updateUser({ data: { user_type: userType } })
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      router.push(profile ? '/dashboard' : '/onboarding')
    }

    handleCallback()
  }, [])

  return null
}

export default function AuthCallback() {
  return (
    <div className="min-h-screen bg-snow flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-chestnut border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-charcoal">Completing sign in...</p>
      </div>
      <Suspense fallback={null}>
        <CallbackHandler />
      </Suspense>
    </div>
  )
}
