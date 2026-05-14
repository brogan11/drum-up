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

      const type = user.user_metadata?.user_type
      setUserType(type || 'fan')
      setLoading(false)
    }
    checkUser()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-snow flex items-center justify-center">
        <p className="text-charcoal">Loading...</p>
      </div>
    )
  }

  if (userType === 'restaurant') return <RestaurantDashboard />
  if (userType === 'musician') return <MusicianDashboard />
  return <FanDashboard />
}