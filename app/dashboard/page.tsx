'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import RestaurantDashboard from './RestaurantDashboard'
import MusicianDashboard from './MusicianDashboard'
import FanDashboard from './FanDashboard'

export default function DashboardPage() {
  const router = useRouter()
  const [userType, setUserType] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, user_type')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile) {
        router.push('/onboarding')
        return
      }

      setUserType(profile.user_type || user.user_metadata?.user_type || 'fan')
      setLoading(false)
    }
    checkUser()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-snow flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-chestnut border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (userType === 'restaurant') return <RestaurantDashboard />
  if (userType === 'musician') return <MusicianDashboard />
  return <FanDashboard />
}
