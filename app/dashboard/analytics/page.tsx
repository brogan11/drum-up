'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DASH_BG } from '@/lib/analytics'
import MusicianAnalytics from './MusicianAnalytics'
import RestaurantAnalytics from './RestaurantAnalytics'

// Routes to the right analytics view based on the signed-in user's type. Fans don't have
// an analytics page (they don't sell or buy on the marketplace), so they're sent back.
export default function AnalyticsPage() {
  const router = useRouter()
  const [userType, setUserType] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) { router.push('/auth/login'); return }
        const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).maybeSingle()
        if (!profile) { router.push('/onboarding'); return }
        if (profile.user_type !== 'musician' && profile.user_type !== 'restaurant') {
          router.replace('/dashboard')
          return
        }
        setUserType(profile.user_type)
      } catch (err) {
        console.error('Analytics routing failed:', err)
        router.replace('/dashboard')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [router])

  if (loading || !userType) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={DASH_BG}>
        <div className="w-12 h-12 border-4 border-chestnut border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return userType === 'restaurant' ? <RestaurantAnalytics /> : <MusicianAnalytics />
}
